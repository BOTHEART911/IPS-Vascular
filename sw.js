/**
 * IPS VASCULAR — Service Worker  ·  v7 (Fase 7.1, 07/09/2026 — capas fx movidas a css/ y js/)
 * - Shell (HTML/JS/CSS): network-first (siempre lo más nuevo, con respaldo sin señal).
 * - Imágenes y sonidos propios: cache-first (se piden UNA vez y quedan guardados).
 * - version.js: siempre de la red.
 * Al cambiar CACHE_NAME se borra el caché viejo solo.
 */
const CACHE_NAME = 'ips-vascular-v7';
const APP_SHELL = [
  './', './index.html', './app.js', './styles.css', './manifest.webmanifest',
  './css/vista-solicitudes.css', './css/tableros.css', './css/insights.css',
  './css/mitrabajo.css', './css/informes.css',
  './css/rueda-fecha.css', './css/tema-oscuro.css',
  './css/perfil.css', './css/alertas-bot.css',
  './css/micro.css', './css/esqueletos.css', './css/jalar-recargar.css', './css/onda.css',
  './js/tableros.js', './js/insights.js', './js/mitrabajo.js', './js/informes.js',
  './js/rueda-fecha.js', './js/tema-oscuro.js',
  './js/perfil.js', './js/alertas-bot.js',
  './js/vibracion.js', './js/sonido.js', './js/esqueletos.js', './js/jalar-recargar.js',
  './js/conteo.js', './js/barras.js', './js/onda.js', './js/modales.js',
  './img/logo.webp', './img/solicitudes.webp', './img/pacientes.webp',
  './img/profesionales.webp', './img/bot.webp', './img/config.webp',
  './audio/login.mp3', './audio/click.mp3', './audio/ok.mp3', './audio/err.mp3'
];

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
  const propio = (url.origin === location.origin);

  // version.js: nunca del caché
  if (url.pathname.endsWith('/version.js')) {
    event.respondWith(fetch(req, { cache: 'no-store' })
      .catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Imágenes y audios propios: cache-first (aquí está la ganancia de velocidad)
  if (propio && /\.(webp|png|jpg|jpeg|gif|svg|mp3|ogg|wav)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  // Shell: network-first
  const isShell = /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (isShell && propio) {
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
