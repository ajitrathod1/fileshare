import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Download,
  File,
  Film,
  Image as ImageIcon,
  Laptop,
  Link2,
  Music,
  Package,
  Play,
  QrCode,
  Send,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { FileCategory, Language, PeerConnectionState, PeerInfo, TransferRecord } from '../types/transfer';
import { formatBytes, formatEta, formatSpeed, getFileCategory } from '../utils/crc32';
import { COPY } from '../utils/i18n';

interface TransferWorkspaceProps {
  connectedPeers: PeerInfo[];
  availablePeers: PeerInfo[];
  connectionStates: Record<string, PeerConnectionState>;
  selectedPeer: PeerInfo | null;
  onSelectPeer: (peer: PeerInfo) => void;
  onRequestConnect: (peer: PeerInfo) => void;
  onOpenPairing: () => void;
  queuedFiles: File[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveQueuedFile: (index: number) => void;
  onClearQueue: () => void;
  onSendQueue: () => void;
  transfers: TransferRecord[];
  onCancelTransfer: (transferId: string, peerId: string) => void;
  onClearFinished: () => void;
  onPreviewMedia: (record: TransferRecord) => void;
  onDownloadFile: (blobUrl: string, fileName: string) => void;
  autoAccept: boolean;
  onToggleAutoAccept: (val: boolean) => void;
  autoDownload: boolean;
  onToggleAutoDownload: (val: boolean) => void;
  lang: Language;
}

function FileTypeIcon({ category }: { category: FileCategory }) {
  if (category === 'video') return <Film className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  if (category === 'audio') return <Music className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  if (category === 'image') return <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  if (category === 'archive') return <Package className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
  return <File className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
}

function PeerSmallIcon({ type }: { type: PeerInfo['deviceType'] }) {
  if (type === 'phone') return <Smartphone className="w-3.5 h-3.5" />;
  if (type === 'tablet') return <Tablet className="w-3.5 h-3.5" />;
  return <Laptop className="w-3.5 h-3.5" />;
}

export const TransferWorkspace: React.FC<TransferWorkspaceProps> = ({
  connectedPeers,
  availablePeers,
  connectionStates,
  selectedPeer,
  onSelectPeer,
  onRequestConnect,
  onOpenPairing,
  queuedFiles,
  onAddFiles,
  onRemoveQueuedFile,
  onClearQueue,
  onSendQueue,
  transfers,
  onCancelTransfer,
  onClearFinished,
  onPreviewMedia,
  onDownloadFile,
  autoAccept,
  onToggleAutoAccept,
  autoDownload,
  onToggleAutoDownload,
  lang,
}) => {
  const t = COPY[lang];
  const anyFileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);
  const progressSectionRef = useRef<HTMLElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dismissedConfirmationId, setDismissedConfirmationId] = useState<string | null>(null);

  const totalQueuedBytes = queuedFiles.reduce((acc, f) => acc + f.size, 0);

  const latestConfirmedSent = transfers.find(
    (item) =>
      item.direction === 'send' &&
      item.status === 'completed' &&
      item.verifiedLossless &&
      item.transferId !== dismissedConfirmationId
  );

  const latestReceivedReady = transfers.find(
    (item) =>
      item.direction === 'receive' &&
      item.status === 'completed' &&
      Boolean(item.blobUrl) &&
      item.transferId !== dismissedConfirmationId
  );

  // Reset dismissal when a newer sent transfer completes
  const latestSentId = transfers.find(
    (item) => item.direction === 'send' && item.status === 'completed'
  )?.transferId;

  useEffect(() => {
    if (latestSentId && latestSentId !== dismissedConfirmationId) {
      // keep latest confirmation visible
    }
  }, [latestSentId, dismissedConfirmationId]);

  const handleSendClick = () => {
    if (!selectedPeer) {
      onOpenPairing();
      return;
    }
    onSendQueue();
    setTimeout(() => {
      progressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  const getStatusText = (rec: TransferRecord) => {
    switch (rec.status) {
      case 'waiting-accept':
        return t.statusWaiting;
      case 'connecting':
        return t.statusConnecting;
      case 'transferring':
        return t.statusTransferring;
      case 'verifying':
        return rec.direction === 'receive'
          ? lang === 'hi'
            ? 'फाइल की गुणवत्ता (CRC-32) चेक हो रही है...'
            : 'Verifying lossless checksum...'
          : t.statusVerifying;
      case 'completed':
        return rec.direction === 'receive'
          ? lang === 'hi'
            ? 'फाइल मिल गई — सेव करने के लिए तैयार'
            : 'Received — Ready to Save'
          : t.statusCompleted;
      case 'declined':
        return t.statusDeclined;
      case 'cancelled':
        return t.statusCancelled;
      case 'error':
        return rec.errorMessage || t.statusError;
    }
  };

  const receivedCompleted = transfers.filter(
    (item) => item.direction === 'receive' && item.status === 'completed' && item.blobUrl
  );

  return (
    <div className="space-y-6">
      {/* Connected Devices Strip + Dropzone & File Picker Card */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
        <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {connectedPeers.length > 0 ? t.chooseRecipientLabel : t.connectedToLabel}
            </span>
            {connectedPeers.length === 0 && availablePeers.length === 0 && (
              <button
                type="button"
                onClick={onOpenPairing}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{t.pairDevice}</span>
              </button>
            )}
          </div>

          {connectedPeers.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {connectedPeers.map((peer) => {
                const isSelected = selectedPeer?.id === peer.id;
                return (
                  <button
                    key={peer.id}
                    type="button"
                    onClick={() => onSelectPeer(peer)}
                    className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium transition-colors inline-flex items-center gap-2 whitespace-nowrap ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <PeerSmallIcon type={peer.deviceType} />
                    <span>{peer.name}</span>
                    <span className={isSelected ? 'text-blue-100' : 'text-emerald-600 dark:text-emerald-400'}>
                      · {t.activeBridgeLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : availablePeers.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {availablePeers.map((peer) => {
                const state = connectionStates[peer.id] || 'idle';
                return (
                  <button
                    key={peer.id}
                    type="button"
                    onClick={() => onRequestConnect(peer)}
                    disabled={state === 'requesting'}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <PeerSmallIcon type={peer.deviceType} />
                    <span>{peer.name}</span>
                    <span className="text-blue-600 dark:text-blue-400 inline-flex items-center gap-1">
                      {state === 'requesting' ? (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>{t.waitingBtn}</span>
                        </>
                      ) : (
                        <>
                          <Link2 className="w-3.5 h-3.5" />
                          <span>{t.connectBtn}</span>
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
              {t.noDeviceConnected}
            </p>
          )}
        </div>

        <input
          ref={anyFileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onAddFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <input
          ref={mediaFileInputRef}
          type="file"
          multiple
          accept="video/*,audio/*,image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onAddFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`mt-5 border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-colors ${
            dragActive
              ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/40'
          }`}
        >
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Upload className="w-5 h-5" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.dropzoneTitle}
          </h3>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t.dropzoneSubtitle}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => mediaFileInputRef.current?.click()}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Film className="w-4 h-4" />
              <span>{t.pickVideoAudio}</span>
            </button>
            <button
              type="button"
              onClick={() => anyFileInputRef.current?.click()}
              className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <File className="w-4 h-4" />
              <span>{t.pickAnyFiles}</span>
            </button>
          </div>
        </div>

        {/* Staged Outgoing Queue + Always-Visible Send Action */}
        {queuedFiles.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                {t.queuedFiles} · {queuedFiles.length} {queuedFiles.length === 1 ? 'file' : 'files'} · {formatBytes(totalQueuedBytes)}
              </p>
              <button
                type="button"
                onClick={onClearQueue}
                className="min-h-[36px] px-2.5 text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.clearQueue}</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
              {queuedFiles.map((file, idx) => {
                const cat = getFileCategory(file.type || '', file.name);
                return (
                  <div key={`${file.name}-${file.size}-${idx}`} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileTypeIcon category={cat} />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {file.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {formatBytes(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveQueuedFile(idx)}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedPeer
                  ? `${t.selectedRecipient}: ${selectedPeer.name} (${selectedPeer.os})`
                  : t.selectRecipientHint}
              </p>
              <button
                type="button"
                onClick={handleSendClick}
                className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
              >
                {selectedPeer ? <Send className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
                <span>
                  {selectedPeer
                    ? `${t.sendingTo} ${selectedPeer.name} (${queuedFiles.length})`
                    : t.selectDeviceFirstBtn}
                </span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Sent Confirmation Banner */}
      {latestConfirmedSent && (
        <section
          role="status"
          className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-4"
        >
          <div className="flex items-start gap-3 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                {t.sentSuccessTitle} · {latestConfirmedSent.fileName}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 tabular-nums">
                {t.sentSuccessBody} ({latestConfirmedSent.peerName} · {formatBytes(latestConfirmedSent.fileSize)} · CRC32 {latestConfirmedSent.crc32Actual})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedConfirmationId(latestConfirmedSent.transferId)}
            className="min-h-[36px] px-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors shrink-0"
          >
            {t.dismissBanner}
          </button>
        </section>
      )}

      {/* Received & Ready to Save Banner */}
      {latestReceivedReady && latestReceivedReady.blobUrl && (
        <section
          role="status"
          className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-4 sm:p-5 space-y-3"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 truncate">
                  {lang === 'hi' ? 'फाइल रिसीव हो गई!' : 'File received!'} · {latestReceivedReady.fileName}
                </h3>
                <p className="mt-0.5 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 tabular-nums">
                  {formatBytes(latestReceivedReady.fileSize)} · {latestReceivedReady.peerName} · CRC32 {latestReceivedReady.crc32Actual}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedConfirmationId(latestReceivedReady.transferId)}
              className="min-h-[36px] px-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors shrink-0"
            >
              {t.dismissBanner}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onDownloadFile(latestReceivedReady.blobUrl!, latestReceivedReady.fileName)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>{lang === 'hi' ? 'फोन में सेव करें (Save)' : 'Save to Device'}</span>
            </button>
            {(latestReceivedReady.category === 'video' ||
              latestReceivedReady.category === 'audio' ||
              latestReceivedReady.category === 'image') && (
              <button
                type="button"
                onClick={() => onPreviewMedia(latestReceivedReady)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-200 text-sm font-medium hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                <span>{t.previewMedia}</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Live Transfer Progress & Queue */}
      <section
        ref={progressSectionRef}
        id="transfer-progress-section"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.activeTransfers}
          </h3>
          {transfers.length > 0 && (
            <button
              type="button"
              onClick={onClearFinished}
              className="min-h-[36px] px-3 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t.clearFinished}
            </button>
          )}
        </div>

        <div className="py-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-100 dark:border-slate-800">
          <label className="inline-flex items-center gap-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 cursor-pointer min-h-[36px]">
            <input
              type="checkbox"
              checked={autoAccept}
              onChange={(e) => onToggleAutoAccept(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>{t.autoAcceptLabel}</span>
          </label>
          <label className="inline-flex items-center gap-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 cursor-pointer min-h-[36px]">
            <input
              type="checkbox"
              checked={autoDownload}
              onChange={(e) => onToggleAutoDownload(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>{t.autoDownloadLabel}</span>
          </label>
        </div>

        {transfers.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t.noTransfersTitle}
            </p>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {t.noTransfersBody}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {transfers.map((rec) => {
              const pct =
                rec.fileSize > 0
                  ? Math.min(100, Math.round((rec.bytesTransferred / rec.fileSize) * 100))
                  : rec.status === 'completed'
                    ? 100
                    : 0;
              const isActive =
                rec.status === 'waiting-accept' ||
                rec.status === 'connecting' ||
                rec.status === 'transferring' ||
                rec.status === 'verifying';
              const canPreview =
                rec.direction === 'receive' &&
                rec.status === 'completed' &&
                Boolean(rec.blobUrl) &&
                (rec.category === 'video' || rec.category === 'audio' || rec.category === 'image');

              return (
                <div key={rec.transferId} className="py-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                        <FileTypeIcon category={rec.category} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {rec.fileName}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                            {rec.direction === 'send' ? (
                              <ArrowUpRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            )}
                            <span>{rec.peerName}</span>
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {formatBytes(rec.bytesTransferred)} / {formatBytes(rec.fileSize)}
                          </span>
                          {rec.status === 'transferring' && rec.speedBps > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-slate-700 dark:text-slate-200">
                                {formatSpeed(rec.speedBps)}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{formatEta(rec.etaSeconds)}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>
                            {rec.transport === 'webrtc-p2p' ? 'Direct P2P' : 'Relay'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isActive && (
                        <button
                          type="button"
                          onClick={() => onCancelTransfer(rec.transferId, rec.peerId)}
                          className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      {canPreview && (
                        <button
                          type="button"
                          onClick={() => onPreviewMedia(rec)}
                          className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>{t.previewMedia}</span>
                        </button>
                      )}
                      {rec.direction === 'receive' && rec.status === 'completed' && rec.blobUrl && (
                        <button
                          type="button"
                          onClick={() => onDownloadFile(rec.blobUrl!, rec.fileName)}
                          className="min-h-[36px] px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{t.saveFile}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* High-Visibility Progress Bar */}
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 ${
                        rec.status === 'completed' && rec.verifiedLossless
                          ? 'bg-emerald-600'
                          : rec.status === 'error' || rec.status === 'declined' || rec.status === 'cancelled'
                            ? 'bg-rose-500'
                            : 'bg-blue-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    {rec.status === 'completed' && rec.verifiedLossless ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{t.losslessVerified}</span>
                        {rec.crc32Actual && (
                          <span className="font-mono text-slate-500 dark:text-slate-400 font-normal">
                            · {rec.crc32Actual}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span
                        className={
                          rec.status === 'error'
                            ? 'text-rose-600 dark:text-rose-400 font-medium'
                            : rec.status === 'transferring' || rec.status === 'verifying'
                              ? 'text-blue-600 dark:text-blue-400 font-medium'
                              : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {getStatusText(rec)}
                      </span>
                    )}
                    <span className="font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Received Files Section */}
      {receivedCompleted.length > 0 && (
        <section
          id="received-section"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6"
        >
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 pb-4 border-b border-slate-100 dark:border-slate-800">
            {t.receivedGallery} ({receivedCompleted.length})
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {receivedCompleted.map((rec) => {
              const isMedia =
                rec.category === 'video' || rec.category === 'audio' || rec.category === 'image';
              return (
                <div
                  key={`recv-${rec.transferId}`}
                  className="py-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <FileTypeIcon category={rec.category} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {rec.fileName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatBytes(rec.fileSize)} · {rec.peerName} · CRC32 {rec.crc32Actual}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isMedia && (
                      <button
                        type="button"
                        onClick={() => onPreviewMedia(rec)}
                        className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{t.previewMedia}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDownloadFile(rec.blobUrl!, rec.fileName)}
                      className="min-h-[40px] px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t.saveFile}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
