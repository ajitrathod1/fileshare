import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, RefreshCw, X } from 'lucide-react';
import { Language } from '../types/transfer';
import { COPY } from '../utils/i18n';

interface QrPairModalProps {
  open: boolean;
  onClose: () => void;
  roomCode: string;
  roomError: string | null;
  onJoinCode: (code: string) => boolean;
  onCreateNewCode: () => void;
  lang: Language;
}

export const QrPairModal: React.FC<QrPairModalProps> = ({
  open,
  onClose,
  roomCode,
  roomError,
  onJoinCode,
  onCreateNewCode,
  lang,
}) => {
  const t = COPY[lang];
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== 'undefined' && roomCode
      ? `${window.location.origin}/?room=${roomCode}`
      : '';

  useEffect(() => {
    if (!open || !shareUrl) return;
    let active = true;
    QRCode.toDataURL(shareUrl, {
      width: 220,
      margin: 2,
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
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 shadow-xl"
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
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 flex flex-col items-center border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-slate-50 dark:bg-slate-950/60">
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
