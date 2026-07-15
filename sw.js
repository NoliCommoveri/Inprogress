const CACHE_NAME = 'stm-shell-v1';

// App shell only. `js/*.js` is intentionally excluded — it changes often
// during development and should always come from the network.
const SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/vendor/xlsx.full.min.js',
  './js/vendor/jspdf.umd.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

const SHELL_URLS = new Set(SHELL_FILES.map((f) => new URL(f, self.location.href).href));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  if (SHELL_URLS.has(request.url)) {
    // Shell files are pinned per deploy (see CACHE_NAME) — cache-first is safe.
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  if (request.mode === 'navigate') {
    // App code (js/*.js) always goes to the network; only the shell page
    // itself falls back to cache so the app still opens offline.
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
  }
});
