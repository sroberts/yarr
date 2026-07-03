# Shape: Smart Filters (simple rules)

> Design brief (`/impeccable shape`) for #75. Planning only — no code until approved.
> Anchored to PRODUCT.md ("get through the backlog fast, lose nothing worth keeping";
> local-first, no ML, no telemetry). Confirmed scope: **simple rules** for v1.

## 1. Feature summary
Local, deterministic rules that pre-triage incoming items on refresh: **auto-read**,
**auto-star**, or **mute (delete)** items matching a keyword and/or a specific feed.
Cuts the noise so the manual triage loop only sees decisions worth making.

## 2. Primary user action
Create a rule from intent ("mute anything from this feed with 'sponsored' in the
title"; "auto-star titles containing 'Swift'") and trust it to run silently.

## 3. Design direction
- **Color strategy:** Restrained — a plain list of rules in Settings; the accent only
  for the primary "Add rule" action. No rule "cards".
- **Scene sentence:** *A user tuning their feed after seeing the same junk twice,
  in Settings, deliberate and calm.* → follows theme.
- **Anchor references:** Gmail filters (the mental model), NetNewsWire's "smart
  feeds"/rules, email rules — but far simpler.

## 4. Scope
Production-ready, **v1 = simple rules only** (one condition + one action). No
multi-condition builder, no ordering/priority UI (see Anti-goals). Breadth: a
Settings section + server-side application on refresh. Interactivity: shipped.

## 5. Layout strategy
- Lives as a **"Filters"** section in the Settings modal (the dedicated surface from
  #64), consistent with other config. Not a new top-level screen.
- A simple list: each rule shown as one readable line —
  *"Mute · titles containing 'sponsored' · in Daring Fireball"* — with edit/delete.
- One "Add rule" affordance opens an inline row/compact form: **Action** (read /
  star / mute) · **Match** (keyword) · **Scope** (all feeds / a feed).
- Empty state: "No filters yet. Rules run on refresh to auto-read, star, or mute
  matching items."

## 6. Key states
- **No rules:** empty state (above).
- **Rule form:** action select, keyword input (with a hint about case-insensitive
  substring match), feed scope select (default: all feeds).
- **Saved rule:** appears in the list; applies on the next refresh (and offer "apply
  now to existing unread").
- **Rule matches nothing (yet):** fine; no error.
- **Mute = delete:** confirm the destructive nature once at creation ("Muted items
  are marked read and hidden / deleted") — no per-item surprise.
- **Conflicting rules** (auto-star + mute match same item): define precedence —
  **star wins over read wins over mute** (keep > hide). Documented, not a UI.

## 7. Interaction model
- Rules are evaluated by the **worker** as items are ingested (`CreateItems` /
  refresh), before they surface to the user — the noise never appears.
- Match: case-insensitive substring on title (v1). Scope: all feeds or one feed.
- Action applies the corresponding status: `read`, `starred`, or mute (mark read +
  exclude, or delete — see open questions).
- Editing/deleting a rule affects future refreshes; offer an optional one-time
  "apply to current unread" so a new rule can clean the existing backlog.

## 8. Content requirements
- Copy: rule-line phrasing ("<Action> · titles containing '<kw>' · in <scope>"),
  the mute-is-destructive note, empty state, and the "apply now" confirmation.
- Data per rule: id, action (read|star|mute), keyword, feed_id (nullable = all),
  created_at. Realistic ranges: 0 (typical new user), 3–15 (tuned), rarely 50+.

## 9. Technical notes & constraints
- **Storage:** a new `filters` table in SQLite (schema migration, bump the version
  array per CLAUDE.md; don't rewrite history). No new Go deps.
- **Application:** in `src/worker` at ingest, and an on-demand "apply to unread" pass
  reusing existing item queries.
- **Match engine:** substring/`strings.Contains` on lowered title for v1. Title only
  (content-match deferred). Deterministic, no regex in v1 (avoid footguns).
- Local + private; nothing leaves the device.
- **API/UI:** a small `/api/filters` CRUD (mirror the existing folder/feed handler
  patterns) consumed by the Settings section.

## 10. Recommended references
`clarify.md` (rule phrasing + the destructive-mute copy), `harden.md` (precedence,
apply-to-existing, empty/at-scale), `layout.md` (the Settings list + inline form).

## Anti-goals (protect the brief from scope creep)
- **No multi-condition builder** (AND/OR trees) in v1 — that's the "full rules
  builder" we explicitly deferred.
- **No regex** in v1 (support burden, user footguns).
- **No priority/ordering UI** — precedence is a fixed, documented rule.
- Not a spam/ML classifier — deterministic keyword/feed only.

## Open questions (defaults asserted)
- **Mute = delete vs mark-read-and-hide:** *Default: mark read + hidden from lists*
  (reversible-ish, non-destructive) rather than hard delete. Revisit if users want
  true delete.
- **Match field:** title only for v1. *Asserted; content-match is v2.*
- **Apply-to-existing:** offer it as an optional action at rule creation. *Asserted.*
