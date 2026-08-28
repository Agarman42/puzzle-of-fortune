/* Puzzle of Fortune — service worker (app shell + local assets offline) */
/* Bump CACHE_VERSION when shipping asset changes so clients refresh. */
const CACHE_VERSION = 'pof-v8';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/data/puzzles.js',
  './js/scoring.js',
  './js/state.js',
  './js/game.js',
  './js/ui.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((windows) =>
        Promise.all(
          windows.map((client) => (client.navigate ? client.navigate(client.url) : Promise.resolve()))
        )
      )
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isCdn(url) {
  return (
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // App shell / local: network-first for HTML/JS/CSS so updates land; cache fallback offline
  if (isSameOrigin(url)) {
    const isCode =
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('/') ||
      url.pathname.endsWith('manifest.webmanifest');

    if (isCode) {
      event.respondWith(
        fetch(req, { cache: 'no-store' })
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
      );
    } else {
      event.respondWith(
        caches.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          });
        })
      );
    }
    return;
  }

  // CDN (Tailwind, Font Awesome, fonts): always network-first.
  // Offline fallback only — versioned RUNTIME_CACHE is wiped on activate.
  if (isCdn(url)) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
