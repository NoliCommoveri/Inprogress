const CACHE_NAME = 'stm-shell-v9';

// App shell + app JS. Earlier versions excluded `js/*.js` so it always came
// from the network, but that leaves the cached shell unable to hydrate
// offline (its module imports 404 with no network). Now precached and
// refreshed via CACHE_NAME bumps on deploy instead.
const SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './icons/icon-16x16.png',
  './icons/icon-32x32.png',
  './icons/icon-48x48.png',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-167x167.png',
  './icons/icon-180x180.png',
  './icons/icon-192x192.png',
  './icons/icon-192x192-maskable.png',
  './icons/icon-256x256.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png',
  './icons/icon-512x512-maskable.png',
  './js/data.js',
  './js/util.js',
  './js/router.js',
  './js/seed.js',
  './js/selectors.js',
  './js/wizard.js',
  './js/wizard-content.js',
  './js/nudge.js',
  './js/hygiene.js',
  './js/messaging.js',
  './js/export.js',
  './js/views/team.js',
  './js/views/roster.js',
  './js/views/parents.js',
  './js/views/schedule.js',
  './js/views/snacks.js',
  './js/views/fundraisers.js',
  './js/views/settings.js',
  './js/views/communications.js',
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
    // Network-first for navigations (fresh HTML when online); falls back to
    // the cached shell so the app still opens offline.
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
  }
});
