# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Self-hosters and tinkerers who run their own RSS/Atom feed reader instead of
a hosted service. They are technical enough to deploy a Docker container
(Basecamp Once–compatible) and care about owning their reading data. Two
contexts dominate:

- **Desk / triage:** at a keyboard, scanning many feeds quickly, marking
  read/starred, sending the keepers to Instapaper. Keyboard shortcuts are the
  primary interaction, not a power-user extra.
- **Phone / on the go:** the mobile swipe-triage card mode — flick through
  unread items one at a time, deciding read vs. save vs. open.

The job to be done: get through a backlog of feeds fast, lose nothing worth
keeping, and read without distraction.

The primary user is the author. This fork is built for his own reading and
published as-is: outside contributions are welcome (#133 landed from another
contributor) but other people's setups are not a design constraint. When a
decision is contested, the author's two contexts win.

## Product Purpose

`yarr` is a single-binary, self-hostable feed aggregator (Go + embedded
SQLite + embedded web UI). This fork (`sroberts/yarr`) adds Instapaper
integration and a mobile triage swipe UI on top of upstream. Success is the
tool disappearing: feeds refresh on their own, triage is a few keystrokes or
swipes, and reading is clean. It is local-first — no accounts, no telemetry,
no network calls beyond fetching the feeds the user subscribed to.

Explicitly out of scope (`doc/rationale.txt`): yarr is not an archiving tool.
Retention and search exist to serve triage, not to build a permanent library.

## Positioning

Four claims, each of which a neighboring reader would have to give something
up to copy:

1. **One binary, your data.** A single Go binary with embedded SQLite and an
   embedded UI. No accounts, no telemetry, no cloud, no runtime dependency
   surface — move the file and the database and nothing else exists.
2. **The triage loop.** Keyboard triage at the desk and swipe-card triage on
   the phone, with Instapaper as the keep-it destination. Clearing a backlog
   fast without losing what matters is the mechanism, not a feature list.
3. **Reading that survives being offline.** Starred and Instapaper-saved
   articles are cached in IndexedDB behind a service worker, so the reader pane
   works with no connection. Local-first taken literally.
4. **Feeds an AI client can read.** An MCP server (`doc/mcp.md`, JSON-RPC over
   Streamable HTTP) exposes browse / star / save, so the backlog can be triaged
   conversationally from Claude Code or Claude Desktop. Unusual for a feed
   reader and a real part of what this fork is.

## Operating Context

Two deployments are real and both must keep working:

- **Docker on a home server, plain http over a LAN address.** The dominant
  case. **There is no secure context here**, so `navigator.clipboard`, service
  workers, notifications, and every other secure-context browser API are
  degraded or absent. Any feature that touches one needs a working fallback and
  an honest failure path — this is why Copy Link ships an `execCommand` route
  and reports failure rather than claiming success. Treat "https is available"
  as false unless proven.
- **Basecamp Once appliance**, deployed with authentication, potentially for
  people who are not the author.

Both are reached from a desk browser and a phone browser against the same
instance. The phone is frequently on a slow or absent connection.

## Capabilities and Constraints

- Go 1.23; build tags `sqlite_foreign_keys sqlite_json`; `gui` adds a tray.
- **SQLite only.** No second storage backend, no ORM.
- **No JS framework, bundler, or transpiler.** `src/assets/` is hand-written
  HTML/CSS/JS served from `go:embed`; Vue 3 ships as a vendored global build.
- Dependency surface is deliberately tiny (sqlite + `golang.org/x/{net,sys,text}`)
  and new top-level dependencies are not added casually.
- Fonts are self-hosted and embedded (SIL OFL) — no third-party requests.
- Interfaces beyond the web UI: Fever API (`doc/fever.md`), MCP server
  (`doc/mcp.md`), OPML import/export.
- Releases are cut per merged code change, tagged `vX.Ys`, and always target
  `sroberts/yarr` — never upstream `nkanaev/yarr`.

## Brand Commitments

**Quiet, fast, utilitarian.** An invisible tool that gets out of the way. The
UI is chrome-light and keyboard-driven; nothing decorative competes with the
content. Voice is plain and terse — labels over marketing, no exclamation
points, no onboarding cheer. The interface should feel like a well-worn CLI
that happens to have a screen: instant, predictable, unsurprising.

Icon lineage is Tabler (`doc/rationale.txt` credits Pawel Kuna); new icons match
its 24×24 / stroke-2 geometry rather than introducing a second set.

### Anti-references

- **Ad-driven commercial readers** (Feedly and the like): no promoted content,
  no upsells, no "discover" feeds, no engagement nudges. The user's feed list
  is the whole product.
- **The generic AI-cream aesthetic:** no warm-neutral paper/sand body
  backgrounds, no tracked-uppercase eyebrows above sections, no identical
  icon-heading-text card grids. yarr's calm light + dark themes (one semantic
  token layer, a user-selectable accent) are the identity — don't drift them
  toward trend-of-the-month neutrals.
- More broadly: no bloated dashboard chrome, no hero metrics, no surfaces that
  exist to look busy rather than to do a job.

## Evidence on Hand

- `readme.md` (usage, Once deployment), `doc/` — `rationale.txt` (author's
  stated goals and visual lineage), `fever.md`, `mcp.md`, `build.md`,
  `changelog.md`, `specs/`.
- `etc/promo.png` — the one product screenshot.
- `test/e2e/smoke.spec.js` — the browser regression suite; `.impeccable/critique/`
  — dated critique snapshots with measured findings.

**Absences future work must not fabricate:** there are no users beyond the
author to cite, no testimonials, no adoption or performance numbers, no
customers, no pricing, and no roadmap commitments. Do not invent them for any
surface, including the readme.

## Product Principles

1. **The author's own reading is the spec.** Ship for the two real contexts
   (desk keyboard, phone swipe). Don't generalize for hypothetical users.
2. **Assume the hostile runtime.** Plain http on a LAN, no secure context, a
   flaky phone connection, and feeds that ship arbitrary HTML are the normal
   case, not the edge. Features degrade honestly or don't ship.
3. **Triage speed beats feature surface.** A new capability that slows read /
   star / save / next is a net loss, however good it is in isolation.
4. **Nothing leaves the box.** No telemetry, no remote logging, no third-party
   requests. Every byte the app fetches is a feed the user subscribed to.
5. **It's a reader, not an archive.** Retention, search, and caching serve the
   triage loop; they are not a permanent library.

## Design Principles

1. **The tool disappears.** Every pixel of chrome competes with the content.
   Default to less. If a control isn't earning its place on the toolbar, it
   belongs in a menu or a keystroke.
2. **Keyboard is a first-class path, not a shortcut.** Anything doable with the
   mouse must be doable from the keyboard, and the fast path is assumed.
3. **Triage is the core loop.** Read / star / save / next should be the
   lowest-friction actions in the app, on desk and on phone alike.
4. **Two themes, one system.** Light and dark are co-equal citizens, generated
   from a single semantic token layer (`--surface-*`, `--text-*`, `--accent`…);
   components reference roles, never raw colors. A user-selectable accent (seven
   options, blue default) and the reading fonts are independent axes. Any new
   surface must look deliberate and legible in both themes and every accent —
   never designed for light and patched for dark.
5. **Local-first, always.** No telemetry, no remote logging, no network
   dependency beyond the user's own feeds. The UI assumes it may be offline.

## Accessibility & Inclusion

- **Keyboard-first** is the headline requirement: full keyboard navigation is a
  primary path (the app already ships `key.js`), and new UI must be reachable
  and operable without a pointer. Visible focus states are required.
- Contrast must hold in both themes (light / dark) across every accent; body
  text targets WCAG AAA (7:1) and all interactive/UI text clears AA (4.5:1) as
  the floor. No meaning by color alone — unread and status pair color with
  weight, icon, or label (verify in grayscale).
- Icon-only controls carry an accessible name and, when they toggle, a pressed
  state; `title` alone is not an accessible name and does not exist on touch.
- Respect `prefers-reduced-motion` for the swipe cards, pull-to-refresh, and
  loaders when adding or revising motion.
