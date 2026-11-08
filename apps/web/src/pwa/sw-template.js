/* Riddle Games offline service worker. Built by vite.config.ts, which fills in the version and file list. */
const VERSION = '__VERSION__';
const PRECACHE = __FILES__;
const CACHE = `riddle-games-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('riddle-games-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Pages: try the network briefly so updates arrive, else play from the cache. */
async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500)),
    ]);
    if (res.ok) cache.put('./', res.clone());
    return res;
  } catch {
    return (await cache.match('./')) || (await cache.match('./index.html')) || Response.error();
  }
}

/** Everything else: cache first (file names carry a hash), then network. */
async function asset(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && new URL(request.url).origin === self.location.origin) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;
  event.respondWith(request.mode === 'navigate' ? page(request) : asset(request));
});
