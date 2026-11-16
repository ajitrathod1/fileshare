import { DeviceType, FileCategory } from '../types/transfer';

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export class IncrementalCRC32 {
  private crc = 0xffffffff;

  update(chunk: Uint8Array): void {
    let c = this.crc;
    for (let i = 0; i < chunk.length; i++) {
      c = CRC32_TABLE[(c ^ chunk[i]) & 0xff] ^ (c >>> 8);
    }
    this.crc = c;
  }

  digestHex(): string {
    return ((this.crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0').toUpperCase();
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, exp);
  return `${val >= 100 || exp === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[exp]}`;
}

export function formatSpeed(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return '0 MB/s';
  if (bps < 1024 * 1024) {
    return `${(bps / 1024).toFixed(0)} KB/s`;
  }
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '--';
  if (seconds < 1) return '< 1s';
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function getFileCategory(mimeType: string, fileName: string): FileCategory {
  const mime = mimeType.toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (mime.startsWith('video/') || ['mp4', 'mov', 'mkv', 'webm', 'avi', '3gp', 'm4v'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg', 'opus'].includes(ext)) {
    return 'audio';
  }
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'raw', 'dng', 'svg'].includes(ext)) {
    return 'image';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'apk', 'ipa'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
    return 'archive';
  }
  return 'document';
}

export function detectDeviceInfo(): { name: string; deviceType: DeviceType; os: string; browser: string } {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /Android/i.test(ua);
  const isIPhone = /iPhone/i.test(ua);
  const isIPad = /iPad/i.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIPad;
  const isWin = /Windows/i.test(ua);
  const isLinux = /Linux/i.test(ua) && !isAndroid;

  let os = 'Device';
  let deviceType: DeviceType = 'desktop';

  if (isIPhone) {
    os = 'iOS';
    deviceType = 'phone';
  } else if (isIPad) {
    os = 'iPadOS';
    deviceType = 'tablet';
  } else if (isAndroid) {
    os = 'Android';
    deviceType = /Mobile/i.test(ua) ? 'phone' : 'tablet';
  } else if (isMac) {
    os = 'macOS';
    deviceType = 'desktop';
  } else if (isWin) {
    os = 'Windows';
    deviceType = 'desktop';
  } else if (isLinux) {
    os = 'Linux';
    deviceType = 'desktop';
  }

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome|CriOS/i.test(ua)) browser = 'Chrome';
  else if (/Firefox|FxiOS/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua)) browser = 'Safari';

  const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem('beamdrop_device_name') : null;
  const defaultName = isIPhone
    ? `iPhone (${browser})`
    : isIPad
      ? `iPad (${browser})`
      : isAndroid
        ? `Android Phone (${browser})`
        : `${os} (${browser})`;

  return {
    name: savedName || defaultName,
    deviceType,
    os,
    browser,
  };
}
