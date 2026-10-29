---
version: 1
slug: "src-assets-index-html"
primary_target: "src/assets/index.html"
related_targets: []
---

# Surface brief: main UI (src/assets/index.html)

Scope: the whole web UI shell: feed sidebar, article list, reader, toolbars, triage card mode, menus, toasts, command palette, Settings / shortcuts modals, login page. Visitor mode: Operate (list and triage), Read (reader pane).

Audience and job: the author triaging a backlog of chosen feeds, keyboard-first at a desk, swipe on a phone over a flaky LAN. Get through the backlog fast, lose nothing worth keeping, read without chrome.

Constraints: keep every keyboard binding, behaviour, and the undo model. Keep semantic token names (--surface-*, --text-*, --border-*, --accent, --on-accent) and reader-toolbar structure (pinned by test/e2e/smoke.spec.js; tests may not change without approval). Self-hosted OFL fonts only. Two co-equal themes. The seven-option accent picker stays, reframed as the marker colour (red default).

Unresolved: Instapaper-saved mark shape (distinct from the starred ring); frame numbering beyond 999.

## Direction contract

THESIS: Triage as a photographer edits a roll: every article is a numbered frame, keepers carry a marker, the rest are passed over, the open article is the enlargement. Refuses the grey-sidebar, blue-accent three-pane reader with dot-only unread state.

OWN-WORLD: Photo-paper white list and reader on cool grey; a solid rebate-black band down the article list's left edge carrying mono frame numbers; one marker ink (red by default, user-selectable) reserved for keeper state, links and focus; Hanken Grotesk UI, JetBrains Mono for numbers only, Literata for reading. Dark theme is the negative: graphite paper, light rebate, brighter marker.

STORY: You see the roll, scan frames by weight, mark keepers with s, pass the rest with j, and read the enlargement without leaving the sheet.

FIRST VIEWPORT: Grey feed sidebar (~250px) with segmented views and counts; article list with a 44px rebate band numbering each row 01, 02…; the selected frame inverted with a 2px ink outline; starred frames ringed in marker; reader with "Frame 01 of 15" beside previous/next and a Literata article at ~66ch.

FORM: Contact Sheet, my rank 1 of 7 on the re-rolled list (darkroom contact sheet); chosen as the pick card. Seed key 45e53a06.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
