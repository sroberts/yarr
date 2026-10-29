---
version: 1
slug: "src-assets-index-html"
primary_target: "src/assets/index.html"
related_targets: []
---

# Surface brief: main UI (src/assets/index.html)

Scope: the whole web UI shell: feed navigation, article list, reader, toolbars, triage card mode, menus, toasts, command palette, Settings / shortcuts modals, login page. Visitor mode: Operate (navigation, list, triage), Read (the open slip).

Audience and job: the author triaging a backlog of chosen feeds, keyboard-first at a desk, swipe on a phone over a flaky LAN. A previous world (Contact Sheet) was rejected after use as too heavy / loud and still generic under its metaphor; this one must be quiet and structurally different.

Constraints: keep every keyboard binding, behaviour, and the undo model. Keep landmarks ("Feeds" navigation, "Article" main), reader-toolbar structure and accessible names, accent keys, token names and the reading measure (pinned by test/e2e/smoke.spec.js; tests may not change without approval). Self-hosted OFL fonts only. Two co-equal themes. Seven-option accent picker stays (filing colour; blue default).

Decisions: slip address = feed code (initials) + position in the current view, e.g. SN·12 (front-end only; renumbers with the view). Unresolved: chip-row overflow beyond horizontal scroll.

## Direction contract

THESIS: Every article is a slip with an address; starred slips get filed with a small tab, the rest go back in the box, and the open slip lies enlarged as the one thing that asks for attention. Refuses the boxed three-pane reader with a grey sidebar, and the heavy fields of the rejected Contact Sheet.

OWN-WORLD: Cool box ground #F6F7F5, slip-white cards with 1px edges, ink #1B1C1E, pencil graphite secondary, one filing blue (user-selectable accent) only for filed state and focus; selection is a 2px ink outline, never a fill. Hanken Grotesk for UI and titles, JetBrains Mono for addresses and numbers, Literata for the open slip.

STORY: You glance along the top bar to pick a folder or feed, run down the stack by weight and address, file keepers with s, pass the rest with j, and read the enlarged slip without leaving the box.

FIRST VIEWPORT: No sidebar. A single top bar (the Feeds landmark): wordmark, Unread / Starred / All / Triage, folder chips with the current folder's feed chips inline, menu. Left, a ~400px stack of addressed slips (SN·01…) with search at its head; right, the open slip as a large white card centred on the box ground, address beside prev/next, Literata body at ~64ch.

FORM: Slip Box, my rank 1 of 7 on round 3's list (scholar's slip box); chosen as the pick card. Seed key c260fb12.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
