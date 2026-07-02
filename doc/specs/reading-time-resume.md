# Shape: Reading time + resume position

> Design brief (`/impeccable shape`) for #77. Planning only — no code until approved.
> Anchored to PRODUCT.md (triage is the core loop; the tool disappears).

## 1. Feature summary
Two small, high-frequency quality-of-life touches on the read/next loop:
1. **Reading time** — a "N min read" signal in the item list so users can judge
   effort before opening.
2. **Resume position** — reopening a long article returns to where you left off
   instead of the top.

## 2. Primary user action
Scan the item list and decide what to open based on length; and, when returning to
a half-read article, continue reading immediately without re-scrolling.

## 3. Design direction
- **Color strategy:** Restrained — reading time is `--text-tertiary` metadata,
  same weight as the timestamp; resume is invisible (behavioral, not visual).
- **Scene sentence:** *A triager scanning a dense list deciding what's worth the
  next five minutes.* → follows theme; no new color.
- **Anchor references:** Medium's "N min read", Pocket's time estimates, Safari
  Reader's restore-scroll behavior.

## 4. Scope
Production-ready. Breadth: item-list row + reading pane scroll handling.
Interactivity: shipped. The smallest feature in the slate; a great cycle-filler.

## 5. Layout strategy
- **Reading time** sits inline in the item-list meta row, next to the relative
  date (which already lives top-right of each row). Format: `· 4 min`. It must not
  crowd the title; truncate feed name first if space is tight.
- **Resume** has no layout — it restores `scrollTop` on the content container.
- Optional (v2, out of scope): a thin read-progress line at the top of the reading
  pane. Not in v1 — keep chrome quiet.

## 6. Key states
- **Reading time available:** show `N min`. Compute from content word count
  (~200 wpm), clamped to ≥1 min.
- **No/short content (link-only posts, e.g. HN):** show nothing rather than "0 min"
  — absence is cleaner than a meaningless value.
- **Resume, first open:** top of article (no stored position).
- **Resume, returning:** restore last scroll position for that item.
- **Item marked read / list refreshed:** stored positions for gone items are pruned.
- **Reduced motion:** restore is an instant jump (no smooth scroll).

## 7. Interaction model
- Reading time is computed once per item (on ingest or first render) and displayed
  passively.
- On scroll within an open article (debounced), store `{itemId: scrollTop}`.
- On opening an item, if a stored position exists, restore it after content renders
  (`$nextTick`), else start at top.
- Positions are per-item, cleared when the item leaves the list or is marked read.

## 8. Content requirements
- Reading-time copy: `N min` (append to the existing meta line). No "read" word to
  stay terse (PRODUCT.md voice), unless testing shows it's ambiguous.
- Word count source: the sanitized content text (strip HTML). Store the computed
  minutes so the list doesn't recompute per render.
- Ranges: 0-word link posts (hide), typical 300–2000 words (1–10 min), longreads
  5000+ (25 min+). Cap display at a sane max (e.g. "60 min+").

## 9. Technical notes & constraints
- **Reading time:** compute client-side from content, or (better) compute once in
  Go at ingest and store an int on the item so it's cheap and consistent. Prefer the
  **storage** approach — one migration adding `word_count` or `read_minutes` to the
  items table; the list already has content available to the worker at `CreateItems`.
- **Resume:** client-only. Store positions in `localStorage` (ephemeral, per-device)
  keyed by item id — not worth a server round-trip or schema change. Bounded map,
  pruned on read/refresh.
- No new deps; no telemetry.

## 10. Recommended references
`typeset.md` / `layout.md` (fitting the meta line without crowding), `harden.md`
(the 0-word and very-long edge cases, position pruning).

## Open questions (defaults asserted)
- **Compute location:** in Go at ingest, stored on the item (migration). *Asserted —
  cheaper and consistent; falls back to client compute for pre-existing items.*
- **Resume storage:** localStorage, per-device. *Asserted — sync across devices is
  not worth a schema change for a scroll offset.*
- **"min" vs "min read":** just `N min`. *Asserted per terse voice; revisit if unclear.*
