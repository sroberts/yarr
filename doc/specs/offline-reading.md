# Shape: Offline Reading

> Design brief (`/impeccable shape`) for #73. Planning only — no code until approved.
> Anchored to PRODUCT.md (quiet/fast/utilitarian, local-first, phone-triage persona).

## 1. Feature summary
Cache the full content of the articles a user deliberately kept — **starred** and
**Instapaper-saved** items — so their reading list works with no network. For the
phone persona reading on transit, "saved" should mean "available," signal or not.

## 2. Primary user action
Open a saved/starred article while offline and read it in full, exactly as online.
Everything else (offline awareness, cache management) is secondary and quiet.

## 3. Design direction
- **Color strategy:** Restrained — reuse the existing token system; no new chrome.
- **Scene sentence:** *A commuter on a phone in a tunnel with no signal, opening the
  three articles they starred this morning to read now.* → dark/light both, driven
  by the existing theme; nothing offline-specific visually.
- **Anchor references:** Instapaper's offline queue, Safari Reading List (offline),
  Pocket's downloaded-articles model.
- Confirmed scope: **starred + Instapaper-saved only** (bounded storage, clear model).

## 4. Scope
Production-ready. Breadth: the reading pane + saved lists + the existing service
worker/PWA. Interactivity: shipped component. No new UI surface — an affordance,
not a screen.

## 5. Layout strategy
No new layout. Additions are minimal, in-place:
- A tiny "offline-ready" affordance on saved/starred items (a small dot or the
  existing check vocabulary) — visible only where it earns its place, never noisy.
- The existing offline banner already communicates connectivity; reuse it.
- Reading pane is unchanged; it just resolves content from cache when the network
  is unavailable.

## 6. Key states
- **Online, saved item:** content loads from network; cached in the background.
- **Offline, cached item:** content served from cache, indistinguishable from online.
- **Offline, uncached item:** clear, calm message — "Not saved for offline. Star or
  save it while online to read it here." (Not a raw fetch error.)
- **Cache building:** silent; no spinner or progress bar (background work).
- **Storage pressure / eviction:** oldest-unsaved first; saved items are sticky.
- **Item un-starred / un-saved:** its offline copy is eligible for eviction.

## 7. Interaction model
- On star / save-to-Instapaper (already existing actions), the item's content +
  its "Read Here" readability HTML are fetched and stored for offline use.
- On app load, opportunistically refresh cached copies of still-saved items.
- Reading falls back to cache automatically when `navigator.onLine` is false or a
  fetch fails — no user action, no mode toggle.
- Respect the existing reduced-motion / quiet conventions: no celebratory
  "downloaded!" moments.

## 8. Content requirements
- Store per item: sanitized content HTML, readability HTML (if fetched), title,
  feed title, date, link, media URLs metadata. Media bytes: **out of scope for v1**
  (text-first; images load when online, alt text offline).
- Copy: offline-uncached message (above); an optional Settings line noting "Saved &
  starred articles are kept for offline reading."
- Realistic ranges: 0 saved (empty), typical 20–200, heavy user 1000+ → cap/evict.

## 9. Technical notes & constraints (local-first, single binary)
- **Storage:** IndexedDB in the browser (not the SW cache API — content is data,
  not static assets). Keyed by item id. No server changes required for reads.
- **Service worker:** now fixed (#72/#78); it handles the shell. Article content is
  a separate IndexedDB store the app reads/writes.
- No new Go dependencies; no telemetry; nothing leaves the device.
- Eviction budget (e.g., keep ≤ N MB or ≤ N items; saved/starred are sticky).

## 10. Recommended references
`harden.md` (offline/edge/storage-pressure states), `onboard.md` (the uncached
empty message), `animate.md` only for the quiet affordance (likely none).

## Open questions (defaults asserted)
- **Media caching:** deferred to v2 (text-first v1). *Default: ship text-only.*
- **Eviction cap:** start at ~50 MB or 500 items, saved sticky. *Default: 50 MB.*
- **Affordance style:** a small muted dot on saved rows. *Default: dot; revisit in
  build if it reads as noise.*
