var CACHE_NAME = 'yarr-v8';
var STATIC_ASSETS = [
  './static/stylesheets/base.css',
  './static/stylesheets/app.css',
  './static/javascripts/vue.global.prod.js',
  './static/javascripts/api.js',
  './static/javascripts/offline.js',
  './static/javascripts/app.js',
  './static/javascripts/key.js',
  './static/javascripts/swipe.js',
  './static/fonts/inter.woff2',
  './static/graphicarts/favicon.svg',
  './static/graphicarts/favicon.png',
  './static/graphicarts/icon-192.png',
  './static/graphicarts/icon-512.png',
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

// Network-first with cache fallback. Keeping the freshly served HTML and the
// JS/CSS it depends on in lockstep avoids "fresh HTML + stale cached JS"
// mismatches across deploys, while the cache fallback preserves offline use.
self.addEventListener('fetch', function(event) {
  event.respondWith(
    fetch(event.request).then(function(response) {
      var url = new URL(event.request.url);
      if (url.pathname.indexOf('/static/') !== -1) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});
