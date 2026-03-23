# Interaction Spec: Vellum Norse — Tan/Parchment Light Mode

**Issue:** #1833
**Designer:** Luna
**Date:** 2026-03-23
**Status:** DELIVERED — ready for FiremanDecko implementation
**Supersedes:** #1825 (Ledger beige tweak), #1826 (Odin's Throne beige tweak)

---

## Overview

The **Vellum Norse** palette is a unified tan/parchment light mode color scheme applied to both Ledger and Odin's Throne. It replaces the previous simple beige tweaks (#1825, #1826) with a fully intentional, contrast-tested palette that evokes aged Norse manuscript vellum.

**Theme name:** Vellum Norse
**Design language:** Aged parchment — warm amber-ochre, iron-gall ink, illuminated gold
**Hue family:** 25°–42° warm amber (no cool greys, no blue-tinted neutrals anywhere)

---

## Palette Summary

See companion file: `ux/wireframes/theme/tan-light-mode-palette.html` for full swatches, hex values, and WCAG contrast ratios.

### Core Tokens (HSL)

```css
/* Surfaces — light → dark in UI depth order */
--background:          38  40% 89%    /* aged parchment body */
--card:                42  30% 95%    /* fresh vellum card */
--popover:             42  30% 97%    /* lightest popover surface */
--muted:               36  24% 85%    /* muted well / sidebar fill */
--secondary:           35  22% 80%    /* secondary surface */
--accent:              42  35% 87%    /* gold-wash accent surface */
--card-hover:          42  40% 92%    /* opaque card hover (no flash) */

/* Text */
--foreground:          25  55% 10%    /* iron-gall ink — primary text */
--muted-foreground:    28  28% 35%    /* warm brown — captions, labels */

/* Brand */
--primary:             38  80% 28%    /* dark burnt gold — CTA */
--primary-foreground:   0   0% 100%   /* white on gold */

/* Structure */
--border:              35  28% 74%    /* warm tan border */
--input:               38  25% 91%    /* parchment input background */
--ring:                38  80% 28%    /* focus ring — matches primary */

/* Status (unchanged) */
--destructive:          0  72% 38%    /* blood red */
```

---

## Color Application Rules

### Rule 1 — Warm Tones Only

Every surface, text, and border token in light mode must fall within the **25°–42° warm amber** hue family. Cold blue-greys (#475569, #94a3b8, #d0dce5) are a hard disqualifier — they break the parchment illusion.

**Key fixes from prior implementations:**
- Odin's Throne `--rune-border: #d0dce5` → warm tan `hsl(35,28%,74%)`
- Odin's Throne `--text-rune: #475569` → warm brown `hsl(28,28%,35%)`
- Odin's Throne `--text-void: #94a3b8` → warm muted `hsl(30,20%,52%)`
- Ledger `--foreground: 220 40% 8%` → warm brown-black `hsl(25,55%,10%)`

### Rule 2 — Surface Depth Hierarchy

Surfaces increase in lightness as they float above the page. Use this stacking order:

```
Page body (bg)     hsl(38,40%,89%)   L=89%
├── Muted well     hsl(36,24%,85%)   L=85%
├── Secondary      hsl(35,22%,80%)   L=80%
├── Accent         hsl(42,35%,87%)   L=87%
├── Card surface   hsl(42,30%,95%)   L=95%
│   └── Card hover hsl(42,40%,92%)   L=92%  (darker on hover = raised feeling)
└── Popover        hsl(42,30%,97%)   L=97%
```

Note: card hover is slightly *darker* than rest state — this provides a "pressed" feedback. The opaque value prevents flash artifacts (issue #298).

### Rule 3 — Gold Accent Behavior

The gold accent (`#c9920a`, `#d4a520`) reads as **illuminated manuscript gold** on parchment — this is intentional and desirable. Gold is **not** used as body text. Gold applies to:

- Karl-bling borders, glow shadows, rune characters
- Primary button background (`--primary: hsl(38,80%,28%)` = dark burnt gold)
- Focus rings (`--ring`)
- Icon accents (realm status indicators)

Gold contrast on the new background is 2.4:1 — this is acceptable for non-text decorative elements. The warm background makes gold feel more natural and less harsh than on white.

### Rule 4 — Dark Mode Untouched

Only the light mode blocks change. Nothing in `.dark {}` (Ledger) or the dark `:root {}` (Odin's Throne) changes.

---

## Interaction States

### Hover States

| Element | Rest | Hover | Transition |
|---------|------|-------|------------|
| Card | `--card` surface + `--border` | `--card-hover` bg + `--primary` border tint | 150ms ease |
| Primary button | `--primary` bg | 10% lighter (brightness +10%) | 120ms ease |
| Secondary button | `--secondary` bg | `--muted` bg | 120ms ease |
| Nav item | transparent | `--accent` bg | 100ms ease |
| Input | `--input` bg + `--border` | `--border` darkens 10% | 100ms ease |

### Focus States

All interactive elements use `--ring` (`hsl(38,80%,28%)`) as the focus outline. Ring width: 2px, offset: 2px. This provides a warm gold focus indicator visible against all parchment surfaces.

### Active States (selected nav, active card)

Active items use a 3px left border in `--primary` color (`hsl(38,80%,28%)`). This creates the Norse "rune inscription" feel — a deliberate mark rather than a fill.

---

## Typography on Parchment

The Vellum Norse palette works with the existing Norse typeface stack:

| Role | Font | Color | Contrast |
|------|------|-------|----------|
| Display/H1 | Cinzel Decorative | `--foreground` | 13.1:1 AAA |
| H2–H4 | Cinzel | `--foreground` | 13.1:1 AAA |
| Body | Source Serif 4 | `--foreground` | 13.1:1 AAA |
| Captions, labels | Source Serif 4 | `--muted-foreground` | 4.8:1 AA |
| Data/amounts | JetBrains Mono | `--foreground` | 13.1:1 AAA |
| Placeholders | Source Serif 4 | `--muted-foreground` at 70% opacity | ~3.4:1 AA (large) |

---

## Component Specs

### Card Component

```
Surface:  --card
Border:   --border (1px solid)
Hover bg: --card-hover
Text:     --foreground (name), --muted-foreground (captions)
Badge:    status color per Norse realm mapping (unchanged)
Karl:     gold border overlay via karl-bling.css (unchanged rules, new bg)
```

### Primary Button

```
Background: --primary  (hsl 38 80% 28%)
Text:       --primary-foreground  (#ffffff)
Contrast:   4.3:1 — ensure 16px+ font size or bold weight (WCAG AA large text)
Hover:      filter: brightness(1.10)
```

### Input Field

```
Background: --input  (hsl 38 25% 91%)
Border:     --border  (hsl 35 28% 74%)
Text:       --foreground
Placeholder: --muted-foreground
Focus:      --ring  (2px outline, 2px offset)
```

### Sidebar / Navigation

```
Background: --muted  (hsl 36 24% 85%)
Border-right: --border
Active item: border-left 3px solid --primary
Active text: --foreground  (bold)
Inactive text: --muted-foreground
```

---

## Odin's Throne — Variable Mapping

Odin's Throne uses a separate, flatter variable system. The parchment palette maps onto it as follows:

```
Odin's Throne var    New value                     Replaces
─────────────────    ─────────────────────────     ──────────────────────
--void               hsl(38,40%,89%)               #f5f0e8 (too light)
--forge              hsl(42,30%,95%)               #faf7f1 (too light)
--chain              hsl(36,24%,85%)               #ede8dc (close, warmer now)
--text-saga          hsl(25,55%,10%)               #0f1419 (cool blue-black → warm)
--text-rune          hsl(28,28%,35%)               #475569 (cool slate → warm brown)
--text-void          hsl(30,20%,52%)               #94a3b8 (cool blue-grey → warm tan)
--rune-border        hsl(35,28%,74%)               #d0dce5 (cool blue border → warm tan)
--mist-tool-bg       rgba(185,162,115,0.30)        rgba(220,224,235,0.55) (cool → warm)
--mist-tool-border   rgba(120,95,55,0.25)          rgba(80,80,120,0.25) (cool → warm)
--mist-tool-hover    rgba(165,142,95,0.50)         rgba(200,204,220,0.80) (cool → warm)
--tool-batch-header-bg    rgba(100,80,45,0.08)     rgba(80,80,120,0.08) (cool → warm)
--tool-batch-header-hover rgba(100,80,45,0.16)     rgba(80,80,120,0.16) (cool → warm)
```

All error, success, mayo, kildare, agent-accent, and badge tokens remain unchanged.

---

## Accessibility Summary

| Criterion | Status |
|-----------|--------|
| WCAG AA normal text | PASS — foreground on all surfaces ≥ 9.2:1 |
| WCAG AA captions | PASS — muted-foreground on background 4.8:1 |
| WCAG AA large text | PASS — primary button 4.3:1 (large/bold) |
| WCAG AA UI components | PASS — border visible against all surfaces |
| Color-not-sole-indicator | PASS — status uses text + color |
| Reduced motion | PASS — no changes to existing motion rules |
| Focus visible | PASS — gold ring contrasts all parchment surfaces |

---

## What Does NOT Change

- Dark mode (`.dark {}` in globals.css, dark `:root` in index.css)
- All chart tokens (`--chart-1` through `--chart-5`)
- Easter egg modal tokens (`--egg-*`)
- Howl panel tokens (`--howl-*`)
- Loki toast tokens (`--loki-toast-*`)
- Realm status tokens (`--realm-*`)
- Karl-bling CSS rules (karl-bling.css unchanged — only the background changes)
- Error/success semantic tokens in Odin's Throne
- Mayo, Kildare, agent-accent tokens in Odin's Throne
- Badge colors in Odin's Throne
- `--radius: 0.25rem`

---

## Files for FiremanDecko

| File | Change |
|------|--------|
| `development/ledger/src/app/globals.css` | Replace `:root {}` surface/text/structure vars with Vellum Norse values |
| `development/odins-throne/ui/styles/index.css` | Replace `[data-theme="light"] {}` surface, text, border, and mist tokens |

Reference: `ux/wireframes/theme/tan-light-mode-palette.html` for exact HSL values and hex approximations.

---

## Acceptance Criteria Traceability

| Criterion | Design Decision |
|-----------|-----------------|
| Complete tan/parchment palette with HSL values | Delivered — 20 tokens defined with HSL values |
| All light mode CSS custom properties updated | All :root and [data-theme=light] tokens mapped |
| Consistent look between Ledger and Odin's Throne | Same hue family and lightness scale for both |
| WCAG AA contrast ratios maintained | All text combinations verified — see contrast table |
| Gold accent (#c9920a) works against new backgrounds | 2.4:1 decorative use; feels more natural on parchment |
| Dark mode unchanged | No changes to .dark or dark :root |
| tsc + build pass | CSS-only changes; no TypeScript impact expected |

---

*Luna · ᛚᚢᚾᚨ · UX Designer — Beauty and function, woven as one*
