# Heilung Modal — Interaction Spec
**Issue #955** · Restyle Heilung easter egg dialog with mystical wolf voice
**Wireframe:** [`heilung-modal.html`](./heilung-modal.html)
**Component:** `development/frontend/src/components/easter-eggs/HeilungModal.tsx`

---

## Overview

The Heilung modal is the wolf's testimony — ancient, inevitable, unhurried. Fenrir has heard these sounds before the world had names. Every word, every transition, every silence serves that weight.

The wolf is not angry. The wolf is patient. The wolf remembers.

---

## Copy

### Eyebrow Label
```
ᚠ ᛖ ᚾ ᚱ  ·  INCANTATION FOUND  ·  ᛁ ᚱ ᛊ
```
- Rune spans: `aria-hidden="true"` — decorative only
- Label span: visible text `"Incantation Found"`
- Container `aria-label="Incantation found"` provides full accessible name

### Modal Title
```
HEILUNG
```
- Font: Cinzel Decorative 700
- Color: `--egg-title` (`#f0b429`, `--gold-bright`)
- Letter-spacing: `0.15em`

### Subtitle
```
Amplified History
```
- Font: Source Serif 4 300, italic
- Color: `rgba(201, 146, 10, 0.65)` (gold dimmed)

### Incantation Body
Two short paragraphs. Wolf-voice: ancient, knowing, not angry.

```
They speak in iron and root. I have heard these words before —
in the age before names were given, when the world still breathed.

Three voices carry what others let fall. They call to that
which does not forget. I have never forgotten.
```

- Font: Source Serif 4 400, `0.9rem`, `line-height: 1.75`
- Color: `--egg-text` (`#e8e4d4`, `--text-saga`)
- Do NOT justify. Left-aligned. Let the line breaks breathe.

### Voices Section Label
```
THE VOICES
```
- Font: JetBrains Mono 500, `0.65rem`, uppercase, `letter-spacing: 0.2em`
- Color: `--egg-text-muted` (`#8a8578`, `--text-rune`)

### Voice Entries
| Name | Role |
|---|---|
| Kai Uwe Faust | Chant, throat — the low frequencies |
| Maria Franz | Voice — the oldest tones remembered |
| Christopher Juul | Percussion — the ritual architecture |

- Name: Cinzel 600, `0.825rem`, `--egg-text` (`#e8e4d4`)
- Role: Source Serif 4 300, `0.75rem`, italic, `--egg-text-muted` (`#8a8578`)

### External Link
```
amplifiedhistory.com ↗
```
- Font: JetBrains Mono 500, `0.75rem`
- Color: `--egg-accent` (`#c9920a`)
- Hover: `opacity: 0.7`
- `href="https://www.amplifiedhistory.com"` · `target="_blank"` · `rel="noopener noreferrer"`
- Separator: `border-top: 1px solid --rune-border` above it

### Dismiss Button
```
HEIÐR
```
Old Norse: honour, glory. The wolf acknowledges your presence and lets you return.

- Font: Cinzel 700, `0.8rem`, uppercase, `letter-spacing: 0.25em`
- Resting: border `--egg-accent`, background transparent, text `--egg-accent`
- Hover: background fills `--egg-btn-bg` (`#c9920a`), text becomes `--egg-btn-text` (`#07070d`)
- Min-height: `44px` (WCAG 2.5.5 touch target)

---

## Visual Tokens

All tokens from `ux/theme-system.md` and `development/frontend/src/app/globals.css`.

| Role | Token | Value |
|---|---|---|
| Backdrop tint | `--void` | `#07070d` |
| Backdrop opacity | — | `0.95` + `blur(6px)` |
| Modal background | `--egg-bg` → `--forge` | `#0f1018` |
| Column fill | `--egg-bg-body` → `--chain` | `#13151f` |
| Outer border | `--egg-border` → `--iron-border` | `#2a2d45` |
| Inner divider | `--rune-border` | `#1e2235` |
| Title glow | `--egg-title` → `--gold-bright` | `#f0b429` |
| Body text | `--egg-text` → `--text-saga` | `#e8e4d4` |
| Muted text | `--egg-text-muted` → `--text-rune` | `#8a8578` |
| Accent / border | `--egg-accent` → `--gold` | `#c9920a` |
| Button fill | `--egg-btn-bg` | `#c9920a` |
| Button text | `--egg-btn-text` | `#07070d` |
| Button hover | `--egg-btn-hover` | `#f0b429` |

### Typography

| Element | Font | Weight | Size |
|---|---|---|---|
| Title: HEILUNG | Cinzel Decorative | 700 | `clamp(1.75rem, 4vw, 2.5rem)` |
| Subtitle: Amplified History | Source Serif 4 | 300 | `0.9rem` italic |
| Eyebrow / Voices label | JetBrains Mono | 500 | `0.68rem` |
| Incantation body | Source Serif 4 | 400 | `0.9rem`, `lh: 1.75` |
| Voice names | Cinzel | 600 | `0.825rem` |
| Voice roles | Source Serif 4 | 300 | `0.75rem` italic |
| Link / Button | Cinzel | 700 | `0.8rem` |

---

## Animation

### Principle
Every transition must feel like a ritual, not a UI interaction. Slow, intentional, and weighted. No bouncing. No spring physics. The wolf does not spring.

### Backdrop Entry
```css
/* fade — darkness descends before the modal rises */
initial: { opacity: 0 }
animate: { opacity: 1 }
duration: 400ms
easing: ease
```

### Modal Rise (`wolf-rise`)
```css
/* translateY + fade — rises from below like something ancient waking */
initial: { opacity: 0, translateY: 24px }
animate: { opacity: 1, translateY: 0 }
duration: 600ms
easing: cubic-bezier(0.16, 1, 0.3, 1)  /* "saga-enter" from interactions.md */
```
This is the `wolf-rise` keyframe from `ux/interactions.md`.

### Border Pulse Glow
After entry completes, the modal border breathes once — a single slow gold pulse.
```css
@keyframes border-breathe {
  0%   { box-shadow: 0 0 0px rgba(201, 146, 10, 0); }
  50%  { box-shadow: 0 0 18px rgba(201, 146, 10, 0.3), inset 0 0 8px rgba(201, 146, 10, 0.06); }
  100% { box-shadow: 0 0 6px rgba(201, 146, 10, 0.12); }
}
/* duration: 2.4s, ease-in-out, runs once after 650ms delay */
/* Settling state: 0 0 6px rgba(201, 146, 10, 0.12) — barely-visible ember glow */
```

### Voice Item Stagger
Each `<li>` in the voices list fades in with a vertical slide:
```css
initial: { opacity: 0, translateY: 8px }
animate: { opacity: 1, translateY: 0 }
duration: 300ms
easing: ease-out
delay: 100ms × index  /* 0ms, 100ms, 200ms */
/* Stagger begins 400ms after modal entry completes */
```
Framer Motion: use `variants` with `staggerChildren: 0.1` on the `<ul>`.

### Exit
```css
/* Modal and backdrop exit simultaneously */
initial: { opacity: 1 }
animate: { opacity: 0 }
duration: 220ms
easing: ease
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  /* All animations collapse to instant opacity transition */
  /* border-breathe: skip entirely */
  /* wolf-rise: translateY 0 at all times */
  /* Voice stagger: all items visible immediately */
}
```

---

## Trigger & Dismiss Behaviour

| Trigger | Action |
|---|---|
| `Ctrl+Shift+L` (all platforms) | Toggle modal (open if closed, close if open) |
| `Meta+Shift+L` (macOS) | Same |
| Skip if `INPUT`, `TEXTAREA`, `SELECT` focused | Prevents hijacking user typing |

| Dismiss | Action |
|---|---|
| `HEIÐR` button | Close |
| `×` close button | Close |
| Backdrop click | Close |
| `Escape` key | Close |

Repeatable: no `localStorage` gate. The wolf can be called again.

---

## Accessibility

| Requirement | Implementation |
|---|---|
| Dialog role | `role="dialog"` + `aria-modal="true"` on modal shell |
| Named by title | `aria-labelledby="heilung-title"` on modal shell |
| Focus trap | On open: focus moves to dismiss button. Tab cycles within modal only. |
| Close button label | `aria-label="Dismiss the incantation"` |
| Eyebrow runes | `aria-hidden="true"` on both rune spans |
| Video iframe title | `title="Heilung — Krigsgaldr LIFA"` |
| External link | Accessible text `"amplifiedhistory.com ↗"` — the `↗` is decorative; add `aria-label="amplifiedhistory.com, opens in new tab"` |
| Touch targets | Close button: `44×44px`. Dismiss button: `min-height: 44px`, `min-width: 44px`. |
| Color contrast | `#f0b429` on `#0f1018` — WCAG AA large text ✓. `#e8e4d4` on `#13151f` — WCAG AA ✓ |
| Keyboard dismissal | `Escape` fires dismiss |
| Scroll lock | `overflow: hidden` on `<body>` while modal is open |
| Screen reader scroll | `aria-label` on incantation div provides copy summary when voiceover reads modal |

---

## Responsive Behaviour

### Desktop (`> 600px`)
- Modal: `max-width: 960px`, `width: min(960px, calc(100vw - 2rem))`
- Layout: CSS grid `grid-template-columns: 1fr 1px 1fr`
- Info panel: left column with vertical divider
- Video: right column

### Mobile (`≤ 600px`)
- Modal: `width: 100%`, full-bleed
- Layout: `flex-direction: column`
- Video: `order: 1` — top of modal
- Info panel: `order: 2` — below video, separated by `border-top`
- Vertical divider: `display: none`
- Dismiss button: `width: 100%`
- Header padding: `1.5rem 1.25rem`
- Minimum viewport: `375px`

---

## Engineering Notes for FiremanDecko

1. **No copy changes to the existing `HEILUNG_VIDEO_ID`** — keep `QRg_8NNPTD8`
2. **Replace existing Framer Motion props** — swap `scale: 0.92` for `translateY: 24px`. Remove spring easing.
3. **Add `border-breathe` keyframe** — either in `globals.css` (under Easter Egg Modal section) or as a `motion.div` keyframe via `useAnimate`.
4. **Voice stagger** — wrap `<ul>` in `<motion.ul variants={{ animate: { staggerChildren: 0.1 } }}>` with delayed start.
5. **Dismiss button copy** — change from `"OK"` → `"HEIÐR"`. Screen-reader users get `aria-label="Dismiss the incantation"` on the `×` button; button text `HEIÐR` is the visible label — no additional aria needed.
6. **Eyebrow label change** — from `"Easter Egg Discovered"` → `"Incantation Found"`.
7. **Font check** — Cinzel Decorative, Source Serif 4, Cinzel, JetBrains Mono all already loaded via `next/font` in `layout.tsx`. No new font imports needed.
8. **Backdrop `aria-label`** — remove from backdrop div; it creates duplicate dialog labelling. The `aria-labelledby` on the modal shell is sufficient.
