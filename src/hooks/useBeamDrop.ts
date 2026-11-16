import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileManifestItem,
  IncomingOfferBatch,
  PeerInfo,
  TransferRecord,
  TransportMode,
} from '../types/transfer';
import {
  IncrementalCRC32,
  detectDeviceInfo,
  getFileCategory,
} from '../utils/crc32';

const CHUNK_SIZE = 64 * 1024; // 64 KB — universally safe for WebRTC SCTP on iOS Safari, Android Chrome, and Desktop
const DC_HIGH_WATER_MARK = 1024 * 1024; // 1 MB
const DC_LOW_WATER_THRESHOLD = 256 * 1024; // 256 KB
const WEBRTC_CONNECT_TIMEOUT_MS = 3500;

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface ActiveReceiveState {
  transferId: string;
  batchId: string;
  peerId: string;
  peerName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: TransferRecord['category'];
  chunks: Uint8Array[];
  receivedBytes: number;
  expectedChunkIndex: number;
  crc: IncrementalCRC32;
  startedAt: number;
  lastSpeedAt: number;
  lastSpeedBytes: number;
  transport: TransportMode;
  pendingCompletion?: {
    totalBytes: number;
    crc32: string;
  };
}

interface PendingOutgoingBatch {
  batchId: string;
  targetPeer: PeerInfo;
  files: { manifest: FileManifestItem; file: File }[];
}

function encodeDataChunk(transferId: string, chunkIndex: number, payload: Uint8Array): Uint8Array {
  const tidBytes = new TextEncoder().encode(transferId);
  const frame = new Uint8Array(1 + tidBytes.length + 4 + payload.length);
  frame[0] = tidBytes.length;
  frame.set(tidBytes, 1);
  const view = new DataView(frame.buffer);
  view.setUint32(1 + tidBytes.length, chunkIndex, false);
  frame.set(payload, 1 + tidBytes.length + 4);
  return frame;
}

function encodeWsRelayChunk(targetId: string, dataFrame: Uint8Array): Uint8Array {
  const targetBytes = new TextEncoder().encode(targetId);
  const packet = new Uint8Array(1 + targetBytes.length + dataFrame.length);
  packet[0] = targetBytes.length;
  packet.set(targetBytes, 1);
  packet.set(dataFrame, 1 + targetBytes.length);
  return packet;
}

function decodeDataChunk(buffer: ArrayBuffer): { transferId: string; chunkIndex: number; payload: Uint8Array } | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 6) return null;
  const tidLen = bytes[0];
  if (bytes.length < 1 + tidLen + 4) return null;
  const transferId = new TextDecoder().decode(bytes.subarray(1, 1 + tidLen));
  const view = new DataView(buffer);
  const chunkIndex = view.getUint32(1 + tidLen, false);
  const payload = bytes.subarray(1 + tidLen + 4);
  return { transferId, chunkIndex, payload };
}

function triggerBrowserDownload(blobUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
  }, 150);
}

export function useBeamDrop() {
  const initialDevice = useMemo(() => detectDeviceInfo(), []);

  const [wsConnected, setWsConnected] = useState(false);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [deviceName, setDeviceNameState] = useState<string>(initialDevice.name);
  const [nearbyPeers, setNearbyPeers] = useState<PeerInfo[]>([]);
  const [roomPeers, setRoomPeers] = useState<PeerInfo[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [incomingOffers, setIncomingOffers] = useState<IncomingOfferBatch[]>([]);
  const [autoAccept, setAutoAccept] = useState<boolean>(false);
  const [autoDownload, setAutoDownload] = useState<boolean>(true);
  const [roomError, setRoomError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const deviceNameRef = useRef<string>(initialDevice.name);
  const autoAcceptRef = useRef<boolean>(false);
  const autoDownloadRef = useRef<boolean>(true);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const cancelledTransfersRef = useRef<Set<string>>(new Set());

  const outgoingBatchesRef = useRef<Map<string, PendingOutgoingBatch>>(new Map());
  const receivingRef = useRef<Map<string, ActiveReceiveState>>(new Map());

  useEffect(() => {
    autoAcceptRef.current = autoAccept;
  }, [autoAccept]);

  useEffect(() => {
    autoDownloadRef.current = autoDownload;
  }, [autoDownload]);

  const sendWsJson = useCallback((payload: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const updateTransfer = useCallback((transferId: string, patch: Partial<TransferRecord>) => {
    setTransfers((prev) =>
      prev.map((item) => (item.transferId === transferId ? { ...item, ...patch } : item))
    );
  }, []);

  const finalizeReceive = useCallback(
    (state: ActiveReceiveState, expectedBytes: number, expectedCrc: string) => {
      const actualCrc = state.crc.digestHex();
      const sizeMatch = state.receivedBytes === expectedBytes;
      const crcMatch = actualCrc === expectedCrc;
      const verified = sizeMatch && crcMatch;

      const blobParts = state.chunks.map((c) => c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength) as ArrayBuffer);
      const blob = new Blob(blobParts, { type: state.mimeType || 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);

      state.chunks = [];
      receivingRef.current.delete(state.transferId);

      updateTransfer(state.transferId, {
        bytesTransferred: state.receivedBytes,
        speedBps: 0,
        etaSeconds: 0,
        status: verified ? 'completed' : 'error',
        crc32Expected: expectedCrc,
        crc32Actual: actualCrc,
        verifiedLossless: verified,
        blobUrl,
        completedAt: Date.now(),
        errorMessage: verified
          ? undefined
          : `Checksum mismatch (expected ${expectedCrc}, got ${actualCrc})`,
      });

      if (verified && autoDownloadRef.current) {
        triggerBrowserDownload(blobUrl, state.fileName);
      }

      sendWsJson({
        type: 'transfer:ack',
        targetId: state.peerId,
        transferId: state.transferId,
        verified,
        crc32: actualCrc,
      });
    },
    [sendWsJson, updateTransfer]
  );

  const handleIncomingBinaryFrame = useCallback(
    (buffer: ArrayBuffer, transport: TransportMode) => {
      const decoded = decodeDataChunk(buffer);
      if (!decoded) return;

      const { transferId, chunkIndex, payload } = decoded;
      if (cancelledTransfersRef.current.has(transferId)) return;

      const state = receivingRef.current.get(transferId);
      if (!state) return;

      if (chunkIndex !== state.expectedChunkIndex) {
        return;
      }

      const copy = new Uint8Array(payload.length);
      copy.set(payload);
      state.chunks.push(copy);
      state.crc.update(copy);
      state.receivedBytes += copy.length;
      state.expectedChunkIndex += 1;
      state.transport = transport;

      const now = performance.now();
      const elapsedSinceSample = (now - state.lastSpeedAt) / 1000;
      if (elapsedSinceSample >= 0.2 || state.receivedBytes >= state.fileSize) {
        const deltaBytes = state.receivedBytes - state.lastSpeedBytes;
        const instantSpeed = elapsedSinceSample > 0 ? deltaBytes / elapsedSinceSample : 0;
        const totalElapsed = Math.max((now - state.startedAt) / 1000, 0.05);
        const avgSpeed = state.receivedBytes / totalElapsed;
        const speedBps = instantSpeed > 0 ? instantSpeed * 0.6 + avgSpeed * 0.4 : avgSpeed;
        const remaining = Math.max(state.fileSize - state.receivedBytes, 0);
        const etaSeconds = speedBps > 0 ? remaining / speedBps : null;

        state.lastSpeedAt = now;
        state.lastSpeedBytes = state.receivedBytes;

        updateTransfer(transferId, {
          bytesTransferred: state.receivedBytes,
          speedBps,
          etaSeconds,
          status: state.receivedBytes >= state.fileSize ? 'verifying' : 'transferring',
          transport,
        });
      }

      if (state.pendingCompletion && state.receivedBytes >= state.pendingCompletion.totalBytes) {
        finalizeReceive(
          state,
          state.pendingCompletion.totalBytes,
          state.pendingCompletion.crc32
        );
      }
    },
    [finalizeReceive, updateTransfer]
  );

  const setupDataChannel = useCallback(
    (peerId: string, dc: RTCDataChannel) => {
      dc.binaryType = 'arraybuffer';
      dc.bufferedAmountLowThreshold = DC_LOW_WATER_THRESHOLD;

      dc.onopen = () => {
        dataChannelsRef.current.set(peerId, dc);
      };

      dc.onclose = () => {
        if (dataChannelsRef.current.get(peerId) === dc) {
          dataChannelsRef.current.delete(peerId);
        }
      };

      dc.onerror = () => {
        if (dataChannelsRef.current.get(peerId) === dc) {
          dataChannelsRef.current.delete(peerId);
        }
      };

      dc.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          handleIncomingBinaryFrame(event.data, 'webrtc-p2p');
        } else if (event.data instanceof Blob) {
          event.data.arrayBuffer().then((buf) => {
            handleIncomingBinaryFrame(buf, 'webrtc-p2p');
          });
        }
      };
    },
    [handleIncomingBinaryFrame]
  );

  const createPeerConnection = useCallback(
    (peerId: string, isInitiator: boolean) => {
      const existing = peerConnectionsRef.current.get(peerId);
      if (existing && existing.connectionState !== 'failed' && existing.connectionState !== 'closed') {
        return existing;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current.set(peerId, pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWsJson({
            type: 'webrtc:ice',
            targetId: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peerConnectionsRef.current.delete(peerId);
          dataChannelsRef.current.delete(peerId);
        }
      };

      if (isInitiator) {
        const dc = pc.createDataChannel('beamdrop', { ordered: true });
        setupDataChannel(peerId, dc);
      } else {
        pc.ondatachannel = (event) => {
          setupDataChannel(peerId, event.channel);
        };
      }

      return pc;
    },
    [sendWsJson, setupDataChannel]
  );

  const waitForDataChannelOrFallback = useCallback(
    async (peerId: string): Promise<RTCDataChannel | null> => {
      const existingDc = dataChannelsRef.current.get(peerId);
      if (existingDc && existingDc.readyState === 'open') {
        return existingDc;
      }

      try {
        const pc = createPeerConnection(peerId, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWsJson({
          type: 'webrtc:offer',
          targetId: peerId,
          sdp: pc.localDescription,
        });
      } catch {
        return null;
      }

      const started = Date.now();
      while (Date.now() - started < WEBRTC_CONNECT_TIMEOUT_MS) {
        const dc = dataChannelsRef.current.get(peerId);
        if (dc && dc.readyState === 'open') {
          return dc;
        }
        const pc = peerConnectionsRef.current.get(peerId);
        if (pc && (pc.connectionState === 'failed' || pc.iceConnectionState === 'failed')) {
          return null;
        }
        await new Promise((r) => setTimeout(r, 80));
      }
      return null;
    },
    [createPeerConnection, sendWsJson]
  );

  const executeOutgoingBatch = useCallback(
    async (batch: PendingOutgoingBatch, acceptedIds: string[]) => {
      const targetId = batch.targetPeer.id;
      const acceptedSet = new Set(acceptedIds);
      const filesToSend = batch.files.filter((f) => acceptedSet.has(f.manifest.transferId));

      for (const item of batch.files) {
        if (!acceptedSet.has(item.manifest.transferId)) {
          updateTransfer(item.manifest.transferId, { status: 'declined' });
        }
      }

      if (filesToSend.length === 0) return;

      for (const item of filesToSend) {
        updateTransfer(item.manifest.transferId, { status: 'connecting' });
      }

      const dc = await waitForDataChannelOrFallback(targetId);
      const transport: TransportMode = dc && dc.readyState === 'open' ? 'webrtc-p2p' : 'ws-relay';

      for (const { manifest, file } of filesToSend) {
        const transferId = manifest.transferId;
        if (cancelledTransfersRef.current.has(transferId)) {
          updateTransfer(transferId, { status: 'cancelled' });
          continue;
        }

        const crc = new IncrementalCRC32();
        const startedAt = performance.now();
        let lastSpeedAt = startedAt;
        let lastSpeedBytes = 0;
        let offset = 0;
        let chunkIndex = 0;

        updateTransfer(transferId, {
          status: 'transferring',
          transport,
        });

        try {
          while (offset < file.size) {
            if (cancelledTransfersRef.current.has(transferId)) {
              sendWsJson({ type: 'transfer:cancel', targetId, transferId });
              updateTransfer(transferId, { status: 'cancelled' });
              break;
            }

            const end = Math.min(offset + CHUNK_SIZE, file.size);
            const sliceBuffer = await file.slice(offset, end).arrayBuffer();
            const chunkBytes = new Uint8Array(sliceBuffer);
            crc.update(chunkBytes);

            const dataFrame = encodeDataChunk(transferId, chunkIndex, chunkBytes);

            let activeTransport: TransportMode = transport;
            const liveDc = dataChannelsRef.current.get(targetId);

            if (activeTransport === 'webrtc-p2p' && liveDc && liveDc.readyState === 'open') {
              if (liveDc.bufferedAmount > DC_HIGH_WATER_MARK) {
                await new Promise<void>((resolve) => {
                  const onLow = () => {
                    liveDc.removeEventListener('bufferedamountlow', onLow);
                    resolve();
                  };
                  liveDc.addEventListener('bufferedamountlow', onLow);
                  setTimeout(() => {
                    liveDc.removeEventListener('bufferedamountlow', onLow);
                    resolve();
                  }, 400);
                });
              }
              liveDc.send(dataFrame.buffer as ArrayBuffer);
            } else {
              activeTransport = 'ws-relay';
              const ws = wsRef.current;
              if (!ws || ws.readyState !== WebSocket.OPEN) {
                throw new Error('Connection lost during transfer.');
              }
              while (ws.bufferedAmount > 2 * 1024 * 1024) {
                await new Promise((r) => setTimeout(r, 16));
              }
              const relayPacket = encodeWsRelayChunk(targetId, dataFrame);
              ws.send(relayPacket.buffer as ArrayBuffer);
            }

            offset = end;
            chunkIndex += 1;

            const now = performance.now();
            const elapsedSinceSample = (now - lastSpeedAt) / 1000;
            if (elapsedSinceSample >= 0.2 || offset >= file.size) {
              const deltaBytes = offset - lastSpeedBytes;
              const instantSpeed = elapsedSinceSample > 0 ? deltaBytes / elapsedSinceSample : 0;
              const totalElapsed = Math.max((now - startedAt) / 1000, 0.05);
              const avgSpeed = offset / totalElapsed;
              const speedBps = instantSpeed > 0 ? instantSpeed * 0.6 + avgSpeed * 0.4 : avgSpeed;
              const remaining = Math.max(file.size - offset, 0);
              const etaSeconds = speedBps > 0 ? remaining / speedBps : null;

              lastSpeedAt = now;
              lastSpeedBytes = offset;

              updateTransfer(transferId, {
                bytesTransferred: offset,
                speedBps,
                etaSeconds,
                transport: activeTransport,
                status: offset >= file.size ? 'verifying' : 'transferring',
              });
            }
          }

          if (!cancelledTransfersRef.current.has(transferId)) {
            const finalCrc = crc.digestHex();
            updateTransfer(transferId, {
              bytesTransferred: file.size,
              speedBps: 0,
              etaSeconds: 0,
              status: 'verifying',
              crc32Expected: finalCrc,
            });
            sendWsJson({
              type: 'transfer:complete',
              targetId,
              transferId,
              totalBytes: file.size,
              totalChunks: chunkIndex,
              crc32: finalCrc,
            });
          }
        } catch (err) {
          updateTransfer(transferId, {
            status: 'error',
            errorMessage: err instanceof Error ? err.message : 'Transfer interrupted',
          });
        }
      }

      outgoingBatchesRef.current.delete(batch.batchId);
    },
    [sendWsJson, updateTransfer, waitForDataChannelOrFallback]
  );

  const acceptOfferBatch = useCallback(
    (batch: IncomingOfferBatch) => {
      const now = Date.now();
      const acceptedIds: string[] = [];

      const newRecords: TransferRecord[] = batch.files.map((f) => {
        acceptedIds.push(f.transferId);
        receivingRef.current.set(f.transferId, {
          transferId: f.transferId,
          batchId: batch.batchId,
          peerId: batch.fromPeer.id,
          peerName: batch.fromPeer.name,
          fileName: f.name,
          fileSize: f.size,
          mimeType: f.mimeType,
          category: f.category,
          chunks: [],
          receivedBytes: 0,
          expectedChunkIndex: 0,
          crc: new IncrementalCRC32(),
          startedAt: performance.now(),
          lastSpeedAt: performance.now(),
          lastSpeedBytes: 0,
          transport: 'webrtc-p2p',
        });

        return {
          transferId: f.transferId,
          batchId: batch.batchId,
          peerId: batch.fromPeer.id,
          peerName: batch.fromPeer.name,
          direction: 'receive',
          fileName: f.name,
          fileSize: f.size,
          mimeType: f.mimeType,
          category: f.category,
          bytesTransferred: 0,
          speedBps: 0,
          etaSeconds: null,
          status: 'connecting',
          transport: 'webrtc-p2p',
          verifiedLossless: false,
          createdAt: now,
        };
      });

      setTransfers((prev) => [...newRecords, ...prev]);
      setIncomingOffers((prev) => prev.filter((o) => o.batchId !== batch.batchId));

      sendWsJson({
        type: 'transfer:accept',
        targetId: batch.fromPeer.id,
        batchId: batch.batchId,
        acceptedIds,
      });
    },
    [sendWsJson]
  );

  const declineOfferBatch = useCallback(
    (batch: IncomingOfferBatch) => {
      setIncomingOffers((prev) => prev.filter((o) => o.batchId !== batch.batchId));
      sendWsJson({
        type: 'transfer:decline',
        targetId: batch.fromPeer.id,
        batchId: batch.batchId,
      });
    },
    [sendWsJson]
  );

  useEffect(() => {
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        const urlRoom = new URLSearchParams(window.location.search).get('room')?.replace(/\D/g, '').slice(0, 6);
        const info = detectDeviceInfo();
        ws.send(
          JSON.stringify({
            type: 'peer:register',
            name: deviceNameRef.current || info.name,
            deviceType: info.deviceType,
            os: info.os,
            browser: info.browser,
            requestedRoomCode: urlRoom && urlRoom.length === 6 ? urlRoom : undefined,
          })
        );

        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        if (!unmounted) {
          reconnectTimerRef.current = window.setTimeout(connect, 1800);
        }
      };

      ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
          handleIncomingBinaryFrame(event.data, 'ws-relay');
          return;
        }

        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }

        const type = String(msg.type || '');

        if (type === 'session:init') {
          const id = String(msg.peerId || '');
          myPeerIdRef.current = id;
          setMyPeerId(id);
          if (typeof msg.roomCode === 'string') {
            setRoomCode(msg.roomCode);
          }
          return;
        }

        if (type === 'room:joined' && typeof msg.roomCode === 'string') {
          setRoomCode(msg.roomCode);
          setRoomError(null);
          return;
        }

        if (type === 'room:error' && typeof msg.message === 'string') {
          setRoomError(msg.message);
          return;
        }

        if (type === 'peers:update') {
          const list = Array.isArray(msg.peers) ? (msg.peers as PeerInfo[]) : [];
          if (msg.scope === 'nearby') {
            setNearbyPeers(list.map((p) => ({ ...p, scope: 'nearby' })));
          } else if (msg.scope === 'pair') {
            setRoomPeers(list.map((p) => ({ ...p, scope: 'pair' })));
          }
          return;
        }

        const fromId = typeof msg.from === 'string' ? msg.from : '';

        if (type === 'webrtc:offer' && fromId && msg.sdp) {
          const pc = createPeerConnection(fromId, false);
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
          const queued = pendingIceRef.current.get(fromId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingIceRef.current.delete(fromId);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWsJson({
            type: 'webrtc:answer',
            targetId: fromId,
            sdp: pc.localDescription,
          });
          return;
        }

        if (type === 'webrtc:answer' && fromId && msg.sdp) {
          const pc = peerConnectionsRef.current.get(fromId);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
            const queued = pendingIceRef.current.get(fromId) || [];
            for (const cand of queued) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            pendingIceRef.current.delete(fromId);
          }
          return;
        }

        if (type === 'webrtc:ice' && fromId && msg.candidate) {
          const pc = peerConnectionsRef.current.get(fromId);
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit)).catch(() => {});
          } else {
            const list = pendingIceRef.current.get(fromId) || [];
            list.push(msg.candidate as RTCIceCandidateInit);
            pendingIceRef.current.set(fromId, list);
          }
          return;
        }

        if (type === 'transfer:offer' && msg.fromPeer && Array.isArray(msg.files)) {
          const files = msg.files as FileManifestItem[];
          const batch: IncomingOfferBatch = {
            batchId: String(msg.batchId),
            fromPeer: msg.fromPeer as PeerInfo,
            files,
            totalSize: files.reduce((acc, f) => acc + f.size, 0),
            createdAt: Date.now(),
          };
          if (autoAcceptRef.current) {
            acceptOfferBatch(batch);
          } else {
            setIncomingOffers((prev) => [...prev, batch]);
          }
          return;
        }

        if (type === 'transfer:accept') {
          const batchId = String(msg.batchId || '');
          const acceptedIds = Array.isArray(msg.acceptedIds) ? (msg.acceptedIds as string[]) : [];
          const batch = outgoingBatchesRef.current.get(batchId);
          if (batch) {
            executeOutgoingBatch(batch, acceptedIds);
          }
          return;
        }

        if (type === 'transfer:decline') {
          const batchId = String(msg.batchId || '');
          const batch = outgoingBatchesRef.current.get(batchId);
          if (batch) {
            for (const f of batch.files) {
              updateTransfer(f.manifest.transferId, { status: 'declined' });
            }
            outgoingBatchesRef.current.delete(batchId);
          }
          return;
        }

        if (type === 'transfer:complete') {
          const transferId = String(msg.transferId || '');
          const totalBytes = Number(msg.totalBytes || 0);
          const crc32 = String(msg.crc32 || '');
          const state = receivingRef.current.get(transferId);
          if (state) {
            if (state.receivedBytes >= totalBytes) {
              finalizeReceive(state, totalBytes, crc32);
            } else {
              state.pendingCompletion = { totalBytes, crc32 };
            }
          }
          return;
        }

        if (type === 'transfer:ack') {
          const transferId = String(msg.transferId || '');
          const verified = Boolean(msg.verified);
          const ackCrc = typeof msg.crc32 === 'string' ? msg.crc32 : undefined;
          updateTransfer(transferId, {
            status: verified ? 'completed' : 'error',
            verifiedLossless: verified,
            crc32Actual: ackCrc,
            completedAt: Date.now(),
            errorMessage: verified ? undefined : 'Receiver checksum verification failed',
          });
          return;
        }

        if (type === 'transfer:cancel') {
          const transferId = String(msg.transferId || '');
          cancelledTransfersRef.current.add(transferId);
          const state = receivingRef.current.get(transferId);
          if (state) {
            state.chunks = [];
            receivingRef.current.delete(transferId);
          }
          updateTransfer(transferId, { status: 'cancelled' });
        }
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      wsRef.current?.close();
      peerConnectionsRef.current.forEach((pc) => pc.close());
    };
  }, [
    acceptOfferBatch,
    createPeerConnection,
    executeOutgoingBatch,
    finalizeReceive,
    handleIncomingBinaryFrame,
    sendWsJson,
    updateTransfer,
  ]);

  const updateDeviceName = useCallback(
    (name: string) => {
      const clean = name.trim().slice(0, 48);
      if (!clean) return;
      deviceNameRef.current = clean;
      setDeviceNameState(clean);
      try {
        localStorage.setItem('beamdrop_device_name', clean);
      } catch {
        // ignore storage errors
      }
      const info = detectDeviceInfo();
      sendWsJson({
        type: 'peer:register',
        name: clean,
        deviceType: info.deviceType,
        os: info.os,
        browser: info.browser,
      });
    },
    [sendWsJson]
  );

  const joinRoomCode = useCallback(
    (code: string) => {
      const clean = code.replace(/\D/g, '').slice(0, 6);
      if (clean.length !== 6) {
        setRoomError('Enter a valid 6-digit pairing code.');
        return false;
      }
      setRoomError(null);
      sendWsJson({ type: 'room:join', roomCode: clean });
      return true;
    },
    [sendWsJson]
  );

  const createNewRoomCode = useCallback(() => {
    setRoomError(null);
    sendWsJson({ type: 'room:new' });
  }, [sendWsJson]);

  const sendFilesToPeer = useCallback(
    (peer: PeerInfo, files: File[]) => {
      if (!files.length) return;
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const items = files.map((file, idx) => {
        const transferId = `tx-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
        const manifest: FileManifestItem = {
          transferId,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          category: getFileCategory(file.type || '', file.name),
        };
        return { manifest, file };
      });

      outgoingBatchesRef.current.set(batchId, {
        batchId,
        targetPeer: peer,
        files: items,
      });

      const initialRecords: TransferRecord[] = items.map(({ manifest }) => ({
        transferId: manifest.transferId,
        batchId,
        peerId: peer.id,
        peerName: peer.name,
        direction: 'send',
        fileName: manifest.name,
        fileSize: manifest.size,
        mimeType: manifest.mimeType,
        category: manifest.category,
        bytesTransferred: 0,
        speedBps: 0,
        etaSeconds: null,
        status: 'waiting-accept',
        transport: 'webrtc-p2p',
        verifiedLossless: false,
        createdAt: Date.now(),
      }));

      setTransfers((prev) => [...initialRecords, ...prev]);

      sendWsJson({
        type: 'transfer:offer',
        targetId: peer.id,
        batchId,
        files: items.map((i) => i.manifest),
      });
    },
    [sendWsJson]
  );

  const cancelTransfer = useCallback(
    (transferId: string, peerId: string) => {
      cancelledTransfersRef.current.add(transferId);
      const recv = receivingRef.current.get(transferId);
      if (recv) {
        recv.chunks = [];
        receivingRef.current.delete(transferId);
      }
      sendWsJson({ type: 'transfer:cancel', targetId: peerId, transferId });
      updateTransfer(transferId, { status: 'cancelled' });
    },
    [sendWsJson, updateTransfer]
  );

  const clearCompletedTransfers = useCallback(() => {
    setTransfers((prev) => {
      prev.forEach((t) => {
        if ((t.status === 'completed' || t.status === 'declined' || t.status === 'cancelled' || t.status === 'error') && t.blobUrl) {
          URL.revokeObjectURL(t.blobUrl);
        }
      });
      return prev.filter((t) => t.status === 'transferring' || t.status === 'connecting' || t.status === 'waiting-accept' || t.status === 'verifying');
    });
  }, []);

  const allPeers = useMemo(() => {
    const map = new Map<string, PeerInfo>();
    for (const p of roomPeers) map.set(p.id, p);
    for (const p of nearbyPeers) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    return Array.from(map.values());
  }, [nearbyPeers, roomPeers]);

  return {
    wsConnected,
    myPeerId,
    roomCode,
    deviceName,
    nearbyPeers,
    roomPeers,
    allPeers,
    transfers,
    incomingOffers,
    autoAccept,
    setAutoAccept,
    autoDownload,
    setAutoDownload,
    roomError,
    setRoomError,
    updateDeviceName,
    joinRoomCode,
    createNewRoomCode,
    sendFilesToPeer,
    acceptOfferBatch,
    declineOfferBatch,
    cancelTransfer,
    clearCompletedTransfers,
    triggerBrowserDownload,
  };
}
