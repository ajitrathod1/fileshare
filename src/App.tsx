import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Laptop,
  Moon,
  QrCode,
  Send,
  Smartphone,
  Sun,
  Tablet,
  Unlink,
} from 'lucide-react';
import { ConnectRequestModal } from './components/ConnectRequestModal';
import { DeviceListPanel } from './components/DeviceListPanel';
import { IncomingOfferModal } from './components/IncomingOfferModal';
import { MediaPreviewModal } from './components/MediaPreviewModal';
import { QrPairModal } from './components/QrPairModal';
import { TransferWorkspace } from './components/TransferWorkspace';
import { useBeamDrop } from './hooks/useBeamDrop';
import { DeviceType, Language, PeerInfo, TransferRecord } from './types/transfer';
import { COPY } from './utils/i18n';

function DeviceTypeIcon({ type }: { type: DeviceType }) {
  if (type === 'phone') return <Smartphone className="w-4 h-4" />;
  if (type === 'tablet') return <Tablet className="w-4 h-4" />;
  return <Laptop className="w-4 h-4" />;
}

export default function App() {
  const {
    wsConnected,
    roomCode,
    deviceName,
    myDeviceInfo,
    availablePeers,
    roomPeers,
    connectedPeers,
    connectionStates,
    incomingConnectRequests,
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
    requestConnection,
    acceptConnectionRequest,
    skipConnectionRequest,
    disconnectPeer,
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
  const [pairModalTab, setPairModalTab] = useState<'show' | 'scan'>('show');
  const [previewRecord, setPreviewRecord] = useState<TransferRecord | null>(null);

  const openPairingModal = (tab: 'show' | 'scan' = 'show') => {
    setPairModalTab(tab);
    setPairModalOpen(true);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('beamdrop_theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [darkMode]);

  // Combine explicitly connected peers and room-paired peers for transfer readiness
  const readyPeers = React.useMemo(() => {
    const map = new Map<string, PeerInfo>();
    for (const p of connectedPeers) map.set(p.id, p);
    for (const p of roomPeers) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    return Array.from(map.values());
  }, [connectedPeers, roomPeers]);

  // Combine available peers with room peers so everything shows in Available Devices
  const combinedAvailablePeers = React.useMemo(() => {
    const map = new Map<string, PeerInfo>();
    for (const p of roomPeers) map.set(p.id, p);
    for (const p of availablePeers) {
      if (!map.has(p.id)) map.set(p.id, p);
    }
    return Array.from(map.values());
  }, [availablePeers, roomPeers]);

  const selectedPeer: PeerInfo | null =
    readyPeers.find((p) => p.id === selectedPeerId) || (readyPeers.length > 0 ? readyPeers[0] : null);

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
  const activeConnectRequest = incomingConnectRequests[0] || null;

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
              onClick={() => openPairingModal('show')}
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

        {/* Side-by-Side Active Connection Status Bridge */}
        {selectedPeer && (
          <section
            aria-label="Active device connection status"
            className="mt-6 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl px-4 py-3.5 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 min-w-0">
              {/* Local Device */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                  <DeviceTypeIcon type={myDeviceInfo.deviceType} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {deviceName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {myDeviceInfo.os} · {t.deviceLabel}
                  </p>
                </div>
              </div>

              {/* Connection Link Status */}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 px-2">
                <ArrowLeftRight className="w-4 h-4 shrink-0" />
                <span>{t.activeBridgeLabel}</span>
              </div>

              {/* Remote Connected Device */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <DeviceTypeIcon type={selectedPeer.deviceType} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {selectedPeer.name}
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>
                      {selectedPeer.os} · {selectedPeer.sameNetwork ? 'Same Wi-Fi' : 'Online'}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {connectedPeers.some((p) => p.id === selectedPeer.id) && (
              <button
                type="button"
                onClick={() => disconnectPeer(selectedPeer.id)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-center"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>{t.disconnectBtn}</span>
              </button>
            )}
          </section>
        )}

        {/* Primary 2-Column Transfer Workspace */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5">
            <DeviceListPanel
              deviceName={deviceName}
              onRenameDevice={updateDeviceName}
              wsConnected={wsConnected}
              roomCode={roomCode}
              availablePeers={combinedAvailablePeers}
              connectedPeers={readyPeers}
              connectionStates={connectionStates}
              selectedPeerId={selectedPeer?.id ?? null}
              onSelectPeer={(peer) => setSelectedPeerId(peer.id)}
              onRequestConnect={requestConnection}
              onDisconnectPeer={disconnectPeer}
              onOpenPairing={openPairingModal}
              lang={lang}
            />
          </div>

          <div className="lg:col-span-7">
            <TransferWorkspace
              connectedPeers={readyPeers}
              availablePeers={combinedAvailablePeers}
              connectionStates={connectionStates}
              selectedPeer={selectedPeer}
              onSelectPeer={(peer) => setSelectedPeerId(peer.id)}
              onRequestConnect={requestConnection}
              onOpenPairing={() => openPairingModal('show')}
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
            onClick={() => (selectedPeer ? handleSendQueue() : openPairingModal('show'))}
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
        initialTab={pairModalTab}
        onClose={() => setPairModalOpen(false)}
        roomCode={roomCode}
        roomError={roomError}
        onJoinCode={joinRoomCode}
        onCreateNewCode={createNewRoomCode}
        lang={lang}
      />

      <ConnectRequestModal
        request={activeConnectRequest}
        onAccept={acceptConnectionRequest}
        onSkip={skipConnectionRequest}
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
