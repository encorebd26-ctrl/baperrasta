/* Tesla Express service worker: makes the game playable offline.
   Bump VERSION whenever you deploy a new build so old caches are dropped. */
const VERSION = 'v3';
const CACHE = 'tesla-express-' + VERSION;

const PRECACHE = [
  './',
  'index.html',
  'privacy.html',
  'editor.html',
  'disclaimer.html',
  'saha-likhon.jpg',
  'manifest.webmanifest',
  'icons/favicon.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'tesla-express-og.jpg',
  'fonts/anek-bangla-400-800-bengali.418c763509.woff2',
  'fonts/anek-bangla-400-800-latin.9d14431a27.woff2',
  'fonts/baloo-da-2-600-800-bengali.323d936108.woff2',
  'fonts/baloo-da-2-600-800-latin.074ed9c674.woff2',
  'fonts/galada-400-bengali.22eba75917.woff2',
  'fonts/galada-400-latin.59a0eef638.woff2',
  'fonts/hind-siliguri-700-bengali.b6033f70da.woff2',
  'fonts/hind-siliguri-700-latin.e8f0fc0cab.woff2',
  'fonts/share-tech-mono-400-latin.41e6b9f297.woff2',
  'fonts/tiro-bangla-400-bengali.7132520bbc.woff2',
  'fonts/tiro-bangla-400-latin.bb748ffc6a.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One missing file must not break the whole install, so add them one by one.
    await Promise.all(PRECACHE.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('tesla-express-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // analytics, Google Fonts: let the network handle it
  if (url.pathname.startsWith('/api/')) return;              // leaderboard, subscribe: always live, fails normally offline

  // Pages: network first so a new deploy shows up, cache when offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req, { ignoreSearch: true }))
            || (/\/(privacy|editor|disclaimer)\.html$/.test(url.pathname) ? await cache.match(url.pathname.split('/').pop()) : null)
            || (await cache.match('index.html'))
            || (await cache.match('./'))
            || Response.error();
      }
    })());
    return;
  }

  // Everything else on our origin (fonts, icons, images): cache first, refresh in the background.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await fresh) || Response.error();
  })());
});
