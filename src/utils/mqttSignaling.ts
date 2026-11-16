// Minimal, zero-dependency MQTT 3.1.1 over WebSocket (WSS) client for 100% client-side Vercel signaling

const BROKER_URLS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

function encodeVarLen(len: number): number[] {
  const out: number[] = [];
  let x = len;
  do {
    let byte = x % 128;
    x = Math.floor(x / 128);
    if (x > 0) byte |= 0x80;
    out.push(byte);
  } while (x > 0);
  return out;
}

function encodeUtf8Str(str: string): Uint8Array {
  const bytes = new TextEncoder().encode(str);
  const out = new Uint8Array(2 + bytes.length);
  out[0] = (bytes.length >> 8) & 0xff;
  out[1] = bytes.length & 0xff;
  out.set(bytes, 2);
  return out;
}

function buildConnectPacket(clientId: string): Uint8Array {
  const proto = encodeUtf8Str('MQTT');
  const cid = encodeUtf8Str(clientId);
  const varHeader = new Uint8Array([
    ...proto,
    0x04, // MQTT 3.1.1
    0x02, // Clean session
    0x00,
    0x3c, // Keep alive 60s
  ]);
  const remLen = varHeader.length + cid.length;
  const remBytes = encodeVarLen(remLen);
  const pkt = new Uint8Array(1 + remBytes.length + remLen);
  pkt[0] = 0x10;
  pkt.set(remBytes, 1);
  pkt.set(varHeader, 1 + remBytes.length);
  pkt.set(cid, 1 + remBytes.length + varHeader.length);
  return pkt;
}

function buildSubscribePacket(packetId: number, topics: string[]): Uint8Array {
  const encodedTopics = topics.map((t) => encodeUtf8Str(t));
  const payloadLen = encodedTopics.reduce((sum, t) => sum + t.length + 1, 0);
  const remLen = 2 + payloadLen;
  const remBytes = encodeVarLen(remLen);
  const pkt = new Uint8Array(1 + remBytes.length + remLen);
  let pos = 0;
  pkt[pos++] = 0x82;
  for (const b of remBytes) pkt[pos++] = b;
  pkt[pos++] = (packetId >> 8) & 0xff;
  pkt[pos++] = packetId & 0xff;
  for (const tBytes of encodedTopics) {
    pkt.set(tBytes, pos);
    pos += tBytes.length;
    pkt[pos++] = 0x00; // QoS 0
  }
  return pkt;
}

function buildPublishPacket(topic: string, payload: Uint8Array): Uint8Array {
  const topicBytes = encodeUtf8Str(topic);
  const remLen = topicBytes.length + payload.length;
  const remBytes = encodeVarLen(remLen);
  const pkt = new Uint8Array(1 + remBytes.length + remLen);
  let pos = 0;
  pkt[pos++] = 0x30; // PUBLISH QoS 0
  for (const b of remBytes) pkt[pos++] = b;
  pkt.set(topicBytes, pos);
  pos += topicBytes.length;
  pkt.set(payload, pos);
  return pkt;
}

export class MqttWssClient {
  private ws: WebSocket | null = null;
  private brokerIndex = 0;
  private clientId: string;
  private subscriptions: string[] = [];
  private pingTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private closed = false;
  private connected = false;
  private rxBuffer = new Uint8Array(0);
  private packetSeq = 1;

  public onConnect?: () => void;
  public onDisconnect?: () => void;
  public onMessage?: (topic: string, payload: Uint8Array) => void;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  public connect(topics: string[]) {
    this.subscriptions = topics;
    this.closed = false;
    this.openSocket();
  }

  public isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  public getBufferedAmount(): number {
    return this.ws?.bufferedAmount ?? 0;
  }

  public publishJson(topic: string, data: unknown) {
    const payload = new TextEncoder().encode(JSON.stringify(data));
    this.publishBytes(topic, payload);
  }

  public publishBytes(topic: string, payload: Uint8Array) {
    if (!this.isConnected() || !this.ws) return;
    const pkt = buildPublishPacket(topic, payload);
    this.ws.send(pkt.buffer as ArrayBuffer);
  }

  public close() {
    this.closed = true;
    this.connected = false;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  private openSocket() {
    if (this.closed) return;
    const url = BROKER_URLS[this.brokerIndex % BROKER_URLS.length];
    const ws = new WebSocket(url, 'mqtt');
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    this.rxBuffer = new Uint8Array(0);

    ws.onopen = () => {
      ws.send(buildConnectPacket(this.clientId).buffer as ArrayBuffer);
    };

    ws.onmessage = (event) => {
      const incoming = new Uint8Array(event.data as ArrayBuffer);
      const merged = new Uint8Array(this.rxBuffer.length + incoming.length);
      merged.set(this.rxBuffer);
      merged.set(incoming, this.rxBuffer.length);
      this.rxBuffer = merged;
      this.drainPackets();
    };

    ws.onclose = () => {
      const wasConnected = this.connected;
      this.connected = false;
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (wasConnected) {
        this.onDisconnect?.();
      }
      if (!this.closed) {
        this.brokerIndex += 1;
        this.reconnectTimer = window.setTimeout(() => this.openSocket(), 1500);
      }
    };

    ws.onerror = () => {
      // onclose will handle fallback to next broker
    };
  }

  private drainPackets() {
    let offset = 0;
    while (offset + 2 <= this.rxBuffer.length) {
      const headerByte = this.rxBuffer[offset];
      let multiplier = 1;
      let remLen = 0;
      let idx = offset + 1;
      let encodedByte = 0;
      let incomplete = false;

      do {
        if (idx >= this.rxBuffer.length) {
          incomplete = true;
          break;
        }
        encodedByte = this.rxBuffer[idx++];
        remLen += (encodedByte & 127) * multiplier;
        multiplier *= 128;
      } while ((encodedByte & 128) !== 0);

      if (incomplete || idx + remLen > this.rxBuffer.length) {
        break;
      }

      const body = this.rxBuffer.subarray(idx, idx + remLen);
      const packetType = headerByte >> 4;

      if (packetType === 2 && body.length >= 2 && body[1] === 0) {
        // CONNACK success
        this.connected = true;
        if (this.subscriptions.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(
            buildSubscribePacket(this.packetSeq++, this.subscriptions).buffer as ArrayBuffer
          );
        }
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = window.setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(new Uint8Array([0xc0, 0x00]).buffer as ArrayBuffer);
          }
        }, 25000);
        this.onConnect?.();
      } else if (packetType === 3 && body.length >= 2) {
        // PUBLISH
        const qos = (headerByte >> 1) & 0x03;
        const topicLen = (body[0] << 8) | body[1];
        if (2 + topicLen <= body.length) {
          const topic = new TextDecoder().decode(body.subarray(2, 2 + topicLen));
          const headerEnd = 2 + topicLen + (qos > 0 ? 2 : 0);
          if (headerEnd <= body.length) {
            const payload = body.subarray(headerEnd);
            this.onMessage?.(topic, payload);
          }
        }
      }

      offset = idx + remLen;
    }

    if (offset > 0) {
      this.rxBuffer = this.rxBuffer.subarray(offset);
    }
  }
}
