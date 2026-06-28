const CACHE_NAME = 'eport-fleet-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/imported_data.js',
  './js/store.js',
  './js/chart-config.js',
  './js/salary.js',
  './js/fuel.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching assets...');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache...');
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch Event (Network-First falling back to Cache)
self.addEventListener('fetch', (e) => {
  // Only cache GET requests
  if (e.request.method !== 'GET') return;
  
  // Skip chrome-extension or external schemas
  if (!e.request.url.startsWith(self.location.origin) && !e.request.url.startsWith('https://')) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Make clone of response
        const resClone = res.clone();
        // Open cache and put response clone in it
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(() => caches.match(e.request).then((res) => res))
  );
});
