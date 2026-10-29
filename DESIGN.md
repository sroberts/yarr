---
name: yarr
description: A quiet, fast feed reader where every article is an addressed slip in a box.
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
  label:
    fontFamily: "Hanken Grotesk Var, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
  address:
    fontFamily: "JetBrains Mono Var, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.72rem"
    fontWeight: 500
    lineHeight: 1
    fontFeature: "tnum"
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
  tab: "2px 2px 0 0"
  swatch: "50%"
spacing:
  stack-gap: "6px"
  stack-gap-tabbed: "10px"
  slip-pad: "0.55rem 0.75rem 0.6rem"
  open-slip-pad: "2.25rem 2.75rem 2.75rem"
  open-slip-pad-phone: "1.25rem 1.1rem 1.75rem"
  card-pad: "1.5rem"
  stack-width: "400px"
  touch-target: "44px"
components:
  slip:
    backgroundColor: "{colors.slip-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.slip}"
    padding: "{spacing.slip-pad}"
  slip-unread:
    backgroundColor: "{colors.slip-white}"
    textColor: "{colors.ink}"
    typography: "{typography.slip-title-unread}"
  slip-tab:
    backgroundColor: "{colors.filing-blue}"
    rounded: "{rounded.tab}"
    width: "18px"
    height: "5px"
  feed-row:
    backgroundColor: "{colors.box}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  open-slip:
    backgroundColor: "{colors.slip-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.slip}"
    padding: "{spacing.open-slip-pad}"
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

**Creative North Star: "The Slip Box"**

yarr is a scholar's slip box for feeds. Every article is a slip with an address; slips lie in a stack on a cool box ground, the ones you keep get filed with a small coloured tab, the rest go back in the box, and the one you open lies enlarged on the same ground as the single thing asking for attention. The interface is quiet, fast and utilitarian: chrome recedes to hairlines and pencil-grey text so the stack and the open slip carry the screen.

Three columns, the reader convention: from tablet width up a feed sidebar on the box ground holds the wordmark, the four view filters and the folder/feed tree; beside it the stack (about 400px) of slips; on the desk the open slip takes the third column. On tablet the open slip replaces the sidebar and stack; on phone the three take turns. Density comes from many small, legible slips, not from packing, and the colour budget is spent almost entirely on one filing colour that marks filed state and focus. The columns are conventional on purpose (an earlier top-bar layout clipped and was hard to read); the world lives in the slips, addresses and filing tab, not in a novel frame. It refuses a grey boxed sidebar and the heavy, loud fields of the rejected Contact Sheet world.

Light and dark are co-equal: every role has a value in both, contrast is checked in both, and neither is a derived afterthought.

**Key Characteristics:**
- White slips with a 1px edge, a 4px corner and a barely-there shadow, 6px apart on a cool off-white (or graphite) box ground.
- A mono address on every slip (feed code and position in the view, e.g. `FB·03`) that is bold ink while unread.
- One filing colour (user-selectable, seven options, blue by default) reserved for filed state, the star, focus and text selection.
- Selection is drawn in ink as an outline on the object, never an accent fill.
- Hanken Grotesk for interface and titles, JetBrains Mono for addresses and numbers, Literata for reading. All self-hosted.

## Colors

A near-monochrome ink-on-paper palette with one deliberately scarce filing colour; light and dark carry the same roles.

### Primary
- **Filing Blue** (`filing-blue`, dark `filing-blue-dark`): the default filing colour. It paints the tab on a starred slip, the star marker, the triage Star button's outline and label, the focus ring, focused input borders, the triage hint link, and (as a 22% tint) `::selection`. The user may swap it for **Teal**, **Green**, **Violet**, **Rose**, **Amber** or **Slate** under "Filing colour" in Settings; each option has its own light and dark value, all clearing AA as text on box, slip and raised surfaces of their theme. On the always-dark toast the filing colour is lightened toward white for legibility.

### Secondary
- **Instapaper Orange** (`instapaper-orange`): the one fixed brand colour, identical in both themes, used only where an action sends to Instapaper (the triage "save" pill and stat). It is not part of the filing vocabulary.

### Neutral
- **Box Ground** (`box-ground` / `box-ground-dark`): the page, the stack column, the reader column and the triage view. Everything else lies on it.
- **Slip White** (`slip-white` / `slip-dark`): slips, the open slip, the triage card, inputs and default buttons.
- **Raised Grey** (`raised-grey` / `raised-dark`): menus, modals, the command palette and code blocks in the reader.
- **Hover Grey** (`hover-grey` / `hover-dark`): pointer hover on controls (only under `hover: hover`).
- **Subtle Edge** (`edge-subtle` / `edge-subtle-dark`): the 1px edge of every slip, hairline dividers and column rules.
- **Strong Edge** (`edge-strong` / `edge-strong-dark`): hovered slips, the triage card, default and outline buttons, segmented tracks.
- **Ink** (`ink` / `ink-dark`): primary text, links, and the selection outline. 15.9:1 (light) and 15.1:1 (dark) on the box.
- **Graphite** (`graphite` / `graphite-dark`): read slip titles, counters, bylines' feed name, secondary actions.
- **Pencil** (`pencil` / `pencil-dark`): tertiary text: slip meta, addresses on read slips, placeholders, captions, the "n of m" stack position.
- **Status** (`status-success`, `status-attention`, `status-error`, each with a dark value): semantic feedback only, never decoration.

### Named Rules
**The Filing Colour Rule.** The filing colour means "filed" or "focused". It marks the starred tab and star, keyboard focus, focused fields and the text-selection tint, and nothing else: not links, not selection, not headers, not scrollbars.

**The Ink Link Rule.** Links are ink. In the reader they are ink with an underline; in the chrome they are ink and identified by context. A link is never filing-coloured.

**The Pencil Floor Rule.** Pencil (tertiary) text must stay at or above 4.5:1 on both the slip and raised surfaces in both themes. The e2e suite measures it; a new grey that fails it is wrong, not the test.

## Typography

**Display Font:** none; titles are set in the interface face.
**Body Font:** Literata (with Georgia) for reading; Hanken Grotesk (with system-ui) for everything else.
**Label/Mono Font:** JetBrains Mono (with SFMono-Regular, Menlo).

**Character:** A plain, slightly warm grotesk runs the instrument; a bookish serif takes over only inside the open slip; a mono face stamps addresses and numbers like a library index. All three are variable WOFF2 files self-hosted from `src/assets/fonts` under the SIL OFL, split latin / latin-ext. No third-party font requests.

The root size is 15px; the reading size is user-controlled (default 1.2rem) and reader headings scale with it in `em`.

### Hierarchy
- **Headline** (Hanken Grotesk 600, 1.6em of the reading size, 1.2): the open slip's article title, balanced wrapping.
- **Title** (Hanken Grotesk 600, 1.4rem, 1.25): the triage card headline.
- **Body** (Literata 400, 1.2rem default, 1.6): article text in the open slip. Users may switch to sans or mono; each reading font has its own measure (Literata 35em, Hanken 33em, JetBrains Mono 44em) so all three land at roughly 70 characters per line. The triage excerpt is Literata at 1rem in graphite.
- **UI** (Hanken Grotesk 400, 1rem): slip titles, feed rows, menus, settings. Unread slip titles step up to 600 in ink; read titles drop to graphite at 400.
- **Label** (Hanken Grotesk 400, 0.8rem): slip meta, bylines (sans, pencil, tabular), "n of m", settings labels, the triage card header.
- **Address** (JetBrains Mono 500, 0.72rem, tabular): the slip address `XX·NN`; 700 and ink while unread. Counters use the same face at 0.78rem in graphite.
- **Wordmark** (Hanken Grotesk 700, -0.01em): "yarr" beside the anchor mark at the head of the feed sidebar, tablet and up.

### Named Rules
**The Weight Is Unread Rule.** Unread is carried by weight (600 title, 700 address) and ink, which survive grayscale. Read slips step back a text tier, never an opacity.

**The Measure Rule.** The open slip holds 62 to 76 characters per line in every reading font (pinned by the e2e suite). Measure is set in `em` per font, not `ch`.

**The No Eyebrow Rule.** Captions are quiet sentence-case labels. There is no tracked uppercase anywhere in the system; group labels mark where a group ends and never shout.

## Layout

The page is the box. Three widths:

- **Desktop (992px and up):** three columns: the feed sidebar (default 300px, resizable), the stack (default 400px, resizable) and the open slip.
- **Tablet (768px to 991.98px):** sidebar (35%) and stack (65%); opening an article replaces both with the open slip.
- **Phone (below 768px):** feeds, stack and open slip take turns full-width; the reader gets a bottom thumb-zone bar with labelled previous/next and the address. Secondary reader actions fold into an overflow menu so six 44px controls fit 320px.

Spacing rhythm is small and fixed: slips 6px apart (10px above a tabbed slip, so the tab clears the slip above), slip padding `0.55rem 0.75rem 0.6rem`, 8px above the first slip. The open slip is a centred card with `2.25rem 2.75rem 2.75rem` padding (`1.25rem 1.1rem 1.75rem` on phones) and the measure inside it. The triage card is 640px wide on desk, 400px on phone, centred with its action line and legend directly beneath.

Touch: below 992px every toolbar control, list row and menu item is at least 44px; a compact density option tightens rows on fine pointers only.

### Named Rules
**The Three Column Rule.** Feeds, stack, reader, left to right. Navigation stays a vertical, readable tree; don't move it into a horizontal strip.

**The One Ground Rule.** Stack, reader and triage all sit on the box ground; panes are not separate tinted boxes. The only column divider is the stack's hairline right edge.

## Elevation & Depth

Nearly flat. Depth is a white card on a tinted ground plus a 1px edge; the shadow is a whisper that only confirms the slip is paper. Overlays (palette, toasts) are the only things that truly float.

### Shadow Vocabulary
- **Slip** (`--slip-shadow`: `0 1px 2px rgba(27,28,30,.06)` light, `0 1px 2px rgba(0,0,0,.3)` dark): every slip in the stack and the open slip.
- **Toast** (`0 4px 16px rgba(0,0,0,.25)`): the always-dark toast and swipe-undo pill.
- **Palette** (`0 16px 48px rgba(0,0,0,.4)`): the command palette over its dark backdrop.

### Named Rules
**The Paper Not Plastic Rule.** A resting surface never gets more than the slip shadow. Hover changes the edge (subtle to strong), not the elevation.

## Shapes

Cut card. One small corner (4px) for every slip, card, button, segmented track and toast; 3px on toolbar icon buttons, the search field and focus outlines; the filing tab is a 18 by 5px strip with only its top corners rounded (2px), sitting 4px above a slip's top edge at the right. Accent swatches are the only circles. Edges are 1px hairlines; the only 2px strokes are the selection outline and the focus ring. Blockquotes take a 3px strong-edge rule on the left.

## Components

### Slip (stack row)
The signature object.
- **Shape:** slip white, 1px subtle edge, 4px corner, slip shadow.
- **Content:** a meta line (unread dot or filing-coloured star, mono address, feed name, reading time, relative age, all in pencil) over the title.
- **States:** unread = 600 ink title and 700 ink address; read = graphite title. Hover (pointer only) = strong edge. Selected = ink edge and a 2px inset ink outline, background unchanged. Keyboard focus = 2px filing-colour ring inset.
- **Filed:** a starred slip carries the filing tab on its top edge; the tab is decorative, the star icon carries the state.

### Open Slip (reader)
- One large white slip centred on the box ground, holding the article at the measure: sans headline, a one-line sans byline caption (feed name in graphite 600, then short date "Oct 27, 09:42" and reading time in pencil), then Literata body.
- The reader toolbar groups actions by space, not dividers: state (star, read), reading (appearance, read here, listen), send (Instapaper, copy, open). At the right, the slip's address and "n of m" in pencil beside prev/next and close.
- Code blocks sit on raised grey with a hairline, scroll sideways with a right-edge fade while more remains.
- Opening fades the slip in (0.18s, 4px rise).

### Feed Sidebar
- **Style:** the box ground, no slips: folders and feeds are plain rows (icon, name, mono counter, ⋯ actions), feeds indented under an expandable folder.
- **State:** the selected row takes the 2px inset ink outline over slip white; with an article open on the desk it steps down to a 1px ink edge. Never a fill. Actions open from ⋯ or right-click.

### View Filters
Unread, Starred, All, Triage as icon buttons at the head of the feed sidebar (names in title and aria-label). The active one is outlined in ink on slip white at 600, never filled.

### Buttons
- **Toolbar icon:** transparent, 3px corner, `0.25rem 0.5rem`; hover grey under a real pointer; disabled = graphite at 0.7 opacity.
- **Default:** slip white, strong edge, 4px corner; pressed = hover grey.
- **Star (triage):** the one triage verb without a gesture, so it is a labelled button drawn in the filing colour (1px filing border, filing text, slip white ground).
- **Segmented toggle (settings):** a strong-edge track of equal 44px segments with subtle dividers; the active segment inverts to ink.

### Inputs / Fields
- **Search:** slip white, borderless, 3px corner, leading icon, its own clear button; focus fills hover grey and keyboard focus adds the ring.
- **Form fields:** slip white; focus turns the border filing-coloured. Placeholders are pencil at full opacity.

### Triage Card
One slip, enlarged, on the box: slip white, strong edge, 4px corner, 1.5rem padding. Header line with address and feed name and age, then domain, then the 1.4rem title, then a scrolling Literata excerpt (or the article itself, read in place), then a footer with the hint and "n of m". The swipe action pill is ink for mark-read and Instapaper orange for save. Swipes snap and fly at 0.3s.

### Toasts
An always-dark pill (4px corner, toast shadow), bottom centre in the thumb zone, auto-dismissing; the undo variant carries a lightened filing-colour action.

### Accent Picker
Seven circular swatches under "Filing colour", each previewing its own theme's value; the chosen one gets an ink ring and a check mark so the choice survives colour blindness.

## Do's and Don'ts

### Do:
- **Do** put every article on a slip: slip white, 1px subtle edge, 4px corner, slip shadow, 6px apart on the box ground.
- **Do** give every slip its mono address (feed initials, a middle dot, two-digit position in the current view), bold ink while unread.
- **Do** mark selection with an ink outline on the object (2px inset), leaving its surface white.
- **Do** keep `--focus-ring` equal to `--accent` and declare accent derivations on `body`, where the `[data-accent]` value actually lands.
- **Do** keep the accent keys `blue`, `teal`, `green`, `violet`, `rose`, `amber`, `slate`, each with a light and dark value and a matching swatch.
- **Do** reference roles (`--surface-*`, `--text-*`, `--ink-select`, `--accent`), never raw colours, in components.
- **Do** design and check every change in light and dark.
- **Do** self-host any face under an open licence and keep the reading measure at 62 to 76 characters per line.

### Don't:
- **Don't** move feeds and folders into a horizontal top bar; it clipped and was hard to read.
- **Don't** use the filing colour for links, selection fills, headings, scrollbars or decoration.
- **Don't** flood a selected slip, feed row or filter with colour; ink outline only.
- **Don't** add elevation beyond the slip shadow to resting surfaces.
- **Don't** use opacity to de-emphasise text; use graphite or pencil.
- **Don't** add tracked uppercase eyebrows or kickers above titles or groups.
- **Don't** request fonts, icons or scripts from a third-party host, or add a JS framework or bundler.
