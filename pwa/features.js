// Capability checks for the dashboard. Each test returns true/false, or
// { state, detail } for a richer answer; it may be async. Features marked
// `install` only exist in the installed (home screen) app on iOS, so a
// missing API in a browser tab reads as "Install to test" rather than "no".
const has = (obj, key) => obj != null && key in obj;
const proto = name => window[name] && window[name].prototype;

const FEATURE_GROUPS = [
  {
    name: 'Install & app shell',
    emoji: '📲',
    lab: 'install.html',
    items: [
      {
        name: 'Running as installed app',
        test: () => Lab.isStandalone() ? { state: 'yes', detail: Lab.displayMode() } : { state: 'install', detail: 'In a browser tab' }
      },
      { name: 'display-mode media query', test: () => window.matchMedia('(display-mode: browser), (display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches },
      { name: 'Safe-area insets (env())', test: () => CSS.supports('padding-top: env(safe-area-inset-top)') },
      {
        name: 'Install prompt (beforeinstallprompt)',
        detail: 'iOS installs through Share → Add to Home Screen',
        test: () => 'onbeforeinstallprompt' in window
      }
    ]
  },
  {
    name: 'Offline',
    emoji: '📴',
    lab: 'offline.html',
    items: [
      { name: 'Service worker', test: () => 'serviceWorker' in navigator },
      {
        name: 'Page controlled by service worker',
        test: () => !('serviceWorker' in navigator) ? false
          : navigator.serviceWorker.controller ? true
          : { state: 'partial', detail: 'Reload once to hand control to the worker' }
      },
      { name: 'Cache Storage', test: () => 'caches' in window },
      { name: 'Navigation preload', test: () => has(proto('ServiceWorkerRegistration'), 'navigationPreload') }
    ]
  },
  {
    name: 'Notifications & badge',
    emoji: '🔔',
    lab: 'notifications.html',
    items: [
      { name: 'Notifications', install: true, test: () => 'Notification' in window },
      {
        name: 'Notification permission',
        install: true,
        test: () => {
          if (!('Notification' in window)) return false;
          const p = Notification.permission;
          return { state: p === 'granted' ? 'yes' : p === 'denied' ? 'no' : 'partial', detail: p };
        }
      },
      { name: 'App icon badge', install: true, test: () => 'setAppBadge' in navigator },
      { name: 'Push API (not used in this lab yet)', install: true, test: () => 'PushManager' in window }
    ]
  },
  {
    name: 'Camera & mic',
    emoji: '📷',
    lab: 'camera.html',
    items: [
      { name: 'getUserMedia', test: () => has(navigator.mediaDevices, 'getUserMedia') },
      {
        name: 'MediaRecorder',
        test: () => {
          if (!('MediaRecorder' in window)) return false;
          const mp4 = MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/mp4');
          return { state: 'yes', detail: mp4 ? 'records MP4' : 'no MP4 recording' };
        }
      },
      { name: 'BarcodeDetector', test: () => 'BarcodeDetector' in window },
      { name: 'File input capture', test: () => 'capture' in document.createElement('input') }
    ]
  },
  {
    name: 'Motion & location',
    emoji: '🧭',
    lab: 'motion.html',
    items: [
      {
        name: 'Device orientation',
        test: () => !('DeviceOrientationEvent' in window) ? false
          : typeof DeviceOrientationEvent.requestPermission === 'function'
            ? { state: 'yes', detail: 'needs a permission tap' } : true
      },
      { name: 'Device motion', test: () => 'DeviceMotionEvent' in window },
      { name: 'Geolocation', test: () => 'geolocation' in navigator }
    ]
  },
  {
    name: 'Screen wake lock',
    emoji: '💡',
    lab: 'wakelock.html',
    items: [
      { name: 'Screen Wake Lock API', test: () => 'wakeLock' in navigator }
    ]
  },
  {
    name: 'Speech',
    emoji: '🗣️',
    lab: 'speech.html',
    items: [
      {
        name: 'Speech synthesis',
        test: () => 'speechSynthesis' in window
      },
      {
        name: 'Speech recognition',
        test: () => 'SpeechRecognition' in window ? true
          : 'webkitSpeechRecognition' in window ? { state: 'yes', detail: 'prefixed (webkit)' } : false
      }
    ]
  },
  {
    name: 'Storage',
    emoji: '💾',
    lab: 'storage.html',
    items: [
      { name: 'IndexedDB', test: () => 'indexedDB' in window },
      {
        name: 'Storage estimate',
        test: async () => {
          if (!has(navigator.storage, 'estimate')) return false;
          const { usage, quota } = await navigator.storage.estimate();
          return { state: 'yes', detail: Lab.formatBytes(usage) + ' of ' + Lab.formatBytes(quota) };
        }
      },
      {
        name: 'Persistent storage',
        test: async () => {
          if (!has(navigator.storage, 'persist')) return false;
          const persisted = await navigator.storage.persisted();
          return { state: persisted ? 'yes' : 'partial', detail: persisted ? 'granted' : 'not granted yet' };
        }
      },
      { name: 'Origin Private File System', test: () => has(navigator.storage, 'getDirectory') },
      { name: 'OPFS createWritable', test: () => has(proto('FileSystemFileHandle'), 'createWritable') },
      { name: 'Web Locks', test: () => 'locks' in navigator },
      { name: 'BroadcastChannel', test: () => 'BroadcastChannel' in window }
    ]
  },
  {
    name: 'Share & clipboard',
    emoji: '📤',
    lab: 'share.html',
    items: [
      { name: 'Web Share', test: () => 'share' in navigator },
      {
        name: 'Share files',
        test: () => {
          if (!('canShare' in navigator)) return false;
          try {
            return navigator.canShare({ files: [new File(['lab'], 'lab.txt', { type: 'text/plain' })] });
          } catch (error) {
            return false;
          }
        }
      },
      { name: 'Async clipboard (text)', test: () => has(navigator.clipboard, 'writeText') },
      { name: 'ClipboardItem (images)', test: () => 'ClipboardItem' in window }
    ]
  },
  {
    name: 'Passkeys',
    emoji: '🔑',
    lab: 'passkeys.html',
    items: [
      { name: 'WebAuthn', test: () => 'PublicKeyCredential' in window },
      {
        name: 'Platform authenticator (Face ID / Touch ID)',
        test: async () => 'PublicKeyCredential' in window &&
          await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      },
      {
        name: 'Passkey autofill (conditional UI)',
        test: async () => 'PublicKeyCredential' in window &&
          typeof PublicKeyCredential.isConditionalMediationAvailable === 'function' &&
          await PublicKeyCredential.isConditionalMediationAvailable()
      },
      {
        name: 'getClientCapabilities',
        test: () => 'PublicKeyCredential' in window && typeof PublicKeyCredential.getClientCapabilities === 'function'
      }
    ]
  },
  {
    name: 'Apple Pay',
    emoji: '💳',
    lab: 'applepay.html',
    items: [
      { name: 'Payment Request API', test: () => 'PaymentRequest' in window },
      { name: 'ApplePaySession', test: () => 'ApplePaySession' in window },
      {
        name: 'Apple Pay can make payments',
        test: () => {
          if (!('ApplePaySession' in window)) return false;
          try {
            return ApplePaySession.canMakePayments() ? true : { state: 'partial', detail: 'no card set up' };
          } catch (error) {
            return { state: 'no', detail: error.message };
          }
        }
      }
    ]
  },
  {
    name: 'Modern visuals',
    emoji: '✨',
    lab: 'transitions.html',
    items: [
      { name: 'View transitions (same page)', test: () => 'startViewTransition' in document },
      {
        name: 'View transitions (between pages)',
        detail: 'Confirmed on the transitions lab',
        test: () => 'CSSViewTransitionRule' in window || ('onpagereveal' in window)
      },
      { name: 'Scroll-driven animations', test: () => CSS.supports('animation-timeline: scroll()') },
      { name: 'Anchor positioning', test: () => CSS.supports('anchor-name: --a') }
    ]
  },
  {
    name: 'Graphics',
    emoji: '🎮',
    lab: 'graphics.html',
    items: [
      { name: 'WebGPU', test: () => 'gpu' in navigator },
      { name: 'WebGL 2', test: () => !!document.createElement('canvas').getContext('webgl2') }
    ]
  },
  {
    name: 'Not on iOS (yet)',
    emoji: '🚧',
    items: [
      { name: 'Background Sync', test: () => has(proto('ServiceWorkerRegistration'), 'sync') },
      { name: 'Periodic Background Sync', test: () => has(proto('ServiceWorkerRegistration'), 'periodicSync') },
      { name: 'Web Bluetooth', test: () => 'bluetooth' in navigator },
      { name: 'Web NFC', test: () => 'NDEFReader' in window },
      { name: 'WebUSB', test: () => 'usb' in navigator },
      { name: 'Vibration', test: () => 'vibrate' in navigator },
      { name: 'Fullscreen API', test: () => !!document.fullscreenEnabled },
      { name: 'Screen orientation lock', test: () => has(window.screen.orientation, 'lock') },
      { name: 'File System Access pickers', test: () => 'showOpenFilePicker' in window },
      { name: 'Contact Picker', test: () => has(navigator.contacts, 'select') }
    ]
  }
];

async function runFeature(item) {
  try {
    let result = await item.test();
    if (typeof result === 'boolean') result = { state: result ? 'yes' : 'no' };
    if (result.state === 'no' && item.install && !Lab.isStandalone()) {
      result = { state: 'install', detail: 'only in the installed app' };
    }
    return { detail: item.detail, ...result };
  } catch (error) {
    return { state: 'unknown', detail: error.message };
  }
}
