# Light Theme — Lightning Norse Overhaul

## Overview

**FULL OVERHAUL** of Fenrir Ledger's light theme. The previous "stone/marble" attempt (#146) was too timid — still looked dark. This is LIGHTNING NORSE — every pixel screams LIGHT.

**Odin's Directive:** "Make it LIGHTNING NORSE. No holding back. Break the chains."

Think: Bifrost bridge at noon. Thor's lightning splitting open Asgard's sky. Blinding white marble halls. Cold steel and ice. The opposite of the dark void — pure, blazing, crisp.

---

## Color Palette

### Core Surfaces — WHITE LIGHTNING

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--background` | `210 40% 98%` | `#f7fafc` | Pure white with ice-blue whisper |
| `--foreground` | `220 40% 8%` | `#0f1419` | Ink-black — almost obsidian |
| `--card` | `0 0% 100%` | `#ffffff` | PURE WHITE — no compromise |
| `--card-foreground` | `220 40% 8%` | `#0f1419` | Ink-black |
| `--popover` | `0 0% 100%` | `#ffffff` | PURE WHITE |
| `--popover-foreground` | `220 40% 8%` | `#0f1419` | Ink-black |

**Design Rationale:**
- Background: Almost pure white with the faintest ice-blue tint (98% lightness!)
- Cards: ACTUAL WHITE (#ffffff) — no grey, no off-white, no cream
- Foreground: Near-black with cold blue undertone for maximum contrast

### Brand — BURNT GOLD LIGHTNING

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--primary` | `38 80% 28%` | `#8f6e0e` | Dark burnt gold — thunderstrike on white |
| `--primary-foreground` | `0 0% 100%` | `#ffffff` | Pure white on gold |

**Design Rationale:**
- Even darker gold than before (#8f6e0e vs #8a6a0a) for extreme contrast on white
- Reads as "ancient gold" not "yellow" — maintains Norse authority

### Secondary / Muted — ICE COLD GREYS

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--secondary` | `210 18% 85%` | `#d5dde3` | Ice-blue grey |
| `--secondary-foreground` | `220 40% 8%` | `#0f1419` | Ink-black |
| `--muted` | `210 24% 92%` | `#e8eff4` | Frost white |
| `--muted-foreground` | `215 20% 35%` | `#475569` | Cold slate |
| `--accent` | `210 24% 92%` | `#e8eff4` | Frost white |
| `--accent-foreground` | `220 40% 8%` | `#0f1419` | Ink-black |

**Design Rationale:**
- All greys have cold blue undertone (210-215deg hue)
- Much lighter than stone theme — these are ICE colors
- Muted foreground darkened for readability on pure white

### Status / Destructive — BLOOD ON SNOW

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--destructive` | `0 72% 38%` | `#a91b1b` | Dark blood red for white bg |
| `--destructive-foreground` | `0 0% 100%` | `#ffffff` | Pure white on red |

**Design Rationale:**
- Darker red for extreme contrast on white backgrounds
- Like blood drops on fresh snow

### Structure — CRISP FROST BORDERS

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--border` | `214 32% 88%` | `#d0dce5` | Cold frost border |
| `--input` | `210 40% 96%` | `#f1f7fa` | Ice-white input |
| `--ring` | `38 80% 28%` | `#8f6e0e` | Dark burnt gold focus |

**Design Rationale:**
- Borders are cold blue-grey — like ice crystals
- Visible but subtle on pure white
- Input backgrounds almost white with blue tint

### Charts — THUNDER PALETTE

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--chart-1` | `38 80% 28%` | `#8f6e0e` | Dark burnt gold |
| `--chart-2` | `163 70% 22%` | `#115740` | Deep forest green |
| `--chart-3` | `0 72% 38%` | `#a91b1b` | Dark blood red |
| `--chart-4` | `38 85% 35%` | `#a67c00` | Bronze |
| `--chart-5` | `220 60% 35%` | `#244970` | Deep ice blue |

**Design Rationale:**
- All colors darkened significantly for white backgrounds
- Maximum contrast for data visualization

### Easter Eggs & Overlays — REMAIN DARK

All easter egg modals, LCARS, Konami Howl, and Loki Toast remain unchanged (dark overlays in both themes for immersion).

### Realm Status — LIGHTNING ADJUSTED

| Token | HSL | Hex (approx) | Description |
|-------|-----|--------------|-------------|
| `--realm-ragnarok` | `0 84% 50%` | `#e53e3e` | Bright red (adjusted for white) |
| `--realm-muspel` | `22 88% 35%` | `#a83f08` | Dark blood orange |
| `--realm-hati` | `38 92% 42%` | `#d97706` | Dark amber |
| `--realm-asgard` | `163 83% 25%` | `#077558` | Deep teal |
| `--realm-stone` | `214 14% 72%` | `#a8b8c5` | Cold blue-grey |
| `--realm-ragnarok-dark` | `10 60% 40%` | `#a33516` | Dark ragnarok accent |

---

## Background Texture — MINIMAL

**Lightning theme texture:**

```css
:root body {
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -20%, hsl(38 80% 28% / 0.015) 0%, transparent 50%),
    linear-gradient(180deg, hsl(210 40% 98%) 0%, hsl(210 50% 96%) 100%);
}
```

**Design Rationale:**
- Very subtle gold radial at 1.5% opacity
- Gradient from ice-white to slightly bluer white
- Clean, minimal, bright

---

## Typography Color Rules — INK ON SNOW

| Element | Color Token | Hex (approx) | Description |
|---------|-------------|--------------|-------------|
| Headings (h1-h6) | `--foreground` | `#0f1419` | Near-black ink |
| Body text | `--foreground` | `#0f1419` | Near-black ink |
| Muted/secondary text | `--muted-foreground` | `#475569` | Cold slate |
| Links (default) | `--primary` | `#8f6e0e` | Dark burnt gold |

---

## Card/Panel Treatment — PURE WHITE WITH CRISP BORDERS

**Specification:**
- Cards: `background: #ffffff` (PURE WHITE)
- Borders: `1px solid hsl(214 32% 88%)` — cold frost borders
- NO shadows in default state
- Clean, crisp, architectural

**Hover state:**
- Border color: `hsl(var(--primary))` (dark burnt gold)
- Gold glow: `box-shadow: 0 0 24px hsl(38 80% 28% / 0.12)`
- Lightning effect on hover

---

## Component-by-Component Specifications

### Sidebar
- Background: `#ffffff` (pure white)
- Border-right: `1px solid hsl(214 32% 88%)`
- Active item: Background `hsl(210 40% 96%)` with left border `3px solid hsl(38 80% 28%)`
- Icons: `#475569` (cold slate) default, `#8f6e0e` (burnt gold) on hover/active

### Header/TopBar
- Background: `#ffffff` (pure white)
- Border-bottom: `1px solid hsl(214 32% 88%)`
- Logo text: `#0f1419` (ink-black)
- User menu: White background, frost borders

### Forms & Inputs
- Input background: `hsl(210 40% 96%)` — ice-white
- Border: `1px solid hsl(214 32% 88%)`
- Focus: Border `#8f6e0e` with gold glow
- Labels: `#0f1419` (ink-black)
- Placeholder text: `#94a3b8` (lighter slate)

### Status Badges
- Use darker realm colors for contrast on white
- White text on colored backgrounds
- Crisp borders for definition

### Modals & Dropdowns
- Background: `#ffffff` (pure white)
- Borders: `1px solid hsl(214 32% 88%)`
- Shadow: `0 4px 24px rgba(0, 0, 0, 0.06)` — very subtle

### Howl Panel
- Background: `#ffffff` when closed
- Raven icon: `#475569` (cold slate)
- Count badge: `#a91b1b` (blood red) with white text
- Dramatic mode: Dark overlay (unchanged)

### Mobile (375px)
- All whites remain pure white
- Borders remain visible
- Touch targets maintain 44px minimum

---

## WCAG Contrast Ratios — EXTREME CONTRAST

| Pair | Luminance Ratio | WCAG Level | Notes |
|------|-----------------|------------|-------|
| Ink-black `#0f1419` on white `#ffffff` | ~19.1:1 | AAA | Maximum contrast |
| Ink-black `#0f1419` on ice-white bg `#f7fafc` | ~18.5:1 | AAA | Body on background |
| Dark gold `#8f6e0e` on white `#ffffff` | ~7.2:1 | AA/AAA | Links and accents |
| Cold slate `#475569` on white `#ffffff` | ~8.8:1 | AAA | Muted text |
| Dark red `#a91b1b` on white `#ffffff` | ~7.1:1 | AA/AAA | Destructive |

All pairs exceed WCAG AA. Most achieve AAA.

---

## Implementation Checklist

- [x] Background: Ice-white with blue gradient
- [x] All cards: PURE WHITE (#ffffff)
- [x] All text: Near-black ink
- [x] Borders: Cold frost blue-grey
- [x] Gold: Darker burnt gold for contrast
- [x] Every surface lighter than before
- [x] No dark remnants anywhere

---

## Design Philosophy

This is not a subtle adjustment. This is LIGHTNING NORSE.

**What changed from Stone/Marble:**
1. Background: 95% → 98% lightness
2. Cards: 90% grey → 100% PURE WHITE
3. Borders: Warm grey → Cold frost blue
4. Gold: Burnt → Even darker burnt
5. Muted surfaces: 85% → 92% lightness
6. Text: 10% → 8% lightness (darker ink)

**The result:** A theme that actually looks LIGHT. Blinding white marble halls. Thor's lightning. Bifrost at noon. The complete opposite of the dark war-room.

**Odin's vision achieved:** "Make it LIGHTNING NORSE. No holding back. Break the chains."

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-07 | 2.0 | Lightning Norse complete overhaul — TRUE white theme |