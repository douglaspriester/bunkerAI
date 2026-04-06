// static/sw.js — BunkerAI Service Worker
// Caches static assets for offline operation

const CACHE_NAME = 'bunkerai-v3';

// Assets to pre-cache on install
// NOTE: static files are served at "/" (not "/static/"), so paths start with /js/, /lib/, etc.
const PRECACHE_URLS = [
  '/',
  '/style.css',
  '/js/main.js',
  '/js/apps-core.js',
  '/js/apps-map.js',
  '/js/apps-content.js',
  '/js/apps-books-journal.js',
  '/js/apps-search.js',
  '/js/apps-sysmon.js',
  '/js/apps-office.js',
  '/js/apps-tools.js',
  '/js/apps-creative.js',
  '/js/apps-ref.js',
  '/js/apps-modelmgr.js',
  '/js/chat.js',
  '/js/state.js',
  '/js/windowManager.js',
  '/js/companion.js',
  '/js/guide-companion.js',
  '/js/voice-input.js',
  '/js/markdown.js',
  '/js/rag-app.js',
  '/lib/leaflet.js',
  '/lib/leaflet.css',
  '/lib/minisearch.min.js',
  '/lib/epub.min.js',
  '/lib/jszip.min.js',
  '/lib/pmtiles.js',
  '/lib/protomaps-leaflet.js',
];

// Install: pre-cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache what we can, ignore failures (some files may not exist)
      return Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static assets, network-first for API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls, WebSocket, or external resources
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/ws') ||
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets: cache-first strategy
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      // Not in cache — fetch and cache for next time
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/');
        }
      });
    })
  );
});

// Message: allow manual cache refresh
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
