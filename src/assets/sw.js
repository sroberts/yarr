var CACHE_NAME = 'yarr-v20';
// the app page itself, cached on each successful load so an installed app
// opens with no connection (saved and starred articles are in IndexedDB)
var SHELL_KEY = './';
var STATIC_ASSETS = [
  './static/stylesheets/base.css',
  './static/stylesheets/app.css',
  './static/javascripts/vue.global.prod.js',
  './static/javascripts/api.js',
  './static/javascripts/offline.js',
  './static/javascripts/outbox.js',
  './static/javascripts/app.js',
  './static/javascripts/key.js',
  './static/javascripts/swipe.js',
  './static/fonts/hanken-grotesk-latin.woff2',
  './static/fonts/hanken-grotesk-latin-ext.woff2',
  './static/fonts/literata-latin.woff2',
  './static/fonts/literata-latin-ext.woff2',
  './static/fonts/literata-latin-italic.woff2',
  './static/fonts/literata-latin-ext-italic.woff2',
  './static/fonts/jetbrains-mono.woff2',
  './static/graphicarts/favicon.svg',
  './static/graphicarts/favicon.png',
  './static/graphicarts/icon-192.png',
  './static/graphicarts/icon-512.png',
  './static/graphicarts/icon-maskable.svg',
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
  var req = event.request;
  // Page loads: network first; keep the last good copy of the app page, and
  // fall back to it offline. One copy whatever the query (?view= shortcuts),
  // and only a real 200 page, never a redirect or an error.
  if (req.mode === 'navigate' && req.method === 'GET') {
    event.respondWith(
      fetch(req).then(function(response) {
        // Only the app page itself: a navigation to /opml/export, an API
        // URL or a gateway sign-in page must never become the shell.
        var isShell = new URL(req.url).pathname === new URL(self.registration.scope).pathname &&
          (response.headers.get('Content-Type') || '').indexOf('text/html') === 0;
        if (isShell && response.ok && response.type === 'basic' && !response.redirected) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(SHELL_KEY, copy);
          });
        }
        return response;
      }).catch(function() {
        return caches.open(CACHE_NAME).then(function(cache) {
          return cache.match(SHELL_KEY);
        }).then(function(cached) {
          return cached || Response.error();
        });
      })
    );
    return;
  }
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
