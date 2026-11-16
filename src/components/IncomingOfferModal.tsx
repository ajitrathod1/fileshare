import React from 'react';
import { Check, File, Film, Image as ImageIcon, Music, Package, X } from 'lucide-react';
import { FileCategory, IncomingOfferBatch, Language } from '../types/transfer';
import { formatBytes } from '../utils/crc32';
import { COPY } from '../utils/i18n';

interface IncomingOfferModalProps {
  offer: IncomingOfferBatch | null;
  onAccept: (offer: IncomingOfferBatch) => void;
  onDecline: (offer: IncomingOfferBatch) => void;
  lang: Language;
}

function CategoryIcon({ category }: { category: FileCategory }) {
  if (category === 'video') return <Film className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  if (category === 'audio') return <Music className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  if (category === 'image') return <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  if (category === 'archive') return <Package className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
  return <File className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
}

export const IncomingOfferModal: React.FC<IncomingOfferModalProps> = ({
  offer,
  onAccept,
  onDecline,
  lang,
}) => {
  if (!offer) return null;
  const t = COPY[lang];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {offer.fromPeer.name} {t.incomingTitle}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {offer.files.length} {offer.files.length === 1 ? 'file' : 'files'} · {formatBytes(offer.totalSize)} · {offer.fromPeer.os}
        </p>

        <div className="mt-4 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
          {offer.files.map((file) => (
            <div key={file.transferId} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <CategoryIcon category={file.category} />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                  {file.name}
                </span>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                {formatBytes(file.size)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onDecline(offer)}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <X className="w-4 h-4" />
            <span>{t.declineFiles}</span>
          </button>
          <button
            type="button"
            onClick={() => onAccept(offer)}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Check className="w-4 h-4" />
            <span>{t.acceptFiles}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
