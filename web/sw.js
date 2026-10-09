/* Reachmark Audio — service worker
   PWABuilder checklist: registered at root scope, precached app shell, fetch handler with
   offline navigation fallback, cache-first static assets, network-only for API/auth. */
const VERSION = 'reachmark-audio-v1.1.0';
const SHELL = [
  '/', '/index.html', '/css/app.css', '/manifest.webmanifest',
  '/js/main.js', '/js/core.js', '/js/audio.js', '/js/brain.js', '/js/auth.js', '/js/views-a.js', '/js/views-b.js',
  '/assets/favicon.svg', '/assets/icon.png', '/assets/icon-512.png', '/assets/icon-192.png', '/assets/icon-96.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // never intercept API/auth/streaming calls — credits & sessions must stay live
  if (url.pathname.startsWith('/api/')) return;

  // navigations: network-first, fall back to cached shell (offline support)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put('/index.html', copy));
        return res;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }
  // static assets: cache-first with background refresh
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('/assets/icon.png')))
  );
});
