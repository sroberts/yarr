'use strict';

var TITLE = document.title

// Reading time: computed client-side from an item's content (the list payload
// already ships content), memoized per item id so re-renders are cheap.
// Returns whole minutes at ~200 wpm (min 1), '60+' past an hour, or null when
// there's no prose to estimate (link-only posts) so the UI shows nothing.
var readingTimeCache = {}
function readingMinutes(item) {
  if (!item || item.id == null) return null
  if (readingTimeCache[item.id] !== undefined) return readingTimeCache[item.id]
  var text = (item.content || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').trim()
  var words = text ? text.split(/\s+/).length : 0
  var mins = words ? Math.max(1, Math.round(words / 200)) : null
  if (mins && mins > 60) mins = '60+'
  readingTimeCache[item.id] = mins
  return mins
}

// Fuzzy matcher for the command palette: subsequence match with a score so
// tighter/earlier/word-start matches rank first. Returns a score (higher is
// better) or -1 when query isn't a subsequence of text. No dependency.
function fuzzyMatch(query, text) {
  if (!query) return 0
  var q = query.toLowerCase(), t = (text || '').toLowerCase()
  var qi = 0, score = 0, streak = 0, ti = 0
  for (; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++
      streak++
      score += streak                                   // reward consecutive hits
      if (ti === 0 || /[\s\W_]/.test(t[ti - 1])) score += 6  // word-start bonus
    } else {
      streak = 0
    }
  }
  return qi === q.length ? score - ti * 0.01 : -1       // tiebreak: earlier finish
}

// Resume position: remember where you left off in a long article. Per-device,
// per-item scroll offsets in localStorage — ephemeral, no server round-trip.
// Bounded (oldest evicted past CAP) so it never grows without limit.
var readingScroll = (function() {
  var KEY = 'yarr:scroll', CAP = 100, map = {}
  try { map = JSON.parse(localStorage.getItem(KEY)) || {} } catch (e) { map = {} }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(map)) } catch (e) {} }
  return {
    get: function(id) { return (map[id] && map[id].y) || 0 },
    set: function(id, y) {
      map[id] = {y: y, t: Date.now()}
      var keys = Object.keys(map)
      if (keys.length > CAP) {
        keys.sort(function(a, b) { return map[a].t - map[b].t })
        delete map[keys[0]]
        persist()
      } else {
        persist()
      }
    },
  }
})()

// Listen to article: on-device text-to-speech via the browser's Web Speech
// API. No network, no deps, no telemetry. speechSynthesis is browser-global
// (keeps talking across SPA state changes), so a single engine owns all of it
// and cancellation is centralized. Long text is split into sentence-sized
// chunks and spoken in sequence: Chrome truncates a single long utterance, and
// the per-chunk queue gives a reliable "finished" signal for triage continuation.
var ttsEngine = (function() {
  var supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  var chunks = [], index = 0, playing = false, paused = false
  var onEnd = null

  // Split into ~200-char pieces on sentence boundaries, falling back to hard
  // slices for runaway sentences so no chunk trips the engine's length limit.
  function chunkText(text) {
    var sentences = (text || '').replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || []
    var out = [], buf = ''
    sentences.forEach(function(s) {
      s = s.trim()
      while (s.length > 220) { out.push(s.slice(0, 220)); s = s.slice(220) }
      if ((buf + ' ' + s).trim().length > 200) { if (buf) out.push(buf.trim()); buf = s }
      else { buf = (buf + ' ' + s).trim() }
    })
    if (buf) out.push(buf.trim())
    return out
  }

  function speakNext() {
    if (index >= chunks.length) { finish(); return }
    var u = new SpeechSynthesisUtterance(chunks[index])
    u.onend = function() { if (!playing) return; index++; speakNext() }
    u.onerror = function() { if (!playing) return; index++; speakNext() }
    window.speechSynthesis.speak(u)
  }

  function finish() {
    var cb = onEnd
    reset()
    if (cb) cb()
  }

  function reset() { chunks = []; index = 0; playing = false; paused = false; onEnd = null }

  return {
    supported: supported,
    playing: function() { return playing && !paused },
    paused: function() { return paused },
    active: function() { return playing },
    // Speak text to completion. opts.onend fires only on natural completion
    // (not on stop/replacement), which triage uses to advance to the next card.
    speak: function(text, opts) {
      if (!supported) return
      window.speechSynthesis.cancel()
      chunks = chunkText(text)
      index = 0
      onEnd = (opts && opts.onend) || null
      if (!chunks.length) { reset(); return }
      playing = true; paused = false
      speakNext()
    },
    pause: function() {
      if (!supported || !playing || paused) return
      paused = true
      window.speechSynthesis.pause()
    },
    resume: function() {
      if (!supported || !playing || !paused) return
      paused = false
      window.speechSynthesis.resume()
    },
    stop: function() {
      if (!supported) return
      reset()
      window.speechSynthesis.cancel()
    },
  }
})()

// Theme preference is one of auto/light/dark (persisted as theme_name).
// 'auto' follows the OS; legacy values map night -> dark, sepia -> light.
function normalizeThemePref(pref) {
  if (pref === 'night') return 'dark'
  if (pref === 'sepia') return 'light'
  if (pref === 'light' || pref === 'dark' || pref === 'auto') return pref
  return 'auto'
}

function systemTheme() {
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  return dark ? 'dark' : 'light'
}

// Resolve a preference to a concrete theme (auto -> the OS theme).
function resolveTheme(pref) {
  return pref === 'auto' ? systemTheme() : pref
}

function scrollto(target, scroll) {
  var padding = 10
  var targetRect = target.getBoundingClientRect()
  var scrollRect = scroll.getBoundingClientRect()

  // target
  var relativeOffset = targetRect.y - scrollRect.y
  var absoluteOffset = relativeOffset + scroll.scrollTop

  if (padding <= relativeOffset && relativeOffset + targetRect.height <= scrollRect.height - padding) return

  var newPos = scroll.scrollTop
  if (relativeOffset < padding) {
    newPos = absoluteOffset - padding
  } else {
    newPos = absoluteOffset - scrollRect.height + targetRect.height + padding
  }
  scroll.scrollTop = Math.round(newPos)
}

var debounce = function(callback, wait) {
  var timeout
  return function() {
    var ctx = this, args = arguments
    clearTimeout(timeout)
    timeout = setTimeout(function() {
      callback.apply(ctx, args)
    }, wait)
  }
}

// Vue 3: create the app from the root options (defined below; the function
// declaration is hoisted), register directives/components on it, then mount
// at the bottom.
var vueApp = Vue.createApp(rootComponent())

vueApp.directive('scroll', {
  mounted: function(el, binding) {
    el.addEventListener('scroll', debounce(function(event) {
      binding.value(event, el)
    }, 200))
  },
})

vueApp.directive('focus', {
  mounted: function(el) {
    el.focus()
  }
})

vueApp.component('drag', {
  props: ['width'],
  template: '<div class="drag"></div>',
  mounted: function() {
    var self = this
    var startX = undefined
    var initW = undefined
    var onMouseMove = function(e) {
      var offset = e.clientX - startX
      var newWidth = initW + offset
      self.$emit('resize', newWidth)
    }
    var onMouseUp = function(e) {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    this.$el.addEventListener('mousedown', function(e) {
      startX = e.clientX
      initW = self.width
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })
  },
})

vueApp.component('dropdown', {
  // Vue 3: `class`/`ref` are reserved and can't be props; a passed class now
  // auto-merges onto the root element, so we drop the explicit :class binding.
  // `fixed` opts the menu into viewport-fixed positioning so it isn't clipped
  // by an overflow:auto ancestor (the sidebar feed list scrolls).
  props: {
    toggleClass: String,
    drop: String,
    title: String,
    fixed: Boolean,
  },
  data: function() {
    return {open: false}
  },
  template: `
    <div class="dropdown">
      <button ref="btn" @click="toggle" :class="btnToggleClass" :title="$props.title"><slot name="button"></slot></button>
      <div ref="menu" class="dropdown-menu" :class="{show: open}"><slot v-if="open"></slot></div>
    </div>
  `,
  computed: {
    btnToggleClass: function() {
      var c = this.$props.toggleClass || ''
      c += ' dropdown-toggle dropdown-toggle-no-caret'
      c += this.open ? ' show' : ''
      return c.trim()
    }
  },
  methods: {
    toggle: function(e) {
      this.open ? this.hide() : this.show()
    },
    show: function(e) {
      this.open = true
      var menu = this.$refs.menu
      var drop = this.$props.drop

      // Feed-row menus sit inside an overflow:auto scroll container that would
      // clip an absolutely-positioned menu; position:fixed escapes the clip.
      // Measure after the slot renders (nextTick) so the menu can flip above
      // the button when there isn't room below, and hide on scroll since a
      // fixed menu no longer tracks the row it belongs to.
      if (this.$props.fixed) {
        menu.style.position = 'fixed'
        menu.style.visibility = 'hidden'
        this.$nextTick(function() {
          var r = this.$refs.btn.getBoundingClientRect()
          var mh = menu.offsetHeight, mw = menu.offsetWidth
          var flipUp = (r.bottom + mh > window.innerHeight) && (r.top - mh > 0)
          menu.style.top = (flipUp ? r.top - mh : r.bottom) + 'px'
          menu.style.left = Math.max(4, r.right - mw) + 'px'
          menu.style.right = 'auto'
          menu.style.visibility = ''
        }.bind(this))
        document.addEventListener('click', this.clickHandler)
        document.addEventListener('keydown', this.keyHandler)
        window.addEventListener('scroll', this.hide, true)
        return
      }

      menu.style.top = this.$refs.btn.offsetHeight + 'px'
      if (drop === 'right') {
        menu.style.left = 'auto'
        menu.style.right = '0'
      } else if (drop === 'center') {
        this.$nextTick(function() {
          var btnWidth = this.$refs.btn.getBoundingClientRect().width
          var menuWidth = menu.getBoundingClientRect().width
          menu.style.left = '-' + ((menuWidth - btnWidth) / 2) + 'px'
        }.bind(this))
      }

      document.addEventListener('click', this.clickHandler)
      document.addEventListener('keydown', this.keyHandler)
    },
    hide: function() {
      this.open = false
      if (this.$refs.menu) {
        var s = this.$refs.menu.style
        s.position = s.visibility = s.top = s.left = s.right = ''
      }
      document.removeEventListener('click', this.clickHandler)
      document.removeEventListener('keydown', this.keyHandler)
      window.removeEventListener('scroll', this.hide, true)
    },
    clickHandler: function(e) {
      var dropdown = e.target.closest('.dropdown')
      if (dropdown == null || dropdown != this.$el) return this.hide()
      if (e.target.closest('.dropdown-item') != null) return this.hide()
    },
    keyHandler: function(e) {
      if (e.key === 'Escape') { this.hide(); this.$refs.btn.focus() }
    }
  },
})

vueApp.component('modal', {
  props: ['open'],
  emits: ['hide'],
  template: `
    <div class="modal custom-modal" tabindex="-1" v-if="$props.open">
      <div class="modal-dialog">
        <div class="modal-content" ref="content" tabindex="-1">
          <div class="modal-body">
            <slot v-if="$props.open"></slot>
          </div>
        </div>
      </div>
    </div>
  `,
  data: function() {
    return {opening: false}
  },
  watch: {
    'open': function(newVal) {
      if (newVal) {
        this.opening = true
        this._prevFocus = document.activeElement
        document.addEventListener('click', this.handleClick)
        document.addEventListener('keydown', this.handleKey)
        // move focus into the dialog for keyboard/screen-reader users
        this.$nextTick(function() {
          if (this.$refs.content) this.$refs.content.focus()
        }.bind(this))
      } else {
        document.removeEventListener('click', this.handleClick)
        document.removeEventListener('keydown', this.handleKey)
        // restore focus to whatever opened the modal
        if (this._prevFocus && this._prevFocus.focus) this._prevFocus.focus()
      }
    },
  },
  methods: {
    handleClick: function(e) {
      if (this.opening) {
        this.opening = false
        return
      }
      if (e.target.closest('.modal-content') == null) this.$emit('hide')
    },
    handleKey: function(e) {
      if (e.key === 'Escape') this.$emit('hide')
    },
  },
})

function dateRepr(d) {
  var sec = (new Date().getTime() - d.getTime()) / 1000
  var neg = sec < 0
  var out = ''

  sec = Math.abs(sec)
  if (sec < 2700)  // less than 45 minutes
    out = Math.round(sec / 60) + 'm'
  else if (sec < 86400)  // less than 24 hours
    out = Math.round(sec / 3600) + 'h'
  else if (sec < 604800)  // less than a week
    out = Math.round(sec / 86400) + 'd'
  else
    out = d.toLocaleDateString(undefined, {year: "numeric", month: "long", day: "numeric"})

  if (neg) return '-' + out
  return out
}

vueApp.component('relative-time', {
  props: ['val'],
  data: function() {
    var d = new Date(this.val)
    return {
      'date': d,
      'formatted': dateRepr(d),
      'interval': null,
    }
  },
  template: '<time :datetime="val">{{ formatted }}</time>',
  watch: {
    // React to `val` changing on a reused instance. The triage card keeps one
    // <relative-time> mounted and swaps currentCard.date through it; without
    // this the first card's date would stick to every later card.
    'val': function(newVal) {
      this.date = new Date(newVal)
      this.formatted = dateRepr(this.date)
    },
  },
  mounted: function() {
    this.interval = setInterval(function() {
      this.formatted = dateRepr(this.date)
    }.bind(this), 600000)  // every 10 minutes
  },
  unmounted: function() {
    clearInterval(this.interval)
  },
})

function rootComponent() { return {
  created: function() {
    // Consume the PWA shortcut param: clean it from the URL so a reload doesn't
    // re-apply it, and route triage through filterSelected (its watcher enters
    // card mode). unread/starred/all were already set as the initial filter.
    var view = (new URLSearchParams(location.search)).get('view')
    if (view) {
      if (window.history && history.replaceState) {
        history.replaceState(null, '', location.pathname + location.hash)
      }
      if (view === 'triage') this.filterSelected = 'triage'
    }
    this.refreshStats()
      .then(this.refreshFeeds.bind(this))
      .then(this.refreshItems.bind(this, false))

    api.feeds.list_errors().then(function(errors) {
      vm.feed_errors = errors
    })
    this.loadFilters()
    this.updateMetaTheme(resolveTheme(this.theme.name))
    // Cmd/Ctrl+K opens the command palette from anywhere (key.js ignores
    // modifier chords, so this needs its own listener).
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        vm.togglePalette()
      }
    })
    // when following the OS, react to OS theme changes live
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
        if (vm.theme.name !== 'auto') return
        var resolved = systemTheme()
        vm.updateMetaTheme(resolved)
        document.body.classList.value = 'theme-' + resolved
      })
    }
  },
  data: function() {
    var s = app.settings
    // PWA app-icon shortcuts land on ?view=<name> (manifest shortcuts). Apply
    // unread/starred/all as the initial filter so there's no persist or extra
    // fetch; triage is applied in created() so its watcher enters card mode.
    var view = (new URLSearchParams(location.search)).get('view')
    var initialFilter = (view === 'unread' || view === 'starred') ? view
                      : (view === 'all') ? ''
                      : s.filter
    return {
      'filterSelected': initialFilter,
      'folders': [],
      'feeds': [],
      'filters': [],
      'filterDraft': {action: 'read', keyword: '', feedId: null, applyNow: false},
      'feedSelected': s.feed,
      'feedListWidth': s.feed_list_width || 300,
      'feedNewChoice': [],
      'feedNewChoiceSelected': '',
      'items': [],
      'itemsHasMore': true,
      'itemSelected': null,
      'itemSelectedDetails': null,
      'itemSelectedReadability': '',
      'itemSearch': '',
      'paletteOpen': false,
      'paletteQuery': '',
      'paletteIndex': 0,
      // {feed, x, y} while a feed row's right-click menu is open, else null
      'feedContextMenu': null,
      // {title, value, confirmLabel, onConfirm} while the themed input prompt
      // (rename/change-link/new-folder) is open, else null
      'promptModal': null,
      // {label, onUndo, onCommit, timer} while a reversible feed action (delete,
      // move) is within its undo window, else null
      'feedUndo': null,
      'ttsPlaying': false,
      'ttsPaused': false,
      'itemSortNewestFirst': s.sort_newest_first,
      'itemListWidth': s.item_list_width || 300,

      'filteredFeedStats': {},
      'filteredFolderStats': {},
      'filteredTotalStats': null,

      'settings': '',
      'loading': {
        'feeds': 0,
        'newfeed': false,
        'items': false,
        'readability': false,
        'instapaper': false,
      },
      'fonts': ['', 'serif', 'monospace'],
      'feedStats': {},
      'theme': {
        // 'auto' follows the OS; legacy night -> dark, sepia -> light
        'name': normalizeThemePref(s.theme_name),
        'font': s.theme_font,
        'size': s.theme_size,
        'accent': s.theme_accent || 'blue',
        'density': s.theme_density || 'comfortable',
        'motion': s.theme_motion || 'system',
      },
      'themeColors': {
        'light': '#FFFFFF',
        'dark': '#0E1116',
      },
      'refreshRate': s.refresh_rate,
      'authenticated': app.authenticated,
      'version': app.version || '',
      'feed_errors': {},

      'instapaperUsername': s.instapaper_username || '',
      'instapaperPassword': s.instapaper_password || '',
      'cardItems': [],
      'cardIndex': 0,
      'cardStats': { read: 0, instapaper: 0, kept: 0 },
      'cardLoading': false,
      'cardUndo': null,
      'toast': null,
      'itemOffline': false,
      'itemUnavailable': false,
      'cardFolder': '',
      'previousFilter': '',
      'refreshRateOptions': [
        { title: "0", value: 0 },
        { title: "10m", value: 10 },
        { title: "30m", value: 30 },
        { title: "1h", value: 60 },
        { title: "2h", value: 120 },
        { title: "4h", value: 240 },
        { title: "12h", value: 720 },
        { title: "24h", value: 1440 },
      ],
    }
  },
  computed: {
    ttsSupported: function() {
      return ttsEngine.supported
    },
    // Responsive layout classes for the #app container. These drive the mobile
    // single-column view (app.css @media max-width): feed list -> article list
    // -> reader. Applied imperatively via a watcher because #app is the Vue
    // *mount container* and Vue 3 ignores :class bindings on the mount host.
    appLayoutClasses: function() {
      return {
        'feed-selected': this.feedSelected !== null,
        'item-selected': this.itemSelected !== null,
        'card-mode': this.cardMode,
      }
    },
    foldersWithFeeds: function() {
      var feedsByFolders = this.feeds.reduce(function(folders, feed) {
        if (!folders[feed.folder_id])
          folders[feed.folder_id] = [feed]
        else
          folders[feed.folder_id].push(feed)
        return folders
      }, {})
      var folders = this.folders.slice().map(function(folder) {
        folder.feeds = feedsByFolders[folder.id]
        return folder
      })
      folders.push({id: null, feeds: feedsByFolders[null]})
      return folders
    },
    feedsById: function() {
      return this.feeds.reduce(function(acc, f) { acc[f.id] = f; return acc }, {})
    },
    foldersById: function() {
      return this.folders.reduce(function(acc, f) { acc[f.id] = f; return acc }, {})
    },
    current: function() {
      var parts = (this.feedSelected || '').split(':', 2)
      var type = parts[0]
      var guid = parts[1]

      var folder = {}, feed = {}

      if (type == 'feed')
        feed = this.feedsById[guid] || {}
      if (type == 'folder')
        folder = this.foldersById[guid] || {}

      return {type: type, feed: feed, folder: folder}
    },
    // Command-palette candidates: enabled actions, then feeds, then folders,
    // fuzzy-ranked against the query (or default order when empty), plus an
    // article-search escape hatch. Capped so a huge feed list stays instant.
    paletteResults: function() {
      var q = this.paletteQuery.trim()
      var all = this.paletteCommands().filter(function(c) { return c.enabled !== false })
      this.feeds.forEach(function(f) {
        all.push({group: 'Feeds', label: f.title || f.feed_link, run: function() {
          vm.feedSelected = 'feed:' + f.id; vm.itemSelected = null
        }})
      })
      this.folders.forEach(function(fo) {
        all.push({group: 'Folders', label: fo.title, run: function() {
          vm.feedSelected = 'folder:' + fo.id; vm.itemSelected = null
        }})
      })
      var results
      if (!q) {
        results = all
      } else {
        results = all
          .map(function(c) { return {c: c, s: fuzzyMatch(q, c.label)} })
          .filter(function(x) { return x.s >= 0 })
          .sort(function(a, b) { return b.s - a.s })
          .map(function(x) { return x.c })
        results.push({group: 'Search', label: 'Search articles for “' + q + '”', run: function() {
          vm.itemSearch = q
          var box = document.getElementById('searchbar'); if (box) box.focus()
        }})
      }
      return results.slice(0, 50)
    },
    itemSelectedContent: function() {
      if (!this.itemSelected) return ''

      if (this.itemSelectedReadability)
        return this.itemSelectedReadability

      return this.itemSelectedDetails.content || ''
    },
    contentImages: function() {
      if (!this.itemSelectedDetails) return []
      return (this.itemSelectedDetails.media_links || []).filter(l => l.type === 'image')
    },
    contentAudios: function() {
      if (!this.itemSelectedDetails) return []
      return (this.itemSelectedDetails.media_links || []).filter(l => l.type === 'audio')
    },
    contentVideos: function() {
      if (!this.itemSelectedDetails) return []
      return (this.itemSelectedDetails.media_links || []).filter(l => l.type === 'video')
    },
    refreshRateTitle: function () {
      const entry = this.refreshRateOptions.find(o => o.value === this.refreshRate)
      return entry ? entry.title : '0'
    },
    cardMode: function() {
      return this.filterSelected === 'triage'
    },
    currentCard: function() {
      if (this.cardIndex < this.cardItems.length) {
        return this.cardItems[this.cardIndex]
      }
      return null
    },
    cardDone: function() {
      return this.cardMode && this.cardIndex >= this.cardItems.length && !this.cardLoading
    },
    cardExcerpt: function() {
      if (!this.currentCard || !this.currentCard.content) return ''
      var tmp = document.createElement('div')
      tmp.textContent = ''
      tmp.insertAdjacentHTML('afterbegin', this.currentCard.content)
      var text = tmp.textContent || tmp.innerText || ''
      return text.length > 600 ? text.substring(0, 600) + '…' : text
    },
    cardDomain: function() {
      if (!this.currentCard || !this.currentCard.link) return ''
      try {
        var url = new URL(this.currentCard.link)
        return url.hostname.replace(/^www\./, '')
      } catch (e) {
        return ''
      }
    },
    cardUndoLabel: function() {
      if (!this.cardUndo) return ''
      if (this.cardUndo.action === 'instapaper') return 'Saved to Instapaper'
      if (this.cardUndo.action === 'read') return 'Marked read'
      return 'Kept unread'
    },
  },
  watch: {
    'appLayoutClasses': {
      immediate: true,
      handler: function(classes) {
        var el = document.getElementById('app')
        if (!el) return
        Object.keys(classes).forEach(function(name) { el.classList.toggle(name, classes[name]) })
      },
    },
    'theme': {
      deep: true,
      handler: function(theme) {
        var resolved = resolveTheme(theme.name)
        this.updateMetaTheme(resolved)
        document.body.classList.value = 'theme-' + resolved
        document.body.dataset.accent = theme.accent
        document.body.dataset.density = theme.density
        document.body.dataset.motion = theme.motion
        api.settings.update({
          theme_name: theme.name,
          theme_font: theme.font,
          theme_size: theme.size,
          theme_accent: theme.accent,
          theme_density: theme.density,
          theme_motion: theme.motion,
        })
      },
    },
    'feedStats': {
      deep: true,
      handler: debounce(function() {
        var title = TITLE
        var unreadCount = Object.values(this.feedStats).reduce(function(acc, stat) {
          return acc + stat.unread
        }, 0)
        if (unreadCount) {
          title += ' ('+unreadCount+')'
        }
        document.title = title
        if ('setAppBadge' in navigator) {
          if (unreadCount) {
            navigator.setAppBadge(unreadCount)
          } else {
            navigator.clearAppBadge()
          }
        }
        this.computeStats()
      }, 500),
    },
    'filterSelected': function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      this.stopListen()  // halt read-aloud when leaving/entering triage or switching views
      if (oldVal === 'triage') {
        this.flushCardAction()
        this.cardItems = []
        this.cardIndex = 0
        this.refreshStats()
      }
      if (newVal === 'triage') {
        this.previousFilter = oldVal || ''
        this.enterCardMode()
        return
      }
      this.itemSelected = null
      this.items = []
      this.itemsHasMore = true
      api.settings.update({filter: newVal}).then(this.refreshItems.bind(this, false))
      this.computeStats()
    },
    'feedSelected': function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      this.itemSelected = null
      this.items = []
      this.itemsHasMore = true
      api.settings.update({feed: newVal}).then(this.refreshItems.bind(this, false))
      if (this.$refs.itemlist) this.$refs.itemlist.scrollTop = 0
    },
    'itemSelected': function(newVal, oldVal) {
      this.stopListen()  // halt any read-aloud when the article changes or closes
      this.itemSelectedReadability = ''
      this.itemOffline = false
      this.itemUnavailable = false
      if (newVal === null) {
        this.itemSelectedDetails = null
        return
      }
      if (this.$refs.content) this.$refs.content.scrollTop = 0

      api.items.get(newVal).then(function(item) {
        this.itemSelectedDetails = item
        this.restoreScroll(newVal)
        // keep the offline copy of deliberately-kept articles fresh
        if (item.status == 'starred' || item.instapaper_saved) {
          if (window.offlineStore) window.offlineStore.put(item)
        }
        if (this.itemSelectedDetails.status == 'unread') {
          api.items.update(this.itemSelectedDetails.id, {status: 'read'}).then(function() {
            this.feedStats[this.itemSelectedDetails.feed_id].unread -= 1
            var itemInList = this.items.find(function(i) { return i.id == item.id })
            if (itemInList) itemInList.status = 'read'
            this.itemSelectedDetails.status = 'read'
          }.bind(this))
        }
      }.bind(this)).catch(function() {
        // network unavailable — fall back to the offline cache
        var self = this
        var lookup = window.offlineStore ? window.offlineStore.get(newVal) : Promise.resolve(null)
        lookup.then(function(cached) {
          if (self.itemSelected !== newVal) return  // selection moved on
          if (cached) {
            self.itemSelectedDetails = cached
            self.itemOffline = true
            self.restoreScroll(newVal)
          } else {
            self.itemSelectedDetails = null
            self.itemUnavailable = true
          }
        })
      }.bind(this))
    },
    'itemSearch': debounce(function(newVal) {
      this.refreshItems()
    }, 500),
    'paletteQuery': function() {
      this.paletteIndex = 0
    },
    'itemSortNewestFirst': function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      api.settings.update({sort_newest_first: newVal}).then(vm.refreshItems.bind(this, false))
    },
    'feedListWidth': debounce(function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      api.settings.update({feed_list_width: newVal})
    }, 1000),
    'itemListWidth': debounce(function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      api.settings.update({item_list_width: newVal})
    }, 1000),
    'refreshRate': function(newVal, oldVal) {
      if (oldVal === undefined) return  // do nothing, initial setup
      api.settings.update({refresh_rate: newVal})
    },
  },
  methods: {
    updateMetaTheme: function(theme) {
      document.querySelector("meta[name='theme-color']").content = this.themeColors[theme] || this.themeColors.light
    },
    // Estimated reading time for an item (see readingMinutes). Template helper.
    readingTime: function(item) {
      return readingMinutes(item)
    },
    // Remember the reading pane's scroll offset for the open article (debounced
    // so a scroll gesture stores once, not on every frame).
    saveScroll: debounce(function() {
      var el = this.$refs.content
      if (el && this.itemSelected != null) readingScroll.set(this.itemSelected, el.scrollTop)
    }, 250),
    // Restore a stored offset after the article's DOM has rendered.
    restoreScroll: function(id) {
      this.$nextTick(function() {
        var el = this.$refs.content
        if (el) el.scrollTop = readingScroll.get(id)
      }.bind(this))
    },
    // Listen to article (on-device TTS). Strip HTML to plain text via a temp
    // element (decodes entities, drops tags) — same approach as cardExcerpt.
    plainText: function(html) {
      var tmp = document.createElement('div')
      tmp.insertAdjacentHTML('afterbegin', html || '')
      return (tmp.textContent || tmp.innerText || '').trim()
    },
    speakArticle: function() {
      var det = this.itemSelectedDetails
      if (!det) return
      var body = this.plainText(this.itemSelectedContent)
      var text = ((det.title || '') + '. ' + body).trim()
      var self = this
      ttsEngine.speak(text, {onend: function() { self.ttsPlaying = false; self.ttsPaused = false }})
      this.ttsPlaying = true
      this.ttsPaused = false
    },
    speakCard: function() {
      var card = this.currentCard
      if (!card) return
      var text = ((card.title || '') + '. ' + this.plainText(card.content)).trim()
      var self = this
      // On natural completion, advance to the next card and keep reading until
      // the deck is exhausted — the hands-free triage loop.
      ttsEngine.speak(text, {onend: function() {
        if (!self.cardMode) { self.ttsPlaying = false; self.ttsPaused = false; return }
        self.cardListenNext()
      }})
      this.ttsPlaying = true
      this.ttsPaused = false
    },
    // Advance triage to the next card and continue reading, or stop at the end.
    cardListenNext: function() {
      if (this.cardIndex + 1 >= this.cardItems.length) {
        this.stopListen()  // deck exhausted (all cards are preloaded)
        return
      }
      this.cardIndex += 1
      var self = this
      this.$nextTick(function() { self.speakCard() })
    },
    pauseListen: function() {
      ttsEngine.pause()
      this.ttsPaused = true
    },
    resumeListen: function() {
      ttsEngine.resume()
      this.ttsPaused = false
    },
    stopListen: function() {
      ttsEngine.stop()
      this.ttsPlaying = false
      this.ttsPaused = false
    },
    // Context-aware toggle used by the toolbar button, 'p' key, and palette:
    // idle -> start (card or article), playing -> pause, paused -> resume.
    toggleListen: function() {
      if (!ttsEngine.supported) return
      if (this.ttsPlaying) {
        this.ttsPaused ? this.resumeListen() : this.pauseListen()
      } else if (this.cardMode) {
        this.speakCard()
      } else if (this.itemSelected != null) {
        this.speakArticle()
      }
    },
    // Command-palette actions. Reuse key.js's shortcutFunctions so the palette
    // and keyboard map can't drift; each entry carries a label, shortcut hint,
    // and an `enabled` predicate for context-dependent actions.
    paletteCommands: function() {
      var S = window.shortcutFunctions || {}
      var hasItem = this.itemSelected != null
      var det = this.itemSelectedDetails
      // Feed management (rare maintenance) is scoped to the selected feed here
      // and via right-click on a feed row — deliberately not persistent chrome.
      var feedSel = this.current.type == 'feed'
      var cf = this.current.feed
      var cmds = [
        {group: 'Actions', label: 'New feed',               run: function() { vm.showSettings('create') }},
        {group: 'Actions', label: 'Refresh feeds',          run: function() { vm.fetchAllFeeds() }},
        {group: 'Actions', label: 'Mark all read',          hint: 'R', enabled: this.filterSelected == 'unread', run: S.markAllRead},
        {group: 'Actions', label: 'Show unread',            hint: '1', run: S.showUnread},
        {group: 'Actions', label: 'Show starred',           hint: '2', run: S.showStarred},
        {group: 'Actions', label: 'Show all',               hint: '3', run: S.showAll},
        {group: 'Actions', label: 'Star / unstar article',  hint: 's', enabled: hasItem, run: S.toggleItemStarred},
        {group: 'Actions', label: 'Mark read / unread',     hint: 'r', enabled: hasItem, run: S.toggleItemRead},
        {group: 'Actions', label: 'Save to Instapaper',     hint: 'I', enabled: hasItem && det && !det.instapaper_saved, run: S.saveToInstapaper},
        {group: 'Actions', label: 'Read here (readability)', hint: 'i', enabled: hasItem, run: S.toggleReadability},
        {group: 'Actions', label: this.ttsPlaying ? (this.ttsPaused ? 'Listen: resume' : 'Listen: pause') : 'Listen to article', hint: 'p', enabled: this.ttsSupported && (hasItem || this.cardMode), run: S.toggleListen},
        {group: 'Actions', label: 'Open original link',     hint: 'o', enabled: hasItem && det && !!det.link, run: S.openItemLink},
        {group: 'Actions', label: 'Theme: Light',           enabled: this.theme.name !== 'light', run: function() { vm.theme.name = 'light' }},
        {group: 'Actions', label: 'Theme: Dark',            enabled: this.theme.name !== 'dark', run: function() { vm.theme.name = 'dark' }},
        {group: 'Actions', label: 'Theme: Auto (system)',   enabled: this.theme.name !== 'auto', run: function() { vm.theme.name = 'auto' }},
        {group: 'Actions', label: 'Settings',               run: function() { vm.showSettings('settings') }},
        {group: 'Actions', label: 'Keyboard shortcuts',     hint: '?', run: S.showShortcuts},
        {group: 'Feed', label: 'Rename feed',            enabled: feedSel, run: function() { vm.renameFeed(vm.current.feed) }},
        {group: 'Feed', label: 'Change feed link',       enabled: feedSel && !!cf.feed_link, run: function() { vm.updateFeedLink(vm.current.feed) }},
        {group: 'Feed', label: 'Move feed to new folder', enabled: feedSel, run: function() { vm.moveFeedToNewFolder(vm.current.feed) }},
        {group: 'Feed', label: 'Move feed out of folder', enabled: feedSel && cf.folder_id != null, run: function() { vm.moveFeedWithUndo(vm.current.feed, null) }},
        {group: 'Feed', label: 'Delete feed',            enabled: feedSel, run: function() { vm.deleteFeed(vm.current.feed) }},
      ]
      // One "Move feed to <folder>" per other folder, only with a feed selected.
      if (feedSel) {
        this.folders.forEach(function(f) {
          if (f.id == cf.folder_id) return
          cmds.push({group: 'Feed', label: 'Move feed to ' + f.title, run: function() { vm.moveFeedWithUndo(vm.current.feed, f) }})
        })
      }
      return cmds
    },
    // Feed row actions menu — opened by right-click OR the row's ⋯ button.
    // Positioned fixed (clamped to the viewport) so the overflow:auto feed list
    // can't clip it; closes on any click, scroll, resize, or Escape. Opening it
    // also selects the row, so the menu and the command palette act on the same
    // feed. `event` is a mouse or keyboard event; keyboard activation has no
    // cursor, so we fall back to the trigger element's box.
    openFeedContextMenu: function(feed, event) {
      this.feedSelected = 'feed:' + feed.id
      // remember the trigger so focus can return to it when the menu closes
      this._ctxTrigger = (event && event.currentTarget) || null
      var x = event && event.clientX, y = event && event.clientY
      if ((!x && !y) && this._ctxTrigger && this._ctxTrigger.getBoundingClientRect) {
        var tr = this._ctxTrigger.getBoundingClientRect()
        x = tr.right; y = tr.bottom
      }
      this.feedContextMenu = {feed: feed, x: x || 0, y: y || 0}
      this.$nextTick(function() {
        var menu = this.$refs.feedContextMenu
        if (!menu) return
        var mw = menu.offsetWidth, mh = menu.offsetHeight
        var mx = this.feedContextMenu.x, my = this.feedContextMenu.y
        if (mx + mw > window.innerWidth) mx = Math.max(4, window.innerWidth - mw - 4)
        if (my + mh > window.innerHeight) my = Math.max(4, window.innerHeight - mh - 4)
        menu.style.left = mx + 'px'
        menu.style.top = my + 'px'
        menu.style.visibility = ''
        // Focus the first item so keyboard users land inside the menu, matching
        // the role="menu" contract that feedContextMenuKey then fulfils.
        var first = menu.querySelector('.dropdown-item')
        if (first) first.focus(); else menu.focus()
      }.bind(this))
      document.addEventListener('click', this.closeFeedContextMenu)
      document.addEventListener('keydown', this.feedContextMenuKey)
      window.addEventListener('scroll', this.closeFeedContextMenu, true)
      window.addEventListener('resize', this.closeFeedContextMenu)
    },
    closeFeedContextMenu: function() {
      if (!this.feedContextMenu) return
      var focusInMenu = this._ctxMenuHasFocus()
      this.feedContextMenu = null
      document.removeEventListener('click', this.closeFeedContextMenu)
      document.removeEventListener('keydown', this.feedContextMenuKey)
      window.removeEventListener('scroll', this.closeFeedContextMenu, true)
      window.removeEventListener('resize', this.closeFeedContextMenu)
      // Return focus to the trigger only if focus was still inside the menu
      // (Escape / arrow nav). When an item was activated, its handler owns focus
      // next (e.g. a prompt modal), so we don't steal it back.
      if (focusInMenu && this._ctxTrigger && this._ctxTrigger.focus) this._ctxTrigger.focus()
      this._ctxTrigger = null
    },
    _ctxMenuHasFocus: function() {
      var menu = this.$refs.feedContextMenu
      return !!(menu && menu.contains(document.activeElement))
    },
    // Fulfil the role="menu" keyboard contract: arrows / Home / End move focus
    // between items (wrapping), Tab is trapped inside, Escape closes.
    feedContextMenuKey: function(e) {
      if (e.key === 'Escape') { e.preventDefault(); this.closeFeedContextMenu(); return }
      var menu = this.$refs.feedContextMenu
      if (!menu) return
      var items = Array.prototype.slice.call(menu.querySelectorAll('.dropdown-item'))
      if (!items.length) return
      var i = items.indexOf(document.activeElement)
      var next = null
      if (e.key === 'ArrowDown') next = items[(i + 1 + items.length) % items.length]
      else if (e.key === 'ArrowUp') next = items[(i - 1 + items.length) % items.length]
      else if (e.key === 'Home') next = items[0]
      else if (e.key === 'End') next = items[items.length - 1]
      else if (e.key === 'Tab') next = items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length]
      if (next) { e.preventDefault(); next.focus() }
    },
    // Grab the menu's feed, close, then run the action — so an action that opens
    // a prompt/confirm replacement isn't racing the menu teardown, and the feed
    // ref survives the close that nulls feedContextMenu.
    runFeedCtx: function(fn) {
      var feed = this.feedContextMenu && this.feedContextMenu.feed
      this.closeFeedContextMenu()
      if (feed) fn.call(this, feed)
    },
    togglePalette: function() {
      this.paletteOpen ? this.closePalette() : this.openPalette()
    },
    openPalette: function() {
      this._palettePrevFocus = document.activeElement
      this.paletteQuery = ''
      this.paletteIndex = 0
      this.paletteOpen = true
      this.$nextTick(function() {
        if (this.$refs.paletteInput) this.$refs.paletteInput.focus()
      }.bind(this))
    },
    closePalette: function() {
      this.paletteOpen = false
      if (this._palettePrevFocus && this._palettePrevFocus.focus) this._palettePrevFocus.focus()
    },
    paletteMove: function(delta) {
      var n = this.paletteResults.length
      if (!n) return
      this.paletteIndex = (this.paletteIndex + delta + n) % n
      this.$nextTick(function() {
        var el = document.querySelector('.command-palette-row.selected')
        if (el && el.scrollIntoView) el.scrollIntoView({block: 'nearest'})
      })
    },
    paletteExecute: function(i) {
      var r = this.paletteResults[i]
      if (!r) return
      // close first, then run — so an action that opens a modal (settings) or
      // moves focus (search) isn't fighting the palette's focus restore.
      this.paletteOpen = false
      this.paletteQuery = ''
      this.$nextTick(function() { if (r && r.run) r.run() })
    },
    // Smart Filters (Settings > Filters): rules that pre-triage items on refresh.
    loadFilters: function() {
      return api.filters.list().then(function(list) { vm.filters = list || [] })
    },
    filterActionLabel: function(action) {
      return {read: 'Auto-read', star: 'Auto-star', mute: 'Mute'}[action] || action
    },
    createFilter: function() {
      var draft = this.filterDraft
      var keyword = (draft.keyword || '').trim()
      if (!keyword) return
      var payload = {action: draft.action, keyword: keyword, feed_id: draft.feedId, apply_now: draft.applyNow}
      api.filters.create(payload).then(function(filter) {
        if (filter && filter.id) vm.filters.push(filter)
        vm.filterDraft = {action: 'read', keyword: '', feedId: null, applyNow: false}
        // "apply now" changed existing items server-side — resync the views.
        if (payload.apply_now) {
          vm.refreshStats().then(vm.refreshFeeds.bind(vm)).then(vm.refreshItems.bind(vm, false))
        }
      })
    },
    deleteFilter: function(f) {
      api.filters.delete(f.id).then(function() {
        vm.filters = vm.filters.filter(function(x) { return x.id !== f.id })
      })
    },
    refreshStats: function(loopMode) {
      return api.status().then(function(data) {
        if (loopMode && !vm.itemSelected) vm.refreshItems()

        vm.loading.feeds = data.running
        if (data.running) {
          setTimeout(vm.refreshStats.bind(vm, true), 500)
        }
        vm.feedStats = data.stats.reduce(function(acc, stat) {
          acc[stat.feed_id] = stat
          return acc
        }, {})

        api.feeds.list_errors().then(function(errors) {
          vm.feed_errors = errors
        })
      })
    },
    getItemsQuery: function() {
      var query = {}
      if (this.feedSelected) {
        var parts = this.feedSelected.split(':', 2)
        var type = parts[0]
        var guid = parts[1]
        if (type == 'feed') {
          query.feed_id = guid
        } else if (type == 'folder') {
          query.folder_id = guid
        }
      }
      if (this.filterSelected) {
        query.status = this.filterSelected
      }
      if (this.itemSearch) {
        query.search = this.itemSearch
      }
      if (!this.itemSortNewestFirst) {
        query.oldest_first = true
      }
      return query
    },
    refreshFeeds: function() {
      return Promise
        .all([api.folders.list(), api.feeds.list()])
        .then(function(values) {
          vm.folders = values[0]
          vm.feeds = values[1]
        })
    },
    refreshItems: function(loadMore = false) {
      if (this.feedSelected === null) {
        vm.items = []
        vm.itemsHasMore = false
        return
      }

      var query = this.getItemsQuery()
      if (loadMore) {
        query.after = vm.items[vm.items.length-1].id
      }

      this.loading.items = true
      return api.items.list(query).then(function(data) {
        if (loadMore) {
          vm.items = vm.items.concat(data.list)
        } else {
          vm.items = data.list
        }
        vm.itemsHasMore = data.has_more
        vm.loading.items = false

        // load more if there's some space left at the bottom of the item list.
        vm.$nextTick(function() {
          if (vm.itemsHasMore && !vm.loading.items && vm.itemListCloseToBottom()) {
            vm.refreshItems(true)
          }
        })
      })
    },
    itemListCloseToBottom: function() {
      // approx. vertical space at the bottom of the list (loading el & paddings) when 1rem = 16px
      var bottomSpace = 70
      var scale = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16

      var el = this.$refs.itemlist

      if (el.scrollHeight === 0) return false  // element is invisible (responsive design)

      var closeToBottom = (el.scrollHeight - el.scrollTop - el.offsetHeight) < bottomSpace * scale
      return closeToBottom
    },
    loadMoreItems: function(event, el) {
      if (!this.itemsHasMore) return
      if (this.loading.items) return
      if (this.itemListCloseToBottom()) return this.refreshItems(true)
      if (this.itemSelected && this.itemSelected === this.items[this.items.length - 1].id) return this.refreshItems(true)
    },
    showToast: function(text) {
      var self = this
      this.toast = {text: text}
      clearTimeout(this._toastTimer)
      this._toastTimer = setTimeout(function() { self.toast = null }, 2500)
    },
    markItemsRead: function() {
      if (!confirm('Mark all articles in this view as read?')) return
      var query = this.getItemsQuery()
      api.items.mark_read(query).then(function() {
        vm.items = []
        vm.itemsPage = {'cur': 1, 'num': 1}
        vm.itemSelected = null
        vm.itemsHasMore = false
        vm.refreshStats()
      })
    },
    toggleFolderExpanded: function(folder) {
      folder.is_expanded = !folder.is_expanded
      api.folders.update(folder.id, {is_expanded: folder.is_expanded})
    },
    formatDate: function(datestr) {
      var options = {
        year: "numeric", month: "long", day: "numeric",
        hour: '2-digit', minute: '2-digit',
      }
      return new Date(datestr).toLocaleDateString(undefined, options)
    },
    // Themed replacement for prompt(): open an in-app input modal. `opts` is
    // {title, value, confirmLabel, onConfirm}. onConfirm receives the trimmed,
    // non-empty value; an empty value cancels (matching prompt()'s null).
    askPrompt: function(opts) {
      this.promptModal = {
        title: opts.title,
        value: opts.value || '',
        confirmLabel: opts.confirmLabel || 'Save',
        onConfirm: opts.onConfirm,
      }
      // The modal component focuses .modal-content on its own $nextTick; defer a
      // macrotask so this input focus runs last and actually wins.
      var self = this
      setTimeout(function() {
        var input = self.$refs.promptInput
        if (input) { input.focus(); input.select() }
      }, 0)
    },
    confirmPrompt: function() {
      var m = this.promptModal
      if (!m) return
      var val = (m.value || '').trim()
      this.promptModal = null
      if (val) m.onConfirm(val)
    },
    // Show a reversible-action toast. `onCommit` fires when the ~5s window closes
    // (or is superseded); `onUndo` fires if the user hits Undo instead. Starting a
    // new undo commits any pending one first, so a deferred server write is never
    // dropped when actions are chained.
    showFeedUndo: function(label, onUndo, onCommit) {
      if (this.feedUndo) this.runFeedUndoCommit()
      var self = this
      var timer = setTimeout(function() { self.runFeedUndoCommit() }, 5000)
      this.feedUndo = {label: label, onUndo: onUndo, onCommit: onCommit, timer: timer}
    },
    runFeedUndoCommit: function() {
      var u = this.feedUndo
      if (!u) return
      clearTimeout(u.timer)
      this.feedUndo = null
      if (u.onCommit) u.onCommit()
    },
    runFeedUndo: function() {
      var u = this.feedUndo
      if (!u) return
      clearTimeout(u.timer)
      this.feedUndo = null
      if (u.onUndo) u.onUndo()
    },
    moveFeed: function(feed, folder) {
      var folder_id = folder ? folder.id : null
      api.feeds.update(feed.id, {folder_id: folder_id}).then(function() {
        feed.folder_id = folder_id
        vm.refreshStats()
      })
    },
    // moveFeed + an undo toast that moves the feed back to its previous folder.
    moveFeedWithUndo: function(feed, folder) {
      var prevId = feed.folder_id
      var prevFolder = prevId ? this.folders.find(function(f) { return f.id == prevId }) : null
      this.moveFeed(feed, folder)
      var dest = folder ? folder.title : 'Uncategorized'
      this.showFeedUndo('Moved “' + feed.title + '” to ' + dest, function() {
        vm.moveFeed(feed, prevFolder || null)
      }, null)
    },
    moveFeedToNewFolder: function(feed) {
      this.askPrompt({title: 'Move to new folder', confirmLabel: 'Create & move', onConfirm: function(title) {
        api.folders.create({'title': title}).then(function(folder) {
          api.feeds.update(feed.id, {folder_id: folder.id}).then(function() {
            vm.refreshFeeds().then(function() {
              vm.refreshStats()
            })
          })
        })
      }})
    },
    createNewFeedFolder: function() {
      var title = prompt('Enter folder name:')
      if (!title) return
      api.folders.create({'title': title}).then(function(result) {
        vm.refreshFeeds().then(function() {
          vm.$nextTick(function() {
            if (vm.$refs.newFeedFolder) {
              vm.$refs.newFeedFolder.value = result.id
            }
          })
        })
      })
    },
    renameFolder: function(folder) {
      var newTitle = prompt('Enter new title', folder.title)
      if (newTitle) {
        api.folders.update(folder.id, {title: newTitle}).then(function() {
          folder.title = newTitle
          this.folders.sort(function(a, b) {
            return a.title.localeCompare(b.title)
          })
        }.bind(this))
      }
    },
    deleteFolder: function(folder) {
      if (confirm('Are you sure you want to delete ' + folder.title + '?')) {
        api.folders.delete(folder.id).then(function() {
          vm.feedSelected = null
          vm.refreshStats()
          vm.refreshFeeds()
        })
      }
    },
    updateFeedLink: function(feed) {
      this.askPrompt({title: 'Change feed link', value: feed.feed_link, confirmLabel: 'Change', onConfirm: function(newLink) {
        api.feeds.update(feed.id, {feed_link: newLink}).then(function() {
          feed.feed_link = newLink
        })
      }})
    },
    renameFeed: function(feed) {
      this.askPrompt({title: 'Rename feed', value: feed.title, confirmLabel: 'Rename', onConfirm: function(newTitle) {
        api.feeds.update(feed.id, {title: newTitle}).then(function() {
          feed.title = newTitle
        })
      }})
    },
    // Delete optimistically and defer the server write behind an undo toast, so a
    // mis-delete is one click to reverse (the feed is only really gone once the
    // undo window closes). Mirrors the swipe-card deferred-write pattern.
    deleteFeed: function(feed) {
      this.feeds = this.feeds.filter(function(f) { return f.id !== feed.id })
      if (this.feedSelected === 'feed:' + feed.id) this.feedSelected = null
      this.refreshStats()
      this.showFeedUndo('Deleted “' + feed.title + '”', function() {
        // Nothing was deleted server-side; refetch to restore the row.
        vm.refreshFeeds().then(function() { vm.refreshStats() })
      }, function() {
        api.feeds.delete(feed.id).then(function() {
          vm.refreshStats()
          vm.refreshFeeds()
        })
      })
    },
    createFeed: function(event) {
      var form = event.target
      var data = {
        url: form.querySelector('input[name=url]').value,
        folder_id: parseInt(form.querySelector('select[name=folder_id]').value) || null,
      }
      if (this.feedNewChoiceSelected) {
        data.url = this.feedNewChoiceSelected
      }
      this.loading.newfeed = true
      api.feeds.create(data).then(function(result) {
        if (result.status === 'success') {
          vm.refreshFeeds()
          vm.refreshStats()
          vm.settings = ''
          vm.feedSelected = 'feed:' + result.feed.id
        } else if (result.status === 'multiple') {
          vm.feedNewChoice = result.choice
          vm.feedNewChoiceSelected = result.choice[0].url
        } else {
          alert('No feeds found at the given url.')
        }
        vm.loading.newfeed = false
      })
    },
    toggleItemStatus: function(item, targetstatus, fallbackstatus) {
      var oldstatus = item.status
      var newstatus = item.status !== targetstatus ? targetstatus : fallbackstatus

      var updateStats = function(status, incr) {
        if ((status == 'unread') || (status == 'starred')) {
          this.feedStats[item.feed_id][status] += incr
        }
      }.bind(this)

      api.items.update(item.id, {status: newstatus}).then(function() {
        updateStats(oldstatus, -1)
        updateStats(newstatus, +1)

        var itemInList = this.items.find(function(i) { return i.id == item.id })
        if (itemInList) itemInList.status = newstatus
        item.status = newstatus
        // cache the open article for offline reading when it's starred
        if (newstatus == 'starred' && window.offlineStore &&
            this.itemSelectedDetails && this.itemSelectedDetails.id == item.id) {
          window.offlineStore.put(this.itemSelectedDetails)
        }
      }.bind(this))
    },
    toggleItemStarred: function(item) {
      this.toggleItemStatus(item, 'starred', 'read')
    },
    toggleItemRead: function(item) {
      this.toggleItemStatus(item, 'unread', 'read')
    },
    importOPML: function(event) {
      var input = event.target
      var form = document.querySelector('#opml-import-form')
      this.$refs.menuDropdown.hide()
      api.upload_opml(form).then(function() {
        input.value = ''
        vm.refreshFeeds()
        vm.refreshStats()
      })
    },
    logout: function() {
      api.logout().then(function() {
        document.location.reload()
      })
    },
    toggleReadability: function() {
      if (this.itemSelectedReadability) {
        this.itemSelectedReadability = null
        return
      }
      var item = this.itemSelectedDetails
      if (!item) return
      if (item.link) {
        this.loading.readability = true
        api.crawl(item.link).then(function(data) {
          vm.itemSelectedReadability = data && data.content
          vm.loading.readability = false
        })
      }
    },
    saveToInstapaper: function(item) {
      if (!item || !item.link || item.instapaper_saved) return
      this.loading.instapaper = true
      api.items.saveToInstapaper(item.id).then(function(resp) {
        vm.loading.instapaper = false
        if (!resp.ok) {
          return resp.json().then(function(data) {
            alert(data.error || 'Failed to save to Instapaper')
          })
        }
        return resp.json().then(function(data) {
          vm.showToast('Saved to Instapaper')
          vm.itemSelectedDetails.instapaper_saved = true
          vm.itemSelectedDetails.status = 'read'
          if (window.offlineStore) window.offlineStore.put(vm.itemSelectedDetails)
          var itemInList = vm.items.find(function(i) { return i.id == item.id })
          if (itemInList) {
            itemInList.status = 'read'
            itemInList.instapaper_saved = true
          }
          if (vm.feedStats[item.feed_id]) {
            var stat = vm.feedStats[item.feed_id]
            if (item.status == 'unread' && stat.unread > 0) {
              stat.unread -= 1
            }
          }
        })
      }.bind(this)).catch(function() {
        vm.loading.instapaper = false
        alert('Failed to save to Instapaper. Check your connection.')
      })
    },
    updateInstapaperCredentials: function(key, value) {
      if (key === 'instapaper_username') this.instapaperUsername = value
      if (key === 'instapaper_password') this.instapaperPassword = value
      var update = {}
      update[key] = value
      api.settings.update(update)
    },
    enterCardMode: function() {
      this.cardItems = []
      this.cardIndex = 0
      this.cardStats = { read: 0, instapaper: 0, kept: 0 }
      this.cardFolder = ''
      this.cardLoading = true
      this.loadCardItems(null)
    },
    changeCardFolder: function(folderId) {
      this.flushCardAction()
      this.cardFolder = folderId
      this.cardItems = []
      this.cardIndex = 0
      this.cardStats = { read: 0, instapaper: 0, kept: 0 }
      this.cardLoading = true
      this.loadCardItems(null)
    },
    loadCardItems: function(afterId) {
      var query = { status: 'unread' }
      if (this.cardFolder) query.folder_id = this.cardFolder
      if (afterId) query.after = afterId
      api.items.list(query).then(function(data) {
        vm.cardItems = vm.cardItems.concat(data.list)
        if (data.has_more && data.list.length > 0) {
          vm.loadCardItems(data.list[data.list.length - 1].id)
        } else {
          vm.cardLoading = false
        }
      }).catch(function() {
        vm.cardLoading = false
        if (vm.cardItems.length === 0) {
          alert('Failed to load items.')
          vm.filterSelected = ''
        }
      })
    },
    exitCardMode: function() {
      this.filterSelected = this.previousFilter
    },
    cardSwipeLeft: function() {
      var item = this.currentCard
      if (!item) return
      this.flushCardAction()
      var index = this.cardIndex
      if (this.instapaperUsername) {
        this.applyCardRead(item)
        item.instapaper_saved = true
        this.cardStats.instapaper += 1
        this.scheduleCardUndo(item, 'instapaper', index)
      } else {
        this.cardStats.kept += 1
        this.scheduleCardUndo(item, 'kept', index)
      }
      this.cardIndex += 1
    },
    cardSwipeRight: function() {
      var item = this.currentCard
      if (!item) return
      this.flushCardAction()
      var index = this.cardIndex
      this.applyCardRead(item)
      this.cardStats.read += 1
      this.scheduleCardUndo(item, 'read', index)
      this.cardIndex += 1
    },
    // Optimistically mark a card read locally; the server write is deferred
    // until the undo window closes (see flushCardAction).
    applyCardRead: function(item) {
      item.status = 'read'
      if (this.feedStats[item.feed_id] && this.feedStats[item.feed_id].unread > 0) {
        this.feedStats[item.feed_id].unread -= 1
      }
    },
    revertCardRead: function(item) {
      item.status = 'unread'
      if (this.feedStats[item.feed_id]) {
        this.feedStats[item.feed_id].unread += 1
      }
    },
    scheduleCardUndo: function(item, action, index) {
      var timer = setTimeout(function() {
        vm.flushCardAction()
      }, 4000)
      this.cardUndo = { item: item, action: action, index: index, timer: timer }
    },
    // Reverse the most recent swipe before its server write fires. Because the
    // write is deferred, nothing has to be undone on the server.
    undoCardAction: function() {
      var pending = this.cardUndo
      if (!pending) return
      clearTimeout(pending.timer)
      if (pending.action === 'instapaper' || pending.action === 'read') {
        this.revertCardRead(pending.item)
      }
      if (pending.action === 'instapaper') {
        pending.item.instapaper_saved = false
        this.cardStats.instapaper -= 1
      } else if (pending.action === 'read') {
        this.cardStats.read -= 1
      } else {
        this.cardStats.kept -= 1
      }
      this.cardIndex = pending.index
      this.cardUndo = null
    },
    // Commit the pending swipe: fire the deferred server write and clear undo.
    flushCardAction: function() {
      var pending = this.cardUndo
      if (!pending) return
      clearTimeout(pending.timer)
      this.cardUndo = null
      var item = pending.item
      if (pending.action === 'read') {
        api.items.update(item.id, { status: 'read' })
      } else if (pending.action === 'instapaper') {
        // Capture the stats object so a late failure adjusts the session that
        // owned this swipe, never a fresh one started by enter/changeCardFolder.
        var stats = this.cardStats
        api.items.saveToInstapaper(item.id).then(function(resp) {
          if (!resp.ok) vm.reconcileFailedInstapaper(item, stats)
        }).catch(function() {
          vm.reconcileFailedInstapaper(item, stats)
        })
      }
    },
    // The Instapaper save we counted optimistically failed; correct the count
    // and restore the item to unread.
    reconcileFailedInstapaper: function(item, stats) {
      item.instapaper_saved = false
      this.revertCardRead(item)
      if (stats && stats.instapaper > 0) stats.instapaper -= 1
    },
    cardTap: function() {
      if (this.currentCard && this.currentCard.link) {
        window.open(this.currentCard.link, '_blank', 'noopener,noreferrer')
      }
    },
    showSettings: function(settings) {
      this.settings = settings

      if (settings === 'create') {
        vm.feedNewChoice = []
        vm.feedNewChoiceSelected = ''
      }
    },
    resizeFeedList: function(width) {
      this.feedListWidth = Math.min(Math.max(200, width), 700)
    },
    resizeItemList: function(width) {
      this.itemListWidth = Math.min(Math.max(200, width), 700)
    },
    resetFeedChoice: function() {
      this.feedNewChoice = []
      this.feedNewChoiceSelected = ''
    },
    incrFont: function(x) {
      this.theme.size = +(this.theme.size + (0.1 * x)).toFixed(1)
    },
    fetchAllFeeds: function() {
      if (this.loading.feeds) return
      api.feeds.refresh().then(function() {
        vm.refreshStats()
      })
    },
    computeStats: function() {
      var filter = this.filterSelected
      var statKey = filter || 'unread'

      var statsFeeds = {}, statsFolders = {}, statsTotal = 0

      for (var i = 0; i < this.feeds.length; i++) {
        var feed = this.feeds[i]
        if (!this.feedStats[feed.id]) continue

        var n = vm.feedStats[feed.id][statKey] || 0

        if (!statsFolders[feed.folder_id]) statsFolders[feed.folder_id] = 0

        statsFeeds[feed.id] = n
        statsFolders[feed.folder_id] += n
        statsTotal += n
      }

      this.filteredFeedStats = statsFeeds
      this.filteredFolderStats = statsFolders
      this.filteredTotalStats = statsTotal || null
    },
    // navigation helper, navigate relative to selected item
    navigateToItem: function(relativePosition) {
      let vm = this
      if (vm.itemSelected == null) {
        // if no item is selected, select first
        if (vm.items.length !== 0) vm.itemSelected = vm.items[0].id
        return
      }

      var itemPosition = vm.items.findIndex(function(x) { return x.id === vm.itemSelected })
      if (itemPosition === -1) {
        if (vm.items.length !== 0) vm.itemSelected = vm.items[0].id
        return
      }

      var newPosition = itemPosition + relativePosition
      if (newPosition < 0 || newPosition >= vm.items.length) return

      vm.itemSelected = vm.items[newPosition].id

      vm.$nextTick(function() {
        var scroll = document.querySelector('#item-list-scroll')

        var handle = scroll.querySelector('input[type=radio]:checked')
        var target = handle && handle.parentElement

        if (target && scroll) scrollto(target, scroll)

        vm.loadMoreItems()
      })
    },
    // navigation helper, navigate relative to selected feed
    navigateToFeed: function(relativePosition) {
      let vm = this
      const navigationList = this.foldersWithFeeds
        .filter(folder => !folder.id || !vm.mustHideFolder(folder))
        .map((folder) => {
          if (this.mustHideFolder(folder)) return []
          const folds = folder.id ? [`folder:${folder.id}`] : []
          const feeds = (folder.is_expanded || !folder.id)
            ? (folder.feeds || []).filter(f => !vm.mustHideFeed(f)).map(f => `feed:${f.id}`)
            : []
          return folds.concat(feeds)
        })
        .flat()
      navigationList.unshift('')

      var currentFeedPosition = navigationList.indexOf(vm.feedSelected)

      if (currentFeedPosition == -1) {
        vm.feedSelected = ''
        return
      }

      var newPosition = currentFeedPosition+relativePosition
      if (newPosition < 0 || newPosition >= navigationList.length) return

      vm.feedSelected = navigationList[newPosition]

      vm.$nextTick(function() {
        var scroll = document.querySelector('#feed-list-scroll')

        var handle = scroll.querySelector('input[type=radio]:checked')
        var target = handle && handle.parentElement

        if (target && scroll) scrollto(target, scroll)
      })
    },
    changeRefreshRate: function(offset) {
      const curIdx = this.refreshRateOptions.findIndex(o => o.value === this.refreshRate)
      if (curIdx <= 0 && offset < 0) return
      if (curIdx >= (this.refreshRateOptions.length - 1) && offset > 0) return
      this.refreshRate = this.refreshRateOptions[curIdx + offset].value
    },
    mustHideFolder: function (folder) {
      return this.filterSelected
        && !(this.current.folder.id == folder.id || this.current.feed.folder_id == folder.id)
        && !this.filteredFolderStats[folder.id]
        && (!this.itemSelectedDetails || (this.feedsById[this.itemSelectedDetails.feed_id] || {}).folder_id != folder.id)
    },
    mustHideFeed: function (feed) {
      return this.filterSelected
        && !(this.current.feed.id == feed.id)
        && !this.filteredFeedStats[feed.id]
        && (!this.itemSelectedDetails || this.itemSelectedDetails.feed_id != feed.id)
    },
  }
} }

// directives + components are registered above; mount now that they exist.
var vm = vueApp.mount('#app')

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(function(err) {
    console.warn('SW registration failed:', err);
  });
}

// Offline indicator
(function() {
  var banner = document.createElement('div')
  banner.className = 'offline-banner'
  banner.textContent = 'You\u2019re offline'
  document.body.appendChild(banner)

  function update() {
    banner.classList.toggle('visible', !navigator.onLine)
  }
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
  update()
})();

// Pull-to-refresh on feed list (mobile/tablet)
(function() {
  var scroll = document.getElementById('feed-list-scroll')
  if (!scroll) return

  var indicator = document.createElement('div')
  indicator.className = 'pull-to-refresh'
  var spinner = document.createElement('div')
  spinner.className = 'pull-to-refresh-spinner'
  indicator.appendChild(spinner)
  scroll.parentNode.insertBefore(indicator, scroll)

  var startY = 0
  var pulling = false
  var threshold = 60

  scroll.addEventListener('touchstart', function(e) {
    if (scroll.scrollTop === 0 && e.touches.length === 1) {
      startY = e.touches[0].clientY
      pulling = true
    }
  }, {passive: true})

  scroll.addEventListener('touchmove', function(e) {
    if (!pulling) return
    var dy = e.touches[0].clientY - startY
    if (dy < 0) { pulling = false; return }
    var progress = Math.min(dy / threshold, 1)
    indicator.style.height = (progress * 40) + 'px'
    indicator.style.opacity = progress
    if (progress >= 1) {
      indicator.classList.add('ready')
    } else {
      indicator.classList.remove('ready')
    }
  }, {passive: true})

  scroll.addEventListener('touchend', function() {
    if (!pulling) return
    pulling = false
    var wasReady = indicator.classList.contains('ready')
    indicator.classList.remove('ready')
    indicator.style.height = '0'
    indicator.style.opacity = '0'
    if (wasReady && !vm.loading.feeds) {
      api.feeds.refresh().then(function() {
        vm.refreshStats()
      })
    }
  })
})();
