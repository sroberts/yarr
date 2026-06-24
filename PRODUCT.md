# Product

## Register

product

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

## Product Purpose

`yarr` is a single-binary, self-hostable feed aggregator (Go + embedded
SQLite + embedded web UI). This fork (`sroberts/yarr`) adds Instapaper
integration and a mobile triage swipe UI on top of upstream. Success is the
tool disappearing: feeds refresh on their own, triage is a few keystrokes or
swipes, and reading is clean. It is local-first — no accounts, no telemetry,
no network calls beyond fetching the feeds the user subscribed to.

## Brand Personality

**Quiet, fast, utilitarian.** An invisible tool that gets out of the way. The
UI is chrome-light and keyboard-driven; nothing decorative competes with the
content. Voice is plain and terse — labels over marketing, no exclamation
points, no onboarding cheer. The interface should feel like a well-worn CLI
that happens to have a screen: instant, predictable, unsurprising.

## Anti-references

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
- Respect `prefers-reduced-motion` for the swipe cards, pull-to-refresh, and
  loaders when adding or revising motion.
