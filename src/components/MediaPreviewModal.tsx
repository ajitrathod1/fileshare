import React from 'react';
import { Download, ShieldCheck, X } from 'lucide-react';
import { Language, TransferRecord } from '../types/transfer';
import { formatBytes } from '../utils/crc32';
import { COPY } from '../utils/i18n';

interface MediaPreviewModalProps {
  record: TransferRecord | null;
  onClose: () => void;
  onDownload: (blobUrl: string, fileName: string) => void;
  lang: Language;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  record,
  onClose,
  onDownload,
  lang,
}) => {
  if (!record || !record.blobUrl) return null;
  const t = COPY[lang];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {record.fileName}
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="tabular-nums">{formatBytes(record.fileSize)}</span>
              {record.verifiedLossless && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{t.losslessVerified}</span>
                  </span>
                </>
              )}
              {record.crc32Actual && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">CRC32 {record.crc32Actual}</span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 bg-slate-950 flex items-center justify-center min-h-[220px] max-h-[65vh]">
          {record.category === 'video' && (
            <video
              src={record.blobUrl}
              controls
              playsInline
              autoPlay
              className="w-full max-h-[58vh] rounded-lg bg-black"
            />
          )}
          {record.category === 'audio' && (
            <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <p className="text-sm font-medium text-slate-100 truncate mb-4">
                {record.fileName}
              </p>
              <audio src={record.blobUrl} controls autoPlay className="w-full" />
            </div>
          )}
          {record.category === 'image' && (
            <img
              src={record.blobUrl}
              alt={record.fileName}
              className="max-w-full max-h-[58vh] object-contain rounded-lg"
              referrerPolicy="no-referrer"
            />
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onDownload(record.blobUrl!, record.fileName)}
            className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{t.saveFile}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
