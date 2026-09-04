// Service worker minimo: solo cachea el "app shell" (HTML/CSS/JS estatico)
// para que la app se pueda instalar y abra rapido/offline. Las llamadas a
// /api/ nunca se sirven de cache: los datos del juego (precios, plantillas,
// sesion...) tienen que ser siempre los reales del servidor.
const CACHE_NAME = 'nba-fantasy-v1';
const APP_SHELL = [
  '/index.html',
  '/group.html',
  '/membership.html',
  '/css/style.css',
  '/js/fantasy/common.js',
  '/js/fantasy/dashboard.js',
  '/js/fantasy/group.js',
  '/js/fantasy/membership.js',
  '/js/fantasy/ads.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  // Stale-while-revalidate: sirve la copia en cache al instante si existe,
  // y de paso la refresca en segundo plano para la siguiente vez.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
