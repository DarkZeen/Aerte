/* Aerte service worker.
   BUMP THIS STRING ON EVERY DEPLOY. It's the only thing that makes an update
   actually reach devices — without it, "I pushed a change but still see the
   old version" is what happens, because the cache name never changes so the
   old cache is reused forever. One line to remember per release. */
const CACHE_VERSION = 'v1';

const CACHE_NAME = `aerte-shell-${CACHE_VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isShellDoc = req.mode === 'navigate' || req.url.endsWith('/index.html') || req.url.endsWith('/');

  if (isShellDoc) {
    // Network-first: whenever there's signal, always fetch the latest shell
    // and refresh the cache with it. Only fall back to the cached copy when
    // the network request fails outright (offline, e.g. at the park).
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match('./index.html')))
    );
    return;
  }

  // Static assets (manifest, icons): cache-first, refresh cache in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
