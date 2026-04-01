# Swipe Triage Card View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen card triage view for mobile/tablet PWA where users swipe left to save to Instapaper and swipe right to mark as read.

**Architecture:** Pure frontend feature. New Vue state properties and methods in `app.js`, new card mode HTML block in `index.html`, new `swipe.js` file for touch gesture handling, new CSS in `app.css`. No backend changes. Items loaded via existing paginated API.

**Tech Stack:** Vue 2, vanilla JS touch events, CSS transforms, existing yarr API endpoints.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/assets/javascripts/app.js` | Card mode Vue state, methods, computed properties |
| Modify | `src/assets/index.html` | Card mode HTML block, triage button in toolbar, swipe.js script tag |
| Create | `src/assets/javascripts/swipe.js` | Touch event handling IIFE for card swipe gestures |
| Modify | `src/assets/stylesheets/app.css` | Card mode styling, responsive visibility, swipe animations |

---

### Task 1: Vue State and Methods for Card Mode

**Files:**
- Modify: `src/assets/javascripts/app.js:216-275` (data), `277-334` (computed), `425-744` (methods)

- [ ] **Step 1: Add card mode data properties**

In `src/assets/javascripts/app.js`, add these properties to the `data` function return object, after `'instapaperPassword'` (around line 264):

```javascript
      'cardMode': false,
      'cardItems': [],
      'cardIndex': 0,
      'cardStats': { read: 0, instapaper: 0 },
      'cardLoading': false,
```

- [ ] **Step 2: Add computed properties**

In `src/assets/javascripts/app.js`, add these computed properties inside the `computed` object, after `refreshRateTitle` (around line 334):

```javascript
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
      return text.length > 200 ? text.substring(0, 200) + '…' : text
    },
```

- [ ] **Step 3: Add card mode methods**

In `src/assets/javascripts/app.js`, add these methods inside the `methods` object, after `updateInstapaperCredentials` (around line 742):

```javascript
    enterCardMode: function() {
      this.cardMode = true
      this.cardItems = []
      this.cardIndex = 0
      this.cardStats = { read: 0, instapaper: 0 }
      this.cardLoading = true
      this.loadCardItems(null)
    },
    loadCardItems: function(afterId) {
      var query = { status: 'unread' }
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
          vm.cardMode = false
        }
      })
    },
    exitCardMode: function() {
      this.cardMode = false
      this.cardItems = []
      this.cardIndex = 0
      this.refreshStats()
    },
    cardSwipeLeft: function() {
      var item = this.currentCard
      if (!item) return
      this.cardStats.instapaper += 1
      api.items.saveToInstapaper(item.id).then(function(resp) {
        if (resp.ok) {
          item.instapaper_saved = true
          item.status = 'read'
          if (vm.feedStats[item.feed_id] && vm.feedStats[item.feed_id].unread > 0) {
            vm.feedStats[item.feed_id].unread -= 1
          }
        }
      })
      this.cardIndex += 1
    },
    cardSwipeRight: function() {
      var item = this.currentCard
      if (!item) return
      this.cardStats.read += 1
      api.items.update(item.id, { status: 'read' }).then(function() {
        if (vm.feedStats[item.feed_id] && vm.feedStats[item.feed_id].unread > 0) {
          vm.feedStats[item.feed_id].unread -= 1
        }
      })
      item.status = 'read'
      this.cardIndex += 1
    },
    cardTap: function() {
      if (this.currentCard && this.currentCard.link) {
        window.open(this.currentCard.link, '_blank', 'noopener,noreferrer')
      }
    },
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/sroberts/Developer/yarr && go build ./...`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/assets/javascripts/app.js
git commit -m "feat: add Vue state and methods for card triage mode"
```

---

### Task 2: Card Mode HTML

**Files:**
- Modify: `src/assets/index.html:25` (add card-mode class), `46-52` (add triage button), `410` (add card view block), `462` (add swipe.js script tag)

- [ ] **Step 1: Add card-mode class to #app**

In `src/assets/index.html`, update the `#app` div (line 25) to include a `card-mode` class:

```html
    <div id="app" class="d-flex" :class="{'feed-selected': feedSelected !== null, 'item-selected': itemSelected !== null, 'card-mode': cardMode}" v-cloak>
```

- [ ] **Step 2: Add triage button to feed list toolbar**

In `src/assets/index.html`, after the "All" filter button (the button ending around line 52 `</button>`) and before the `<div class="flex-grow-1"></div>` on line 53, add:

```html
                <button class="toolbar-item ml-1 d-none d-card-triage"
                        title="Triage"
                        :disabled="!filteredTotalStats && filterSelected !== 'unread'"
                        @click="enterCardMode()">
                    <span class="icon">{% inline "layers.svg" %}</span>
                </button>
```

- [ ] **Step 3: Add card view HTML block**

In `src/assets/index.html`, after the closing `</div>` of `#col-item` (line 410) and before the `<modal>` tag (line 411), add:

```html
        <!-- card triage mode -->
        <div id="card-view" class="vh-100 d-flex flex-column w-100" v-if="cardMode">
            <div class="card-view-toolbar px-3 d-flex align-items-center justify-content-between">
                <button class="btn btn-sm btn-outline-secondary" @click="exitCardMode()">✕ Exit</button>
                <span class="text-muted small" v-if="!cardDone && !cardLoading">
                    {{ cardIndex + 1 }} of {{ cardItems.length }} unread
                </span>
                <span class="text-muted small" v-if="cardLoading">loading...</span>
                <span class="text-muted small" v-if="cardDone">done</span>
            </div>
            <!-- loading state -->
            <div v-if="cardLoading && cardItems.length === 0" class="flex-grow-1 d-flex align-items-center justify-content-center">
                <span class="text-muted">Loading unread items...</span>
            </div>
            <!-- card -->
            <div v-if="currentCard && !cardDone" class="card-view-area flex-grow-1 d-flex align-items-center justify-content-center" id="card-swipe-area">
                <div class="triage-card" id="triage-card" @click="cardTap()">
                    <div class="triage-card-feed">
                        <span>{{ (feedsById[currentCard.feed_id] || {}).title }}</span>
                        <span class="triage-card-date"><relative-time :val="currentCard.date"/></span>
                    </div>
                    <div class="triage-card-title">{{ currentCard.title || 'untitled' }}</div>
                    <div class="triage-card-excerpt">{{ cardExcerpt }}</div>
                    <div class="triage-card-hint">tap to read full article</div>
                </div>
            </div>
            <!-- action indicator -->
            <div class="card-view-action" id="card-action-indicator"></div>
            <!-- swipe hints -->
            <div v-if="currentCard && !cardDone" class="card-view-hints px-4 pb-3 d-flex justify-content-between text-muted small">
                <span>← instapaper</span>
                <span>mark read →</span>
            </div>
            <!-- stats screen -->
            <div v-if="cardDone" class="flex-grow-1 d-flex flex-column align-items-center justify-content-center">
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎉</div>
                <h4 class="mb-4"><b>All caught up!</b></h4>
                <div class="d-flex mb-4" style="gap: 2rem;">
                    <div class="text-center">
                        <div class="card-stat-number card-stat-read">{{ cardStats.read }}</div>
                        <div class="text-muted small">marked read</div>
                    </div>
                    <div class="text-center">
                        <div class="card-stat-number card-stat-instapaper">{{ cardStats.instapaper }}</div>
                        <div class="text-muted small">instapaper</div>
                    </div>
                </div>
                <button class="btn btn-primary" @click="exitCardMode()">Back to feeds</button>
            </div>
            <!-- no unreads -->
            <div v-if="!cardLoading && cardItems.length === 0" class="flex-grow-1 d-flex flex-column align-items-center justify-content-center">
                <div class="text-muted mb-3">No unread items</div>
                <button class="btn btn-outline-secondary" @click="exitCardMode()">Back to feeds</button>
            </div>
        </div>
```

- [ ] **Step 4: Add swipe.js script tag**

In `src/assets/index.html`, after the `app.js` script tag and before the `key.js` script tag (around line 462), add:

```html
    <script src="./static/javascripts/swipe.js"></script>
```

- [ ] **Step 5: Verify compilation**

Run: `cd /Users/sroberts/Developer/yarr && go build ./...`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/assets/index.html
git commit -m "feat: add card triage view HTML and triage button"
```

---

### Task 3: Card Mode CSS

**Files:**
- Modify: `src/assets/stylesheets/app.css` (append at end)

- [ ] **Step 1: Add card mode CSS**

Append the following to the end of `src/assets/stylesheets/app.css`:

```css
/* ── Card triage mode ────────────────────────── */

#app.card-mode #col-feed-list,
#app.card-mode #col-item-list,
#app.card-mode #col-item {
  display: none !important;
}

#card-view {
  background: var(--card-bg, #fff);
}

.theme-night #card-view {
  --card-bg: #0e0e0e;
  --card-surface: #1a1a2e;
  --card-text: #e0e0e0;
  --card-muted: #888;
}
.theme-sepia #card-view {
  --card-bg: #f4f0e5;
  --card-surface: #ede8d8;
  --card-text: #433422;
  --card-muted: #8a7a66;
}
.theme-light #card-view {
  --card-bg: #f5f5f5;
  --card-surface: #fff;
  --card-text: #222;
  --card-muted: #888;
}

.card-view-toolbar {
  min-height: 3rem;
  max-height: 3rem;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(128,128,128,0.15);
}

.card-view-area {
  padding: 1.25rem;
  position: relative;
  overflow: hidden;
}

.triage-card {
  width: 100%;
  max-width: 400px;
  background: var(--card-surface, #fff);
  color: var(--card-text, #222);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;
  will-change: transform;
  cursor: pointer;
}

.triage-card-feed {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--card-muted, #888);
  margin-bottom: 0.75rem;
}

.triage-card-date {
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.triage-card-title {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 0.75rem;
}

.triage-card-excerpt {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--card-muted, #888);
}

.triage-card-hint {
  margin-top: 1.25rem;
  text-align: center;
  font-size: 0.75rem;
  opacity: 0.35;
}

.card-view-action {
  text-align: center;
  min-height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-action-pill {
  display: inline-block;
  padding: 0.375rem 1rem;
  border-radius: 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #fff;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.card-action-pill.visible {
  opacity: 1;
}

.card-action-pill.action-instapaper {
  background: #ff6600;
}

.card-action-pill.action-read {
  background: #0080d4;
}

.card-view-hints {
  flex-shrink: 0;
  opacity: 0.4;
}

.card-stat-number {
  font-size: 2rem;
  font-weight: 700;
}

.card-stat-read {
  color: #0080d4;
}

.card-stat-instapaper {
  color: #ff6600;
}

.triage-card.swiping {
  transition: none;
}

.triage-card.snapping {
  transition: transform 0.3s ease;
}

.triage-card.flying {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

/* Triage button: only show on mobile/tablet */
.d-card-triage {
  display: none !important;
}

@media (max-width: 991.98px) {
  .d-card-triage {
    display: inline-flex !important;
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/sroberts/Developer/yarr && go build ./...`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/assets/stylesheets/app.css
git commit -m "feat: add card triage mode CSS with theme support"
```

---

### Task 4: Swipe Touch Handler

**Files:**
- Create: `src/assets/javascripts/swipe.js`

- [ ] **Step 1: Create swipe.js**

Create `src/assets/javascripts/swipe.js`:

```javascript
'use strict';

// Card swipe gesture handler for triage mode.
// Follows the same IIFE pattern as the pull-to-refresh handler in app.js.
(function() {
  var startX = 0
  var startY = 0
  var offsetX = 0
  var swiping = false
  var directionLocked = false
  var threshold = 80

  function getCard() {
    return document.getElementById('triage-card')
  }

  function getArea() {
    return document.getElementById('card-swipe-area')
  }

  function getIndicator() {
    return document.getElementById('card-action-indicator')
  }

  function showPill(indicator, type, label) {
    while (indicator.firstChild) indicator.removeChild(indicator.firstChild)
    var pill = document.createElement('span')
    pill.className = 'card-action-pill visible ' + type
    pill.textContent = label
    indicator.appendChild(pill)
  }

  function clearPill(indicator) {
    while (indicator.firstChild) indicator.removeChild(indicator.firstChild)
  }

  function updateVisuals(card, area, indicator, dx) {
    var rotation = dx * 0.05
    card.style.transform = 'translateX(' + dx + 'px) rotate(' + rotation + 'deg)'

    var progress = Math.min(Math.abs(dx) / threshold, 1)

    // Background tint
    if (dx < 0) {
      area.style.background = 'linear-gradient(90deg, rgba(255,102,0,' + (progress * 0.15) + ') 0%, transparent 60%)'
    } else if (dx > 0) {
      area.style.background = 'linear-gradient(90deg, transparent 40%, rgba(0,128,212,' + (progress * 0.15) + ') 100%)'
    } else {
      area.style.background = ''
    }

    // Action pill
    if (Math.abs(dx) > threshold) {
      if (dx < 0) {
        showPill(indicator, 'action-instapaper', 'Save to Instapaper')
      } else {
        showPill(indicator, 'action-read', 'Mark Read')
      }
    } else {
      clearPill(indicator)
    }
  }

  function resetVisuals(card, area, indicator) {
    card.classList.remove('swiping')
    card.classList.add('snapping')
    card.style.transform = ''
    area.style.background = ''
    clearPill(indicator)
    setTimeout(function() {
      card.classList.remove('snapping')
    }, 300)
  }

  function flyAway(card, area, indicator, direction) {
    card.classList.remove('swiping')
    card.classList.add('flying')
    var flyX = direction < 0 ? '-120%' : '120%'
    var flyRotate = direction < 0 ? -15 : 15
    card.style.transform = 'translateX(' + flyX + ') rotate(' + flyRotate + 'deg)'
    card.style.opacity = '0'
    area.style.background = ''
    clearPill(indicator)

    setTimeout(function() {
      card.classList.remove('flying')
      card.style.transform = ''
      card.style.opacity = ''
      if (direction < 0) {
        vm.cardSwipeLeft()
      } else {
        vm.cardSwipeRight()
      }
    }, 300)
  }

  document.addEventListener('touchstart', function(e) {
    var card = getCard()
    if (!card || !vm.cardMode || vm.cardDone) return
    if (!card.contains(e.target)) return

    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
    offsetX = 0
    swiping = false
    directionLocked = false
    card.classList.remove('snapping', 'flying')
  }, { passive: true })

  document.addEventListener('touchmove', function(e) {
    var card = getCard()
    if (!card || !vm.cardMode || vm.cardDone) return
    if (!startX && !startY) return

    var dx = e.touches[0].clientX - startX
    var dy = e.touches[0].clientY - startY

    if (!directionLocked) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
      directionLocked = true
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical movement — not a swipe, bail out
        startX = 0
        startY = 0
        return
      }
      swiping = true
      card.classList.add('swiping')
    }

    if (!swiping) return

    e.preventDefault()
    offsetX = dx
    updateVisuals(card, getArea(), getIndicator(), offsetX)
  }, { passive: false })

  document.addEventListener('touchend', function() {
    var card = getCard()
    if (!card || !swiping) {
      startX = 0
      startY = 0
      return
    }

    var area = getArea()
    var indicator = getIndicator()

    if (Math.abs(offsetX) > threshold) {
      flyAway(card, area, indicator, offsetX < 0 ? -1 : 1)
    } else {
      resetVisuals(card, area, indicator)
    }

    startX = 0
    startY = 0
    offsetX = 0
    swiping = false
    directionLocked = false
  })
})();
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/sroberts/Developer/yarr && go build ./...`
Expected: No errors (swipe.js is embedded via assets).

- [ ] **Step 3: Commit**

```bash
git add src/assets/javascripts/swipe.js
git commit -m "feat: add touch swipe handler for card triage mode"
```

---

### Task 5: Final Build and Test

**Files:**
- No new files

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/sroberts/Developer/yarr && go test ./... -v`
Expected: All tests pass.

- [ ] **Step 2: Build the binary**

Run: `cd /Users/sroberts/Developer/yarr && go build -o yarr ./cmd/yarr/`
Expected: Binary builds successfully.

- [ ] **Step 3: Verify the binary starts**

Run: `cd /Users/sroberts/Developer/yarr && ./yarr -version`
Expected: Prints version string.

- [ ] **Step 4: Clean up binary**

Run: `rm /Users/sroberts/Developer/yarr/yarr`

- [ ] **Step 5: Commit (only if fixes were needed)**

Only commit if fixes were applied in earlier steps.
