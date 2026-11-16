import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Camera, Check, Copy, QrCode, RefreshCw, X } from 'lucide-react';
import { Language } from '../types/transfer';
import { COPY } from '../utils/i18n';

interface QrPairModalProps {
  open: boolean;
  initialTab?: 'show' | 'scan';
  onClose: () => void;
  roomCode: string;
  roomError: string | null;
  onJoinCode: (code: string) => boolean;
  onCreateNewCode: () => void;
  lang: Language;
}

function extractRoomCodeFromScan(raw: string): string | null {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const param = url.searchParams.get('room')?.replace(/\D/g, '');
    if (param && param.length === 6) return param;
  } catch {
    // not a full URL, check regex below
  }
  const match = trimmed.match(/(?:room=|^|\b)(\d{6})(?:\b|$)/);
  return match ? match[1] : null;
}

export const QrPairModal: React.FC<QrPairModalProps> = ({
  open,
  initialTab = 'show',
  onClose,
  roomCode,
  roomError,
  onJoinCode,
  onCreateNewCode,
  lang,
}) => {
  const t = COPY[lang];
  const [activeTab, setActiveTab] = useState<'show' | 'scan'>(initialTab);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setCameraError(null);
      setScanStatus('');
    }
  }, [open, initialTab]);

  const shareUrl =
    typeof window !== 'undefined' && roomCode
      ? `${window.location.origin}/?room=${roomCode}`
      : '';

  useEffect(() => {
    if (!open || !shareUrl) return;
    let active = true;
    QRCode.toDataURL(shareUrl, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [open, shareUrl]);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCameraScanner = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setScanStatus('');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        lang === 'hi'
          ? 'इस ब्राउज़र में कैमरा उपलब्ध नहीं है। कृपया HTTPS लिंक इस्तेमाल करें या नीचे 6-अंक का कोड डालें।'
          : 'Camera access requires HTTPS and a supported browser. You can enter the 6-digit code manually below.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      const scanFrame = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !streamRef.current) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (code && code.data) {
              const extracted = extractRoomCodeFromScan(code.data);
              if (extracted) {
                setScanStatus(
                  lang === 'hi' ? `कोड मिला: ${extracted}` : `Scanned code: ${extracted}`
                );
                stopCamera();
                if (onJoinCode(extracted)) {
                  onClose();
                }
                return;
              }
            }
          }
        }
        rafRef.current = requestAnimationFrame(scanFrame);
      };

      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (err) {
      const msg =
        err instanceof Error && err.name === 'NotAllowedError'
          ? lang === 'hi'
            ? 'कैमरा की परमिशन नहीं मिली। ब्राउज़र सेटिंग्स से Camera Allow करें।'
            : 'Camera permission was denied. Please allow camera access in your browser.'
          : lang === 'hi'
            ? 'कैमरा शुरू नहीं हो सका। आप नीचे 6-अंक का कोड डालकर भी जुड़ सकते हैं।'
            : 'Could not start camera. You can still enter the 6-digit code below.';
      setCameraError(msg);
      stopCamera();
    }
  }, [lang, onClose, onJoinCode, stopCamera]);

  useEffect(() => {
    if (open && activeTab === 'scan') {
      startCameraScanner();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open, activeTab, startCameraScanner, stopCamera]);

  if (!open) return null;

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard fallback ignored
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onJoinCode(inputCode)) {
      setInputCode('');
      stopCamera();
      onClose();
    }
  };

  const formattedCode = roomCode ? `${roomCode.slice(0, 3)} ${roomCode.slice(3)}` : '--- ---';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pair-modal-title"
      onClick={() => {
        stopCamera();
        onClose();
      }}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="pair-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t.pairModalTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t.pairModalDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Mode Tabs: Show QR vs Scan Camera */}
        <div className="mt-4 grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('show')}
            className={`min-h-[40px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'show'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>{lang === 'hi' ? 'मेरा QR और कोड' : 'Show My QR'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            className={`min-h-[40px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap ${
              activeTab === 'scan'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{lang === 'hi' ? 'कैमरा से स्कैन करें' : 'Scan QR Camera'}</span>
          </button>
        </div>

        {activeTab === 'show' ? (
          <div className="mt-5 flex flex-col items-center border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50 dark:bg-slate-950/60">
            {qrDataUrl ? (
              <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                <img
                  src={qrDataUrl}
                  alt={`QR code for pairing room ${roomCode}`}
                  className="w-44 h-44 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-44 h-44 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-500">
                Generating QR...
              </div>
            )}

            <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
              {t.yourPairCode}
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-widest font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {formattedCode}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 w-full">
              <button
                type="button"
                onClick={handleCopyLink}
                className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? t.copied : t.copyLink}</span>
              </button>
              <button
                type="button"
                onClick={onCreateNewCode}
                className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{t.newCode}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-950 relative">
            <canvas ref={canvasRef} className="hidden" />
            <div className="relative aspect-[4/3] w-full bg-slate-950 flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />
              {cameraActive && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]" />
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-900/95 p-6 flex flex-col items-center justify-center text-center">
                  <Camera className="w-8 h-8 text-slate-400 mb-3" />
                  <p className="text-sm text-slate-200 leading-relaxed">{cameraError}</p>
                  <button
                    type="button"
                    onClick={startCameraScanner}
                    className="mt-4 min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                  >
                    {lang === 'hi' ? 'फिर से कोशिश करें' : 'Retry Camera'}
                  </button>
                </div>
              )}
            </div>
            <div className="px-4 py-2.5 bg-slate-900 text-center text-xs text-slate-300">
              {scanStatus ||
                (lang === 'hi'
                  ? 'दूसरे फोन के QR कोड के सामने कैमरा रखें'
                  : 'Point camera at the QR code on your other device')}
            </div>
          </div>
        )}

        <form onSubmit={handleJoinSubmit} className="mt-5">
          <label htmlFor="join-code-input" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
            {t.joinCodeLabel}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="join-code-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="e.g. 482915"
              className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-base tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              disabled={inputCode.length !== 6}
              className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-40 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              {t.joinCodeBtn}
            </button>
          </div>
          {roomError && (
            <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{roomError}</p>
          )}
        </form>
      </div>
    </div>
  );
};
