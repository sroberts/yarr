---
version: 1
slug: "src-assets-index-html"
primary_target: "src/assets/index.html"
related_targets: []
---

# Surface brief: main UI (src/assets/index.html)

Scope: the whole web UI shell: feed navigation, article list, reader, toolbars, triage card mode, menus, toasts, command palette, Settings / shortcuts modals, login page. Visitor mode: Operate (navigation, list, triage), Read (the open article).

Audience and job: the author triaging a backlog of chosen feeds, keyboard-first at a desk, swipe on a phone over a flaky LAN. Two earlier worlds were tried and retired: Contact Sheet (too heavy and loud) and Slip Box (every article a bordered card on a tinted ground, which read as busy). The shipped world is DESIGN.md's "The Indexed List"; this brief follows it.

Constraints: keep every keyboard binding, behaviour, and the undo model. Keep landmarks ("Feeds" navigation, "Article" main; "Triage" main while card mode is on), reader-toolbar structure and accessible names, accent keys, token names and the reading measure (pinned by test/e2e/smoke.spec.js; tests may not change without approval). Self-hosted OFL fonts only. Two co-equal themes. Seven-option accent picker stays (filing colour; blue default).

Decisions: the open article's place is a plain position, "4 of 28" ("4/28" on narrow phones), counted in the current view. The Slip Box's slip addresses (feed initials plus position, e.g. SN·12) were never shipped and are retired; don't reintroduce them as a requirement.

## Direction contract

THESIS: A quiet index of your feeds. Every article is a row in a plain list; the ones you keep are starred, the rest are read and fall back a tone, and the one you open sits unframed on the page as the single thing asking for attention. Refuses cards, a grey boxed frame and the loud fields of the rejected worlds; the three columns stay conventional on purpose.

OWN-WORLD: Cool box ground #F6F7F5 under the sidebar and triage; slip white #FFFFFF under the list and reader, with hairline column edges and no boxed panes. Ink #1B1C1E, graphite secondary, pencil tertiary; one filing colour (user-selectable accent) for filed state, the star, focus, text selection and the selected row's tint; toggled controls keep the ink outline. Hanken Grotesk for interface and titles, JetBrains Mono for numbers, Literata for reading.

STORY: You pick a folder or feed in the sidebar, run down the list by weight, star keepers with s, mark the rest with r or pass with j, and read the open article without leaving the list; on a phone, triage takes one card at a time under the thumb.

FIRST VIEWPORT: Three columns from 992px. Left, the Feeds sidebar on the box ground: wordmark, Unread / Starred / All / Triage, the folder/feed tree. Middle, the ~400px article list on slip white with search and the stack heading ("Feed B · 3 unread") at its head. Right, the open article unframed on slip white at ~64ch in Literata, its toolbar grouped state / reading / send with "n of m" beside prev/next and close; a narrow reader column folds the secondary actions into More.

FORM: The Indexed List (DESIGN.md). Supersedes Slip Box (round 3 pick, seed c260fb12) and Contact Sheet.

FINISH: unreviewed and undocumented is unfinished; changes end with a critique or finish review, and DESIGN.md kept in step with what ships.
