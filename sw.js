/* =========================================================================
   Service worker — offline-first for the itinerary PWA.
   Precaches the app shell, self-hosted fonts, icons and the trip JSON so the
   whole itinerary (including Google Fonts) works with no network at all.
   Bump CACHE_VERSION whenever any precached asset changes.
   ========================================================================= */

const CACHE_VERSION = 'boston-2026-v6';
const PRECACHE = 'precache-' + CACHE_VERSION;
const RUNTIME  = 'runtime-'  + CACHE_VERSION;

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./app.js",
  "./styles.css",
  "./fonts.css",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./trips/boston-2026.json",
  "./fonts/archivo-latin-2d6953d7.woff2",
  "./fonts/archivo-latin-ext-594978ed.woff2",
  "./fonts/ibmplexmono-latin-0bc96cd0.woff2",
  "./fonts/ibmplexmono-latin-1b581b15.woff2",
  "./fonts/ibmplexmono-latin-e2661bcc.woff2",
  "./fonts/ibmplexmono-latin-ext-1969f6ff.woff2",
  "./fonts/ibmplexmono-latin-ext-93cfae71.woff2",
  "./fonts/ibmplexmono-latin-ext-a7353317.woff2",
  "./fonts/newsreader-latin-72c495d3.woff2",
  "./fonts/newsreader-latin-ext-34eec978.woff2",
  "./fonts/newsreader-latin-ext-a6a2a4bf.woff2",
  "./fonts/newsreader-latin-f24c3215.woff2"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== PRECACHE && k !== RUNTIME).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      const cache = await caches.open(RUNTIME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Page navigations: try the network for freshness, fall back to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch (err) {
        return (await caches.match('./index.html'))
            || (await caches.match('./'))
            || Response.error();
      }
    })());
    return;
  }

  // Same-origin assets: serve from cache instantly, refresh in the background.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) {
        event.waitUntil(fetchAndCache(request).catch(() => {}));
        return cached;
      }
      return fetchAndCache(request);
    })());
    return;
  }

  // Cross-origin (e.g. the live weather API): network first, cache as a courtesy.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
