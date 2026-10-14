/* Reachmark Audio — service worker
   PWABuilder checklist: registered at root scope, precached app shell, fetch handler with
   offline navigation fallback, cache-first static assets, network-only for API/auth. */
const VERSION = 'reachmark-audio-v1.14.1';
const SHELL = [
  '/', '/index.html', '/css/app.css', '/manifest.webmanifest',
  '/js/main.js', '/js/core.js', '/js/audio.js', '/js/brain.js', '/js/auth.js', '/js/views-a.js', '/js/views-b.js', '/js/gl-bg.js',
  '/assets/voice-app-icon.svg', '/assets/favicon.svg', '/assets/icon-192.png', '/assets/icon-512.png',
  '/assets/icon-maskable-512.png', '/assets/icon-maskable-192.png',
  '/assets/shortcut-tts-96.png', '/assets/shortcut-match-96.png', '/assets/shortcut-support-96.png',
  '/widget.html', '/widget/quick-studio.ac.json',
];

self.addEventListener('install', e => {
  // Cache each shell asset independently: one optional/missing image must not
  // prevent the whole worker from installing. Never cache failed responses.
  e.waitUntil(caches.open(VERSION).then(async c => {
    await Promise.all(SHELL.map(async path => {
      try {
        const response = await fetch(path, { cache: 'reload' });
        if (response && response.ok && response.type === 'basic') await c.put(path, response);
      } catch { /* offline or optional asset; navigation fallback still works */ }
    }));
    await self.skipWaiting();
  }));
});

self.addEventListener('activate', e => {
  // Retain independent runtime caches (fonts/outbox/catalog) across app updates.
  // Only remove older versioned Reachmark shell caches.
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('reachmark-audio-') && k !== VERSION).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Google Fonts: cache-first runtime cache so installed-app typography survives offline
  if (e.request.method === 'GET' && (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com')) {
    e.respondWith(
      caches.open('rm-fonts').then(async c => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        try {
          const res = await fetch(e.request);
          if (res && res.ok) c.put(e.request, res.clone());
          return res;
        } catch (err) { return hit || Response.error(); }
      })
    );
    return;
  }
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
  // Static assets: return cache immediately for speed, refresh in the background.
  // Never persist errors, opaque cross-origin responses, or private/no-store data.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(e.request);
    const refresh = fetch(e.request).then(async response => {
      const policy = response.headers.get('cache-control') || '';
      if (response.ok && response.type === 'basic' && !/\\b(no-store|private)\\b/i.test(policy)) {
        await cache.put(e.request, response.clone());
      }
      return response;
    });
    if (hit) {
      e.waitUntil(refresh.catch(() => {}));
      return hit;
    }
    try { return await refresh; }
    catch { return new Response('Asset unavailable offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } }); }
  })());
});

/* ---------- push notifications (Reachmark announcements) ---------- */
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(data.title || 'Reachmark Audio', {
    body: data.body || 'New from Reachmark Digital',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-96.png',
    tag: data.tag || 'reachmark-announcement',
    renotify: Boolean(data.renotify),
    actions: [
      { action: 'open', title: 'Open Reachmark' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    data: { url: data.url || '/#home' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = (e.notification.data && e.notification.data.url) || '/#home';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if ('focus' in c) {
        try { c.navigate(url); } catch {}
        return c.focus();
      }
    }
    return clients.openWindow(url);
  }));
});

/* ---------- background sync: replay queued support messages ---------- */
function outboxDb() {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open('rm-outbox', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('msgs', { keyPath: 'id' });
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}
self.addEventListener('sync', e => {
  if (e.tag !== 'rm-support-retry') return;
  e.waitUntil((async () => {
    const dbo = await outboxDb();
    const items = await new Promise(res => {
      const tx = dbo.transaction('msgs'); const rq = tx.objectStore('msgs').getAll();
      rq.onsuccess = () => res(rq.result || []); rq.onerror = () => res([]);
    });
    let failed = 0;
    for (const it of items) {
      try {
        const r = await fetch('/api/support/message', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: it.text }) });
        if (r.ok) {
          const tx = dbo.transaction('msgs', 'readwrite'); tx.objectStore('msgs').delete(it.id);
          await new Promise(res => { tx.oncomplete = res; tx.onerror = res; });
        } else failed++;
      } catch { failed++; }
    }
    if (failed) throw new Error('backoff: retry on next sync');
  })());
});

/* ---------- periodic sync: keep the public voice catalog fresh for offline ---------- */
self.addEventListener('periodicsync', e => {
  if (e.tag !== 'rm-catalog') return;
  e.waitUntil(caches.open('rm-data').then(async c => {
    for (const u of ['/api/catalog', '/api/health']) {
      try { const r = await fetch(u); if (r && r.ok) await c.put(u, r.clone()); } catch {}
    }
  }));
});
