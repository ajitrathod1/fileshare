import React from 'react';
import { Laptop, Link2, Smartphone, Tablet, X } from 'lucide-react';
import { IncomingConnectionRequest, Language, PeerInfo } from '../types/transfer';
import { COPY } from '../utils/i18n';

interface ConnectRequestModalProps {
  request: IncomingConnectionRequest | null;
  onAccept: (req: IncomingConnectionRequest) => void;
  onSkip: (req: IncomingConnectionRequest) => void;
  lang: Language;
}

function DeviceIcon({ type }: { type: PeerInfo['deviceType'] }) {
  if (type === 'phone') return <Smartphone className="w-6 h-6" />;
  if (type === 'tablet') return <Tablet className="w-6 h-6" />;
  return <Laptop className="w-6 h-6" />;
}

export const ConnectRequestModal: React.FC<ConnectRequestModalProps> = ({
  request,
  onAccept,
  onSkip,
  lang,
}) => {
  if (!request) return null;
  const t = COPY[lang];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <DeviceIcon type={request.fromPeer.deviceType} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {request.fromPeer.name}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {t.connectRequestPrompt}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {request.fromPeer.os} · {request.fromPeer.browser} · {request.fromPeer.sameNetwork ? 'Same Wi-Fi' : 'Online'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSkip(request)}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <X className="w-4 h-4" />
            <span>{t.skipConnectionBtn}</span>
          </button>
          <button
            type="button"
            onClick={() => onAccept(request)}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Link2 className="w-4 h-4" />
            <span>{t.acceptConnectionBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
