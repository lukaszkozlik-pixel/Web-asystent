const CACHE_NAME = 'Web-aystent-v3.4.1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './tools-src/dvbt.html',
  './tools-src/dvbt.js',
  './tools-src/dvbt.css',
  './tools-src/sat.html',
  './tools-src/sat.js',
  './tools-src/sat.css',
  './tools-src/Jednostki.html',
  './tools-src/jednostki.js',
  './tools-src/internet.html',
  './tools-src/internet.js',
  './tools-src/monitoring.html',
  './tools-src/monitoring.js',
  './tools-src/bts.css',
  './tools-src/bts.js',
  './tools-src/bts.html'
  

];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});