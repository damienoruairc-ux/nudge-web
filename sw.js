/* Nudge service worker: offline shell + notification actions. Bump VERSION when you change files. */
const VERSION = 'nudge-v21';
const SHELL = [
  './', './index.html', './style.css', './core.js', './native.js', './sync.js', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './fonts/nunito-400.woff2', './fonts/nunito-700.woff2', './fonts/nunito-800.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate for our own files.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
      return hit || net;
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const action = e.action || 'open';
  const pid = (e.notification.data && e.notification.data.pid) || '';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.length) {
      wins[0].postMessage({ type: 'notif', action, pid });
      return wins[0].focus();
    }
    return self.clients.openWindow(`./?action=${encodeURIComponent(action)}&pid=${encodeURIComponent(pid)}`);
  })());
});
