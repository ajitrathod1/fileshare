import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileManifestItem,
  IncomingConnectionRequest,
  IncomingOfferBatch,
  PeerConnectionState,
  PeerInfo,
  TransferRecord,
  TransportMode,
} from '../types/transfer';
import {
  IncrementalCRC32,
  detectDeviceInfo,
  getFileCategory,
} from '../utils/crc32';
import { MqttWssClient } from '../utils/mqttSignaling';

const CHUNK_SIZE = 64 * 1024; // 64 KB — universally safe for WebRTC SCTP on iOS Safari, Android Chrome, and Desktop
const MQTT_RELAY_CHUNK_SIZE = 32 * 1024; // 32 KB when relaying over MQTT WSS fallback
const DC_HIGH_WATER_MARK = 1024 * 1024; // 1 MB
const DC_LOW_WATER_THRESHOLD = 256 * 1024; // 256 KB
const WEBRTC_CONNECT_TIMEOUT_MS = 4500;
const MQTT_NS = 'beamdrop_p2p_v1';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

function generateSixDigitCode(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String(100000 + (arr[0] % 900000));
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateClientPeerId(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).slice(2, 12);
}

function getInitialRoomCode(): string {
  if (typeof window === 'undefined') return '100000';
  const urlRoom = new URLSearchParams(window.location.search)
    .get('room')
    ?.replace(/\D/g, '')
    .slice(0, 6);
  if (urlRoom && urlRoom.length === 6) return urlRoom;
  try {
    const saved = sessionStorage.getItem('beamdrop_room_code');
    if (saved && /^\d{6}$/.test(saved)) return saved;
    const fresh = generateSixDigitCode();
    sessionStorage.setItem('beamdrop_room_code', fresh);
    return fresh;
  } catch {
    return generateSixDigitCode();
  }
}

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

interface MqttPeerEntry extends PeerInfo {
  roomCode?: string;
  lastSeen: number;
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
  const initialRoomCode = useMemo(() => getInitialRoomCode(), []);
  const initialPeerId = useMemo(() => generateClientPeerId(), []);

  const [wsConnected, setWsConnected] = useState(false);
  const [signalingBackend, setSignalingBackend] = useState<'ws' | 'mqtt'>('ws');
  const [myPeerId, setMyPeerId] = useState<string>(initialPeerId);
  const [roomCode, setRoomCodeState] = useState<string>(initialRoomCode);
  const [deviceName, setDeviceNameState] = useState<string>(initialDevice.name);
  const [nearbyPeers, setNearbyPeers] = useState<PeerInfo[]>([]);
  const [roomPeers, setRoomPeers] = useState<PeerInfo[]>([]);
  const [availablePeers, setAvailablePeers] = useState<PeerInfo[]>([]);
  const [connectedPeers, setConnectedPeers] = useState<PeerInfo[]>([]);
  const [connectionStates, setConnectionStates] = useState<Record<string, PeerConnectionState>>({});
  const [incomingConnectRequests, setIncomingConnectRequests] = useState<IncomingConnectionRequest[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [incomingOffers, setIncomingOffers] = useState<IncomingOfferBatch[]>([]);
  const [autoAccept, setAutoAccept] = useState<boolean>(false);
  const [autoDownload, setAutoDownload] = useState<boolean>(true);
  const [roomError, setRoomError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mqttRef = useRef<MqttWssClient | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const backendRef = useRef<'ws' | 'mqtt'>('ws');

  const myPeerIdRef = useRef<string>(initialPeerId);
  const roomCodeRef = useRef<string>(initialRoomCode);
  const deviceNameRef = useRef<string>(initialDevice.name);
  const autoAcceptRef = useRef<boolean>(false);
  const autoDownloadRef = useRef<boolean>(true);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const mqttDirectoryRef = useRef<Map<string, MqttPeerEntry>>(new Map());

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

  const setRoomCode = useCallback((code: string) => {
    roomCodeRef.current = code;
    setRoomCodeState(code);
    try {
      sessionStorage.setItem('beamdrop_room_code', code);
    } catch {
      // ignore storage errors
    }
  }, []);

  const getMySelfPeer = useCallback(
    (): PeerInfo => ({
      id: myPeerIdRef.current,
      name: deviceNameRef.current || initialDevice.name,
      deviceType: initialDevice.deviceType,
      os: initialDevice.os,
      browser: initialDevice.browser,
      sameNetwork: false,
    }),
    [initialDevice]
  );

  const publishMqttPresence = useCallback(
    (offline = false) => {
      const payload = offline
        ? { id: myPeerIdRef.current, offline: true, ts: Date.now() }
        : {
            ...getMySelfPeer(),
            roomCode: roomCodeRef.current,
            ts: Date.now(),
          };
      const mqtt = mqttRef.current;
      if (mqtt && mqtt.isConnected()) {
        mqtt.publishJson(`${MQTT_NS}/lobby/${myPeerIdRef.current}`, payload);
      }
      if (broadcastRef.current) {
        try {
          broadcastRef.current.postMessage({ kind: 'presence', payload });
        } catch {
          // ignore
        }
      }
    },
    [getMySelfPeer]
  );

  const syncMqttPeerLists = useCallback(() => {
    const now = Date.now();
    const dir = mqttDirectoryRef.current;
    for (const [id, entry] of dir.entries()) {
      if (now - entry.lastSeen > 12000) {
        dir.delete(id);
      }
    }
    const list = Array.from(dir.values()).filter((p) => p.id !== myPeerIdRef.current);
    setAvailablePeers(list.map((p) => ({ ...p, scope: 'available' })));
    const matchingRoom = list
      .filter((p) => p.roomCode && p.roomCode === roomCodeRef.current)
      .map((p) => ({ ...p, scope: 'pair' as const }));
    setRoomPeers(matchingRoom);
    setConnectedPeers((prev) =>
      prev
        .map((cp) => {
          const fresh = list.find((item) => item.id === cp.id);
          return fresh ? { ...cp, ...fresh } : cp;
        })
        .filter((cp) => list.some((item) => item.id === cp.id))
    );
  }, []);

  const sendWsJson = useCallback(
    (payload: Record<string, unknown>) => {
      if (backendRef.current === 'ws') {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
          return true;
        }
        return false;
      }

      // Serverless / Vercel client-side signaling over MQTT WSS + BroadcastChannel
      const targetId = typeof payload.targetId === 'string' ? payload.targetId : '';
      if (!targetId) return false;

      const envelope = {
        ...payload,
        from: myPeerIdRef.current,
        fromPeer: getMySelfPeer(),
      };

      const mqtt = mqttRef.current;
      if (mqtt && mqtt.isConnected()) {
        mqtt.publishJson(`${MQTT_NS}/inbox/${targetId}`, envelope);
      }
      if (broadcastRef.current) {
        try {
          broadcastRef.current.postMessage({ kind: 'inbox', targetId, envelope });
        } catch {
          // ignore
        }
      }
      return Boolean((mqtt && mqtt.isConnected()) || broadcastRef.current);
    },
    [getMySelfPeer]
  );

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

      const blobParts = state.chunks.map(
        (c) => c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength) as ArrayBuffer
      );
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
      const chunkStep = transport === 'webrtc-p2p' ? CHUNK_SIZE : backendRef.current === 'mqtt' ? MQTT_RELAY_CHUNK_SIZE : CHUNK_SIZE;

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

            const end = Math.min(offset + chunkStep, file.size);
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
            } else if (backendRef.current === 'ws') {
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
            } else {
              activeTransport = 'ws-relay';
              const mqtt = mqttRef.current;
              if (mqtt && mqtt.isConnected()) {
                while (mqtt.getBufferedAmount() > 1024 * 1024) {
                  await new Promise((r) => setTimeout(r, 20));
                }
                mqtt.publishBytes(`${MQTT_NS}/bin/${targetId}`, dataFrame);
              } else if (broadcastRef.current) {
                broadcastRef.current.postMessage({
                  kind: 'bin',
                  targetId,
                  buffer: dataFrame.buffer.slice(0),
                });
              } else {
                throw new Error('P2P & relay channel unavailable.');
              }
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

  const handleSignalingMessage = useCallback(
    async (msg: Record<string, unknown>) => {
      const type = String(msg.type || '');

      if (type === 'session:init') {
        const id = String(msg.peerId || '');
        if (id) {
          myPeerIdRef.current = id;
          setMyPeerId(id);
        }
        if (typeof msg.roomCode === 'string' && /^\d{6}$/.test(msg.roomCode)) {
          // Keep URL ?room= code if user opened a QR scan link
          const urlRoom = new URLSearchParams(window.location.search)
            .get('room')
            ?.replace(/\D/g, '')
            .slice(0, 6);
          if (!urlRoom || urlRoom.length !== 6) {
            setRoomCode(msg.roomCode);
          }
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
        } else if (msg.scope === 'available') {
          setAvailablePeers(list.map((p) => ({ ...p, scope: 'available' })));
          setConnectedPeers((prev) =>
            prev
              .map((cp) => {
                const fresh = list.find((item) => item.id === cp.id);
                return fresh ? { ...cp, ...fresh } : cp;
              })
              .filter((cp) => list.some((item) => item.id === cp.id))
          );
        }
        return;
      }

      const fromId = typeof msg.from === 'string' ? msg.from : '';

      if (type === 'connect:request' && msg.fromPeer) {
        const fromPeer = msg.fromPeer as PeerInfo;
        setIncomingConnectRequests((prev) => {
          if (prev.some((r) => r.fromPeer.id === fromPeer.id)) return prev;
          return [
            ...prev,
            {
              requestId: `creq-${Date.now()}-${fromPeer.id}`,
              fromPeer,
              createdAt: Date.now(),
            },
          ];
        });
        return;
      }

      if (type === 'connect:established' && msg.peer) {
        const peer = msg.peer as PeerInfo;
        setConnectedPeers((prev) => {
          if (prev.some((p) => p.id === peer.id)) {
            return prev.map((p) => (p.id === peer.id ? peer : p));
          }
          return [peer, ...prev];
        });
        setConnectionStates((prev) => ({ ...prev, [peer.id]: 'connected' }));
        return;
      }

      if (type === 'connect:skip' && fromId) {
        setConnectionStates((prev) => ({ ...prev, [fromId]: 'skipped' }));
        return;
      }

      if (type === 'connect:disconnected' && typeof msg.peerId === 'string') {
        const deadId = msg.peerId;
        setConnectedPeers((prev) => prev.filter((p) => p.id !== deadId));
        setConnectionStates((prev) => ({ ...prev, [deadId]: 'idle' }));
        return;
      }

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
    },
    [
      acceptOfferBatch,
      createPeerConnection,
      executeOutgoingBatch,
      finalizeReceive,
      sendWsJson,
      setRoomCode,
      updateTransfer,
    ]
  );

  useEffect(() => {
    let unmounted = false;
    let everOpenedWs = false;
    let presenceInterval: number | null = null;
    let pruneInterval: number | null = null;

    const startServerlessMqtt = () => {
      if (unmounted || mqttRef.current) return;
      backendRef.current = 'mqtt';
      setSignalingBackend('mqtt');

      if (typeof BroadcastChannel !== 'undefined' && !broadcastRef.current) {
        const bc = new BroadcastChannel('beamdrop_local');
        broadcastRef.current = bc;
        bc.onmessage = (e) => {
          const data = e.data;
          if (!data) return;
          if (data.kind === 'presence' && data.payload?.id && data.payload.id !== myPeerIdRef.current) {
            if (data.payload.offline) {
              mqttDirectoryRef.current.delete(data.payload.id);
            } else {
              mqttDirectoryRef.current.set(data.payload.id, {
                ...data.payload,
                sameNetwork: true,
                lastSeen: Date.now(),
              });
            }
            syncMqttPeerLists();
          } else if (data.kind === 'inbox' && data.targetId === myPeerIdRef.current && data.envelope) {
            handleSignalingMessage(data.envelope);
          } else if (data.kind === 'bin' && data.targetId === myPeerIdRef.current && data.buffer) {
            handleIncomingBinaryFrame(data.buffer, 'ws-relay');
          }
        };
      }

      const mqtt = new MqttWssClient(`bd_${myPeerIdRef.current}`);
      mqttRef.current = mqtt;

      mqtt.onConnect = () => {
        if (unmounted) return;
        setWsConnected(true);
        publishMqttPresence(false);
        if (presenceInterval) clearInterval(presenceInterval);
        presenceInterval = window.setInterval(() => publishMqttPresence(false), 3500);
        if (pruneInterval) clearInterval(pruneInterval);
        pruneInterval = window.setInterval(syncMqttPeerLists, 3000);
      };

      mqtt.onDisconnect = () => {
        if (!unmounted) setWsConnected(false);
      };

      mqtt.onMessage = (topic, payload) => {
        if (topic.startsWith(`${MQTT_NS}/bin/`)) {
          const copy = new Uint8Array(payload.length);
          copy.set(payload);
          handleIncomingBinaryFrame(copy.buffer, 'ws-relay');
          return;
        }

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(new TextDecoder().decode(payload));
        } catch {
          return;
        }

        if (topic.startsWith(`${MQTT_NS}/lobby/`)) {
          const id = String(parsed.id || '');
          if (!id || id === myPeerIdRef.current) return;
          if (parsed.offline) {
            mqttDirectoryRef.current.delete(id);
          } else {
            mqttDirectoryRef.current.set(id, {
              id,
              name: String(parsed.name || 'Device'),
              deviceType:
                parsed.deviceType === 'phone' || parsed.deviceType === 'tablet'
                  ? parsed.deviceType
                  : 'desktop',
              os: String(parsed.os || 'Device'),
              browser: String(parsed.browser || 'Browser'),
              roomCode: typeof parsed.roomCode === 'string' ? parsed.roomCode : undefined,
              sameNetwork: false,
              lastSeen: Date.now(),
            });
          }
          syncMqttPeerLists();
          return;
        }

        if (topic === `${MQTT_NS}/inbox/${myPeerIdRef.current}`) {
          handleSignalingMessage(parsed);
        }
      };

      mqtt.connect([
        `${MQTT_NS}/lobby/+`,
        `${MQTT_NS}/inbox/${myPeerIdRef.current}`,
        `${MQTT_NS}/bin/${myPeerIdRef.current}`,
      ]);
    };

    const connectWs = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let ws: WebSocket;
      try {
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      } catch {
        startServerlessMqtt();
        return;
      }
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      const wsTimeout = window.setTimeout(() => {
        if (!everOpenedWs && ws.readyState !== WebSocket.OPEN) {
          ws.close();
          startServerlessMqtt();
        }
      }, 1800);

      ws.onopen = () => {
        clearTimeout(wsTimeout);
        everOpenedWs = true;
        backendRef.current = 'ws';
        setSignalingBackend('ws');
        setWsConnected(true);
        const info = detectDeviceInfo();
        ws.send(
          JSON.stringify({
            type: 'peer:register',
            name: deviceNameRef.current || info.name,
            deviceType: info.deviceType,
            os: info.os,
            browser: info.browser,
            requestedRoomCode: roomCodeRef.current,
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
        clearTimeout(wsTimeout);
        setWsConnected(false);
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        if (unmounted) return;

        if (!everOpenedWs) {
          // Hosted on Vercel / static CDN without /ws server -> switch immediately to serverless client-side signaling
          startServerlessMqtt();
        } else {
          reconnectTimerRef.current = window.setTimeout(connectWs, 1800);
        }
      };

      ws.onmessage = (event) => {
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
        handleSignalingMessage(msg);
      };
    };

    const handleBeforeUnload = () => {
      if (backendRef.current === 'mqtt') {
        publishMqttPresence(true);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    connectWs();

    return () => {
      unmounted = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (presenceInterval) clearInterval(presenceInterval);
      if (pruneInterval) clearInterval(pruneInterval);
      wsRef.current?.close();
      if (mqttRef.current) {
        publishMqttPresence(true);
        mqttRef.current.close();
      }
      broadcastRef.current?.close();
      peerConnectionsRef.current.forEach((pc) => pc.close());
    };
  }, [
    handleIncomingBinaryFrame,
    handleSignalingMessage,
    publishMqttPresence,
    syncMqttPeerLists,
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
      if (backendRef.current === 'ws') {
        const info = detectDeviceInfo();
        sendWsJson({
          type: 'peer:register',
          name: clean,
          deviceType: info.deviceType,
          os: info.os,
          browser: info.browser,
        });
      } else {
        publishMqttPresence(false);
      }
    },
    [publishMqttPresence, sendWsJson]
  );

  const joinRoomCode = useCallback(
    (code: string) => {
      const clean = code.replace(/\D/g, '').slice(0, 6);
      if (clean.length !== 6) {
        setRoomError('Enter a valid 6-digit pairing code.');
        return false;
      }
      setRoomError(null);
      setRoomCode(clean);

      if (backendRef.current === 'ws') {
        sendWsJson({ type: 'room:join', roomCode: clean });
      } else {
        publishMqttPresence(false);
        syncMqttPeerLists();
      }
      return true;
    },
    [publishMqttPresence, sendWsJson, setRoomCode, syncMqttPeerLists]
  );

  const createNewRoomCode = useCallback(() => {
    setRoomError(null);
    const fresh = generateSixDigitCode();
    setRoomCode(fresh);

    if (backendRef.current === 'ws') {
      sendWsJson({ type: 'room:join', roomCode: fresh });
    } else {
      publishMqttPresence(false);
      syncMqttPeerLists();
    }
  }, [publishMqttPresence, sendWsJson, setRoomCode, syncMqttPeerLists]);

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
        if (
          (t.status === 'completed' ||
            t.status === 'declined' ||
            t.status === 'cancelled' ||
            t.status === 'error') &&
          t.blobUrl
        ) {
          URL.revokeObjectURL(t.blobUrl);
        }
      });
      return prev.filter(
        (t) =>
          t.status === 'transferring' ||
          t.status === 'connecting' ||
          t.status === 'waiting-accept' ||
          t.status === 'verifying'
      );
    });
  }, []);

  const requestConnection = useCallback(
    (peer: PeerInfo) => {
      setConnectionStates((prev) => ({ ...prev, [peer.id]: 'requesting' }));
      sendWsJson({
        type: 'connect:request',
        targetId: peer.id,
      });
    },
    [sendWsJson]
  );

  const acceptConnectionRequest = useCallback(
    (req: IncomingConnectionRequest) => {
      setIncomingConnectRequests((prev) => prev.filter((item) => item.requestId !== req.requestId));
      if (backendRef.current === 'ws') {
        sendWsJson({
          type: 'connect:accept',
          targetId: req.fromPeer.id,
        });
      } else {
        setConnectedPeers((prev) => {
          if (prev.some((p) => p.id === req.fromPeer.id)) return prev;
          return [req.fromPeer, ...prev];
        });
        setConnectionStates((prev) => ({ ...prev, [req.fromPeer.id]: 'connected' }));
        sendWsJson({
          type: 'connect:established',
          targetId: req.fromPeer.id,
          peer: getMySelfPeer(),
        });
      }
    },
    [getMySelfPeer, sendWsJson]
  );

  const skipConnectionRequest = useCallback(
    (req: IncomingConnectionRequest) => {
      setIncomingConnectRequests((prev) => prev.filter((item) => item.requestId !== req.requestId));
      sendWsJson({
        type: 'connect:skip',
        targetId: req.fromPeer.id,
      });
    },
    [sendWsJson]
  );

  const disconnectPeer = useCallback(
    (peerId: string) => {
      setConnectedPeers((prev) => prev.filter((p) => p.id !== peerId));
      setConnectionStates((prev) => ({ ...prev, [peerId]: 'idle' }));
      if (backendRef.current === 'ws') {
        sendWsJson({
          type: 'connect:disconnect',
          targetId: peerId,
        });
      } else {
        sendWsJson({
          type: 'connect:disconnected',
          targetId: peerId,
          peerId: myPeerIdRef.current,
        });
      }
    },
    [sendWsJson]
  );

  const allPeers = useMemo(() => {
    const map = new Map<string, PeerInfo>();
    for (const p of connectedPeers) map.set(p.id, p);
    for (const p of roomPeers) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    for (const p of nearbyPeers) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    for (const p of availablePeers) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    return Array.from(map.values());
  }, [availablePeers, connectedPeers, nearbyPeers, roomPeers]);

  return {
    wsConnected,
    signalingBackend,
    myPeerId,
    roomCode,
    deviceName,
    myDeviceInfo: initialDevice,
    nearbyPeers,
    roomPeers,
    availablePeers,
    connectedPeers,
    connectionStates,
    incomingConnectRequests,
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
    requestConnection,
    acceptConnectionRequest,
    skipConnectionRequest,
    disconnectPeer,
    sendFilesToPeer,
    acceptOfferBatch,
    declineOfferBatch,
    cancelTransfer,
    clearCompletedTransfers,
    triggerBrowserDownload,
  };
}
