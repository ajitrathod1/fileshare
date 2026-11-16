import React, { useEffect, useState } from 'react';
import { Moon, QrCode, Send, Sun } from 'lucide-react';
import { DeviceListPanel } from './components/DeviceListPanel';
import { IncomingOfferModal } from './components/IncomingOfferModal';
import { MediaPreviewModal } from './components/MediaPreviewModal';
import { QrPairModal } from './components/QrPairModal';
import { TransferWorkspace } from './components/TransferWorkspace';
import { useBeamDrop } from './hooks/useBeamDrop';
import { Language, PeerInfo, TransferRecord } from './types/transfer';
import { COPY } from './utils/i18n';

export default function App() {
  const {
    wsConnected,
    roomCode,
    deviceName,
    nearbyPeers,
    roomPeers,
    allPeers,
    transfers,
    incomingOffers,
    autoAccept,
    setAutoAccept,
    autoDownload,
    setAutoDownload,
    roomError,
    updateDeviceName,
    joinRoomCode,
    createNewRoomCode,
    sendFilesToPeer,
    acceptOfferBatch,
    declineOfferBatch,
    cancelTransfer,
    clearCompletedTransfers,
    triggerBrowserDownload,
  } = useBeamDrop();

  const [lang, setLang] = useState<Language>('en');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('beamdrop_theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [pairModalOpen, setPairModalOpen] = useState(false);
  const [previewRecord, setPreviewRecord] = useState<TransferRecord | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('beamdrop_theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [darkMode]);

  // Auto-select first available peer if none selected or selected peer disconnected
  const selectedPeer: PeerInfo | null =
    allPeers.find((p) => p.id === selectedPeerId) || (allPeers.length === 1 ? allPeers[0] : null);

  useEffect(() => {
    if (selectedPeer && selectedPeer.id !== selectedPeerId) {
      setSelectedPeerId(selectedPeer.id);
    } else if (!selectedPeer && selectedPeerId !== null) {
      setSelectedPeerId(null);
    }
  }, [selectedPeer, selectedPeerId]);

  const t = COPY[lang];

  const handleAddFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;
    setQueuedFiles((prev) => [...prev, ...incoming]);
  };

  const handleRemoveQueuedFile = (index: number) => {
    setQueuedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendQueue = () => {
    if (!selectedPeer || queuedFiles.length === 0) return;
    sendFilesToPeer(selectedPeer, queuedFiles);
    setQueuedFiles([]);
  };

  const activeOffer = incomingOffers[0] || null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#transfer-section"
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            BeamDrop
          </a>

          {/* Zone 2: Concise Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#transfer-section"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navTransfer}
            </a>
            <a
              href="#received-section"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navReceived}
            </a>
            <a
              href="#how-it-works"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navHowItWorks}
            </a>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setPairModalOpen(true)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <QrCode className="w-4 h-4" />
              <span>{t.pairDevice}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-24 sm:pb-14">
        {/* Hero Intro + Workspace Toolbar */}
        <section id="transfer-section" className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-2xl">
            <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 [text-wrap:balance]">
              {t.heroTitle}
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.heroSubtitle}
            </p>
          </div>

          {/* Workspace Preferences Bar (outside header) */}
          <div className="flex items-center gap-3 self-start lg:self-end shrink-0">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  lang === 'en'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang('hi')}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  lang === 'hi'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                हिन्दी
              </button>
            </div>

            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </section>

        {/* Primary 2-Column Transfer Workspace */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5">
            <DeviceListPanel
              deviceName={deviceName}
              onRenameDevice={updateDeviceName}
              wsConnected={wsConnected}
              roomCode={roomCode}
              nearbyPeers={nearbyPeers}
              roomPeers={roomPeers}
              selectedPeerId={selectedPeer?.id ?? null}
              onSelectPeer={(peer) => setSelectedPeerId(peer.id)}
              onOpenPairing={() => setPairModalOpen(true)}
              lang={lang}
            />
          </div>

          <div className="lg:col-span-7">
            <TransferWorkspace
              allPeers={allPeers}
              selectedPeer={selectedPeer}
              onSelectPeer={(peer) => setSelectedPeerId(peer.id)}
              onOpenPairing={() => setPairModalOpen(true)}
              queuedFiles={queuedFiles}
              onAddFiles={handleAddFiles}
              onRemoveQueuedFile={handleRemoveQueuedFile}
              onClearQueue={() => setQueuedFiles([])}
              onSendQueue={handleSendQueue}
              transfers={transfers}
              onCancelTransfer={cancelTransfer}
              onClearFinished={clearCompletedTransfers}
              onPreviewMedia={(rec) => setPreviewRecord(rec)}
              onDownloadFile={triggerBrowserDownload}
              autoAccept={autoAccept}
              onToggleAutoAccept={setAutoAccept}
              autoDownload={autoDownload}
              onToggleAutoDownload={setAutoDownload}
              lang={lang}
            />
          </div>
        </div>

        {/* How It Works Section */}
        <section
          id="how-it-works"
          className="mt-14 pt-10 border-t border-slate-200 dark:border-slate-800"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t.howStep1Title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.howStep1Body}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t.howStep2Title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.howStep2Body}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t.howStep3Title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.howStep3Body}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile Sticky Bottom Send Bar (appears when files are queued) */}
      {queuedFiles.length > 0 && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => (selectedPeer ? handleSendQueue() : setPairModalOpen(true))}
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
          >
            {selectedPeer ? <Send className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
            <span>
              {selectedPeer
                ? `${t.sendingTo} ${selectedPeer.name} (${queuedFiles.length})`
                : t.selectDeviceFirstBtn}
            </span>
          </button>
        </div>
      )}

      {/* Modals */}
      <QrPairModal
        open={pairModalOpen}
        onClose={() => setPairModalOpen(false)}
        roomCode={roomCode}
        roomError={roomError}
        onJoinCode={joinRoomCode}
        onCreateNewCode={createNewRoomCode}
        lang={lang}
      />

      <IncomingOfferModal
        offer={activeOffer}
        onAccept={acceptOfferBatch}
        onDecline={declineOfferBatch}
        lang={lang}
      />

      <MediaPreviewModal
        record={previewRecord}
        onClose={() => setPreviewRecord(null)}
        onDownload={triggerBrowserDownload}
        lang={lang}
      />
    </div>
  );
}
