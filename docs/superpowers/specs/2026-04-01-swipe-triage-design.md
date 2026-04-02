# Swipe Triage Card View — Design Spec

## Summary

A dedicated full-screen card view for mobile/tablet (PWA) that lets users triage unread items by swiping. Swipe left to save to Instapaper, swipe right to mark as read. Tinder-style card physics with rotation, color tinting, and action confirmation.

## Decisions

- **Interaction style:** Tinder-style full card slide with rotation and background color tint
- **Card content:** Title + preview only (feed name, title, date, ~200 char excerpt). Tap to open full article.
- **Entry point:** Dedicated button in feed list toolbar, visible only on mobile/tablet (max-width: 991.98px)
- **Item set:** Always all unread items across all feeds, regardless of current selection
- **Completion:** Stats screen showing read count + Instapaper count + "Back to feeds" button
- **Platform:** Touch/mobile only. Hidden on desktop.
- **Backend:** No changes. Uses existing API endpoints.

## Architecture

### Approach

New Vue state in `app.js`, new HTML section in `index.html`, new `swipe.js` file for touch handling, new CSS in `app.css`. No backend changes.

### New Files

- `src/assets/javascripts/swipe.js` — Touch handler IIFE for card swipe gestures. Attaches to the card element, tracks touch state, applies CSS transforms during drag, triggers actions on threshold release. Follows the pattern of `key.js` (self-contained IIFE that references `vm`).

### Modified Files

- `src/assets/index.html` — Card mode HTML block (v-if="cardMode"), entry button in feed toolbar, script tag for swipe.js
- `src/assets/javascripts/app.js` — New Vue data properties and methods for card mode
- `src/assets/stylesheets/app.css` — Card mode styling, responsive visibility rules

## Vue State

New data properties:
- `cardMode` (boolean, default false) — whether card view is active
- `cardItems` (array, default []) — unread items loaded for triage
- `cardIndex` (number, default 0) — index of the currently displayed card
- `cardStats` (object, default {read: 0, instapaper: 0}) — counts for stats screen

New methods:
- `enterCardMode()` — sets `cardMode = true`, calls `api.items.list({status: 'unread'})` to load all unreads into `cardItems`, sets `cardIndex = 0`, resets `cardStats`
- `exitCardMode()` — sets `cardMode = false`, clears `cardItems`, refreshes feed stats via `refreshStats()`
- `cardSwipeLeft()` — calls `saveToInstapaper(currentCard)`, increments `cardStats.instapaper`, advances card
- `cardSwipeRight()` — marks item as read via API (same pattern as `toggleItemRead`), increments `cardStats.read`, advances card
- `cardAdvance()` — increments `cardIndex`. If past end of `cardItems`, shows stats screen
- `cardTap()` — opens `currentCard.link` in a new tab

New computed:
- `currentCard` — returns `cardItems[cardIndex]` or null
- `cardDone` — returns `cardIndex >= cardItems.length`

## Card Layout

### Structure

Full-screen overlay that replaces the three-column layout when `cardMode` is active.

Top bar:
- Exit button (✕ Exit) — calls `exitCardMode()`
- Counter ("3 of 24 unread")

Card area (centered):
- Card element with rounded corners, shadow
- Feed icon + feed name + relative date
- Article title (large, bold)
- Text excerpt (~200 chars, stripped HTML)
- "tap to read full article" hint at bottom

Bottom hint bar:
- "← save to instapaper" (left)
- "mark read →" (right)

### Stats Screen

Shown when `cardDone` is true:
- Emoji (🎉)
- "All caught up!" heading
- Two stat counters: marked read (blue) + saved to Instapaper (orange)
- "Back to feeds" button — calls `exitCardMode()`

## Touch Handling (swipe.js)

### Gesture Detection

1. `touchstart` (passive: true) — record `startX`, `startY`, set `swiping = false`
2. `touchmove` — first 10px determines direction:
   - If more vertical than horizontal → ignore gesture entirely (user is scrolling)
   - If horizontal → set `swiping = true`, use `{passive: false}` to call `preventDefault()` (prevents iOS scroll/navigation)
3. `touchend` — if `swiping`, check final offset against threshold

### Visual Feedback During Drag

- Card `transform: translateX(offsetX) rotate(offsetX * 0.05deg)` — follows finger with slight rotation
- Background tint: orange gradient fading in for negative X (left), blue for positive X (right). Opacity proportional to `|offsetX| / threshold`
- Action pill appears at bottom of screen once `|offsetX| > threshold`:
  - Left: orange pill "Save to Instapaper"
  - Right: blue pill "Mark Read"

### Threshold & Animation

- Trigger threshold: 80px horizontal displacement
- Below threshold on release: card springs back to center via CSS transition (`transform 0.3s ease`)
- Above threshold on release:
  1. Card animates off-screen in swipe direction (`translateX(±120%)`, `rotate(±15deg)`, transition 0.3s)
  2. Action fires (API call)
  3. After animation completes, next card is set (no translateX), brief fade-in

### Performance

- All visual feedback via CSS transforms (GPU-accelerated)
- `touchstart` is `{passive: true}`
- `touchmove` starts passive; switches to non-passive only after horizontal lock-in is detected (to call `preventDefault`)
- No DOM manipulation during drag — only style property changes

### iOS PWA Specifics

- In standalone PWA mode (`display: standalone` in manifest), iOS disables the swipe-to-go-back edge gesture. No conflict with our swipe gestures.
- `-webkit-overflow-scrolling: touch` is already set on scroll containers
- Safe area insets already handled in existing CSS
- `viewport-fit=cover` already set in meta tag

## Entry Point

### Button Placement

New button in the feed list toolbar (top bar of `#col-feed-list`), after the All filter button and before the flex spacer.

- Icon: a card/stack icon (new SVG or reuse existing `layers.svg`)
- Only visible at `max-width: 991.98px` (tablet and mobile breakpoints)
- Disabled when total unread count is 0
- On tap: calls `enterCardMode()`

## Responsive Visibility

Card mode HTML block:
- Hidden by default (`v-if="cardMode"`)
- When active, all three columns are hidden, card view takes full screen
- Only the entry button is gated by media query — the card view itself is full-screen at any size but can only be entered on mobile/tablet

## Item Loading

- On entering card mode: fetch all unread items by paginating through `api.items.list({status: 'unread'})` using the existing `after` parameter. The API returns 20 items per page with `has_more`. Loop until `has_more` is false, accumulating into `cardItems`.
- Show a brief loading state while fetching ("Loading unread items...")
- Items are loaded once upfront into `cardItems` — no pagination during triage
- Each swipe action makes its own API call to persist the state change
- If items fail to load, show an error and stay in normal mode
