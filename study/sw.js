// Leerhulp service worker (scope /study/).
// Everything is served network-first with a short timeout, falling back to
// the cache, so new content shows up right away but the app still works
// offline. On install it precaches the app and every chapter in the catalog.
const VERSION = 'leerhulp-v1';
const NETWORK_TIMEOUT = 3000;

const SHELL = [
  './',
  'index.html',
  'app.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/content.js',
  'js/questions.js',
  'js/speech.js',
  'js/store.js',
  'js/text.js',
  'fonts/lexend-latin-400-normal.woff2',
  'fonts/lexend-latin-600-normal.woff2',
  'fonts/lexend-latin-700-normal.woff2',
  'fonts/OpenDyslexic-Regular.woff',
  'fonts/OpenDyslexic-Bold.woff',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'content/catalog.json'
];

async function contentFiles() {
  try {
    const response = await fetch('content/catalog.json', { cache: 'no-store' });
    const catalog = await response.json();
    return catalog.subjects.flatMap(s => s.chapters.map(c => 'content/' + c.file));
  } catch (error) {
    return [];
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    const files = [...SHELL, ...(await contentFiles())];
    // One by one, so a single missing file doesn't break the install
    await Promise.allSettled(files.map(file => cache.add(new Request(file, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('leerhulp-') && key !== VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  const network = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  network.catch(() => {});
  try {
    return await withTimeout(network, NETWORK_TIMEOUT);
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./');
      if (shell) return shell;
    }
    return network;
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  event.respondWith(networkFirst(request));
});
