import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Laptop,
  Link2,
  QrCode,
  Smartphone,
  Tablet,
  Unlink,
  Wifi,
} from 'lucide-react';
import { Language, PeerConnectionState, PeerInfo } from '../types/transfer';
import { COPY } from '../utils/i18n';

interface DeviceListPanelProps {
  deviceName: string;
  onRenameDevice: (name: string) => void;
  wsConnected: boolean;
  roomCode: string;
  availablePeers: PeerInfo[];
  connectedPeers: PeerInfo[];
  connectionStates: Record<string, PeerConnectionState>;
  selectedPeerId: string | null;
  onSelectPeer: (peer: PeerInfo) => void;
  onRequestConnect: (peer: PeerInfo) => void;
  onDisconnectPeer: (peerId: string) => void;
  onOpenPairing: () => void;
  lang: Language;
}

function PeerIcon({ type }: { type: PeerInfo['deviceType'] }) {
  if (type === 'phone') return <Smartphone className="w-5 h-5" />;
  if (type === 'tablet') return <Tablet className="w-5 h-5" />;
  return <Laptop className="w-5 h-5" />;
}

export const DeviceListPanel: React.FC<DeviceListPanelProps> = ({
  deviceName,
  onRenameDevice,
  wsConnected,
  roomCode,
  availablePeers,
  connectedPeers,
  connectionStates,
  selectedPeerId,
  onSelectPeer,
  onRequestConnect,
  onDisconnectPeer,
  onOpenPairing,
  lang,
}) => {
  const t = COPY[lang];
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(deviceName);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (draftName.trim()) {
      onRenameDevice(draftName.trim());
    }
    setEditing(false);
  };

  const connectedIds = new Set(connectedPeers.map((p) => p.id));
  const unconnectedAvailable = availablePeers.filter((p) => !connectedIds.has(p.id));
  const totalVisible = connectedPeers.length + unconnectedAvailable.length;

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      {/* Own Device Identity Row */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t.deviceLabel}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {wsConnected ? `Room ${roomCode || '------'}` : 'Reconnecting...'}
          </span>
        </div>

        {editing ? (
          <form onSubmit={handleSaveName} className="mt-2.5 flex items-center gap-2">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={48}
              autoFocus
              className="flex-1 min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Check className="w-4 h-4" />
              <span>{t.saveName}</span>
            </button>
          </form>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {deviceName}
            </p>
            <button
              type="button"
              onClick={() => {
                setDraftName(deviceName);
                setEditing(true);
              }}
              className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{t.editName}</span>
            </button>
          </div>
        )}
      </div>

      {/* Connected & Available Devices List */}
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t.availableDevicesTitle}
          </h2>
          <span
            className={`text-xs font-medium tabular-nums ${
              totalVisible > 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {totalVisible > 0 ? `${totalVisible} ${t.devicesOnlineCount}` : t.noDevicesBadge}
          </span>
        </div>

        {totalVisible === 0 ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <Wifi className="w-6 h-6" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t.noDevicesTitle}
            </h3>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              {t.noDevicesBody}
            </p>
            <button
              type="button"
              onClick={onOpenPairing}
              className="mt-5 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2 whitespace-nowrap"
            >
              <QrCode className="w-4 h-4" />
              <span>{t.openPairing}</span>
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {/* Connected Devices */}
            {connectedPeers.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
                  {t.connectedDevicesSection}
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {connectedPeers.map((peer) => {
                    const isSelected = selectedPeerId === peer.id;
                    return (
                      <div
                        key={peer.id}
                        className={`py-3 px-3 -mx-1 rounded-xl flex items-center justify-between gap-2 transition-colors ${
                          isSelected
                            ? 'bg-emerald-50/80 dark:bg-emerald-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectPeer(peer)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left min-h-[44px]"
                        >
                          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <PeerIcon type={peer.deviceType} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {peer.name}
                            </p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 truncate flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>
                                {t.activeBridgeLabel} · {peer.os} · {peer.sameNetwork ? 'Same Wi-Fi' : 'Online'}
                              </span>
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDisconnectPeer(peer.id)}
                          className="min-h-[36px] px-2.5 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1 shrink-0"
                          title={t.disconnectBtn}
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t.disconnectBtn}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available Devices Waiting to Connect */}
            {unconnectedAvailable.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  {t.nearbyDevices}
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {unconnectedAvailable.map((peer) => {
                    const state = connectionStates[peer.id] || 'idle';
                    return (
                      <div
                        key={peer.id}
                        className="py-3 px-2 -mx-1 rounded-xl flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                            <PeerIcon type={peer.deviceType} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {peer.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {peer.os} · {peer.browser} · {peer.sameNetwork ? 'Same Wi-Fi' : 'Online'}
                              {state === 'skipped' ? ` · ${t.skippedLabel}` : ''}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onRequestConnect(peer)}
                          disabled={state === 'requesting'}
                          className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                            state === 'requesting'
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-wait'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
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
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onOpenPairing}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <QrCode className="w-4 h-4" />
                <span>{t.openPairing}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
