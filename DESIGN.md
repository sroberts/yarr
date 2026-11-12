---
name: yarr
description: A quiet, fast feed reader: a plain list of articles and an unframed page to read them on.
colors:
  filing-blue: "#2B4C9A"
  filing-blue-dark: "#8FAAF0"
  filing-teal: "#0F766E"
  filing-teal-dark: "#2DD4BF"
  filing-green: "#137337"
  filing-green-dark: "#4ADE80"
  filing-violet: "#7C3AED"
  filing-violet-dark: "#A78BFA"
  filing-rose: "#C4201A"
  filing-rose-dark: "#FF6B5E"
  filing-amber: "#A64B07"
  filing-amber-dark: "#FBBF24"
  filing-slate: "#475569"
  filing-slate-dark: "#94A3B8"
  instapaper-orange: "#FF6600"
  box-ground: "#F6F7F5"
  slip-white: "#FFFFFF"
  raised-grey: "#F0F1EF"
  hover-grey: "#E9EBE8"
  edge-subtle: "#E2E4E1"
  edge-strong: "#C6C9C5"
  ink: "#1B1C1E"
  graphite: "#4B4F55"
  pencil: "#62666C"
  status-success: "#15803D"
  status-attention: "#B45309"
  status-error: "#B42318"
  box-ground-dark: "#141618"
  slip-dark: "#1C1F22"
  raised-dark: "#22262A"
  hover-dark: "#2A2E33"
  edge-subtle-dark: "#2C3035"
  edge-strong-dark: "#3F444A"
  ink-dark: "#E9EAEC"
  graphite-dark: "#AFB3B9"
  pencil-dark: "#959AA2"
  status-success-dark: "#4ADE80"
  status-attention-dark: "#FBBF24"
  status-error-dark: "#FF7A6B"
typography:
  headline:
    fontFamily: "Hanken Grotesk Var, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.6em"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Hanken Grotesk Var, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.4rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Literata Var, Georgia, Times New Roman, serif"
    fontSize: "1.2rem"
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontFamily: "Hanken Grotesk Var, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  slip-title-unread:
    fontFamily: "Hanken Grotesk Var, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  small:
    fontFamily: "Hanken Grotesk Var, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  label:
    fontFamily: "Hanken Grotesk Var, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
  counter:
    fontFamily: "JetBrains Mono Var, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.78rem"
    fontWeight: 400
    fontFeature: "tnum"
  wordmark:
    fontFamily: "Hanken Grotesk Var, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
rounded:
  slip: "4px"
  control: "3px"
  tab: "0 0 2px 2px"
  swatch: "50%"
  pill: "999px"
spacing:
  row-pad: "0.7rem 0.75rem 0.7rem 0.375rem"
  row-gutter: "0.75rem"
  reader-pad: "2rem 1rem 2.75rem"
  reader-pad-phone: "1.25rem 1.1rem 1.75rem"
  card-pad: "1.5rem"
  stack-width: "400px"
  touch-target: "44px"
components:
  list-row:
    backgroundColor: "{colors.slip-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.slip}"
    padding: "{spacing.row-pad}"
  list-row-unread:
    backgroundColor: "{colors.slip-white}"
    textColor: "{colors.ink}"
    typography: "{typography.slip-title-unread}"
  list-row-selected:
    backgroundColor: "color-mix(accent 12% light / 22% dark, slip-white)"
    textColor: "{colors.ink}"
  feed-row:
    backgroundColor: "{colors.box}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  reader:
    backgroundColor: "{colors.slip-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "{spacing.reader-pad}"
  triage-card:
    backgroundColor: "{colors.slip-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.slip}"
    padding: "{spacing.card-pad}"
    width: "640px"
  triage-card-phone:
    width: "400px"
  button-default:
    backgroundColor: "{colors.slip-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.slip}"
  button-star:
    backgroundColor: "{colors.slip-white}"
    textColor: "{colors.filing-blue}"
    rounded: "{rounded.slip}"
    padding: "0.25rem 0.85rem"
  toolbar-icon:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.25rem 0.5rem"
  segmented-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.slip-white}"
    height: "{spacing.touch-target}"
  search-field:
    backgroundColor: "{colors.slip-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
---

# Design System: yarr

## Overview

**Creative North Star: "The Indexed List"**

yarr is a quiet index of your feeds. Every article is a row in a plain list; the ones you keep are starred, the rest are read and fall back a tone, and the one you open sits unframed on the page as the single thing asking for attention. The interface is quiet, fast and utilitarian: chrome recedes to hairlines and pencil-grey text so the titles and the article carry the screen.

Three columns, the reader convention: from tablet width up a feed sidebar on the box ground holds the wordmark, the four view filters and the folder/feed tree; beside it the article list (about 400px) on slip white; on the desk the reader takes the third column, also on slip white. On tablet the reader replaces the sidebar and list; on phone the three take turns. Density comes from many small, legible rows separated by hairlines, not from cards or packing, and the colour budget is spent almost entirely on one filing colour that marks filed state, focus and the selected row. The columns are conventional on purpose (an earlier top-bar layout clipped and was hard to read). This replaces the earlier Slip Box world (every article a bordered card on a tinted ground), which read as busy; it also refuses a grey boxed sidebar and the heavy, loud fields of the rejected Contact Sheet world.

Light and dark are co-equal: every role has a value in both, contrast is checked in both, and neither is a derived afterthought.

**Key Characteristics:**
- Plain article rows on slip white, title first, separated by inset 1px hairlines that step aside for the hovered or selected row. No cards, no shadows.
- One filing colour (user-selectable, seven options, blue by default) reserved for filed state, the star, focus and text selection.
- A selected list row is a soft filing-colour tint under ink text; toggled controls (filters, active toolbar items, palette rows) keep the ink outline.
- Hanken Grotesk for interface and titles, JetBrains Mono for numbers, Literata for reading. All self-hosted.

## Colors

A near-monochrome ink-on-paper palette with one deliberately scarce filing colour; light and dark carry the same roles.

### Primary
- **Filing Blue** (`filing-blue`, dark `filing-blue-dark`): the default filing colour. It paints the star marker, the selected-row tint (12% light / 22% dark), the triage Star button's outline and label, the focus ring, focused input borders, the triage hint link, and (as a 22% tint) `::selection`. The user may swap it for **Teal**, **Green**, **Violet**, **Rose**, **Amber** or **Slate** under "Filing colour" in Settings; each option has its own light and dark value, all clearing AA as text on box, slip and raised surfaces of their theme. On the always-dark toast the filing colour is lightened toward white for legibility.

### Secondary
- **Instapaper Orange** (`instapaper-orange`): the one fixed brand colour, identical in both themes, used only where an action sends to Instapaper (the triage "save" pill and stat). It is not part of the filing vocabulary.

### Neutral
- **Box Ground** (`box-ground` / `box-ground-dark`): the page, the feed sidebar and the triage view.
- **Slip White** (`slip-white` / `slip-dark`): the article list, the reader, the triage card, inputs and default buttons.
- **Raised Grey** (`raised-grey` / `raised-dark`): menus, modals, the command palette and code blocks in the reader.
- **Hover Grey** (`hover-grey` / `hover-dark`): pointer hover on controls (only under `hover: hover`).
- **Subtle Edge** (`edge-subtle` / `edge-subtle-dark`): the hairlines between article rows, dividers and column rules.
- **Strong Edge** (`edge-strong` / `edge-strong-dark`): the triage card, default and outline buttons, segmented tracks.
- **Ink** (`ink` / `ink-dark`): primary text, links, and the selection outline. 15.9:1 (light) and 15.1:1 (dark) on the box.
- **Graphite** (`graphite` / `graphite-dark`): read article titles, counters, bylines' feed name, secondary actions.
- **Pencil** (`pencil` / `pencil-dark`): tertiary text: row meta, placeholders, captions, the "n of m" list position.
- **Status** (`status-success`, `status-attention`, `status-error`, each with a dark value): semantic feedback only, never decoration.

### Named Rules
**The Filing Colour Rule.** The filing colour means "filed", "focused" or "this one". It marks the star, keyboard focus, focused fields, the text-selection tint and (as a 12% light / 22% dark tint) the selected list row, and nothing else: not links, not unread, not headers, not scrollbars.

**The Ink Link Rule.** Links are ink. In the reader they are ink with an underline; in the chrome they are ink and identified by context. A link is never filing-coloured.

**The Pencil Floor Rule.** Pencil (tertiary) text must stay at or above 4.5:1 on both the slip and raised surfaces in both themes. The e2e suite measures it; a new grey that fails it is wrong, not the test.

## Typography

**Display Font:** none; titles are set in the interface face.
**Body Font:** Literata (with Georgia) for reading; Hanken Grotesk (with system-ui) for everything else.
**Label/Mono Font:** JetBrains Mono (with SFMono-Regular, Menlo).

**Character:** A plain, slightly warm grotesk runs the instrument; a bookish serif takes over only inside the reader; a mono face sets the counts. All three are variable WOFF2 files self-hosted from `src/assets/fonts` under the SIL OFL, split latin / latin-ext. No third-party font requests.

The root size is 15px; the reading size is user-controlled (default 1.2rem) and reader headings scale with it in `em`.

### Hierarchy
- **Headline** (Hanken Grotesk 700, 1.6em of the reading size, 1.2, -0.012em): the article title in the reader, balanced wrapping.
- **Title** (Hanken Grotesk 600, 1.4rem, 1.25): the triage card headline.
- **Body** (Literata 400, 1.2rem default, 1.6): article text in the reader. Users may switch to sans or mono; each reading font has its own measure (Literata 35em, Hanken 33em, JetBrains Mono 44em) so all three land at roughly 70 characters per line. The triage excerpt is Literata at 1rem in graphite.
- **UI** (Hanken Grotesk 400, 1rem; list titles 1.0667rem / 1.35, clamped to 3 lines): list titles, feed rows, menus, settings. Unread titles step up to 600 in ink; read titles drop to graphite at 400.
- **Small** (`--text-small`, Hanken Grotesk, 0.875rem): the list heading's name and count, labelled toolbar buttons, toasts, the sync chip, swipe pills, filter rows and code in the triage card. The one step between UI and Label; nothing sits at .85 or .9rem.
- **Label** (Hanken Grotesk 400, 0.8rem): the row meta line, bylines (sans, pencil, tabular), "n of m", settings labels, the triage card header.
- **Counter** (JetBrains Mono, 0.78rem, tabular): sidebar and heading counts, in graphite.
- **Wordmark** (Hanken Grotesk 700, -0.01em): "yarr" beside the anchor mark at the head of the feed sidebar, tablet and up.

### Named Rules
**The Weight Is Unread Rule.** Unread is carried by a 600 ink title and an ink dot in the row's left gutter, which survive grayscale. Read rows step back a text tier, never an opacity.

**The Measure Rule.** The reader holds 62 to 76 characters per line in every reading font (pinned by the e2e suite). Measure is set in `em` per font, not `ch`.

**The No Eyebrow Rule.** Captions are quiet sentence-case labels. There is no tracked uppercase anywhere in the system; group labels mark where a group ends and never shout.

## Layout

The page is the box. Three widths:

- **Desktop (992px and up):** three columns: the feed sidebar (default 300px, resizable), the article list (default 400px, resizable) and the reader.
- **Tablet (768px to 991.98px):** sidebar (35%) and list (65%); opening an article replaces both with the reader.
- **Phone (below 768px):** feeds, list and reader take turns full-width; the reader gets a bottom thumb-zone bar with labelled previous/next and the "n of m" position. Secondary reader actions fold into an overflow menu so six 44px controls fit 320px.

Spacing rhythm is small and fixed: article rows pad `0.7rem 0.75rem 0.7rem 0.375rem` with a 0.75rem gutter for the unread dot or star, and sit flush with an inset hairline between them. The reader is unframed: the text column at the measure, `2rem 1rem 2.75rem` around it (`1.25rem 1.1rem 1.75rem` on phones), with space rather than a rule under the byline. The triage card is 640px wide on desk, 400px on phone, centred with its action line and legend directly beneath.

Touch: below 992px every toolbar control, list row and menu item is at least 44px; a compact density option tightens rows on fine pointers only.

### Named Rules
**The Three Column Rule.** Feeds, list, reader, left to right. Navigation stays a vertical, readable tree; don't move it into a horizontal strip.

**The Two Grounds Rule.** The sidebar and triage view sit on the box ground; the article list and the reader sit on slip white. Panes are not separately boxed; the only column dividers are hairline right edges.

## Elevation & Depth

Flat. Resting surfaces have no shadow and no card edge; hierarchy comes from weight, tone and hairlines. The triage card and overlays (palette, menus, toasts) are the only things that lift.

### Shadow Vocabulary
- **Card** (`--slip-shadow`: `0 1px 2px rgba(27,28,30,.06)` light, `0 1px 2px rgba(0,0,0,.3)` dark): the triage card only.
- **Control** (`--shadow-control`: `0 1px 2px` at 10% light / 30% dark; `--shadow-inset` for text fields): default buttons and selects only.
- **Float** (`--shadow-float`: `0 4px 16px` at 22% light / 45% dark): toasts, the swipe-undo pill, the floating sync chip, the settings menu and the skip link.
- **Overlay** (`--shadow-overlay`: `0 16px 48px` at 40% light / 60% dark): the command palette over its dark backdrop. Its selected row is a 2px inset ink outline, never a fill.

### Named Rules
**The Paper Not Plastic Rule.** A resting surface never gets a shadow. Hover changes the surface (hover grey), not the elevation.

## Shapes

One small corner (4px) for list rows, the triage card, buttons, segmented tracks and toasts; 3px on toolbar icon buttons, the search field and focus outlines. Accent swatches are the only circles. Edges are 1px hairlines; the only 2px strokes are the toggle outline and the focus ring. Blockquotes take a 3px strong-edge rule on the left.

## Components

### Article Row (list)
The signature object.
- **Shape:** a flat row on slip white, 4px corner (visible only on hover and selection); inset 1px subtle hairlines between rows that hide beside the hovered or selected row.
- **Content:** a left gutter with the unread dot (ink) or the star (filing colour); the title (up to 3 lines); then one meta line in pencil: feed · relative age · reading time.
- **States:** unread = 600 ink title and ink dot; read = graphite title. Hover (pointer only) = hover grey. Selected = the filing-colour tint, ink title and graphite meta. Keyboard focus = 2px filing-colour ring inset.

### Reader
- The article sits directly on slip white, unframed, at the measure: sans 700 headline, a one-line sans byline caption (feed name in graphite 600, then short date "Oct 27, 09:42" and reading time in pencil, never splitting "9 min"), 2em of space, then Literata body. No rule under the byline.
- The reader toolbar groups actions with space and a short hairline between groups: state (star, read), reading (appearance, read here, listen), send (Instapaper, copy, open). The read toggle shows the list's unread dot while unread and a check once read. At the right, the article's "n of m" in pencil beside prev/next and close.
- Code blocks sit on raised grey with a hairline, scroll sideways with a right-edge fade while more remains.
- Opening fades the article in (0.18s, 4px rise).
- Appearance is the "Aa" typography glyph, never the sliders (which mean Settings). Esc closes the article as q does, after any open menu. Below desk width Back is the only exit; at desk width, Close.
- An empty list says why in one centred line, names the view ("Nothing unread in Feed B.", "…in your feeds.") and offers one way on (Show all articles / Show unread / Show everything); the reader's prompt reads "All caught up" to match.
- On a phone the reader is the screen, edge to edge. Below desk width the reader replaces the list, so a Back chevron leads its toolbar on phones and tablets alike. The byline's feed name is a button that opens that feed.

### Stack Heading
The list's own heading line under the search field, at every width, on slip white: the feed, folder or "All Unread/Starred/Feeds" name in 600 ink, and the filter's count in graphite ("Feed B · 3 unread"). In the Unread view a labelled "Mark all read" text button sits at its right, so the bulk action names its scope; it hides while a search is active, since the server would mark the whole scope, not the results. On phones a labelled "Triage" button sits beside it, and the list's way back reads "‹ Feeds". It is how a phone keeps its place with the sidebar off-screen.

### Feed Sidebar
- **Style:** the box ground: folders and feeds are plain rows (icon, name, mono counter), feeds indented under an expandable folder. The ⋯ actions button is hidden at rest on a mouse and appears on the hovered, selected or keyboard-focused row; on touch it stays faintly visible.
- **State:** the selected row takes the filing-colour tint at 600; with an article open on the desk it steps down to hover grey, so only one tint shows at a time. Actions open from ⋯ or right-click; opening them leaves the selection alone (on a phone, selecting would leave the list) and marks the row in hover grey while its menu is up.

### View Filters
Unread, Starred, All, Triage at the head of the feed sidebar, named in text wherever the toolbar is 280px or wider (a container query); a narrower sidebar falls back to icons, and the wordmark only returns at 380px. The active one is outlined in ink on slip white at 600, never filled.

### Buttons
- **Toolbar icon:** transparent, 3px corner, `0.25rem 0.5rem`; hover grey under a real pointer; disabled = graphite at 0.7 opacity.
- **Default:** slip white, strong edge, 4px corner; pressed = hover grey.
- **Star (triage):** the one triage verb without a gesture, so it is a labelled button drawn in the filing colour (1px filing border, filing text, slip white ground).
- **Segmented toggle (settings):** a strong-edge track of equal segments with subtle dividers, 36px at a desk and 44px on touch; the active segment inverts to ink.

### Dialogs and Menus
Settings, the shortcut sheet, prompts and the palette are real dialogs: labelled, Tab stays inside, and page shortcuts pause while one is open (? still swaps Settings for the sheet). The scrim dims the page to 45% rather than blacking it out. The palette opened over a dialog closes alone on Esc and hands focus back to the dialog. Settings rows name their control groups, so a screen reader hears "Theme, group" before the choices. A "Skip to articles" link appears on the first Tab. Menus open onto their first item from the keyboard, move with the arrows, Home and End, and close when Tab leaves them; they carry a strong edge and a soft shadow in both themes, with shortcut keys in pencil at the right. The shortcut sheet groups its keys under small headings: Views, Moving around, Articles, Triage.

### Inputs / Fields
- **Search:** slip white, borderless, 3px corner, leading icon, its own clear button; focus fills hover grey and keyboard focus adds the ring.
- **Form fields:** slip white; focus turns the border filing-coloured. Placeholders are pencil at full opacity.

### Triage Card
One slip, enlarged, on the box: slip white, strong edge, 4px corner, 1.5rem padding. Header line with feed name and age, then domain (hidden for IP addresses and LAN names), then the 1.4rem title, then a scrolling Literata excerpt (or the article itself, read in place), then a footer with the hint and "n of m". The excerpt keeps paragraph breaks, leaves code out, and is set in the reader's font, as is the article read in the card, so expanding never changes the voice. "Open original" is an ink underline, not the filing colour. A card with no body says "No preview in the feed" and offers the original instead of a read-here hint; tapping it opens the original. Triage starts in the folder being read, and its header keeps the view filters beside the wordmark as in the three-column layout. The swipe action pill is ink for mark-read and Instapaper orange for save. Swipes snap and fly at 0.3s; under reduced motion (the OS setting or Motion: Reduced) the card does not travel, it fades in place in 0.2s under the action's tint and pill. On phones the card sits low, near the thumb, with the folder picker under the legend at the bottom edge. With Instapaper connected the left swipe saves, so "Not now" (n) is an outlined button beside Star that leaves the card unread; on a phone it takes Listen's place, and at 320px Star drops to its glyph. Triage with nothing unread is one state, "Nothing unread in <folder>", with a way back to the list; the "All caught up" tally only follows a real run. Each new card is announced to screen readers ("Card 3 of 12: title"). A focused button, link or the folder picker keeps its own Enter, Space and arrows; the letters and Esc still triage. The finished screen titles itself "All caught up" at 1.5rem/650, with every count in ink. The legend ends ("‹ Keep unread" or "‹ Instapaper", "Mark read ›") are buttons drawn as legend text, so a mouse or a screen reader can triage at the desk; they never wrap, and Listen drops out below 360px.

### Toasts
An always-dark pill (4px corner, toast shadow), bottom centre in the thumb zone, auto-dismissing; the undo variant carries a lightened filing-colour action with its key, `u`, in an outlined key cap beside it at desk widths. Undo holds for 6s (10s for a delete), pauses while hovered or focused, and `u` reaches it from anywhere. Status text reaches screen readers through one live region; the offline banner is empty, and silent, until the connection drops.

### Accent Picker
Seven circular swatches under "Filing colour", each previewing its own theme's value; the chosen one gets an ink ring and a check mark so the choice survives colour blindness.

## Do's and Don'ts

### Do:
- **Do** list articles as flat rows on slip white, title first, with an inset hairline between rows. No cards.
- **Do** mark a selected list row with the filing-colour tint (`--selected-bg`), and a toggled control with the 2px inset ink outline.
- **Do** keep `--focus-ring` equal to `--accent` and declare accent derivations on `body`, where the `[data-accent]` value actually lands.
- **Do** keep the accent keys `blue`, `teal`, `green`, `violet`, `rose`, `amber`, `slate`, each with a light and dark value and a matching swatch.
- **Do** reference roles (`--surface-*`, `--text-*`, `--ink-select`, `--accent`), never raw colours, in components.
- **Do** design and check every change in light and dark.
- **Do** self-host any face under an open licence and keep the reading measure at 62 to 76 characters per line.

### Don't:
- **Don't** move feeds and folders into a horizontal top bar; it clipped and was hard to read.
- **Don't** use the filing colour for links, unread, headings, scrollbars or decoration; its one fill is the selected-row tint.
- **Don't** put articles back on cards or frame the reader; the list and the page are the content.
- **Don't** add shadows to resting surfaces; only the triage card and overlays lift.
- **Don't** use opacity to de-emphasise text; use graphite or pencil.
- **Don't** add tracked uppercase eyebrows or kickers above titles or groups.
- **Don't** request fonts, icons or scripts from a third-party host, or add a JS framework or bundler.
