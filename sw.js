const CACHE_NAME = 'Web-aystent';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './tools-src/nadajniki.html',
  './tools-src/bibliotekaDVBT.html',
  './tools-src/satelity.html',
  './tools-src/bibliotekaSAT.html',
  './tools-src/Jednostki.html',
  './tools-src/internet.html',
  
  './tools-src/docs/czestotliwosciDVBT.html',
  './tools-src/docs/kolorySat.html',
  './tools-src/docs/KonstelacjaDVbt2.html',
  './tools-src/docs/KonstelacjaSat.html',
  './tools-src/docs/muxy.html',
  './tools-src/docs/Parametry-DVB-t.html',
  './tools-src/docs/ParametrySAT.html',
  './tools-src/docs/UnicablePB.html',
  './tools-scr/docs/NC_PLUS_RESET.html'
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
  self.clientsClaim();
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
