# Shape: Command Palette

> Design brief (`/impeccable shape`) for #74. Planning only — no code until approved.
> Anchored to PRODUCT.md ("keyboard is a first-class path"), and the critique's
> Recognition-vs-recall gap (shortcuts are memorized, not discoverable).

## 1. Feature summary
One keystroke opens a fuzzy palette to **jump** to any feed/folder, **run** any
action (star, save, mark-all-read, refresh, open, theme, triage…), or **search**
articles — without touching the mouse or memorizing the full shortcut map.

## 2. Primary user action
Type a few characters, arrow to the match, press Enter. The single most important
outcome: reaching any feed or command in under two seconds, keyboard-only.

## 3. Design direction
- **Color strategy:** Restrained — the palette is chrome; it uses `--surface-raised`,
  `--text-*`, and the accent only for the selected row.
- **Scene sentence:** *A power user at a keyboard mid-triage, hands never leaving
  home row, flicking between feeds and actions.* → follows the active theme.
- **Anchor references:** Raycast, macOS Spotlight, VS Code command palette,
  Linear's ⌘K. Quiet and instant, not flashy.

## 4. Scope
Production-ready. Breadth: one overlay component reused across the app.
Interactivity: shipped component with full keyboard model.

## 5. Layout strategy
- Centered overlay near the top third (Spotlight position), modal-backdrop dim
  reusing the existing `.modal` treatment so stacking/z-index is consistent.
- Single text input at top; a scrollable results list below, grouped by kind
  (**Feeds**, **Folders**, **Actions**), each group with a quiet label.
- Selected row uses the accent-fill selection vocabulary already established.
- Compact rows; icon + label + (for actions) the shortcut key hint on the right,
  reinforcing the existing shortcuts rather than hiding them.

## 6. Key states
- **Empty query:** show recent/likely items — the current filter's feeds + top
  actions — so it's useful before typing.
- **Typing:** live fuzzy filter across feeds/folders/action names.
- **No matches:** calm "No matches" row, never a dead end.
- **Selected:** one row highlighted; wraps at ends.
- **Executed:** palette closes; the action's own feedback (toast/indicator) fires.
- **Reduced motion / data-motion=reduce:** open/close is instant.

## 7. Interaction model
- **Trigger:** `⌘K` / `Ctrl+K`, plus a bare `k`? No — `k` is prev-item. Use
  `⌘K`/`Ctrl+K` and also a mouse affordance is unnecessary (keyboard-first).
  Secondary trigger `g` then… no; keep it single: **⌘K / Ctrl+K**.
- **Within:** ↑/↓ move, Enter executes, Esc closes (matches the new modal Esc),
  Tab optional. Typing filters instantly (debounced only for the article-search
  branch that hits the API).
- **Feeds/folders/actions** filter locally (already in memory). **Article search**
  reuses the existing `/api/items?search=` path; entering "search: <q>" or a query
  with no local match offers "Search articles for '<q>'".
- Focus returns to the prior element on close (reuse the modal focus-restore added
  in the harden pass).

## 8. Content requirements
- Action registry: reuse the existing keybinding action set (key.js) as the source
  of truth so the palette and shortcuts never drift. Each entry: label, optional
  icon, optional shortcut hint, run(), and an `enabled` predicate (e.g. star needs a
  selected item).
- Copy: placeholder "Jump to a feed or run a command…"; group labels; "No matches".
- Ranges: 0 feeds (palette still lists actions), typical 5–50 feeds, heavy 500+
  (fuzzy match must stay instant — cap rendered rows, e.g. top 50).

## 9. Technical notes & constraints
- Vue 3 component; reuse the `modal`/overlay + focus-management primitives.
- Fuzzy match: tiny hand-rolled scorer (subsequence + rank), **no new dependency**
  (dependency surface stays tiny).
- Register actions from a shared list consumed by both key.js and the palette to
  prevent divergence (fixes a latent maintenance risk).

## 10. Recommended references
`layout.md` (overlay/results rhythm), `interaction`/`harden.md` (keyboard model,
focus trap/restore), `clarify.md` (labels/microcopy).

## Open questions (defaults asserted)
- **Trigger key:** ⌘K / Ctrl+K only. *Asserted; `/` stays search-focus, `?` stays help.*
- **Mouse entry point:** none in v1 (keyboard-first). *Asserted; can add a search-box
  hint later.*
- **Article-search in-palette vs deferring to the existing search box:** offer it as
  a result row, don't duplicate the search UI. *Asserted.*
