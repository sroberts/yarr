---
name: yarr
description: A self-hosted feed reader whose triage loop is edited like a roll of film on a contact sheet.
colors:
  surface-base: "#FFFFFF"
  surface-raised: "#F1F2F4"
  surface-hover: "#E6E8EB"
  border-subtle: "#E1E3E7"
  border-strong: "#C3C7CD"
  text-primary: "#111214"
  text-secondary: "#4A4F57"
  text-tertiary: "#61666E"
  ink-select: "#111214"
  on-ink-select: "#FFFFFF"
  rebate: "#111214"
  rebate-text: "#8E939B"
  rebate-text-strong: "#FFFFFF"
  accent: "#C4201A"
  on-accent: "#FFFFFF"
  marker-on-rebate: "#FF6B5E"
  status-success: "#15803D"
  status-attention: "#B45309"
  status-error: "#C4201A"
  scrollbar-thumb: "#C3C7CD"
  scrollbar-thumb-hover: "#A3A8B0"
  surface-base-negative: "#16181B"
  surface-raised-negative: "#1D2024"
  surface-hover-negative: "#272B30"
  border-subtle-negative: "#2B2F35"
  border-strong-negative: "#3E434A"
  text-primary-negative: "#ECEDEF"
  text-secondary-negative: "#AEB3BA"
  text-tertiary-negative: "#8D939C"
  ink-select-negative: "#ECEDEF"
  on-ink-select-negative: "#16181B"
  rebate-negative: "#D3D6DA"
  rebate-text-negative: "#4E535B"
  rebate-text-strong-negative: "#111214"
  accent-negative: "#FF6B5E"
  on-accent-negative: "#16181B"
  marker-on-rebate-negative: "#C4201A"
  status-success-negative: "#4ADE80"
  status-attention-negative: "#FBBF24"
  status-error-negative: "#FF6B5E"
  scrollbar-thumb-negative: "#3E434A"
  scrollbar-thumb-hover-negative: "#555B63"
  marker-blue: "#2563EB"
  marker-blue-negative: "#5B8DEF"
  marker-teal: "#0F766E"
  marker-teal-negative: "#2DD4BF"
  marker-green: "#137337"
  marker-green-negative: "#4ADE80"
  marker-violet: "#7C3AED"
  marker-violet-negative: "#A78BFA"
  marker-rose: "#C4201A"
  marker-rose-negative: "#FF6B5E"
  marker-amber: "#A64B07"
  marker-amber-negative: "#FBBF24"
  marker-slate: "#475569"
  marker-slate-negative: "#94A3B8"
  instapaper: "#FF6600"
  toast-leader: "#111214"
typography:
  display:
    fontFamily: "'Literata Var', Georgia, 'Times New Roman', serif"
    fontSize: "1.6em"
    fontWeight: 600
    lineHeight: 1.2
  headline:
    fontFamily: "'Literata Var', Georgia, 'Times New Roman', serif"
    fontSize: "1.4rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "'Literata Var', Georgia, 'Times New Roman', serif"
    fontSize: "1.2rem"
    fontWeight: 400
    lineHeight: 1.6
  body-ui:
    fontFamily: "'Hanken Grotesk Var', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "'Hanken Grotesk Var', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  label:
    fontFamily: "'Hanken Grotesk Var', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.4
  frame-number:
    fontFamily: "'JetBrains Mono Var', SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.72rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.02em"
    fontFeature: "'tnum'"
  frame-tag:
    fontFamily: "'JetBrains Mono Var', SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "'tnum'"
  count:
    fontFamily: "'JetBrains Mono Var', SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.78rem"
    fontWeight: 400
    fontFeature: "'tnum'"
rounded:
  frame: "2px"
  sm: "3px"
  marker-ring: "50% 45% 55% 48%"
  swatch: "50%"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  rebate-w: "40px"
  rebate-w-phone: "34px"
  toolbar: "2rem"
  toolbar-touch: "3rem"
  touch-target: "44px"
  measure: "35em"
  measure-sans: "33em"
  measure-mono: "44em"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.sm}"
    padding: "0.375rem 0.75rem"
  button-default:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "0.375rem 0.75rem"
  button-default-active:
    backgroundColor: "{colors.surface-hover}"
  button-star:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.85rem"
    height: "2rem"
  toolbar-item:
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
  toolbar-item-hover:
    backgroundColor: "{colors.surface-hover}"
  toolbar-item-active:
    backgroundColor: "{colors.ink-select}"
    textColor: "{colors.on-ink-select}"
  feed-row:
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "0.375rem 0.5rem"
  feed-row-selected:
    backgroundColor: "{colors.ink-select}"
    textColor: "{colors.on-ink-select}"
  frame-row-selected:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.text-primary}"
  rebate-band:
    backgroundColor: "{colors.rebate}"
    textColor: "{colors.rebate-text}"
    typography: "{typography.frame-number}"
    width: "{spacing.rebate-w}"
  frame-tag:
    backgroundColor: "{colors.rebate}"
    textColor: "{colors.rebate-text-strong}"
    typography: "{typography.frame-tag}"
    rounded: "{rounded.frame}"
    padding: "0.1rem 0.3rem"
  triage-card:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "1.5rem 1.5rem 1.5rem calc(40px + 1.25rem)"
    width: "640px"
  input:
    backgroundColor: "{colors.surface-base}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "0.375rem 0.75rem"
  menu:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 0"
  segmented-active:
    backgroundColor: "{colors.ink-select}"
    textColor: "{colors.on-ink-select}"
    height: "44px"
  toast:
    backgroundColor: "{colors.toast-leader}"
    textColor: "{colors.on-ink-select}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
---

# Design System: yarr

## Overview

**Creative North Star: "The Contact Sheet"**

Triage is editing a roll of film. Every article in the list is a numbered frame printed beside a solid rebate band; the frames you have not looked at print bright, the ones you have fade, keepers are ringed with a china marker, and the article you open is the enlargement. The board the sheet lies on is cool grey, the print itself is photo-paper white, and nothing else in the chrome asks for attention. Density is a working editor's density: tight rows, a 2rem toolbar at the desk, 44px targets under a thumb.

The two themes are co-equal and are one material read two ways. The light theme is **the print**: white paper, black rebate, deep marker. The dark theme is **the negative**: graphite paper, a light rebate, and a brighter marker. Every component references roles only (`--surface-*`, `--text-*`, `--border-*`, `--ink-select`, `--rebate*`, `--accent`), so a component written once is correct in both.

Colour carries exactly two jobs. Ink (`--ink-select`) is selection: whatever is chosen right now is inverted. The marker (`--accent`) is judgement: keepers, links and focus, nothing else. The marker is the user's own pen, one of seven colours, red by default. The system rejects the grey-sidebar, blue-accent three-pane reader with dot-only unread state that this world replaced.

**Key Characteristics:**
- A solid rebate band down the article list's left edge, carrying two-digit mono frame numbers that scroll with the rows.
- Selection is ink (black on the print, near-white on the negative), never the marker.
- The marker colour (`--accent`) appears only for keeper state, links and keyboard focus.
- Hanken Grotesk for the interface, Literata for reading, JetBrains Mono for numbers only.
- Corners are cut square and only softened (3px); the one curve is the hand-drawn keeper ring.
- Flat surfaces stepped by tone; shadows exist only on things that float above the sheet.

## Colors

A near-achromatic graphite-and-paper palette with one user-chosen marker ink; every value has a print (light) and a negative (dark) counterpart, and the negative keys carry the `-negative` suffix in the frontmatter.

### Primary
- **Marker Red** (`accent`, `accent-negative`): the china marker. Starred-state icons, the keeper ring, the Star button's outline and label, links, and the keyboard focus ring. The default is the `rose` option; the negative swaps to a brighter red so the mark keeps its weight on graphite. `on-accent` flips from white (print) to near-black graphite (negative).
- **Marker on Rebate** (`marker-on-rebate`, `marker-on-rebate-negative`): the ring drawn on the rebate band takes whichever marker value contrasts with the band, the bright value on the black rebate and the deep value on the light one. Every marker ring clears the 3:1 non-text floor against its band (red: 6.7:1 on the print rebate, 4.0:1 on the negative rebate).

### Marker options
Seven user-selectable pens, keyed by the `data-accent` attribute on `<body>`. Each is a deep value for the print and a bright value for the negative (`marker-<key>` / `marker-<key>-negative`), and each carries its own `--marker-on-rebate` as the opposite value of its pair. Per the token comment, every pair clears AA as text on both the base and raised surfaces of its theme. Keys: blue, teal, green, violet, rose (labelled "red", the default), amber, slate (labelled "graphite"). Settings swatches preview the theme-correct value of each and mark the chosen one with a check glyph in `on-accent` plus a `text-primary` border, so the choice survives grayscale.

### Secondary
- **Instapaper Orange** (`instapaper`): the one fixed brand colour, identical in both themes. It belongs to Instapaper as a destination (the swipe-left action pill and the triage stats count), not to the system.

### Neutral
- **Photo Paper** (`surface-base`): the print itself, meaning the article list, the reader, the triage card and input wells. Negative: graphite paper.
- **Grey Board** (`surface-raised`): the board the sheet lies on, meaning the feed sidebar, the triage backdrop, menus, modals and code blocks.
- **Board Hover** (`surface-hover`): pointer hover on rows and controls, and the quiet selected feed row while an article is open.
- **Hairline** (`border-subtle`): column dividers, menu and modal edges, dividers inside the palette and settings. **Edge** (`border-strong`): button and input outlines, the triage card's edge, blockquote rules.
- **Text tiers** (`text-primary`, `text-secondary`, `text-tertiary`): documented in the token layer at 18.7:1, 8.2:1 (7.4:1 on raised) and 5.8:1 (5.2:1 on raised, 4.7:1 on hover) on the print; 15.2:1, 8.4:1 (7.8:1 on raised) and 5.8:1 (5.3:1 on raised, 4.6:1 on hover) on the negative. Primary and secondary are AAA; tertiary is the AA floor for meta, placeholders and captions.
- **Ink** (`ink-select` / `on-ink-select`): selection. It is the same value as `text-primary` and inverts against it.
- **Rebate** (`rebate`, `rebate-text`, `rebate-text-strong`): the film edge. On the print the band is black, with frames already seen at `rebate-text` (6.1:1) and unread frames in white; on the negative the band turns light grey and the numbers go dark (seen frames 5.3:1).
- **Status** (`status-success`, `status-attention`, `status-error`): feed-health and destructive-action colour. On the print `status-error` shares the red marker's value.
- **Toast Leader** (`toast-leader`): the always-dark background of toasts in both themes.

### Named Rules
**The Ink Selects, The Marker Judges Rule.** Selection (the active feed, the checked segment, the highlighted palette row, the toggled toolbar button) is always `ink-select` with `on-ink-select`. The marker is never used to show selection, and ink is never used to show a keeper.

**The Marker's Three Jobs Rule.** `--accent` paints exactly three things: keeper state, links, and keyboard focus. If a new element wants the marker and is none of those, it doesn't get it.

**The Roles Only Rule.** Components reference role tokens, never raw hex values. The marker derivations (`--accent-hover`, `--focus-ring`) are declared on `body`, not `:root`, so they resolve against the selected `data-accent`.

## Typography

**Display Font:** Literata (with Georgia, Times New Roman, serif)
**Body Font:** Literata for reading; Hanken Grotesk (with system-ui) for the interface
**Label/Mono Font:** JetBrains Mono (with SFMono-Regular, Menlo, Consolas)

**Character:** Hanken Grotesk is a plain, slightly warm grotesk that keeps the chrome quiet. Literata is a bookish screen serif that makes the enlargement read as print. JetBrains Mono is the film-edge stamp, used where a number has to sit in a column. All three are self-hosted variable OFL fonts split into latin and latin-ext ranges (Literata also ships its italic). The root size is 15px.

### Hierarchy
- **Display** (Literata 600, 1.6em of the reading size, line-height 1.2): the reader's article title, balanced. Its size scales with the user's reading-size control.
- **Headline** (Literata 600, 1.4rem, 1.25): the triage card's article title, balanced.
- **Body** (Literata 400, 1.2rem by default, line-height 1.6, measure 35em): reader prose. In-article h2 and h3 are 1.4em and 1.2em. The user can switch the reader to sans or mono; sans (Hanken Grotesk, narrower) takes 33em and mono widens to 44em, so all three carry ~71 characters per line. The triage excerpt uses Literata at 1rem/1.6 in `text-secondary`.
- **Body UI** (Hanken Grotesk 400, 1rem, 1.5): the interface, meaning feed names, read article titles and menus.
- **Title** (Hanken Grotesk 600, 1rem): unread article titles in `text-primary`, against read titles at 400 in `text-secondary`. Weight is the unread signal.
- **Label** (Hanken Grotesk 400, 0.75 to 0.875rem): row meta, bylines (0.8em, `text-tertiary` with the feed name at 600 in `text-secondary`), settings labels and the triage footer. Sentence case, no tracking.
- **Frame number** (JetBrains Mono 500, 0.72rem, tabular, +0.02em): numbers in the rebate band, set at 700 for unread frames. **Frame tag** (JetBrains Mono 600, 0.75rem) is the inverted number in "Frame 07 of 15". **Count** (JetBrains Mono, 0.78rem, tabular) is used for the sidebar's unread counts.

### Named Rules
**The Numbers Are Mono Rule.** JetBrains Mono sets numbers that line up (frame numbers, frame tags, counts) and code, and nothing else. Words are never set in mono outside code and the user's own mono reading choice.

**The Weight Is Unread Rule.** Unread is shown by weight (600 against 400) and a brighter frame number, and this signal survives grayscale. Opacity is never used to show that something has been read.

## Layout

A three-pane contact sheet on desktop: the feed sidebar on the grey board (300px by default, drag-resizable between 200 and 700px), the article list (the roll, also 300px by default), and the reader filling the rest. Columns are divided by hairlines that start below the toolbar. The toolbar is 2rem tall at 992px and above, and 3rem with 44px minimum controls below that.

The roll's rebate is drawn as the list's own background (a hard-stop gradient attached locally), so it runs the full scrolled length; rows are inset by the rebate width plus 0.5rem. The rebate is 40px wide, and 34px below 768px.

The reader centres a column capped at the measure (35em serif, 33em sans, 44em mono), sized in em so that changing the reading size never reflows the column's character count. Code blocks bleed 0.5rem past the measure on each side.

Breakpoints: 992px (three panes at or above; below it, panes show one or two at a time and touch sizing applies), 768px (phone: one pane at a time, the reader's secondary actions fold into an overflow menu, and a labelled previous/next bar sits in the thumb zone), 480px (modals go near-full-width). Triage mode takes the whole window at every width. On desktop the card is capped at 640px wide and centred with its action line and legend beneath it. On phones it is capped at 400px.

Spacing follows the 0.25 / 0.5 / 0.75 / 1 / 1.5rem steps. Touch targets are 44px on coarse pointers. A compact density setting tightens rows on fine pointers only.

## Elevation & Depth

The sheet is flat. Depth comes from tone: the board (`surface-raised`) sits behind the paper (`surface-base`), hover steps to `surface-hover`, and the rebate is the strongest tonal edge on screen. Outlines and rings do work that shadows would do elsewhere: the selected frame is a 2px inset ink outline and the keeper is a 2px marker ring. Shadows are reserved for things that float above the sheet.

### Shadow Vocabulary
- **Palette lift** (`box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4)`): the command palette over its dimmed backdrop.
- **Toast lift** (`box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25)`): the always-dark toast and the swipe-undo toast.
- **Menu hint** (`box-shadow: 0px 1px 5px rgba(0, 0, 0, 0.07)`): the settings dropdown.
- **Control press** (`box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1)`): the resting default button, which drops the shadow when pressed.

### Named Rules
**The Flat Sheet Rule.** Surfaces on the sheet (rows, cards, panes, the reader) carry no drop shadow. Only overlays (the palette, toasts, menus) lift.

## Shapes

Prints and frames are cut square: the system radius is 3px (`--radius`) on buttons, inputs, menus, modals, the triage card, toasts and segmented tracks, and 2px on the small stamps (frame numbers, frame tags). The one deliberate curve is the keeper ring, a slightly irregular ellipse (`border-radius: 50% 45% 55% 48%`, rotated -4deg) that reads as hand-drawn marker without going soft. Accent swatches are true circles, scrollbar thumbs are pills, and the login panel is 5px.

**The Square Print Rule.** Corners soften but never round. Anything that reads as a print, a frame or a control stays at 3px or less; only the hand-drawn marker ring and the swatches curve.

## Components

### Buttons
Quiet, square-cut and text-forward.
- **Shape:** softened corners (3px).
- **Primary:** a marker fill with `on-accent` text (0.375rem 0.75rem). It is used rarely.
- **Default:** paper fill, `border-strong` outline and the control-press shadow. Pressed, it steps to `surface-hover` and drops the shadow. Focused, the border goes to the marker.
- **Toolbar item:** transparent, 0.25rem 0.5rem padding, `surface-hover` on hover (real pointers only), inverted to ink when toggled on. Disabled controls take `text-secondary` at 0.7 opacity so they clear the 3:1 non-text floor in both themes.
- **Star (keeper verb):** a marker outline with marker text and a star icon on paper, weight 600, 2rem tall (44px on coarse pointers). It is the only labelled button in the triage legend.

### Chips and Tags
- **Frame tag:** an inverted rebate stamp (`rebate` background with `rebate-text-strong`, mono 600, 2px corners) inside "Frame 07 of 15". The reader's frame label sits beside previous/next, and when the open article is starred the tag gains the marker ring.
- **Command hint:** a hairline-bordered key hint at 0.75rem in `text-tertiary`. It inverts with its row when selected.

### Cards / Containers
- **Triage card (the print):** paper on the grey board, a `border-strong` edge, 3px corners, no shadow. It has its own strip of rebate down the left edge carrying the frame number in mono 700. Inside are the feed and date in label type, the domain, a Literata headline, and the excerpt as the one region that grows and scrolls. Tap or Enter expands the article inside the card. The card follows the finger while swiping, then snaps back or flies off over 0.3s ease.
- **Menus and modals:** the grey board (`surface-raised`) with a hairline edge and 3px corners.
- **Code blocks:** `surface-raised` with a hairline and 3px corners, and a right-edge fade while more code is hidden past the edge.

### Inputs / Fields
- **Style:** a paper well, `border-strong` outline, 3px corners, a faint inset (`inset 0 1px 1px rgba(0,0,0,0.07)`), and `text-tertiary` placeholders at full opacity. The toolbar search field is borderless and fills to `surface-hover` on hover and focus.
- **Focus:** the border turns to the marker, and keyboard focus adds the 2px marker ring.
- **Segmented control:** a `border-strong` track of equal 44px segments split by hairlines. The active segment is inverted to ink.

### Navigation
- **Feed sidebar:** feed and folder rows on the grey board (0.375rem 0.5rem padding, 3px corners) with mono unread counts in `text-secondary`. The selected row is inverted to ink, and its count inverts with it. While an article is open on desktop, the sidebar's selection steps down to `surface-hover` at weight 600, so the screen holds only one solid selection.
- **View switch:** icon toolbar items at the top of the sidebar (unread, starred, all, triage), with the active one inverted to ink.
- **Phone reader bar:** labelled previous/next buttons at 44px in `text-secondary` above the home indicator, divided from the article by a hairline.

### The Roll (signature component)
The article list as a strip of film. Each row is a frame: a label-type meta line (with a filled-dot icon for unread and a marker star for starred), then the title with weight carrying unread state. In the rebate band beside it sits a two-digit frame number (01, 02…), bright and bold when unread and faded once seen. A starred frame's number is ringed in `marker-on-rebate`. The selected frame is outlined with a 2px inset ink border on paper, its number becomes an inverted paper stamp, and its meta steps up to `text-secondary`. Frame numbers are decorative (`aria-hidden`), and the row announces its own state.

### Toasts
An always-dark pill (`toast-leader` with white text, 3px corners, toast lift), bottom-centre in the thumb zone. When an article is open on a phone it rises above the reader bar. The undo action is set at 600 weight in the marker lightened toward white, and its focus ring is white.

### Focus and Motion
- **Focus:** `:focus-visible` only. A 2px solid marker outline at a 2px offset, or inset at -2px inside clipped and scrolling containers (rows, menu items, the article, code blocks, segments). Pointer interaction never shows a ring.
- **Motion:** state colours ease over 0.12s. A newly opened article fades in and rises 4px over 0.18s. Toasts fade over 0.2s. The triage card snaps and flies over 0.3s ease. All motion collapses to instant under `prefers-reduced-motion` or the in-app Reduced setting.

## Do's and Don'ts

### Do:
- **Do** show selection in ink (`--ink-select` / `--on-ink-select`) in both themes.
- **Do** reserve `--accent` for keeper state, links and keyboard focus, and use `--marker-on-rebate` for any marker drawn on the rebate band.
- **Do** number frames with two-digit tabular mono (`01`, `02`…) and show unread state with weight and brightness, never with colour alone.
- **Do** design every new component against the print and the negative together, using role tokens only.
- **Do** keep corners at 3px (2px for stamps) and keep the sheet flat; lift only overlays.
- **Do** keep meta, placeholders and captions at `--text-tertiary` or stronger, never lowered with opacity.
- **Do** give touch controls a 44px minimum and confine hover feedback to `(hover: hover)`.

### Don't:
- **Don't** use the marker for selection, active tabs or toggled controls; selection is ink.
- **Don't** fill or flood the selected frame; outline it in ink.
- **Don't** set words in JetBrains Mono outside code and the user's mono reading choice.
- **Don't** round prints, cards or controls past 3px.
- **Don't** add drop shadows to rows, cards or panes on the sheet.
- **Don't** show unread with only a coloured dot; weight is the signal.
- **Don't** hard-code a colour in a component when a role token exists.
