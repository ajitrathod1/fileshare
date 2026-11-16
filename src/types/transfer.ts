export type DeviceType = 'phone' | 'tablet' | 'desktop';

export type Language = 'en' | 'hi';

export interface PeerInfo {
  id: string;
  name: string;
  deviceType: DeviceType;
  os: string;
  browser: string;
  sameNetwork?: boolean;
  scope?: 'nearby' | 'pair' | 'available';
}

export type PeerConnectionState = 'idle' | 'requesting' | 'connected' | 'skipped';

export interface IncomingConnectionRequest {
  requestId: string;
  fromPeer: PeerInfo;
  createdAt: number;
}

export type FileCategory = 'video' | 'audio' | 'image' | 'archive' | 'document';

export type TransferDirection = 'send' | 'receive';

export type TransferStatus =
  | 'waiting-accept'
  | 'connecting'
  | 'transferring'
  | 'verifying'
  | 'completed'
  | 'declined'
  | 'cancelled'
  | 'error';

export type TransportMode = 'webrtc-p2p' | 'ws-relay';

export interface FileManifestItem {
  transferId: string;
  name: string;
  size: number;
  mimeType: string;
  category: FileCategory;
}

export interface TransferRecord {
  transferId: string;
  batchId: string;
  peerId: string;
  peerName: string;
  direction: TransferDirection;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: FileCategory;
  bytesTransferred: number;
  speedBps: number;
  etaSeconds: number | null;
  status: TransferStatus;
  transport: TransportMode;
  crc32Expected?: string;
  crc32Actual?: string;
  verifiedLossless: boolean;
  errorMessage?: string;
  blobUrl?: string;
  createdAt: number;
  completedAt?: number;
}

export interface IncomingOfferBatch {
  batchId: string;
  fromPeer: PeerInfo;
  files: FileManifestItem[];
  totalSize: number;
  createdAt: number;
}
