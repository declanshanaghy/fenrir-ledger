# Interaction Spec: Karl Card Bling — Issue #1088

## Overview

Karl card bling is a **CSS-only cosmetic overlay** on the existing `CardTile` component.
It activates via the `data-tier` attribute on `<html>`, set by `EntitlementContext` (wired in #1086).
No JS-driven state changes beyond class injection for the badge gold accent.

---

## 1. Hover Glow Behavior

### Trigger
- `[data-tier="karl"] .karl-bling-card:hover` — Karl tier
- `[data-tier="trial"] .karl-bling-card:hover` — trial tier

### Karl tier (full intensity)
```
On mouseenter:
  border-color → rgba(212,165,32,0.55)
  box-shadow   → 0 0 0 1px rgba(212,165,32,0.25), var(--karl-shadow-md)
  animation    → karl-gold-glow 2.8s ease-in-out infinite
```

### Trial tier (soft intensity)
```
On mouseenter:
  border-color → rgba(212,165,32,0.30)
  box-shadow   → 0 0 0 1px rgba(212,165,32,0.12), var(--karl-shadow-sm)
  animation    → karl-gold-glow-soft 3.2s ease-in-out infinite
```

### On mouseleave
Animation stops immediately (no reverse animation). Border and shadow return to resting state via `transition: box-shadow 200ms ease-out` (from `.card-chain`).

### Coexists with Framer Motion y-lift
The `.card-chain` CSS `transition` and Framer Motion `whileHover={{ y: -2 }}` both apply.
They operate on separate properties (`box-shadow`/`border-color` vs `transform`) — no conflict.

---

## 2. Rune Corner Behavior

### Resting state (always visible for Karl + trial)
- Four Elder Futhark runes in card corners: ᚠ (top-left), ᚱ (top-right), ᛁ (bottom-left), ᚾ (bottom-right)
- Position: `absolute`, 5px top/bottom, 6px left/right insets
- Font-size: 10px (desktop), 9px (mobile ≤375px)
- **No animation, no interaction, no tooltip**
- `aria-hidden="true"` on all four spans — purely decorative

### Hover state
Runes do **not** animate on hover. They remain at resting opacity/position.
No transform, no glow on the rune glyphs themselves.

### Hidden for Thrall tier
```css
.karl-rune-corner { display: none; }
[data-tier="karl"] .karl-rune-corner,
[data-tier="trial"] .karl-rune-corner { display: block; }
```

---

## 3. Reduced-Motion Fallback

### `@media (prefers-reduced-motion: reduce)`

| Element | Animation | Static fallback |
|---|---|---|
| `.karl-bling-card:hover` (Karl) | `animation: none` | Gold border + shadow preserved (no pulsing) |
| `.karl-bling-card:hover` (trial) | `animation: none` | Lighter gold border + shadow preserved |
| `.karl-rune-corner` | N/A — never animated | Always static |
| `.karl-bling-badge-status` | N/A — no animation on badge | Gold border tint preserved |

Design intent: users with reduced-motion preference still see the **gold treatment** (border color, badge tint, rune corners) — only the pulsing keyframe animation is suppressed. The bling is present but still.

---

## 4. Touch Device Fallback

### `@media (hover: none)`

Hover glow animation suppressed (`:hover` pseudo-class is unreliable on touch — already handled in karl-bling.css from #1086). Resting gold border and rune corners remain visible.

On tap, the card navigates to the edit form (existing behavior unchanged).

---

## 5. Status Badge Gold Accent

### Class: `.karl-bling-badge-status`

Applied via `useIsKarlOrTrial()` hook inside `StatusBadge.tsx`.

| Tier | Border | Background | Text | Tooltip |
|---|---|---|---|---|
| Thrall | Default | Default | Unchanged | Unchanged |
| Trial | `rgba(212,165,32,0.25)` | None | Unchanged | Unchanged |
| Karl | `rgba(212,165,32,0.50)` | `rgba(212,165,32,0.07)` | Unchanged | Unchanged |

The badge variant (color-coded by `CardStatus`) is preserved — only the border/tint changes.
No animation on the badge.

---

## 6. Component Change Summary

| File | Changes |
|---|---|
| `CardTile.tsx` | Add `.karl-bling-card` to `motion.div`. Add four `<span aria-hidden="true" className="karl-rune-corner karl-rune-{tl|tr|bl|br}">` glyphs inside the motion wrapper before `<Link>`. |
| `StatusBadge.tsx` | Conditionally append `.karl-bling-badge-status` to Badge className via `useIsKarlOrTrial()`. |
| `karl-bling.css` | Add `.karl-rune-corner` base (hidden), `[data-tier="karl|trial"] .karl-rune-corner` visible rules with gold color token. Add `.karl-bling-badge-status` Karl + trial rules. |

---

## 7. CSS Token Reference

```
--karl-gold:        #d4a520   /* gold.DEFAULT */
--karl-gold-bright: #f0c040   /* gold.bright */
--karl-glow-sm:     8px
--karl-glow-md:     20px
--karl-shadow-sm:   0 0 8px rgba(212,165,32,0.22)
--karl-shadow-md:   0 0 20px rgba(212,165,32,0.28)
```

All tokens defined in `:root` in karl-bling.css (from #1086). No new tokens required for this issue.
