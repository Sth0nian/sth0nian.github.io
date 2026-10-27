// Shared helpers for the PWA Lab pages: environment info, output logs,
// status pills and service worker registration with an update prompt.
(function () {
  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true;

  function displayMode() {
    for (const mode of ['fullscreen', 'standalone', 'minimal-ui', 'browser']) {
      if (window.matchMedia('(display-mode: ' + mode + ')').matches) return mode;
    }
    return navigator.standalone ? 'standalone' : 'unknown';
  }

  function env() {
    const ua = navigator.userAgent;
    const os = ua.match(/OS (\d+)[_.](\d+)(?:[_.](\d+))? like Mac OS X/);
    const safari = ua.match(/Version\/([\d.]+)/);
    // iPadOS reports itself as a Mac; touch support gives it away
    const device = /iPhone/.test(ua) ? 'iPhone'
      : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad'
      : /Macintosh/.test(ua) ? 'Mac'
      : /Android/.test(ua) ? 'Android' : 'Other';
    return {
      ua,
      device,
      // Safari 26 freezes the OS version in the user agent, so trust the Safari version first
      ios: os ? os.slice(1).filter(Boolean).join('.') : null,
      safari: safari ? safari[1] : null,
      mode: displayMode(),
      standalone: isStandalone(),
      screen: screen.width + '×' + screen.height + ' @' + window.devicePixelRatio + 'x',
      viewport: window.innerWidth + '×' + window.innerHeight,
      language: navigator.language,
      online: navigator.onLine
    };
  }

  function escape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Returns a function that prepends a timestamped line to a log element
  function logger(el) {
    return function log(message, type = 'info') {
      if (!el) return console.log(message);
      const line = document.createElement('div');
      line.className = 'log-line log-' + type;
      const time = document.createElement('span');
      time.className = 'log-time';
      time.textContent = new Date().toLocaleTimeString('en-GB');
      line.append(time, document.createTextNode(String(message)));
      el.prepend(line);
    };
  }

  const STATE_LABELS = {
    yes: 'Supported',
    partial: 'Partial',
    install: 'Install to test',
    no: 'Not supported',
    unknown: 'Unknown'
  };

  function pill(state, text) {
    return '<span class="pill pill-' + state + '">' + escape(text || STATE_LABELS[state]) + '</span>';
  }

  function setStatus(el, state, text) {
    if (el) el.innerHTML = pill(state, text);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fallback for contexts without the async clipboard
      const area = document.createElement('textarea');
      area.value = text;
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }
  }

  function formatBytes(bytes) {
    if (bytes == null || isNaN(bytes)) return '–';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return bytes.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  }

  // Service worker: one registration covers the whole lab
  let updateRequested = false;

  function showUpdateBanner(worker) {
    if (document.querySelector('.update-banner')) return;
    const banner = document.createElement('div');
    banner.className = 'update-banner';
    banner.innerHTML = '<span>A new version of the lab is ready.</span>';
    const button = document.createElement('button');
    button.className = 'button';
    button.textContent = 'Reload';
    button.addEventListener('click', () => {
      updateRequested = true;
      worker.postMessage({ type: 'skip-waiting' });
    });
    banner.append(button);
    document.body.append(banner);
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register('/pwa/sw.js', { scope: '/pwa/' });
      const offer = () => {
        if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
      };
      offer();
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (worker) {
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') offer();
          });
        }
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (updateRequested) window.location.reload();
      });
      return reg;
    } catch (error) {
      console.warn('Service worker registration failed', error);
      return null;
    }
  }

  // Ask the service worker something and wait for its reply
  function askWorker(message) {
    return new Promise((resolve, reject) => {
      const worker = navigator.serviceWorker && navigator.serviceWorker.controller;
      if (!worker) return reject(new Error('No active service worker controls this page yet'));
      const channel = new MessageChannel();
      channel.port1.onmessage = event => resolve(event.data);
      worker.postMessage(message, [channel.port2]);
      setTimeout(() => reject(new Error('Service worker did not reply')), 3000);
    });
  }

  document.documentElement.classList.toggle('is-standalone', isStandalone());

  window.Lab = {
    isStandalone,
    displayMode,
    env,
    escape,
    logger,
    pill,
    setStatus,
    copyText,
    formatBytes,
    askWorker,
    ready: registerServiceWorker()
  };
})();
