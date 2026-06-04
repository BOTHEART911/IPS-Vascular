/**
 * IPS VASCULAR — Service Worker
 * network-first para HTML/JS/CSS, version.js siempre desde la red.
 */
const CACHE_NAME = 'ips-vascular-v1';
const APP_SHELL = ['./', './index.html', './app.js', './styles.css', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL).catch(() => {})));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.pathname.endsWith('/version.js')) {
    event.respondWith(fetch(req, { cache: 'no-store' })
      .catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  const isShell = /\.(html|js|css)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (isShell && url.origin === location.origin) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
