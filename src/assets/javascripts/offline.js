"use strict";

// Offline reading store: keeps the full content of deliberately-kept articles
// (starred + Instapaper-saved) in IndexedDB so the reading pane works with no
// network. Local-only; nothing leaves the device. Exposes window.offlineStore
// with put(item) / get(id); all methods fail soft (resolve null / no-op) so the
// app never breaks when IndexedDB is unavailable (private mode, quota, etc.).
(function() {
  var DB_NAME = 'yarr-offline';
  var STORE = 'articles';
  var OUTBOX = 'outbox';  // writes waiting to reach the server (outbox.js)
  var VERSION = 2;
  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve, reject) {
      if (!('indexedDB' in window)) return reject(new Error('no-indexeddb'));
      var req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = function() {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, {keyPath: 'id'});
        }
        if (!req.result.objectStoreNames.contains(OUTBOX)) {
          req.result.createObjectStore(OUTBOX, {keyPath: 'key'});
        }
      };
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error); };
    });
    return dbPromise;
  }

  function withStore(mode, fn, name) {
    return openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var t = db.transaction(name || STORE, mode);
        var store = t.objectStore(name || STORE);
        var out = fn(store);
        t.oncomplete = function() { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function() { reject(t.error); };
        t.onabort = function() { reject(t.error); };
      });
    });
  }

  window.offlineStore = {
    // Cache an item (with its content) for offline reading.
    put: function(item) {
      if (!item || item.id == null) return Promise.resolve();
      return withStore('readwrite', function(store) {
        store.put({id: item.id, item: item, savedAt: Date.now()});
      }).catch(function() { /* fail soft */ });
    },
    // Return the cached item, or null if absent / unavailable.
    get: function(id) {
      return openDB().then(function(db) {
        return new Promise(function(resolve) {
          var req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
          req.onsuccess = function() { resolve(req.result ? req.result.item : null); };
          req.onerror = function() { resolve(null); };
        });
      }).catch(function() { return null; });
    },
    // Queued writes. The outbox keeps its own copy in memory, so these only
    // make the queue survive a reload; they fail soft like the rest.
    outbox: {
      put: function(entry) {
        return withStore('readwrite', function(store) {
          store.put(entry);
        }, OUTBOX).catch(function() {});
      },
      del: function(key) {
        return withStore('readwrite', function(store) {
          store.delete(key);
        }, OUTBOX).catch(function() {});
      },
      all: function() {
        return withStore('readonly', function(store) {
          return store.getAll();
        }, OUTBOX).then(function(rows) { return rows || []; })
          .catch(function() { return []; });
      },
    },
  };
})();
