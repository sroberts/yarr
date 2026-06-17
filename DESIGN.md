---
name: yarr
description: A single-binary, self-hostable feed reader — a news terminal for the feeds you chose.
colors:
  signal-blue: "#0080d4"
  signal-blue-deep: "#0067ab"
  instapaper-orange: "#ff6600"
  alert-red: "#e74c3c"
  alert-red-night: "#c0392b"
  light-surface: "#ffffff"
  light-canvas: "#f5f5f5"
  light-ink: "#212529"
  light-muted: "#6c757d"
  light-border: "#dee2e6"
  light-hover: "#f0f0f0"
  sepia-surface: "#f4f0e5"
  sepia-card: "#ede8d8"
  sepia-ink: "#433422"
  sepia-excerpt: "#5c4a33"
  sepia-muted: "#8a7a66"
  sepia-border: "#e0d6ba"
  night-surface: "#0e0e0e"
  night-card: "#1a1a2e"
  night-ink: "#d1d1d1"
  night-excerpt: "#aaaaaa"
  night-muted: "#888888"
  night-border: "#1a1a1a"
typography:
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.8rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "normal"
  reading-serif:
    fontFamily: "Georgia, serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  reading-mono:
    fontFamily: "SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  xs: "3px"
  sm: "4px"
  lg: "16px"
  pill: "1.5rem"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  toolbar: "2rem"
  toolbar-mobile: "3rem"
  touch: "44px"
components:
  toolbar-item:
    backgroundColor: "transparent"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.xs}"
    padding: "0.25rem 0.5rem"
  toolbar-item-active:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.light-surface}"
    rounded: "{rounded.xs}"
    padding: "0.25rem 0.5rem"
  selectgroup-item:
    backgroundColor: "transparent"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.sm}"
    padding: "0.375rem 0.5rem"
  selectgroup-item-selected:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.light-surface}"
    rounded: "{rounded.sm}"
    padding: "0.375rem 0.5rem"
  button-default:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.sm}"
    padding: "0.375rem 0.75rem"
  input:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.sm}"
    padding: "0.375rem 0.75rem"
  triage-card:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
    width: "400px"
  undo-toast:
    backgroundColor: "#141414"
    textColor: "{colors.light-surface}"
    rounded: "{rounded.pill}"
    padding: "0 0.25rem 0 1rem"
---

# Design System: yarr

## 1. Overview

**Creative North Star: "The News Terminal"**

yarr is a clean, just-the-facts instrument — a Bloomberg terminal for the feeds you chose. It is not a magazine, not a discovery engine, not a place to linger over chrome. The whole surface exists to move a backlog of unread items past your eyes quickly, let you keep the few that matter, and get out of the way. Density and speed are the aesthetic; the interface should feel like a well-worn CLI that happens to have a screen — instant, predictable, unsurprising.

Three columns carry the entire desktop experience (feeds → items → article), collapsing to one column at a time on a phone with no duplicate markup. Chrome is held to a 2rem toolbar band and a single 1px divider. There is exactly one accent color, and it never decorates — it only signals state (selected, active, focused). The reading surface is deliberately unstyled beyond legibility: the article is the content, the app is the frame.

This system explicitly rejects the ad-driven reader (Feedly and kin): no promoted content, no "discover" rails, no engagement nudges, no dopamine confetti. It also rejects the 2026 AI-cream aesthetic — no warm-neutral paper backgrounds, no tracked-uppercase eyebrows, no identical icon-heading-text card grids. yarr's three themes (light, sepia, night) are the identity; they are equal citizens, never "light plus two patches."

**Key Characteristics:**
- Information-dense, three-pane terminal that collapses to single-pane on mobile.
- One accent (Signal Blue), used only for state — selection, active, focus.
- Three first-class themes; every surface must read in all three.
- Keyboard is a primary path, not a power-user extra; visible focus is required.
- Flat by default; lift (shadow) is reserved for the two floating objects — the triage card and the undo toast.

## 2. Colors

A near-monochrome neutral field per theme, carrying a single functional accent. Color is information, not ornament.

### Primary
- **Signal Blue** (`#0080d4`): the one accent. Links in article content, the selected feed/item row, active filter toggles, the keyboard focus ring, and the "mark read" swipe affordance. Identical across all three themes. Its rarity is the point — if two things on screen are blue, one is wrong.
- **Signal Blue Deep** (`#0067ab`): the filled-state background variant. Use behind white text (selected row, active filter) where the standard accent only reaches ~3.9:1 against white; the deep step clears AA (~4.6:1).

### Secondary
- **Instapaper Orange** (`#ff6600`): the single non-accent functional color, reserved exclusively for the "save to Instapaper" action — the left-swipe pill and the save stat. Never used for anything else.

### Tertiary
- **Alert Red** (`#e74c3c`, night `#c0392b`): the offline banner and destructive/error text only.

### Neutral
The neutral ramp is theme-scoped. Each theme is a self-contained surface/ink/border triad:
- **Light** — surface `#ffffff`, canvas `#f5f5f5`, ink `#212529`, muted `#6c757d`, border/divider `#dee2e6`, hover wash `#f0f0f0`.
- **Sepia** — surface `#f4f0e5`, card `#ede8d8`, ink `#433422`, excerpt `#5c4a33`, muted `#8a7a66`, border `#e0d6ba`.
- **Night** — surface `#0e0e0e`, card `#1a1a2e`, ink `#d1d1d1`, excerpt `#aaaaaa`, muted `#888888`, border `#1a1a1a`.

### Named Rules
**The One Signal Rule.** Signal Blue is the only accent and it only ever means *state* — selected, active, focused, or a link. It never appears as decoration, a background flourish, or a brand flourish. Orange means one thing (Instapaper) and red means one thing (error/offline). Three functional colors, zero decorative ones.

**The Filled-State Rule.** When white text sits on the accent (selected row, active filter), use Signal Blue Deep (`#0067ab`), not Signal Blue — `#fff` on `#0080d4` is only ~3.9:1 and fails AA for normal text.

**The Three-Equal-Themes Rule.** Light, sepia, and night are equal citizens. Any new surface must be designed and contrast-checked in all three before it ships. Never design for light and patch the rest.

## 3. Typography

**Display / Body Font:** the platform system sans (`system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`). One family carries headings, labels, data, and UI.
**Reading Fonts (reader pane, user-selectable):** Georgia (serif) and SFMono-Regular/Menlo/Consolas (mono).

**Character:** Utilitarian and invisible. The UI never uses a display face; type hierarchy is built from weight and size on one neutral sans, so nothing competes with the article. The serif and mono options exist only inside the reading pane, as a reader preference, never in chrome.

Base font size is **15px** (`html { font-size: 15px }`); all rem values resolve against it.

### Hierarchy
- **Headline** (700, 1.8rem, 1.3): the article title in the reader pane. The single largest type in the app.
- **Title** (600, 1.25rem, 1.3): the triage-card article title; section emphasis.
- **Body** (400, 1rem, 1.5): item titles, article body, most UI text. Reader prose wrapped at `max-width: 60rem`.
- **Label** (400, 0.8rem): feed names, relative timestamps, counters, swipe hints — secondary metadata, often muted.

### Named Rules
**The No-Display-Face Rule.** UI labels, buttons, and data never use a display or decorative font. Hierarchy comes from weight (400/600/700) and size on one sans. A display font in chrome is a bug.

**The Reader-Only Serif Rule.** Georgia and the mono stack appear *only* in the article reading pane as a user preference. They never leak into toolbars, lists, or labels.

## 4. Elevation

Flat by default. The app is a field of 1px borders and tonal hover washes, not stacked cards — depth is conveyed by the column dividers and the selected-row fill, not by shadow. Two elements, and only two, float: the **triage card** and the **undo toast**. Everything else (toolbars, dropdowns, inputs) carries at most a hairline 1–2px shadow for affordance, not lift.

### Shadow Vocabulary
- **Hairline** (`box-shadow: 0 1px 2px rgba(0,0,0,0.1)`): default buttons and selects — a barely-there edge that says "pressable."
- **Inset field** (`box-shadow: inset 0 1px 1px rgba(0,0,0,0.07)`): form inputs — a recessed well.
- **Menu** (`box-shadow: 0 1px 5px rgba(0,0,0,0.07)`): the settings dropdown — just enough to separate it from the list beneath.
- **Floating card** (`box-shadow: 0 4px 24px rgba(0,0,0,0.12)`): the triage card — the one genuinely lifted reading surface.
- **Toast** (`box-shadow: 0 4px 16px rgba(0,0,0,0.25)`): the undo toast — sits above everything in the thumb zone.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadow is reserved for the two objects that literally float over content (triage card, undo toast) and for hairline pressable affordances. If a panel has a drop shadow "to look nice," remove it.

## 5. Components

### Buttons
- **Shape:** small radius — toolbar icon buttons `3px`, standard buttons `4px` (0.25rem).
- **Toolbar item (icon button):** transparent at rest, `#f0f0f0` hover wash (theme-scoped), `padding: 0.25rem 0.5rem`. **Active state fills with the accent and flips text to white** — this is the primary "selected/active" signal across the app.
- **Default button:** surface background, 1px `#ced4da` border, hairline shadow; active state flattens (`background: #f5f7f9`, shadow removed).
- **Link / ghost:** `color: inherit`, no border — used for menu toggles and inline actions.
- **Hover / Focus:** background wash on hover; keyboard focus shows a 2px Signal Blue `:focus-visible` ring (offset 2px; inset −2px inside clipped/scrolling containers). Pointer focus stays quiet.

### List rows (the selectgroup — signature)
- **Style:** the feed list and item list are radio inputs rendered as full-width rows. The native input is visually hidden (`opacity:0`); the `.selectgroup-label` is the visible row, `4px` radius, `0.375rem 0.5rem` padding.
- **State:** hover wash on the row; **selected row fills with the accent (use Signal Blue Deep behind the white text) ** — the same selection vocabulary as the active toolbar item.
- **Focus:** keyboard focus on the hidden radio surfaces an inset ring on its adjacent label.

### Inputs / Fields
- **Style:** surface background, `4px` radius, inset hairline shadow (recessed well).
- **Focus:** border shifts to Signal Blue; the `:focus-visible` ring applies. The bootstrap focus glow is suppressed in favor of the single ring system.

### Dropdown menu (settings)
- **Style:** surface panel, `0 1px 5px rgba(0,0,0,0.07)` menu shadow, `overflow: hidden`, max-height with scroll. Items are `0.375rem 1rem`, hover wash, dividers between concern-groups.
- **Note:** this menu currently carries many concerns (config, credentials, OPML, help, logout). Treat it as a candidate for a dedicated Settings surface, not a pattern to replicate.

### Triage card (signature, mobile core loop)
- **Corner style:** `16px` radius — the softest shape in the system, marking it as the one object you act on directly.
- **Background:** theme card surface (`#fff` / `#ede8d8` / `#1a1a2e`); excerpt text uses the dedicated `--card-excerpt` token (≥7:1 in every theme).
- **Shadow strategy:** Floating card (`0 4px 24px rgba(0,0,0,0.12)`) — see Elevation.
- **Behavior:** swipe right = mark read (Signal Blue pill); swipe left = save to Instapaper (Orange pill) or keep unread; tap = open the full article. A 4-second **undo toast** follows every swipe; the server write is deferred until that window closes. All swipe motion is suppressed under `prefers-reduced-motion`.

### Undo toast (signature)
- **Style:** dark pill (`rgba(20,20,20,0.92)`), white label, Signal-Blue-tinted "Undo" button (`#4db4ff` for contrast on the dark pill), `1.5rem` radius, Toast shadow.
- **Placement:** `position: fixed`, bottom-center thumb zone, with `env(safe-area-inset-bottom)` padding. The Undo button is a 44px touch target.

### Offline banner
- **Style:** full-width fixed bar at top, Alert Red (`#e74c3c`, night `#c0392b`), white bold text, slides in via transform. Honors safe-area inset.

### Named Rules
**The One Selection Vocabulary Rule.** "Selected / active" looks the same everywhere — accent fill, white text. The active filter, the selected feed, the selected item all use the identical treatment so the eye learns it once.

## 6. Do's and Don'ts

### Do:
- **Do** keep Signal Blue (`#0080d4`) for state only — selection, active, focus, links — and reach for Signal Blue Deep (`#0067ab`) whenever white text sits on the accent.
- **Do** design and contrast-check every new surface in light, sepia, AND night before shipping. Treat WCAG AA (4.5:1 body) as the floor.
- **Do** keep chrome to the 2rem toolbar band (3rem on mobile) and a single 1px divider. If a control isn't earning its place on the toolbar, move it to a menu or a keystroke.
- **Do** give every interactive element a full keyboard path and a visible `:focus-visible` ring; the keyboard is a primary path.
- **Do** provide a `@media (prefers-reduced-motion: reduce)` alternative for every animation (swipe, pull-to-refresh, spinners, toast).
- **Do** keep one type family in chrome; build hierarchy from weight and size.
- **Do** keep touch targets ≥44px on mobile.

### Don't:
- **Don't** add promoted content, "discover" rails, engagement nudges, or celebratory confetti/emoji. yarr is not Feedly; the user's feed list is the whole product.
- **Don't** drift the themes toward the AI-cream aesthetic — no warm-neutral paper/sand body backgrounds, no tracked-uppercase eyebrows above sections, no identical icon-heading-text card grids.
- **Don't** introduce a second accent or use the accent decoratively. Three functional colors (blue/orange/red), zero decorative ones.
- **Don't** use a display or decorative font anywhere in the UI; serif/mono live only inside the reader pane as a preference.
- **Don't** add drop shadows for looks. Flat by default; only the triage card and undo toast float.
- **Don't** use `border-left`/`border-right` greater than 1px as a colored accent stripe; use full borders, fills, or nothing.
- **Don't** ship a surface that's legible in light but muddy in sepia or night — that's the single most common regression here.
