const CACHE_NAME = 'calitech-attendance-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first strategy to make sure the app real-time updates when internet is connected
self.addEventListener('fetch', (e) => {
  // Only handle GET requests and local/same-origin assets
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Clone and put the updated version in cache
        const rc = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, rc);
        });
        return response;
      })
      .catch(() => {
        // Fallback to cache if network is down
        return caches.match(e.request);
      })
  );
});
