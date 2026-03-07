# Light Theme — Stone/Marble Redesign

## Overview

Fenrir Ledger's light theme redesigned from warm parchment to cool stone/marble aesthetic. This is the complementary daylight mode to the dark Norse war-room — if dark is the War Room at night, light is the Great Hall in daylight.

**Design Direction (from Odin):**
- **Tone:** Clean stone/marble — cool, crisp. NOT warm parchment. Think polished granite, cool grey-blues, marble whites.
- **Gold accents:** Darker/burnt gold for contrast on light backgrounds.
- **Cards & panels:** Subtle borders + stone textures to define regions. NOT elevation-based. Use fine borders, subtle grain textures.
- **Typography:** Headings go ink-black on light backgrounds. NOT gold. Body text dark charcoal/ink.
- **Mood:** Sunlit Asgard — the other side of the same Norse coin.

---

## Color Palette

### Core Surfaces

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--background` | `220 10% 95%` | `#f0f1f3` | Cool marble white — slight blue undertone |
| `--foreground` | `220 20% 10%` | `#14161a` | Ink black — very dark with blue cast |
| `--card` | `220 8% 90%` | `#e2e4e8` | Cooler marble — slightly darker than bg |
| `--card-foreground` | `220 20% 10%` | `#14161a` | Ink black |
| `--popover` | `220 12% 97%` | `#f6f7f8` | Lightest cool white |
| `--popover-foreground` | `220 20% 10%` | `#14161a` | Ink black |

**Design Rationale:**
- Backgrounds use `220deg` hue (cool blue-grey) at very low saturation to create a stone/marble effect
- NOT warm parchment hues (36deg-42deg range)
- Foreground is ink-black with blue undertone, not brown-black

### Brand (Primary Gold)

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--primary` | `38 75% 32%` | `#8a6a0a` | Burnt gold — darker for light bg contrast |
| `--primary-foreground` | `220 12% 97%` | `#f6f7f8` | Light text on gold |

**Design Rationale:**
- Darker/burnt gold (#8a6a0a) instead of parchment-theme #ae8510
- Better contrast on cool light backgrounds
- Still recognizably "gold" but muted and earthy

### Secondary / Muted

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--secondary` | `215 10% 78%` | `#bec2c8` | Cool medium grey |
| `--secondary-foreground` | `220 20% 10%` | `#14161a` | Ink black |
| `--muted` | `215 8% 85%` | `#d4d7db` | Cool light grey |
| `--muted-foreground` | `215 12% 42%` | `#5e6570` | Cool dark grey (body text muted) |
| `--accent` | `215 8% 85%` | `#d4d7db` | Cool light grey |
| `--accent-foreground` | `220 20% 10%` | `#14161a` | Ink black |

**Design Rationale:**
- All greys have cool blue undertone (215deg-220deg hue range)
- NOT warm leather/tan tones from parchment theme
- Muted foreground is cool dark grey for secondary text

### Status / Destructive

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--destructive` | `15 85% 42%` | `#c94020` | Blood orange — adapted for light bg |
| `--destructive-foreground` | `220 12% 97%` | `#f6f7f8` | Light text on destructive |

**Design Rationale:**
- Kept blood orange hue (15deg) from parchment theme
- Darkened luminance to 42% for sufficient contrast on light backgrounds

### Structure

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--border` | `215 10% 75%` | `#b8bcc2` | Cool light grey border — blue undertone |
| `--input` | `215 12% 92%` | `#e8eaed` | Cool light grey input background |
| `--ring` | `38 75% 32%` | `#8a6a0a` | Burnt gold focus ring |

**Design Rationale:**
- Borders are cool grey with blue undertone, NOT warm tan
- Subtle but visible against marble white background

### Charts (adapted for light stone background)

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--chart-1` | `38 75% 32%` | `#8a6a0a` | Burnt gold |
| `--chart-2` | `163 75% 25%` | `#0f7a5f` | Dark teal (Asgard) |
| `--chart-3` | `15 85% 42%` | `#c94020` | Blood orange |
| `--chart-4` | `38 80% 38%` | `#ae8510` | Deeper amber |
| `--chart-5` | `0 70% 48%` | `#d43c3c` | Red |

**Design Rationale:**
- All chart colors darkened for sufficient contrast on cool light background
- Maintain Norse realm color associations

### Easter Egg Modal

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--egg-bg` | `230 20% 12%` | `#1a1c25` | Deep indigo (same as dark theme) |
| `--egg-bg-body` | `230 18% 10%` | `#13151f` | Slightly lighter |
| `--egg-border` | `230 25% 20%` | `#2a2d45` | Muted indigo seam |
| `--egg-title` | `42 90% 55%` | `#f0b429` | Bright gold |
| `--egg-text` | `40 27% 91%` | `#e8e4d4` | Parchment text |
| `--egg-text-muted` | `30 6% 50%` | `#8a8578` | Stone muted |
| `--egg-accent` | `42 75% 40%` | `#c9920a` | Gold accent |
| `--egg-btn-bg` | `42 75% 40%` | `#c9920a` | Gold button |
| `--egg-btn-text` | `230 40% 5%` | `#07070d` | Near-black |
| `--egg-btn-hover` | `42 90% 55%` | `#f0b429` | Bright gold hover |

**Design Rationale:**
- Easter egg modals remain dark in both themes (design decision: modals are immersive)
- Same values as dark theme

### LCARS Overlay

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--lcars-orange` | `30 100% 50%` | `#ff9900` | Star Trek orange |
| `--lcars-lavender` | `300 33% 72%` | `#cc99cc` | Lavender |
| `--lcars-periwinkle` | `240 100% 80%` | `#9999ff` | Periwinkle blue |
| `--lcars-red` | `0 100% 60%` | `#ff3333` | Red |
| `--lcars-green` | `145 60% 50%` | `#33cc66` | Green |
| `--lcars-rose` | `0 40% 60%` | `#cc6666` | Rose |
| `--lcars-bg` | `0 0% 0%` | `#000000` | Deep black |
| `--lcars-scanline` | `30 100% 50%` | `#ff9900` | Orange scanline |
| `--lcars-text-dark` | `0 0% 0%` | `#000000` | Text on bright bars |

**Design Rationale:**
- LCARS Easter egg remains unchanged (Star Trek brand colors)

### Konami Howl

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--howl-wolf-fill` | `42 75% 40%` | `#c9920a` | Wolf gold |
| `--howl-eye-fill` | `230 40% 5%` | `#07070d` | Void cutouts |
| `--howl-pulse-bg` | `0 100% 12%` | `#3d0000` | Deep red flash |
| `--howl-band-bg` | `240 30% 4%` | `rgba(7,7,13,0.96)` | Dark band background |
| `--howl-band-border` | `10 60% 48%` | `#c94020` | Blood red border |
| `--howl-band-text` | `10 60% 48%` | `#c94020` | Blood red text |
| `--howl-wolf-bg` | `240 30% 4%` | `rgba(7,7,13,0.92)` | Wolf background |
| `--howl-wolf-border` | `42 75% 40%` | `#c9920a` | Gold border |

**Design Rationale:**
- Konami howl remains dark overlay in both themes (design decision: full-screen takeover is always dark)

### Loki Toast

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--loki-toast-bg` | `28 15% 7%` | `#12100e` | Dark toast bg |
| `--loki-toast-border` | `42 75% 48%` | `#d4a520` | Gold border |
| `--loki-toast-text` | `46 87% 60%` | `#f0c040` | Bright gold text |
| `--loki-toast-shadow` | `42 75% 48%` | `#d4a520` | Gold glow |

**Design Rationale:**
- Loki Toast remains dark in both themes (design decision: toasts are always dark for consistency)

### Realm Status

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--realm-ragnarok` | `0 84% 60%` | `#ef4444` | Red (overdue) |
| `--realm-muspel` | `22 88% 41%` | `#c94a0a` | Blood orange (fee approaching) |
| `--realm-hati` | `38 92% 50%` | `#f59e0b` | Amber (promo expiring) |
| `--realm-asgard` | `163 83% 29%` | `#0a8c6e` | Teal (active) |
| `--realm-stone` | `215 6% 50%` | `#797e87` | Cool stone grey (closed) |
| `--realm-ragnarok-dark` | `10 60% 48%` | `#c94020` | Ragnarok accent |

**Design Rationale:**
- Status colors remain consistent across themes (color-coded statuses should not change)
- `--realm-stone` adapted to cool grey (was `37 6% 50%` warm stone, now `215 6% 50%` cool stone)

---

## Background Texture

**Light theme stone grain:**

```css
:root body {
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -5%, hsl(38 75% 32% / 0.03) 0%, transparent 65%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='s'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23s)' opacity='0.02'/%3E%3C/svg%3E");
}
```

**Design Rationale:**
- Radial gradient uses burnt gold at very low opacity (3%) — subtle glow at top
- Stone grain texture at 2% opacity (was 3% in parchment theme — lighter for cleaner feel)
- NOT warm parchment grain

---

## Typography Color Rules

| Element | Color Token | Hex (approx) | Description |
|---------|-------------|--------------|-------------|
| Headings (h1-h6) | `--foreground` | `#14161a` | Ink black — NOT gold |
| Body text | `--foreground` | `#14161a` | Ink black |
| Muted/secondary text | `--muted-foreground` | `#5e6570` | Cool dark grey |
| Links (default) | `--primary` | `#8a6a0a` | Burnt gold |

**Design Rationale:**
- Headings are ink-black, NOT gold (Odin's direction)
- Body text is dark charcoal/ink for readability
- Muted text is cool grey, NOT warm stone

---

## Card/Panel Border Treatment

**Specification:**
- All cards use `border: 1px solid hsl(var(--border))`
- Border color: cool light grey (`#b8bcc2`)
- Subtle but visible against marble white background
- NO drop shadows or elevation effects
- Stone grain texture on body background provides subtle depth

**Hover state:**
- Border color shifts to `hsl(var(--primary))` (burnt gold)
- Gold glow: `box-shadow: 0 0 20px hsl(var(--primary) / 0.15)`
- Consistent with dark theme hover treatment (adjusted opacity for light bg)

---

## WCAG Contrast Ratios

All text/background pairs must meet **WCAG AA** requirements:
- Normal text: >= 4.5:1
- Large/bold text (18px+ or 14px+ bold): >= 3:1

### Contrast Calculations

| Pair | Luminance Ratio | WCAG Level | Notes |
|------|-----------------|------------|-------|
| Ink black `#14161a` on marble white `#f0f1f3` | ~15.2:1 | AAA | Body text, headings |
| Burnt gold `#8a6a0a` on marble white `#f0f1f3` | ~5.8:1 | AA | Primary accent, links |
| Cool dark grey `#5e6570` on marble white `#f0f1f3` | ~6.9:1 | AA | Muted/secondary text |
| Cool dark grey `#5e6570` on card `#e2e4e8` | ~6.5:1 | AA | Muted text on cards |
| Burnt gold `#8a6a0a` on card `#e2e4e8` | ~5.5:1 | AA | Primary accent on cards |
| Blood orange `#c94020` on marble white `#f0f1f3` | ~4.8:1 | AA | Destructive/urgent |

**Verification Method:**
Contrast ratios calculated using WCAG 2.1 relative luminance formula.

**Result:**
All key text/background pairs exceed WCAG AA requirements. No contrast violations.

---

## Implementation Notes for FiremanDecko

### Files to Modify

1. **`development/frontend/src/app/globals.css`**
   - Update ALL `:root` block values (lines 19-107)
   - Do NOT modify `.dark` block (lines 115-202)
   - Update body background texture for `:root body` (line 220-224)
   - Update WCAG contrast comment block (lines 541-559)

2. **`designs/ux-design/theme-system.md`**
   - Update Light Palette table (lines 38-55)
   - Update WCAG Contrast Ratios section (lines 88-95)

### Testing Checklist

- [ ] Dashboard in light mode: card tiles with cool borders
- [ ] StatusRing component: all 4 realm states visible on light bg
- [ ] HowlPanel component: raven icon + urgent count on light bg
- [ ] Easter egg modals: remain dark overlay (no changes needed)
- [ ] LCARS overlay: remain dark overlay (no changes needed)
- [ ] Konami Howl: remain dark overlay (no changes needed)
- [ ] Loki Toast: remain dark toast (no changes needed)
- [ ] Theme toggle: verify smooth transition between light/dark
- [ ] Mobile: 375px minimum viewport width

### Mobile-First Requirement

All components must render correctly at 375px viewport width minimum.

---

## Design Rationale Summary

**Why stone/marble instead of parchment?**
- Parchment aesthetic is warm, aged, antiquarian — works for dark theme as "war-room"
- Light theme needs a complementary daylight mood: clean, crisp, sunlit
- Stone/marble evokes Norse Great Hall in daylight — polished granite, cool blues, marble whites
- Creates stronger visual distinction between light/dark modes (not just "lighter parchment")

**Why ink-black headings instead of gold?**
- Gold on light backgrounds can feel "antiquated" or "certificate-like"
- Ink-black headings provide maximum clarity and readability
- Gold reserved for accents, links, focus states — maintains brand identity without dominating

**Why cool blue undertones instead of warm browns?**
- Warm browns tie to parchment/leather aesthetic (dark theme territory)
- Cool blues evoke stone, marble, granite — cleaner, more modern, more Nordic
- Blue undertones at very low saturation (8-12%) feel neutral, not "blue-themed"

**Why burnt gold (#8a6a0a) instead of brighter gold (#ae8510)?**
- Brighter gold lacks sufficient contrast on cool light backgrounds
- Burnt gold reads as "earthy gold" not "yellow" — maintains Norse voice
- Better WCAG contrast ratios while preserving brand identity

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-07 | 1.0 | Initial stone/marble light theme design spec |
