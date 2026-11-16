import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PeerRecord {
  id: string;
  name: string;
  deviceType: 'phone' | 'tablet' | 'desktop';
  os: string;
  browser: string;
  nearbyRoom: string;
  pairRoom: string | null;
  ws: WebSocket;
  connectedAt: number;
}

const peers = new Map<string, PeerRecord>();
const rooms = new Map<string, Set<string>>();

function normalizeIp(rawIp: string | undefined): string {
  if (!rawIp) return '127.0.0.1';
  const first = rawIp.split(',')[0].trim();
  if (first === '::1' || first === '::ffff:127.0.0.1') return '127.0.0.1';
  if (first.startsWith('::ffff:')) return first.slice(7);
  return first;
}

function getNearbyRoomKey(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const headerIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = normalizeIp(headerIp || req.socket.remoteAddress);
  const hash = crypto.createHash('sha256').update(`beamdrop:${ip}`).digest('hex').slice(0, 12);
  return `nearby:${hash}`;
}

function addPeerToRoom(peerId: string, roomKey: string) {
  if (!rooms.has(roomKey)) {
    rooms.set(roomKey, new Set());
  }
  rooms.get(roomKey)!.add(peerId);
}

function removePeerFromRoom(peerId: string, roomKey: string) {
  const set = rooms.get(roomKey);
  if (!set) return;
  set.delete(peerId);
  if (set.size === 0) {
    rooms.delete(roomKey);
  }
}

function serializePeer(peer: PeerRecord) {
  return {
    id: peer.id,
    name: peer.name,
    deviceType: peer.deviceType,
    os: peer.os,
    browser: peer.browser,
  };
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoomPeers(roomKey: string) {
  const memberIds = rooms.get(roomKey);
  if (!memberIds) return;

  const isPair = roomKey.startsWith('pair:');
  const scope = isPair ? 'pair' : 'nearby';
  const roomCode = isPair ? roomKey.slice(5) : null;

  const members: PeerRecord[] = [];
  for (const id of memberIds) {
    const p = peers.get(id);
    if (p) members.push(p);
  }

  for (const recipient of members) {
    const others = members
      .filter((m) => m.id !== recipient.id)
      .map(serializePeer);
    sendJson(recipient.ws, {
      type: 'peers:update',
      scope,
      roomCode,
      peers: others,
    });
  }
}

function generatePairCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activePeers: peers.size });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 * 1024 });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (process.env.NODE_ENV === 'production' || process.env.DISABLE_HMR === 'true') {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, req) => {
    const peerId = crypto.randomBytes(6).toString('hex');
    const nearbyRoom = getNearbyRoomKey(req);
    const defaultPairCode = generatePairCode();

    const peer: PeerRecord = {
      id: peerId,
      name: 'Connecting Device',
      deviceType: 'desktop',
      os: 'Unknown',
      browser: 'Browser',
      nearbyRoom,
      pairRoom: `pair:${defaultPairCode}`,
      ws,
      connectedAt: Date.now(),
    };

    peers.set(peerId, peer);
    addPeerToRoom(peerId, nearbyRoom);
    addPeerToRoom(peerId, peer.pairRoom!);

    sendJson(ws, {
      type: 'session:init',
      peerId,
      roomCode: defaultPairCode,
    });

    broadcastRoomPeers(nearbyRoom);
    broadcastRoomPeers(peer.pairRoom!);

    ws.on('message', (rawData, isBinary) => {
      if (isBinary) {
        const buf = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData as ArrayBuffer);
        if (buf.length < 3) return;
        const targetLen = buf.readUInt8(0);
        if (buf.length < 1 + targetLen + 1) return;
        const targetId = buf.subarray(1, 1 + targetLen).toString('utf8');
        const targetPeer = peers.get(targetId);
        if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
          targetPeer.ws.send(buf.subarray(1 + targetLen), { binary: true });
        }
        return;
      }

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawData.toString());
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'ping') {
        sendJson(ws, { type: 'pong', ts: Date.now() });
        return;
      }

      if (type === 'peer:register') {
        if (typeof msg.name === 'string' && msg.name.trim()) {
          peer.name = msg.name.trim().slice(0, 48);
        }
        if (msg.deviceType === 'phone' || msg.deviceType === 'tablet' || msg.deviceType === 'desktop') {
          peer.deviceType = msg.deviceType;
        }
        if (typeof msg.os === 'string') peer.os = msg.os.slice(0, 32);
        if (typeof msg.browser === 'string') peer.browser = msg.browser.slice(0, 32);

        if (typeof msg.requestedRoomCode === 'string' && /^\d{6}$/.test(msg.requestedRoomCode)) {
          if (peer.pairRoom) {
            const oldRoom = peer.pairRoom;
            removePeerFromRoom(peerId, oldRoom);
            broadcastRoomPeers(oldRoom);
          }
          peer.pairRoom = `pair:${msg.requestedRoomCode}`;
          addPeerToRoom(peerId, peer.pairRoom);
          sendJson(ws, { type: 'room:joined', roomCode: msg.requestedRoomCode });
        }

        broadcastRoomPeers(peer.nearbyRoom);
        if (peer.pairRoom) broadcastRoomPeers(peer.pairRoom);
        return;
      }

      if (type === 'room:join') {
        const code = typeof msg.roomCode === 'string' ? msg.roomCode.replace(/\D/g, '').slice(0, 6) : '';
        if (code.length !== 6) {
          sendJson(ws, { type: 'room:error', message: 'Room code must be 6 digits.' });
          return;
        }
        const nextRoom = `pair:${code}`;
        if (peer.pairRoom && peer.pairRoom !== nextRoom) {
          const oldRoom = peer.pairRoom;
          removePeerFromRoom(peerId, oldRoom);
          broadcastRoomPeers(oldRoom);
        }
        peer.pairRoom = nextRoom;
        addPeerToRoom(peerId, nextRoom);
        sendJson(ws, { type: 'room:joined', roomCode: code });
        broadcastRoomPeers(nextRoom);
        return;
      }

      if (type === 'room:new') {
        const freshCode = generatePairCode();
        const nextRoom = `pair:${freshCode}`;
        if (peer.pairRoom) {
          const oldRoom = peer.pairRoom;
          removePeerFromRoom(peerId, oldRoom);
          broadcastRoomPeers(oldRoom);
        }
        peer.pairRoom = nextRoom;
        addPeerToRoom(peerId, nextRoom);
        sendJson(ws, { type: 'room:joined', roomCode: freshCode });
        broadcastRoomPeers(nextRoom);
        return;
      }

      const targetId = typeof msg.targetId === 'string' ? msg.targetId : '';
      if (targetId) {
        const targetPeer = peers.get(targetId);
        if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
          sendJson(targetPeer.ws, {
            ...msg,
            from: peerId,
            fromPeer: serializePeer(peer),
          });
        } else {
          sendJson(ws, {
            type: 'peer:unavailable',
            targetId,
            transferId: msg.transferId ?? null,
          });
        }
      }
    });

    ws.on('close', () => {
      peers.delete(peerId);
      removePeerFromRoom(peerId, peer.nearbyRoom);
      broadcastRoomPeers(peer.nearbyRoom);
      if (peer.pairRoom) {
        removePeerFromRoom(peerId, peer.pairRoom);
        broadcastRoomPeers(peer.pairRoom);
      }
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BeamDrop server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
