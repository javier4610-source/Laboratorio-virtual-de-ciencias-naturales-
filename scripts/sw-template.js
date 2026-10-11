/* Service worker del Laboratorio Virtual de Ciencias Naturales.
 * Generado por scripts/build-sw.mjs: no editar dist/sw.js directamente.
 * Estrategia: toda la aplicación se guarda en la primera visita (precarga) y luego
 * se sirve desde la caché, así funciona sin conexión y abre rápido en redes lentas.
 * Las versiones nuevas se descargan en segundo plano y se activan cuando el usuario acepta. */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `lvcn-${VERSION}`;
const RUNTIME = 'lvcn-runtime';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('lvcn-') && key !== CACHE && key !== RUNTIME) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Solo recursos propios: el servidor de informes y otros orígenes van directo a la red.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const shell = await caches.match(new URL('./index.html', self.registration.scope).href, { cacheName: CACHE });
      if (shell) return shell;
      return fetch(request);
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(RUNTIME).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return response;
  })());
});
