---
name: yarr
description: A single-binary, self-hostable feed reader — a calm reading instrument for the feeds you chose.
tokens:
  # One semantic layer, two co-equal themes. Components reference ROLES,
  # never raw colors. Set on the theme class on <body>.
  light:
    surface-base: "#FFFFFF"
    surface-raised: "#F7F8FA"
    surface-hover: "#EEF1F5"
    border-subtle: "#E2E6EC"
    border-strong: "#C7CDD6"
    text-primary: "#16191D"   # ~15.8:1 — AAA
    text-secondary: "#4A515B" # ~8.3:1  — AAA
    text-tertiary: "#6B7280"  # ~5.1:1  — AA
    status-success: "#15803D"
    status-attention: "#B45309"
    status-error: "#DC2626"
    scrollbar-thumb: "#C7CDD6"
  dark:
    surface-base: "#0E1116"
    surface-raised: "#161B22"
    surface-hover: "#1F2630"
    border-subtle: "#262D38"
    border-strong: "#38414F"
    text-primary: "#E6EAF0"   # ~13.5:1 — AAA
    text-secondary: "#A4ADBA" # ~7.4:1  — AAA
    text-tertiary: "#6E7889"  # ~4.6:1  — AA
    status-success: "#4ADE80"
    status-attention: "#FBBF24"
    status-error: "#F87171"
    scrollbar-thumb: "#38414F"
accent:
  # Independent of theme. Each option: light value / dark override / on-accent.
  # --accent-hover and --focus-ring derive from --accent via color-mix.
  blue:   { light: "#2563EB", dark: "#5B8DEF" }   # default
  teal:   { light: "#0F766E", dark: "#2DD4BF" }
  green:  { light: "#15803D", dark: "#4ADE80" }
  violet: { light: "#7C3AED", dark: "#A78BFA" }
  rose:   { light: "#BE123C", dark: "#FB7185" }
  amber:  { light: "#B45309", dark: "#FBBF24" }
  slate:  { light: "#475569", dark: "#94A3B8" }
  on-accent: "white on light / near-black (#0E1116) on dark"
brand:
  instapaper: "#FF6600"   # the single fixed action color, both themes
  offline-banner: "#C2362C" # fixed deep red, white text clears AA in both themes
typography:
  # Self-hosted variable fonts (SIL OFL), embedded in the binary under fonts/.
  font-sans:  "'InterVar', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
  font-serif: "'Source Serif 4 Var', Georgia, 'Times New Roman', serif"
  font-mono:  "'JetBrains Mono Var', SFMono-Regular, Menlo, Consolas, monospace"
  base: "15px (chrome). Reading body defaults to 1.2rem (~18px), user-adjustable."
  scales:
    list-title:   { size: "15px", weight: "600 unread / 400 read" }
    list-meta:    { size: "12px", weight: 400 }
    article-h1:   { size: "1.6em", lineHeight: 1.2 }
    article-body: { size: "~18px (1.2rem default)", lineHeight: 1.6, measure: "70ch" }
rounded:
  base: "6px"   # --radius, applied globally
  lg: "16px"    # triage card
  pill: "1.5rem" # undo toast, action pills
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  toolbar: "2rem"
  toolbar-mobile: "3rem"
  touch: "44px"
components:
  toolbar-item-active:
    backgroundColor: "var(--accent)"
    textColor: "var(--on-accent)"
    rounded: "{rounded.base}"
  selectgroup-item-selected:
    backgroundColor: "var(--accent)"
    textColor: "var(--on-accent)"
    rounded: "{rounded.base}"
  button-default:
    backgroundColor: "var(--surface-base)"
    textColor: "var(--text-primary)"
    border: "1px solid var(--border-strong)"
    rounded: "{rounded.base}"
  input:
    backgroundColor: "var(--surface-base)"
    textColor: "var(--text-primary)"
    rounded: "{rounded.base}"
  dropdown-menu:
    backgroundColor: "var(--surface-raised)"
    border: "1px solid var(--border-subtle)"
  triage-card:
    backgroundColor: "var(--surface-raised)"
    textColor: "var(--text-primary)"
    border: "1px solid var(--border-subtle)"
    rounded: "{rounded.lg}"
    width: "400px"
  undo-toast:
    backgroundColor: "rgba(20,20,20,0.92)"  # always dark
    textColor: "#fff"
    rounded: "{rounded.pill}"
---

# Design System: yarr

## 1. Overview

**Creative North Star: "The Calm Reading Instrument"**

yarr is a clean, just-the-facts instrument — a terminal for the feeds you chose.
It is not a magazine, not a discovery engine, not a place to linger over chrome.
The whole surface exists to move a backlog of unread items past your eyes
quickly, let you keep the few that matter, and get out of the way. The interface
earns trust by getting out of the way, ranking information ruthlessly, and never
moving or shouting without a reason the user caused.

Three columns carry the entire desktop experience (feeds → items → article),
collapsing to one column at a time on a phone with no duplicate markup. Chrome is
held to a 2rem toolbar band and a single 1px divider. There is exactly one accent
color at a time, and it never decorates — it only signals state (selected, active,
focused, link). The reading surface is deliberately unstyled beyond legibility:
the article is the content, the app is the frame.

This system rejects the ad-driven reader (Feedly and kin): no promoted content,
no "discover" rails, no engagement nudges. It also rejects the 2026 AI-cream
aesthetic — no warm-neutral paper backgrounds, no tracked-uppercase eyebrows, no
identical icon-heading-text card grids.

**Key Characteristics:**
- Information-dense, three-pane terminal that collapses to single-pane on mobile.
- **One semantic token layer, two co-equal themes (light / dark).** Components
  reference roles (`--surface-*`, `--text-*`, `--accent`), never raw colors.
- **A user-selectable accent** (seven options, blue default), independent of
  theme; used only for state. Plus user controls for density and motion.
- Keyboard is a primary path, not a power-user extra; visible focus is required.
- Flat by default; lift (shadow) is reserved for the two floating objects — the
  triage card and the undo toast.

## 2. Colors

A near-monochrome neutral field per theme, carrying a single functional accent.
Color is information, not ornament.

### The token layer
Every color is a semantic role defined once per theme on the `.theme-light` /
`.theme-dark` class. Surfaces step `base → raised → hover`; text steps
`primary → secondary → tertiary`; borders step `subtle → strong`. Elevation is a
**surface step plus a 1px border**, never a heavy shadow. All values are
contrast-checked: body text targets AAA (7:1), all UI text clears AA (4.5:1).

### Accent (selectable)
The accent is the one chromatic color in the chrome, chosen by the user from
seven options (blue default). Each option carries a **light value and a deliberate
dark override** (a mid-blue that passes on white fails on near-black), plus
`--on-accent` for text on an accent fill — white on the deep light values,
near-black on the bright dark values. `--accent-hover` and `--focus-ring` derive
from `--accent` via `color-mix`, so adding an accent is just two hex values.

### Functional / brand
- **Instapaper Orange** (`--instapaper: #FF6600`): the single fixed action color,
  reserved for the "save to Instapaper" affordance. Identical in both themes.
- **Status** (`--status-success` / `--status-attention` / `--status-error`):
  tuned per theme; **never the sole carrier of meaning** — always paired with an
  icon, label, or weight change.
- **Offline banner** (`#C2362C`): a fixed deep red with white text that clears AA
  in both themes (it's a fill, not text, so it doesn't use the status token).

### Named Rules
**The One Accent Rule.** The accent only ever means *state* — selected, active,
focused, or a link. It never appears as decoration. If two unrelated things on
screen carry the accent, one is wrong.

**The Token Rule.** Components reference roles, never raw hex. A literal color in
a component rule is a bug — it won't survive the other theme.

**The Two-Equal-Themes Rule.** Light and dark are co-equal. Any new surface is
designed and contrast-checked in both, across every accent, before it ships.
Never design for light and patch dark.

## 3. Typography

This is a reading application, so type is the product, not decoration.

**UI / body:** **Inter** (variable, self-hosted) — one family carries headings,
labels, data, and UI. **Reading fonts (reader pane, user-selectable):** **Source
Serif 4** (serif) and **JetBrains Mono** (mono), both variable and self-hosted.
All three are SIL OFL, embedded in the binary (`src/assets/fonts/`) — no
third-party requests, consistent with local-first.

Base font size is **15px** for chrome (`html { font-size: 15px }`). The reading
body defaults to **~18px** (`theme.size` 1.2rem) and is user-adjustable; article
headings use `em` so they scale with it.

### Hierarchy
- **Article h1** (1.6em, line-height 1.2): the reader-pane title — the single
  largest type in the app; scales with the reading-size control.
- **Article body** (~18px, line-height 1.6): reader prose, **capped at a 70ch
  measure** regardless of window width and centered.
- **List title** (15px; 600 when unread, 400 when read): item-list headlines.
  The weight shift *is* the unread signal (survives grayscale).
- **List meta** (12px): feed names, timestamps, counters — `--text-tertiary`.

### Named Rules
**The No-Display-Face Rule.** UI labels, buttons, and data never use a display
font; hierarchy comes from weight and size on Inter.

**The Reader-Only Serif/Mono Rule.** Source Serif 4 and JetBrains Mono appear
*only* in the article reading pane (and `<pre>`), as a user preference. They
never leak into toolbars, lists, or labels.

**The Measure Rule.** Article body never exceeds ~70ch per line. Full-width prose
on a wide monitor is the most common reading-app failure.

## 4. Elevation

Flat by default. Depth is conveyed by the **surface step** (`raised` over `base`)
plus a 1px `--border-subtle`, not by shadow. Two elements, and only two, float:
the **triage card** and the **undo toast**. Reject heavy drop shadows and
glassmorphism in both themes — they barely read on dark and cost contrast on
light.

### Shadow Vocabulary
- **Hairline** (`0 1px 2px rgba(0,0,0,0.1)`): default buttons/selects.
- **Inset field** (`inset 0 1px 1px rgba(0,0,0,0.07)`): form inputs.
- **Menu** (`0 1px 5px rgba(0,0,0,0.07)`): the settings dropdown.
- **Floating card** (`0 4px 24px rgba(0,0,0,0.12)`): the triage card.
- **Toast** (`0 4px 16px rgba(0,0,0,0.25)`): the undo toast.

## 5. Components

A single global radius (`--radius: 6px`) applies to buttons, inputs, menus, and
rows; the triage card (16px) and pills/toast (1.5rem) are the only exceptions.

### Buttons
- **Toolbar item (icon button):** transparent at rest, `--surface-hover` wash on
  hover. **Active fills with `--accent`, text flips to `--on-accent`** — the
  primary "selected/active" signal across the app.
- **Default button:** `--surface-base`, 1px `--border-strong`, hairline shadow;
  active flattens to `--surface-hover`.
- **Focus:** keyboard `:focus-visible` shows a 2px `--focus-ring` (the accent),
  offset 2px (inset −2px inside clipped/scrolling containers). Pointer focus
  stays quiet.

### List rows (the selectgroup — signature)
Feed list and item list are radio inputs rendered as full-width rows; the native
input is visually hidden and the `.selectgroup-label` is the visible row.
**Selected fills with `--accent` / `--on-accent`** — the same vocabulary as the
active toolbar item. Compact density tightens row padding on fine pointers only;
touch keeps 44px targets.

### Inputs / Dropdown / Modal
Inputs sit on `--surface-base` with an inset hairline; focus border shifts to
`--accent`. The settings dropdown and modals are **raised** surfaces
(`--surface-raised` + `--border-subtle`). The settings menu hosts the
theme (light/dark), accent picker (7 swatches), density, and motion controls.

### Triage card (signature, mobile core loop)
16px radius — the softest shape in the system. Background `--surface-raised`,
1px `--border-subtle`, Floating-card shadow. Swipe right = mark read (accent
tint, derived from `--accent` via `color-mix`); swipe left = save to Instapaper
(`--instapaper` tint) or keep unread; tap = open. A 4-second **undo toast**
follows every swipe; the server write is deferred until that window closes. All
swipe motion is suppressed under reduced-motion.

### Undo toast (signature)
Always-dark pill (`rgba(20,20,20,0.92)`), white label, "Undo" button colored from
the active accent lightened 35% toward white (`color-mix`) for legibility on the
dark pill, 1.5rem radius. Fixed bottom-center thumb zone; 44px touch target.

### Named Rules
**The One Selection Vocabulary Rule.** "Selected / active" looks the same
everywhere — accent fill, on-accent text. The eye learns it once.

## 6. Motion

Functional or gone (150–250ms). Permitted: state-change confirmation, skeleton-
to-content, pane expand/collapse, mark-as-read. Banned: load-time entrances,
attention loops, parallax, scroll-triggered reveals. Motion honors **both** the
OS `prefers-reduced-motion` and an in-app toggle (`body[data-motion="reduce"]`),
so users can force it off regardless of system setting.

## 7. Do's and Don'ts

### Do:
- **Do** reference tokens (`var(--accent)`, `var(--surface-raised)`, …), never
  raw hex, in component rules.
- **Do** keep the accent for state only — selection, active, focus, links — and
  pair status/unread with weight, icon, or label (verify in grayscale).
- **Do** design and contrast-check every new surface in light AND dark, across
  every accent, before shipping. AAA body, AA UI.
- **Do** cap reading measure at ~70ch and keep chrome to the 2rem toolbar band
  and a single 1px divider.
- **Do** give every interactive element a full keyboard path and a visible
  `--focus-ring`; keep touch targets ≥44px.
- **Do** provide a reduced-motion alternative for every animation.

### Don't:
- **Don't** add promoted content, "discover" rails, engagement nudges, or
  confetti. The user's feed list is the whole product.
- **Don't** drift toward the AI-cream aesthetic — no warm-neutral paper
  backgrounds, no tracked-uppercase eyebrows, no identical card grids.
- **Don't** introduce a second simultaneous accent or use the accent
  decoratively.
- **Don't** use a display font in chrome; serif/mono live only in the reader.
- **Don't** add drop shadows for looks. Flat by default; only the triage card
  and undo toast float.
- **Don't** use `border-left`/`border-right` > 1px as a colored accent stripe.
- **Don't** ship a surface that's legible in light but muddy in dark — the most
  common regression here.
