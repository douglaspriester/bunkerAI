// static/sw.js — BunkerAI Service Worker
// Caches static assets for offline operation

const CACHE_NAME = 'bunkerai-v2';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/static/index.html',
  '/static/style.css',
  '/static/js/main.js',
  '/static/js/apps-core.js',
  '/static/js/apps-map.js',
  '/static/js/apps-content.js',
  '/static/js/apps-books-journal.js',
  '/static/js/apps-search.js',
  '/static/js/apps-sysmon.js',
  '/static/js/apps-office.js',
  '/static/js/apps-tools.js',
  '/static/js/apps-creative.js',
  '/static/js/apps-ref.js',
  '/static/js/apps-modelmgr.js',
  '/static/js/chat.js',
  '/static/js/state.js',
  '/static/js/windowManager.js',
  '/static/js/companion.js',
  '/static/js/guide-companion.js',
  '/static/js/voice-input.js',
  '/static/js/markdown.js',
  '/static/js/rag-app.js',
  '/static/lib/leaflet.js',
  '/static/lib/leaflet.css',
  '/static/lib/minisearch.min.js',
  '/static/lib/epub.min.js',
  '/static/lib/jszip.min.js',
  '/static/lib/pmtiles.js',
  '/static/lib/protomaps-leaflet.js',
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
