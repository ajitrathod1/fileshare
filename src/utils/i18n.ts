import { Language } from '../types/transfer';

export const COPY: Record<
  Language,
  {
    navTransfer: string;
    navReceived: string;
    navHowItWorks: string;
    pairDevice: string;
    heroTitle: string;
    heroSubtitle: string;
    deviceLabel: string;
    editName: string;
    saveName: string;
    availableDevicesTitle: string;
    devicesOnlineCount: string;
    noDevicesBadge: string;
    nearbyDevices: string;
    pairedDevices: string;
    connectedDevicesSection: string;
    connectBtn: string;
    waitingBtn: string;
    skippedLabel: string;
    disconnectBtn: string;
    activeBridgeLabel: string;
    connectRequestPrompt: string;
    acceptConnectionBtn: string;
    skipConnectionBtn: string;
    noDevicesTitle: string;
    noDevicesBody: string;
    openPairing: string;
    connectedToLabel: string;
    noDeviceConnected: string;
    chooseRecipientLabel: string;
    selectedRecipient: string;
    selectRecipientHint: string;
    dropzoneTitle: string;
    dropzoneSubtitle: string;
    pickAnyFiles: string;
    pickVideoAudio: string;
    queuedFiles: string;
    clearQueue: string;
    sendNow: string;
    sendingTo: string;
    selectDeviceFirstBtn: string;
    activeTransfers: string;
    clearFinished: string;
    noTransfersTitle: string;
    noTransfersBody: string;
    receivedGallery: string;
    saveFile: string;
    previewMedia: string;
    autoAcceptLabel: string;
    autoDownloadLabel: string;
    incomingTitle: string;
    acceptFiles: string;
    declineFiles: string;
    pairModalTitle: string;
    pairModalDesc: string;
    yourPairCode: string;
    copyLink: string;
    copied: string;
    newCode: string;
    joinCodeLabel: string;
    joinCodeBtn: string;
    losslessVerified: string;
    sentSuccessTitle: string;
    sentSuccessBody: string;
    dismissBanner: string;
    howStep1Title: string;
    howStep1Body: string;
    howStep2Title: string;
    howStep2Body: string;
    howStep3Title: string;
    howStep3Body: string;
    statusWaiting: string;
    statusConnecting: string;
    statusTransferring: string;
    statusVerifying: string;
    statusCompleted: string;
    statusDeclined: string;
    statusCancelled: string;
    statusError: string;
    transportP2P: string;
    transportRelay: string;
    slowLargeFileTip: string;
  }
> = {
  en: {
    navTransfer: 'Transfer',
    navReceived: 'Received',
    navHowItWorks: 'How it works',
    pairDevice: 'Pair Code / QR',
    heroTitle: 'Direct high-speed file transfer with zero compression.',
    heroSubtitle:
      'Send full-resolution videos, audio tracks, photos, and documents directly between phones and computers. Verified byte-for-byte with CRC-32.',
    deviceLabel: 'Your device',
    editName: 'Rename',
    saveName: 'Save',
    availableDevicesTitle: 'Available Devices',
    devicesOnlineCount: 'online',
    noDevicesBadge: '0 devices online yet',
    nearbyDevices: 'Online & Ready to Connect',
    pairedDevices: 'Paired via Room Code',
    connectedDevicesSection: 'Connected Devices',
    connectBtn: 'Connect',
    waitingBtn: 'Waiting...',
    skippedLabel: 'Skipped',
    disconnectBtn: 'Disconnect',
    activeBridgeLabel: 'Connected',
    connectRequestPrompt: 'wants to connect with your device to share files.',
    acceptConnectionBtn: 'Connect',
    skipConnectionBtn: 'Skip',
    noDevicesTitle: 'No other devices online yet',
    noDevicesBody:
      'Open BeamDrop on your second phone or computer — it will appear here automatically so you can tap Connect.',
    openPairing: 'Pair via QR / 6-Digit Code',
    connectedToLabel: 'Connection Status',
    noDeviceConnected: 'Tap Connect on any available device to start sharing',
    chooseRecipientLabel: 'Send files to',
    selectedRecipient: 'Sending to',
    selectRecipientHint: 'Connect to a device first to send files',
    dropzoneTitle: 'Drop or pick videos, audio, photos, or any file',
    dropzoneSubtitle: 'Original quality preserved · Direct P2P transfer · Zero server/database storage',
    pickAnyFiles: 'Choose Any Files',
    pickVideoAudio: 'Pick Videos & Audio',
    queuedFiles: 'Selected & ready to send',
    clearQueue: 'Clear',
    sendNow: 'Send Files',
    sendingTo: 'Send to',
    selectDeviceFirstBtn: 'Pair or Connect a Device',
    activeTransfers: 'Live Transfer Progress',
    clearFinished: 'Clear finished',
    noTransfersTitle: 'No active transfers',
    noTransfersBody: 'Pick media files above and press Send to watch live transfer speed and verification.',
    receivedGallery: 'Received Files',
    saveFile: 'Save',
    previewMedia: 'Preview',
    autoAcceptLabel: 'Auto-accept incoming files',
    autoDownloadLabel: 'Auto-save when complete',
    incomingTitle: 'wants to send files',
    acceptFiles: 'Accept & Receive',
    declineFiles: 'Decline',
    pairModalTitle: 'Pair with another phone or PC',
    pairModalDesc: 'Scan the QR code with your phone camera or enter the 6-digit code on the other device.',
    yourPairCode: 'Your pairing code',
    copyLink: 'Copy Invite Link',
    copied: 'Link Copied',
    newCode: 'New Code',
    joinCodeLabel: 'Or enter code from another device',
    joinCodeBtn: 'Connect',
    losslessVerified: 'Sent & Verified Lossless (CRC-32)',
    sentSuccessTitle: 'File sent successfully',
    sentSuccessBody: 'Delivered with 0% data loss and verified by the receiving device.',
    dismissBanner: 'Dismiss',
    howStep1Title: '01. Find & Connect',
    howStep1Body: 'Available devices appear automatically. Tap Connect to send a quick request — the other device can tap Connect or Skip.',
    howStep2Title: '02. Select original media',
    howStep2Body: 'Pick videos, audio recordings, photos, or ZIP archives. Files stream in 4 MB disk blocks over an 8 MB WebRTC pipeline and write directly to disk without filling phone RAM.',
    howStep3Title: '03. Verified arrival',
    howStep3Body: 'WebRTC DataChannel transfers directly device-to-device with CRC-32 checksum verification. Nothing is ever saved in a backend database or cloud storage.',
    statusWaiting: 'Waiting for receiver to tap Accept...',
    statusConnecting: 'Connecting to device...',
    statusTransferring: 'Sending...',
    statusVerifying: 'Confirming delivery with receiver...',
    statusCompleted: 'Sent & Confirmed',
    statusDeclined: 'Declined by receiver',
    statusCancelled: 'Cancelled',
    statusError: 'Failed',
    transportP2P: 'Direct Wi-Fi / LAN P2P',
    transportRelay: 'Internet Relay',
    slowLargeFileTip:
      'Large file speed tip: Connect both phones to the same Wi-Fi (or turn on Mobile Hotspot on one phone and connect the other) for 20–80 MB/s Direct P2P speed instead of slow cellular relay.',
  },
  hi: {
    navTransfer: 'शेयर करें',
    navReceived: 'रिसीव्ड फाइल्स',
    navHowItWorks: 'कैसे काम करता है',
    pairDevice: 'QR / कोड जोड़ें',
    heroTitle: 'फुल स्पीड और बिना डेटा लॉस के सीधे फाइल ट्रांसफर।',
    heroSubtitle:
      'वीडियो, ऑडियो, फोटो और डॉक्यूमेंट्स को बिना क्वालिटी कम किए एक फोन से दूसरे फोन या कंप्यूटर में सीधे भेजें।',
    deviceLabel: 'आपका डिवाइस',
    editName: 'नाम बदलें',
    saveName: 'सेव',
    availableDevicesTitle: 'उपलब्ध डिवाइस (Available)',
    devicesOnlineCount: 'ऑनलाइन',
    noDevicesBadge: 'अभी 0 डिवाइस ऑनलाइन',
    nearbyDevices: 'कनेक्ट करने के लिए उपलब्ध',
    pairedDevices: 'कोड से जुड़े डिवाइस',
    connectedDevicesSection: 'कनेक्टेड डिवाइस',
    connectBtn: 'Connect',
    waitingBtn: 'इंतज़ार...',
    skippedLabel: 'Skip किया गया',
    disconnectBtn: 'हटाएं',
    activeBridgeLabel: 'कनेक्टेड',
    connectRequestPrompt: 'आपसे फाइल शेयर करने के लिए कनेक्ट होना चाहता है।',
    acceptConnectionBtn: 'Connect करें',
    skipConnectionBtn: 'Skip करें',
    noDevicesTitle: 'अभी कोई दूसरा डिवाइस ऑनलाइन नहीं है',
    noDevicesBody:
      'अपने दूसरे फोन या PC में यही वेबसाइट खोलें — डिवाइस यहां अपने-आप दिख जाएगा और आप Connect दबा सकते हैं।',
    openPairing: 'QR और 6-अंक का कोड देखें',
    connectedToLabel: 'कनेक्शन स्टेटस',
    noDeviceConnected: 'फाइल भेजने के लिए किसी उपलब्ध डिवाइस पर Connect दबाएं',
    chooseRecipientLabel: 'इस डिवाइस को भेजें',
    selectedRecipient: 'इसे भेज रहे हैं',
    selectRecipientHint: 'फाइल भेजने के लिए पहले डिवाइस से Connect करें',
    dropzoneTitle: 'वीडियो, ऑडियो, फोटो या कोई भी फाइल चुनें',
    dropzoneSubtitle: 'ओरिजिनल क्वालिटी · डायरेक्ट P2P स्पीड · कोई डेटाबेस या सर्वर स्टोरेज नहीं',
    pickAnyFiles: 'कोई भी फाइल चुनें',
    pickVideoAudio: 'वीडियो और ऑडियो चुनें',
    queuedFiles: 'भेजने के लिए तैयार फाइल्स',
    clearQueue: 'साफ़ करें',
    sendNow: 'अभी भेजें (Send)',
    sendingTo: 'भेजें →',
    selectDeviceFirstBtn: 'भेजने के लिए डिवाइस कनेक्ट करें',
    activeTransfers: 'ट्रांसफर प्रोग्रेस',
    clearFinished: 'पूरा हुआ हटाएं',
    noTransfersTitle: 'अभी कोई ट्रांसफर नहीं चल रहा',
    noTransfersBody: 'ऊपर से मीडिया फाइल्स चुनें और Send बटन दबाएं — यहां लाइव प्रोग्रेस दिखेगा।',
    receivedGallery: 'रिसीव हुई फाइल्स',
    saveFile: 'सेव करें',
    previewMedia: 'चलाएं / देखें',
    autoAcceptLabel: 'आने वाली फाइलें अपने-आप स्वीकार करें',
    autoDownloadLabel: 'पूरा होने पर अपने-आप डाउनलोड करें',
    incomingTitle: 'फाइलें भेजना चाहता है',
    acceptFiles: 'स्वीकार करें और लें',
    declineFiles: 'मना करें',
    pairModalTitle: 'दूसरे फोन या PC से कनेक्ट करें',
    pairModalDesc: 'दूसरे फोन के कैमरे से QR कोड स्कैन करें या यह 6-अंक का कोड वहां डालें।',
    yourPairCode: 'आपका पेयरिंग कोड',
    copyLink: 'लिंक कॉपी करें',
    copied: 'लिंक कॉपी हो गया',
    newCode: 'नया कोड',
    joinCodeLabel: 'या दूसरे डिवाइस का 6-अंक का कोड डालें',
    joinCodeBtn: 'जोड़ें',
    losslessVerified: 'सफलतापूर्वक भेजा गया · 100% वेरिफाइड (CRC-32)',
    sentSuccessTitle: 'फाइल सफलतापूर्वक भेज दी गई!',
    sentSuccessBody: 'बिना किसी डेटा लॉस के दूसरे डिवाइस पर पहुंच गई और वेरिफाई हो गई।',
    dismissBanner: 'बंद करें',
    howStep1Title: '01. डिवाइस खोजें और Connect करें',
    howStep1Body: 'उपलब्ध डिवाइस अपने-आप दिखते हैं। Connect दबाने पर दूसरे फोन को मैसेज जाता है — वो Connect या Skip कर सकता है।',
    howStep2Title: '02. ओरिजिनल फाइल चुनें',
    howStep2Body: 'वीडियो, गाने, फोटो या कोई भी बड़ी फाइल बिना कंप्रेस किए 4 MB ब्लॉक स्ट्रीमिंग और 8 MB P2P पाइपलाइन से भेजी जाती है, जिससे 3-4 GB फाइल पर भी फोन हैंग नहीं होता।',
    howStep3Title: '03. वेरिफाइड डिलीवरी',
    howStep3Body: 'सीधे डिवाइस-टू-डिवाइस (WebRTC P2P) ट्रांसफर होता है और CRC-32 चेकसम से वेरिफाई होता है। कोई भी फाइल या डेटा किसी डेटाबेस या सर्वर में सेव नहीं होता।',
    statusWaiting: 'दूसरे डिवाइस पर Accept करने का इंतज़ार है...',
    statusConnecting: 'डिवाइस से कनेक्ट हो रहा है...',
    statusTransferring: 'भेजा जा रहा है...',
    statusVerifying: 'रिसीवर से कन्फर्मेशन लिया जा रहा है...',
    statusCompleted: 'भेजा जा चुका है (Confirmed)',
    statusDeclined: 'रिसीवर ने मना किया',
    statusCancelled: 'रद्द किया गया',
    statusError: 'त्रुटि',
    transportP2P: 'Direct Wi-Fi / LAN P2P',
    transportRelay: 'Internet Relay',
    slowLargeFileTip:
      'तेज़ स्पीड टिप (3+ GB वीडियो): दोनों फोन को एक ही Wi-Fi से जोड़ें (या एक फोन का Mobile Hotspot चालू करके दूसरे को उससे कनेक्ट करें) — इससे मोबाइल डेटा/Relay के बजाय 20–80 MB/s फुल Wi-Fi स्पीड मिलेगी।',
  },
};
