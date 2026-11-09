"use strict";

// Outbox for article writes (read / starred / Instapaper). A write that can't
// reach the server is kept, persisted to IndexedDB so it survives a reload,
// and retried with backoff instead of being thrown away (#171, #122).
//
// send(entry) resolves with the Response when the server took the write,
// resolves null when it was queued for retry, and rejects (err.permanent)
// when the server refused it: retrying would never help, so the caller
// should put the old state back and say so.
//
// entry: {kind: 'status' | 'instapaper', id, status?, from?, title?}
(function() {
  var pending = {}   // key -> queued entry
  var latest = {}    // key -> the newest entry sent for that item
  var chains = {}    // key -> tail of that item's write chain
  var failures = 0   // consecutive transient failures
  var timer = null
  var draining = null
  var listeners = []
  var handlers = {}
  var seq = 0

  function keyOf(e) { return e.kind + ':' + e.id }
  function store() { return window.offlineStore && window.offlineStore.outbox }
  function count() { return Object.keys(pending).length }

  function state() {
    return {count: count(), failing: failures >= 2, syncing: !!draining}
  }
  function notify() {
    var s = state()
    listeners.forEach(function(fn) { fn(s) })
  }

  function enqueue(e) {
    if (latest[e.key] !== e) return  // a newer write for this item exists
    pending[e.key] = e
    if (store()) store().put(e)
    notify()
    schedule()
  }
  function dequeue(e) {
    if (pending[e.key] !== e) return
    delete pending[e.key]
    if (store()) store().del(e.key)
    notify()
  }

  // Network errors and gateway-style 5xx (the server restarting behind a
  // proxy) are worth retrying. Anything the server itself answered is not;
  // that includes an Instapaper 502 that carries yarr's own error message.
  function request(e) {
    var p = e.kind === 'instapaper'
      ? api.items.saveToInstapaper(e.id)
      : api.items.update(e.id, {status: e.status})
    return p.then(function(res) {
      if (res.ok) return res
      return res.json().catch(function() { return {} }).then(function(body) {
        var message = (body && body.error) || ''
        var err = new Error(message)
        err.permanent = res.status < 500 || (e.kind === 'instapaper' && !!message)
        throw err
      })
    })
  }

  // Writes for one item run one after another, so an older write can never
  // land after a newer one. Different items don't wait on each other.
  function run(e) {
    var tail = (chains[e.key] || Promise.resolve()).then(function() { return request(e) })
    var settled = tail.catch(function() {})
    chains[e.key] = settled
    settled.then(function() { if (chains[e.key] === settled) delete chains[e.key] })
    return tail
  }

  function succeeded() {
    var was = failures
    failures = 0
    if (was) notify()
    // the server answers again: send what was waiting
    if (count() && !draining) drain()
  }
  function failed() {
    failures += 1
    notify()
  }

  function schedule() {
    if (timer || draining || !count()) return
    // 2s, 4s, 8s ... capped at a minute, with a little jitter
    var delay = Math.min(60000, 2000 * Math.pow(2, Math.max(0, failures - 1)))
    timer = setTimeout(drain, delay * (0.8 + Math.random() * 0.4))
  }

  function drain() {
    clearTimeout(timer)
    timer = null
    if (draining) return draining
    var list = Object.keys(pending).map(function(k) { return pending[k] })
      .sort(function(a, b) { return a.seq - b.seq })
    if (!list.length) return Promise.resolve()
    var synced = 0
    draining = list.reduce(function(prev, e) {
      return prev.then(function(stop) {
        if (stop || pending[e.key] !== e) return stop
        return run(e).then(function(res) {
          dequeue(e)
          failures = 0
          synced += 1
          if (handlers.synced) handlers.synced(e, res)
          return false
        }, function(err) {
          if (err.permanent) {
            dequeue(e)
            if (handlers.rejected) handlers.rejected(e, err)
            return false
          }
          // still unreachable: stop here rather than hammer it with the rest
          failed()
          return true
        })
      })
    }, Promise.resolve(false)).then(function() {
      draining = null
      notify()
      if (synced && handlers.drained) handlers.drained(synced)
      schedule()
    })
    notify()
    return draining
  }

  window.outbox = {
    send: function(entry) {
      var e = {
        kind: entry.kind, id: entry.id, status: entry.status,
        from: entry.from, title: entry.title || '',
        seq: ++seq, queuedAt: Date.now(),
      }
      e.key = keyOf(e)
      latest[e.key] = e
      if (pending[e.key]) dequeue(pending[e.key])  // superseded
      return run(e).then(function(res) {
        succeeded()
        return res
      }, function(err) {
        if (err.permanent) throw err
        failed()
        enqueue(e)
        return null
      })
    },
    retry: function() {
      return drain()
    },
    state: state,
    subscribe: function(fn) {
      listeners.push(fn)
      fn(state())
    },
    // synced(entry, res): a queued write went through
    // rejected(entry, err): the server refused a queued write
    // drained(n): a retry pass sent n writes
    on: function(h) {
      for (var k in h) handlers[k] = h[k]
    },
    // Pick up writes queued before the last reload, then try them.
    restore: function() {
      if (!store()) return Promise.resolve()
      return store().all().then(function(entries) {
        entries.sort(function(a, b) { return a.queuedAt - b.queuedAt }).forEach(function(e) {
          if (latest[e.key]) return  // already written again this session
          e.seq = ++seq
          latest[e.key] = e
          pending[e.key] = e
        })
        notify()
        if (count()) drain()
      })
    },
  }

  window.addEventListener('online', function() { if (count()) drain() })
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && count()) drain()
  })
})();
