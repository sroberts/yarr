# Review flows

Flows the web-app-review pipeline walks in the browser (Stage 3). Each step
lists the expected outcome. Generated 2026-11-02 from `src/server/routes.go`,
`src/assets/index.html`, `src/assets/javascripts/key.js` and PRODUCT.md (core
loop: read / star / save / next, on desk and phone). Edit freely.

Setup: a fresh DB with at least two feeds that have items
(`POST /api/feeds {"url": ...}`), desktop viewport 1400x900 unless noted.

## 1. App shell
1. Open `/`. → Three columns render: Feeds, Articles, Article (empty reader hint "j / k to move").
2. Console. → No errors.

## 2. Feed and article selection (mouse)
1. Click a feed. → Article list shows only that feed's items.
2. Click an article. → Reader opens it; it is marked read; feed counter drops.
3. Click the close (×) button. → Reader returns to the empty hint.

## 3. Keyboard reading loop
1. Press `j`. → First article opens.
2. Press `j` / `k`. → Next / previous article opens; list keeps it in view.
3. Press `s`. → Article starred (toolbar star toggles on).
4. Press `r`. → Read state toggles.
5. Press `f` / `b`. → Article content scrolls a page forward / back.
6. Press `q`. → Article closes.

## 4. Column navigation (h / l)
1. On load press `j`. → Moves articles exactly as in flow 3; no column marker shown.
2. Press `l` with no article open. → First article opens; marker appears on the reader column.
3. Press `j` / `k`. → Reader content scrolls a short step; article does not change.
4. Press `h`. → Marker moves to the article list; `j` / `k` change article again.
5. Press `h`. → Marker on the feed list; `j` / `k` change feed.
6. Press `h` at the leftmost / `l` at the rightmost column. → No change, no error.
7. Press `q` while in the reader column. → Article closes; marker falls back to the article list.
8. With the marker shown, click inside the reader. → Marker moves to the reader.
9. The marker is visible in light, sepia and night themes.

## 5. Filters and views
1. Press `1`, `2`, `3`. → Unread / starred / all views; list reloads.
2. Press `4`. → Triage card mode; ← / → swipe; Esc exits.

## 6. Search and palette
1. Press `/`, type a query containing j, k, h, l. → Characters land in the search box; no shortcuts fire; result count updates.
2. Press Cmd/Ctrl+K. → Palette opens; Esc closes it.

## 7. Settings and help
1. Press `?`. → Shortcuts sheet lists `h l` as column moves and `j k` as next/prev in the current column.
2. Open ⋯ → Settings; switch theme and accent. → Body theme class and accent apply.

## 8. Add feed
1. Open New Feed, submit a feed URL. → Feed appears in the list.

## 9. Phone layout (390x844)
1. Open `/`. → Single column: feed list.
2. Tap a feed, then an article. → Item list, then the reader, one column at a time.
3. Back buttons return to the previous column.
