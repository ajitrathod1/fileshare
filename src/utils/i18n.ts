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
  }
> = {
  en: {
    navTransfer: 'Transfer',
    navReceived: 'Received',
    navHowItWorks: 'How it works',
    pairDevice: 'Pair Device',
    heroTitle: 'Direct high-speed file transfer with zero compression.',
    heroSubtitle:
      'Send full-resolution videos, audio tracks, photos, and documents directly between phones and computers. Verified byte-for-byte with CRC-32.',
    deviceLabel: 'Your device',
    editName: 'Rename',
    saveName: 'Save',
    availableDevicesTitle: 'Available Devices',
    devicesOnlineCount: 'available to receive',
    noDevicesBadge: '0 devices nearby yet',
    nearbyDevices: 'Available on Same Wi-Fi',
    pairedDevices: 'Connected via Pairing Code',
    noDevicesTitle: 'No other device connected yet',
    noDevicesBody:
      'Open BeamDrop on your second phone or PC on the same Wi-Fi, or tap below to connect via QR code / 6-digit code.',
    openPairing: 'Pair via QR / 6-Digit Code',
    connectedToLabel: 'Connected & Ready',
    noDeviceConnected: 'No receiving device connected yet',
    chooseRecipientLabel: 'Send files to',
    selectedRecipient: 'Sending to',
    selectRecipientHint: 'Connect another device to send files',
    dropzoneTitle: 'Drop or pick videos, audio, photos, or any file',
    dropzoneSubtitle: 'Original quality preserved · No file size limit · Direct P2P transfer',
    pickAnyFiles: 'Choose Any Files',
    pickVideoAudio: 'Pick Videos & Audio',
    queuedFiles: 'Selected & ready to send',
    clearQueue: 'Clear',
    sendNow: 'Send Files',
    sendingTo: 'Send to',
    selectDeviceFirstBtn: 'Pair a Device to Send',
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
    howStep1Title: '01. Open on both devices',
    howStep1Body: 'Devices on the same Wi-Fi appear automatically. On mobile data, scan the QR code or type the 6-digit room code.',
    howStep2Title: '02. Select original media',
    howStep2Body: 'Pick videos, audio recordings, photos, or ZIP archives. Files stream in 64 KB binary frames without server compression.',
    howStep3Title: '03. Verified arrival',
    howStep3Body: 'WebRTC DataChannel transfers directly device-to-device with automatic relay fallback and bit-exact CRC-32 checksum verification.',
    statusWaiting: 'Waiting for receiver to tap Accept...',
    statusConnecting: 'Connecting to device...',
    statusTransferring: 'Sending...',
    statusVerifying: 'Confirming delivery with receiver...',
    statusCompleted: 'Sent & Confirmed',
    statusDeclined: 'Declined by receiver',
    statusCancelled: 'Cancelled',
    statusError: 'Failed',
  },
  hi: {
    navTransfer: 'शेयर करें',
    navReceived: 'रिसीव्ड फाइल्स',
    navHowItWorks: 'कैसे काम करता है',
    pairDevice: 'डिवाइस जोड़ें',
    heroTitle: 'फुल स्पीड और बिना डेटा लॉस के सीधे फाइल ट्रांसफर।',
    heroSubtitle:
      'वीडियो, ऑडियो, फोटो और डॉक्यूमेंट्स को बिना क्वालिटी कम किए एक फोन से दूसरे फोन या कंप्यूटर में सीधे भेजें।',
    deviceLabel: 'आपका डिवाइस',
    editName: 'नाम बदलें',
    saveName: 'सेव',
    availableDevicesTitle: 'उपलब्ध डिवाइस (Available)',
    devicesOnlineCount: 'डिवाइस कनेक्ट हैं',
    noDevicesBadge: 'अभी कोई दूसरा डिवाइस नहीं जुड़ा',
    nearbyDevices: 'एक ही Wi-Fi पर उपलब्ध',
    pairedDevices: 'कोड से जुड़े डिवाइस',
    noDevicesTitle: 'अभी कोई दूसरा डिवाइस कनेक्ट नहीं है',
    noDevicesBody:
      'अपने दूसरे फोन या PC में यही लिंक खोलें, या नीचे क्लिक करके QR कोड / 6-अंक के कोड से जोड़ें।',
    openPairing: 'QR और 6-अंक का कोड देखें',
    connectedToLabel: 'कनेक्टेड डिवाइस',
    noDeviceConnected: 'अभी कोई रिसीविंग डिवाइस नहीं जुड़ा है',
    chooseRecipientLabel: 'इस डिवाइस को भेजें',
    selectedRecipient: 'इसे भेज रहे हैं',
    selectRecipientHint: 'फाइल भेजने के लिए पहले डिवाइस जोड़ें',
    dropzoneTitle: 'वीडियो, ऑडियो, फोटो या कोई भी फाइल चुनें',
    dropzoneSubtitle: 'ओरिजिनल क्वालिटी · कोई साइज़ लिमिट नहीं · डायरेक्ट P2P स्पीड',
    pickAnyFiles: 'कोई भी फाइल चुनें',
    pickVideoAudio: 'वीडियो और ऑडियो चुनें',
    queuedFiles: 'भेजने के लिए तैयार फाइल्स',
    clearQueue: 'साफ़ करें',
    sendNow: 'अभी भेजें (Send)',
    sendingTo: 'भेजें →',
    selectDeviceFirstBtn: 'भेजने के लिए डिवाइस जोड़ें',
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
    howStep1Title: '01. दोनों डिवाइस में खोलें',
    howStep1Body: 'एक ही Wi-Fi पर डिवाइस अपने-आप दिखेंगे। मोबाइल डेटा पर QR कोड स्कैन करें या 6-अंक का कोड डालें।',
    howStep2Title: '02. ओरिजिनल फाइल चुनें',
    howStep2Body: 'वीडियो, गाने, रिकॉर्डिंग या कोई भी फाइल बिना कंप्रेस किए सीधे 64 KB बाइनरी चंक्स में भेजी जाती है।',
    howStep3Title: '03. वेरिफाइड डिलीवरी',
    howStep3Body: 'सीधे डिवाइस-टू-डिवाइस ट्रांसफर के साथ हर फाइल का CRC-32 चेकसम मिलाकर पक्का किया जाता है कि कोई डेटा लॉस न हो।',
    statusWaiting: 'दूसरे डिवाइस पर Accept करने का इंतज़ार है...',
    statusConnecting: 'डिवाइस से कनेक्ट हो रहा है...',
    statusTransferring: 'भेजा जा रहा है...',
    statusVerifying: 'रिसीवर से कन्फर्मेशन लिया जा रहा है...',
    statusCompleted: 'भेजा जा चुका है (Confirmed)',
    statusDeclined: 'रिसीवर ने मना किया',
    statusCancelled: 'रद्द किया गया',
    statusError: 'त्रुटि',
  },
};
