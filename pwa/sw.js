// PWA Lab service worker: precaches the lab so it works offline, serves
// pages network-first and assets stale-while-revalidate, can pretend to be
// offline for testing, and routes notification taps back into the app.
const VERSION = 'pwa-lab-v1';
const CACHE = VERSION;
const FLAGS = 'pwa-lab-flags';
const SIM_OFFLINE_KEY = '/pwa/__sim-offline';

const LABS = [
  'install', 'offline', 'notifications', 'camera', 'motion', 'wakelock',
  'speech', 'storage', 'share', 'passkeys', 'applepay', 'transitions', 'graphics'
];

const PRECACHE = [
  '/pwa/',
  '/pwa/fallback.html',
  '/pwa/manifest.webmanifest',
  '/pwa/pwa.css',
  '/pwa/lab.js',
  '/pwa/features.js',
  '/pwa/js/dashboard.js',
  '/pwa/icons/icon-180.png',
  '/pwa/icons/icon-192.png',
  '/pwa/icons/icon-512.png',
  '/styled.css',
  '/site-header.css',
  '/js/components.js',
  '/components/menu.html',
  '/components/footer.html',
  '/commit-hash.txt',
  '/fonts/KodeMono-Regular.ttf',
  '/fonts/KodeMono-Medium.ttf',
  '/fonts/KodeMono-SemiBold.ttf',
  '/fonts/KodeMono-Bold.ttf',
  ...LABS.map(name => '/pwa/' + name + '.html'),
  ...LABS.map(name => '/pwa/js/' + name + '.js')
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Add one by one so a single missing file doesn't break the install
    await Promise.allSettled(PRECACHE.map(url => cache.add(url)));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(key => key !== CACHE && key !== FLAGS).map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

async function isSimulatingOffline() {
  const flags = await caches.open(FLAGS);
  return !!(await flags.match(SIM_OFFLINE_KEY));
}

async function setSimulatingOffline(on) {
  const flags = await caches.open(FLAGS);
  if (on) {
    await flags.put(SIM_OFFLINE_KEY, new Response('1'));
  } else {
    await flags.delete(SIM_OFFLINE_KEY);
  }
}

function json(data) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

// Reports where a request was answered from, for the offline lab
async function ping(offline) {
  if (offline) return json({ source: 'service worker', reason: 'simulated offline' });
  try {
    const response = await fetch('/commit-hash.txt', { cache: 'no-store' });
    return json({ source: 'network', commit: (await response.text()).trim() });
  } catch (error) {
    return json({ source: 'service worker', reason: 'network unreachable' });
  }
}

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  return cache.match(request, { ignoreSearch: request.mode === 'navigate' });
}

async function handleNavigation(request, offline) {
  if (!offline) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request.url.split('?')[0], response.clone());
      }
      return response;
    } catch (error) {
      // Fall through to the cache
    }
  }
  return (await fromCache(request)) || (await caches.match('/pwa/fallback.html'));
}

async function handleAsset(request, offline) {
  const cached = await fromCache(request);
  if (offline) return cached || new Response('', { status: 503, statusText: 'Simulated offline' });

  const network = fetch(request)
    .then(async response => {
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached || Response.error());

  return cached || network;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const offline = await isSimulatingOffline();
    if (url.pathname === '/pwa/__ping') return ping(offline);
    if (request.mode === 'navigate') return handleNavigation(request, offline);
    return handleAsset(request, offline);
  })());
});

self.addEventListener('message', event => {
  const data = event.data || {};
  const reply = message => event.ports[0] && event.ports[0].postMessage(message);

  if (data.type === 'skip-waiting') {
    self.skipWaiting();
  } else if (data.type === 'state') {
    event.waitUntil(isSimulatingOffline().then(offline => reply({ version: VERSION, offline })));
  } else if (data.type === 'sim-offline') {
    event.waitUntil(setSimulatingOffline(!!data.on).then(() => reply({ offline: !!data.on })));
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/pwa/', self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      client.postMessage({ type: 'notification-click', tag: event.notification.tag, title: event.notification.title });
    }
    const existing = windows.find(client => client.url.startsWith(self.registration.scope));
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  })());
});

self.addEventListener('notificationclose', event => {
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window' });
    for (const client of windows) {
      client.postMessage({ type: 'notification-close', tag: event.notification.tag });
    }
  })());
});
