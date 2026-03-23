# Interaction Spec: Void Norse — Dark Theme Contrast Fix

**Issue:** #1875
**Designer:** Luna
**Date:** 2026-03-23
**Status:** DELIVERED — ready for FiremanDecko implementation
**Scope:** Dark theme only — light theme (Vellum Norse) is untouched

---

## Overview

The **Void Norse** dark theme has two compounding problems: border colors that are virtually invisible against the void-black background, and border strokes that are universally too thin (1px). This spec defines the corrective changes to CSS custom properties and component-level thickness overrides.

**Theme name:** Void Norse
**Design language:** Norse war-room — forge-lit gold embers, ink-black stone, warm charcoal depth
**Hue family:** 20°–30° warm charcoal (no blue-grey drifts in corrected tokens)

---

## Root Problem

The current `--border` token (`hsl(22, 8%, 20%)`) sits only 13 lightness points above the background (`hsl(28, 15%, 7%)`). This produces a contrast ratio of approximately **1.4:1** — below the WCAG 1.4.11 minimum of 3:1 for non-text UI components. Combined with 1px stroke width, card edges, tab separators, button outlines, and divider lines are essentially invisible on screen.

---

## Palette Changes

See companion file: `ux/wireframes/theme/dark-void-palette.html` for full swatches, hex approximations, contrast ratios, and before/after UI demos.

### Tokens to Change (`.dark {}` block only)

```css
/* ── Structure — CHANGED ─────────────────────────────────────── */
--border:             28 22% 40%;    /* was: 22  8% 20% — invisible seam → visible 3.1:1 */
--muted:              25 12% 20%;    /* was: 20  7% 27% — cleaner surface tier */
--secondary:          22 10% 22%;    /* was: 22  8% 20% — lift from border identity */
--input:              25 10% 14%;    /* was: 20  7% 27% — sunken below card for field boundary */

/* ── Text — CHANGED ─────────────────────────────────────────── */
--muted-foreground:   30 14% 65%;    /* was: 30 11% 58% — lifted to 7.8:1 AAA on bg */
```

### Tokens That Do NOT Change

```css
/* ── Surfaces — UNCHANGED ────────────────────────────────────── */
--background          /* 28 15%  7% — void black — correct as-is */
--card                /* 25 14% 10% — forge — correct as-is */
--popover             /* 20  9% 13% — chain — correct as-is */
--card-hover          /* 30 18% 11% — opaque hover (Issue #298) — correct */

/* ── Brand — UNCHANGED ───────────────────────────────────────── */
--primary             /* 42 75% 48% — brighter gold — correct */
--primary-foreground  /* 28 15%  7% — void black on gold — correct */

/* ── Core text — UNCHANGED ───────────────────────────────────── */
--foreground          /* 40 27% 91% — light parchment — 15.9:1 AAA */
--destructive         /* 22 88% 41% — Muspelheim fire — unchanged */
--ring                /* 42 75% 48% — gold focus ring — unchanged */

/* ── Extended tokens — ALL UNCHANGED ─────────────────────────── */
/* --chart-*, --egg-*, --howl-*, --loki-toast-*, --realm-* */
```

---

## Border Thickness Requirements

Thickness is applied via component-level overrides in the `.dark` class scope. Not via CSS custom properties. See the component table below.

### Per-Element Specification

| Element | Current | Required (dark only) | Implementation |
|---------|---------|---------------------|----------------|
| Card, CardContent, ValhallaCardTile | 1px | **2px** | `.dark .card { border-width: 2px; }` or `dark:border-2` |
| Modal / Dialog outline | 1px or none | **2px** | `.dark [role="dialog"] { border: 2px solid hsl(var(--border)); }` |
| Tabs separator (TabsList bottom line) | 1px | **1.5px** | `.dark [data-radix-tabs-list] { border-bottom-width: 1.5px; }` |
| Tab active indicator (bottom border) | 2px | **2px** | No change — already correct thickness |
| Secondary / outline button border | 1px | **1.5px** | `.dark .btn-outline, .dark .btn-secondary { border-width: 1.5px; }` |
| Divider / Separator (horizontal) | 1px height | **1.5px height** | `.dark [data-radix-separator] { height: 1.5px; }` |
| Divider / Separator (vertical) | 1px width | **1.5px width** | `.dark [data-radix-separator][data-orientation=vertical] { width: 1.5px; }` |
| Input / Textarea / Select border | 1px | **1.5px** | `.dark input, .dark textarea, .dark select { border-width: 1.5px; }` |
| Nav sidebar border-right | 1px | **1.5px** | `.dark [data-slot="sidebar"] { border-right-width: 1.5px; }` |
| Footer top border | 1px | **1.5px** | `.dark footer { border-top-width: 1.5px; }` |
| Table row separators | 1px | **1px** | No change — internal grid lines intentionally lighter |
| Focus ring (all interactive) | 1px outline | **no change** | Box-shadow focus treatment already correct in globals.css |

### Thickness Design Rationale

A 1px line at 3:1 contrast reads as equivalent visual weight to a 2px line at 1.7:1 contrast in a dark theme. Since we are correcting the contrast ratio to 3.1:1 AND increasing thickness, the combined effect is substantially more visible. The result should feel like clear structural delineation rather than decoration.

The 0.5px step from 1px to 1.5px is deliberate:
- On high-DPI (Retina 2x) screens, 1.5px renders as 3 physical pixels — guaranteed full-pixel rendering
- On standard 1x screens, 1.5px rounds to 2px — still a step up
- Using 1.5px for secondary elements and 2px for cards creates a visual hierarchy without looking heavy

---

## Color Application Rules

### Rule 1 — Warm Tones Only

All corrected tokens remain in the **20°–30° warm charcoal** hue range. No cool blue-grey drifts. The border correction lifts to H=28° (from H=22°) — slightly warmer, slightly more amber, consistent with the forge/hearth aesthetic.

### Rule 2 — Surface Depth Hierarchy (dark mode)

In dark mode, surfaces get lighter as they float above the base. The corrected tier:

```
Page body (bg)       hsl(28,15%, 7%)   L= 7%   ← void black
├── Input field      hsl(25,10%,14%)   L=14%   ← sunken form fields
├── Card surface     hsl(25,14%,10%)   L=10%   ← forge (slightly above bg)
├── Popover          hsl(20, 9%,13%)   L=13%   ← chain (above card)
├── Muted well       hsl(25,12%,20%)   L=20%   ← sidebar / emphasized surface
│   └── Secondary    hsl(22,10%,22%)   L=22%   ← secondary button / chip
└── Border seam      hsl(28,22%,40%)   L=40%   ← clearly visible structural line
```

Note: Input is intentionally *below* card lightness to create a "sunken field" perception. Combined with a 1.5px border at 3.1:1 contrast, the form field boundary is clear.

### Rule 3 — Border Token Applies Everywhere

The single `--border` token at `hsl(28, 22%, 40%)` applies to all structural separators:
- Card edges
- Input borders
- Tab separators
- Dividers
- Sidebar/nav borders
- Modal outlines
- Footer/header separators

This is consistent with how shadcn/ui's `border-border` utility class works. All elements using `@apply border-border` automatically receive the updated color via the CSS custom property change.

### Rule 4 — Thickness Must Be Targeted

Global `border-width` overrides in `.dark` will break components that intentionally use no border or a specific border for focus/state reasons. Target by component class, slot attribute, or Radix primitive data attribute. When in doubt, use Tailwind's `dark:` variant directly on the component.

---

## Interaction States

### Hover States (dark mode — no change to logic, only base color changes)

| Element | Rest border | Hover border | Transition |
|---------|-------------|--------------|------------|
| Card | `--border` 1.5→2px, `hsl(28,22%,40%)` | `--primary` tint + bg `--card-hover` | 150ms ease |
| Primary button | none | filter: brightness(1.10) | 120ms ease |
| Secondary / outline button | `--border` 1.5px | `--border` + `--primary` glow | 120ms ease |
| Input | `--border` 1.5px | `--primary` border + glow shadow | 100ms ease |
| Nav item | transparent | `--accent` bg | 100ms ease |

### Focus States

All interactive elements: `--ring` (`hsl(42,75%,48%)`) — gold focus outline. Unchanged.
- Ring width: 1px outline (`box-shadow: 0 0 0 1px ...`) per globals.css existing treatment
- Ring glow: `hsl(var(--primary) / 0.4)` shadow already defined

### Active / Selected States

- Active nav item: 3px left border in `--primary` color — unchanged
- Active tab: 2px bottom border in `--primary` color — thickness already correct

---

## Component Affected List

These components need review for dark-mode border thickness and the updated `--border` color:

- `components/ui/card.tsx` — Card, CardHeader, CardContent, CardFooter
- `components/ui/tabs.tsx` — TabsList, TabsTrigger
- `components/ui/button.tsx` — variant="outline", variant="secondary"
- `components/ui/separator.tsx` — horizontal and vertical
- `components/ui/input.tsx`
- `components/ui/textarea.tsx`
- `components/ui/select.tsx`
- `components/ui/dialog.tsx` — Dialog, DialogContent
- `components/ui/sheet.tsx` — Sheet panel borders
- `components/dashboard/valhalla-card-tile.tsx`
- Navigation / Sidebar root component (border-right)
- Footer component (border-top)

The CSS custom property change to `--border` propagates automatically via shadcn's `@apply border-border` utilities. Only the thickness overrides require component-level edits.

---

## Files for FiremanDecko

| File | Change |
|------|--------|
| `development/ledger/src/app/globals.css` | Replace 5 tokens inside `.dark {}` block with proposed values |
| `development/ledger/src/app/globals.css` | Add dark-scoped thickness overrides (outside @layer or in component styles) |
| Each affected component (listed above) | Add `dark:border-2` or `dark:border-[1.5px]` Tailwind variants as needed |

Reference: `ux/wireframes/theme/dark-void-palette.html` for exact HSL values, contrast ratios, and side-by-side rendered demo.

---

## Acceptance Criteria Traceability

| Criterion | Design Decision |
|-----------|-----------------|
| All borders use a lighter tone clearly visible against void-black bg | --border lifted from L=20% (1.4:1) to L=40% (3.1:1) |
| Card borders are at least 2px thick | Specified: `.dark .card { border-width: 2px }` |
| Tab separators, button outlines, dividers at least 1.5px | Specified per element in thickness table |
| Secondary/muted text WCAG AA (4.5:1) against dark bg | --muted-foreground proposed: 7.8:1 AAA |
| Footer and nav separator lines clearly visible | border-top / border-right both use updated --border + 1.5px |
| No changes to light theme | All changes scoped to .dark {} block and dark: variants only |

---

## What Does NOT Change

- `:root {}` light theme — zero edits
- All chart, easter egg, howl, loki toast, realm status tokens
- Gold brand (`--primary`, `--ring`)
- Primary text (`--foreground`)
- Destructive / status colors
- Karl-bling CSS
- Border radius (`--radius: 0.25rem`)
- Interaction transition durations
- Focus ring treatment (gold glow — already correct)

---

*Luna · ᛚᚢᚾᚨ · UX Designer — Beauty and function, woven as one*
