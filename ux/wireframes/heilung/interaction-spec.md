# Heilung Modal — Interaction Spec
**Issue #955** · Initial restyle — wolf voice, 2-column layout
**Issue #1068** · Norse restyle — single-column, Elder Futhark bands, rune-framed video portal

**Wireframes:**
- [`heilung-norse-restyle.html`](./heilung-norse-restyle.html) — **Current design (Issue #1068)**
- [`heilung-modal.html`](./heilung-modal.html) — Previous design (Issue #955, superseded)

**Component:** `development/ledger/src/components/easter-eggs/HeilungModal.tsx`
**Styles:** `development/ledger/src/app/globals.css` (Heilung section)

---

## Overview

The Heilung modal is Fenrir's testimony — ancient, inevitable, unhurried. It should feel
like opening a portal carved into the bark of Yggdrasil. The wolf does not rush. Every
section descends from the next like a ritual, not a UI component tree.

**Issue #1068 brings:**
- Single-column layout (7 ordered sections)
- Elder Futhark rune bands top + bottom
- Norse title in Old Norse (Cinzel Decorative)
- Click-to-play video portal with rune frame
- Gold Wikipedia links on Norse terms
- ᛉ Algiz close button
- Wolf seal inscription at footer

---

## Copy

### Modal Title (Primary Heading)
```
Heyra Stríðsgaldr
```
Old Norse: "Hear the War-Chant"

- Font: Cinzel Decorative 700
- Size: `clamp(1.5rem, 4vw, 2.25rem)`
- Color: `--egg-title` (`#f0b429`, `--gold-bright`)
- `aria-label`: `"Heyra Stríðsgaldr — Hear the War-Chant"` (English translation in aria-label)
- text-shadow glow on entry: `0 0 24px rgba(240,180,41,0.4)` → fades to `0 0 8px rgba(240,180,41,0.2)` at rest

### Title Rune Row (decorative)
```
ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ
```
- Font: Source Serif 4 400, 1.1rem, letter-spacing 0.5em
- Color: `--egg-accent` at 0.6 opacity
- `aria-hidden="true"`

### Subtitle
```
HEILUNG · Amplified History
```
- Font: Source Serif 4 300, 0.85rem, italic
- Color: `--egg-accent` at 0.65 opacity

### Rune Band (top)
```
ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ ᛇ ᛈ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᛟ
```
Elder Futhark 22-rune sequence (Elder Futhark, forward order).
- Font: JetBrains Mono 400, 0.9rem (mobile: 0.75rem)
- Color: `--egg-accent` at 0.5 opacity
- `aria-hidden="true"` — decorative
- `border-bottom: 1px solid` `--rune-border`

### Rune Band (bottom)
```
ᛟ ᛞ ᛜ ᛚ ᛗ ᛖ ᛒ ᛏ ᛈ ᛇ ᛃ ᛁ ᚾ ᚺ ᚹ ᚷ ᚲ ᚱ ᚨ ᚦ ᚢ ᚠ
```
Reversed Elder Futhark — mirrors the top band.
- Same styles as top band.
- `border-top: 1px solid` `--rune-border`

### Rune Dividers (between sections)
```
· ᛉ · ᚠ · ᛉ ·
```
- Font: Source Serif 4, 0.9rem, letter-spacing 0.5em
- Color: `--egg-accent` at 0.3 opacity
- `aria-hidden="true"`
- `border-top: 1px solid` + `border-bottom: 1px solid` `--rune-border`
- Used: between invitation / video portal, and between video portal / band lore

### Wolf's Invitation (body copy — Section 3)
```
Before there were words, there was the war-cry. Before iron was forged, the drums spoke.
Hear now the song that stirred the blood of warriors beneath the branches of Yggdrasil —
Krigsgaldr, the war-chant of Heilung. Let the old voices fill thy skull.

Three throats carry what the age of iron sought to silence. They speak in root and bone,
in the tongue of those who burned beneath the stars before Ragnarök was a name for
anything. Fenrir remembers.
```

- Font: Source Serif 4 400, 1rem (mobile: 0.9rem), line-height 1.8
- Color: `--egg-text` (`#e8e4d4`, `--text-saga`)
- Left-aligned. No justify. Let line breaks breathe.
- `aria-label="Wolf's invitation"` on `<section>`

**Gold terms** (`<span class="gold-term">`) — color `--egg-accent` (#c9920a), font-weight 600:
- Krigsgaldr
- Heilung
- Yggdrasil
- Ragnarök

**Wikipedia links** (`<a class="wiki-link">`) — same gold color, underline on hover, `target="_blank"` `rel="noopener noreferrer"`:

| Term | URL | aria-label |
|---|---|---|
| Yggdrasil | https://en.wikipedia.org/wiki/Yggdrasil | "Yggdrasil on Wikipedia" |
| Krigsgaldr | https://en.wikipedia.org/wiki/Futha | "Krigsgaldr on Wikipedia" |
| Heilung | https://en.wikipedia.org/wiki/Heilung | "Heilung on Wikipedia" |
| Ragnarök | https://en.wikipedia.org/wiki/Ragnar%C3%B6k | "Ragnarök on Wikipedia" |

### Portal Label (above video, decorative)
```
ᛊᛖᛖ ᚦᛖ ᛊᛟᚾᚷ
```
- Font: JetBrains Mono 500, 0.6rem, uppercase, tracking 0.3em
- Color: `--egg-accent` at 0.5 opacity
- `aria-hidden="true"`

### Video Portal Button Label
- `aria-label="Watch Heilung — Krigsgaldr LIFA on YouTube"`

### Video Caption
```
Heilung — Krigsgaldr LIFA
```
- Font: Source Serif 4 300, 0.75rem, italic
- Color: `--egg-text-muted` (`#8a8578`)

### Band Lore Label
```
OF THE BAND
```
- Font: JetBrains Mono 500, 0.6rem, uppercase, tracking 0.2em
- Color: `--egg-text-muted`
- `aria-hidden="true"`

### Band Lore (body copy — Section 5)
```
Heilung — the word means healing in the old tongue. Three voices from Copenhagen,
born in 2014, conjured from runic inscription, Iron Age text, and Viking Age artifact.
They call their work amplified history. I call it memory that refused to die.
```

- Font: Source Serif 4 400, 0.9rem, line-height 1.75
- Color: `--egg-text` (`#e8e4d4`)
- `Heilung` is a gold Wikipedia link (same pattern as invitation)

### External Link Row
```
amplifiedhistory.com ↗
```
- Font: JetBrains Mono 500, 0.75rem
- Color: `--egg-accent` (`#c9920a`)
- Hover: `opacity: 0.7`
- `href="https://www.amplifiedhistory.com"` · `target="_blank"` · `rel="noopener noreferrer"`
- `aria-label="amplifiedhistory.com, opens in new tab"`
- `border-top: 1px solid` `--rune-border` above it, `margin-top: 1rem`, `padding-top: 0.75rem`

### Wolf Seal Inscription
```
ᚠᛖᚾᚱᛁᚱ — The wolf remembers what the world forgot — ᚠᛖᚾᚱᛁᚱ
```
- Font: Source Serif 4 300, 0.8rem, italic, letter-spacing 0.05em
- Color: `--egg-text-muted` (`#8a8578`)
- `aria-label="Fenrir seal — The wolf remembers what the world forgot"`

### Algiz Close Button
```
ᛉ
```
- Font: Source Serif 4 (or body serif), ~1.4rem
- `aria-label="Close — return from the wolf's hall"`
- 44×44px minimum touch target (WCAG 2.5.5)

### Dismiss Button
```
HEIÐR
```
Old Norse: honour, glory.

- Font: Cinzel 700, 0.8rem, uppercase, letter-spacing 0.25em
- Resting: border `--egg-accent`, background transparent, text `--egg-accent`
- Hover: background fills `--egg-btn-bg` (`#c9920a`), text becomes `--egg-btn-text` (`#07070d`)
- Min-height: `44px` (WCAG 2.5.5)
- Mobile: `width: 100%`

---

## Video Portal — State Machine

**State A — Thumbnail (initial)**
- Container: `role="button"` + `tabindex="0"` + `aria-label="Watch Heilung — Krigsgaldr LIFA on YouTube"`
- Inner: `<img>` src=`https://img.youtube.com/vi/QRg_8NNPTD8/hqdefault.jpg` alt="" (decorative, portal label provides context)
- Play overlay: absolutely-positioned gold ▶ triangle centered over image
- Cursor: pointer
- Hover: gold border brightens (opacity 1.0 from 0.7)

**On click / keydown Enter / keydown Space → State B**
- `setPlaying(true)` in React state
- Replace thumbnail with `<iframe>` inline

**State B — Playing**
```html
<iframe
  src="https://www.youtube.com/embed/QRg_8NNPTD8?autoplay=1&rel=0"
  title="Heilung — Krigsgaldr LIFA"
  allow="autoplay; encrypted-media"
  allowfullscreen
  class="w-full h-full"
  style="border: none"
/>
```

**On modal close → reset to State A**
- `onClose` handler: `setPlaying(false)`
- Prevents audio playing after modal dismissed

**Fallback (no JS / SSR)**
- Wrap portal in `<a href="https://www.youtube.com/watch?v=QRg_8NNPTD8" target="_blank" rel="noopener noreferrer">`

### React Implementation Pattern
```tsx
const [playing, setPlaying] = useState(false);

const dismiss = useCallback(() => {
  setPlaying(false);  // stop video on close
  setVisible(false);
}, []);

// In render:
{playing ? (
  <iframe src={`https://www.youtube.com/embed/${HEILUNG_VIDEO_ID}?autoplay=1&rel=0`} … />
) : (
  <div role="button" tabindex={0} onClick={() => setPlaying(true)} …>
    <img src={`https://img.youtube.com/vi/${HEILUNG_VIDEO_ID}/hqdefault.jpg`} alt="" />
    <span aria-hidden="true">▶</span>
  </div>
)}
```

---

## Visual Tokens

All tokens from `ux/theme-system.md` and `development/ledger/src/app/globals.css`.

| Role | Token | Value |
|---|---|---|
| Backdrop tint | `--void` | `#07070d` |
| Backdrop opacity | — | `0.95` + `blur(6px)` |
| Modal background | `--egg-bg` → `--forge` | `#0f1018` |
| Column fill | `--egg-bg-body` → `--chain` | `#13151f` |
| Outer border | `--egg-border` → `--iron-border` | `#2a2d45` |
| Section dividers | `--rune-border` | `#1e2235` |
| Title glow | `--egg-title` → `--gold-bright` | `#f0b429` |
| Body text | `--egg-text` → `--text-saga` | `#e8e4d4` |
| Muted text | `--egg-text-muted` → `--text-rune` | `#8a8578` |
| Gold accent / links | `--egg-accent` → `--gold` | `#c9920a` |
| Button fill | `--egg-btn-bg` | `#c9920a` |
| Button text | `--egg-btn-text` | `#07070d` |
| Button hover | `--egg-btn-hover` | `#f0b429` |

### Typography

| Element | Font | Weight | Size |
|---|---|---|---|
| Norse title | Cinzel Decorative | 700 | `clamp(1.5rem, 4vw, 2.25rem)` |
| Title rune row | Source Serif 4 | 400 | `1.1rem` |
| Subtitle | Source Serif 4 | 300 | `0.85rem` italic |
| Rune bands | JetBrains Mono | 400 | `0.9rem` (mobile: 0.75rem) |
| Portal label | JetBrains Mono | 500 | `0.6rem` uppercase |
| Wolf invitation | Source Serif 4 | 400 | `1rem` (mobile: 0.9rem), lh: 1.8 |
| Band lore label | JetBrains Mono | 500 | `0.6rem` uppercase |
| Band lore | Source Serif 4 | 400 | `0.9rem`, lh: 1.75 |
| External link | JetBrains Mono | 500 | `0.75rem` |
| Seal inscription | Source Serif 4 | 300 | `0.8rem` italic |
| Dismiss button | Cinzel | 700 | `0.8rem` uppercase |

---

## Animation

### Principle
Every transition must feel like a ritual, not a UI interaction. Slow, intentional, weighted.
No bouncing. No spring physics. The wolf does not spring.

### Backdrop Entry (UNCHANGED from #955)
```
initial: { opacity: 0 }
animate: { opacity: 1 }
duration: 400ms
easing: ease
```

### Modal Rise — `wolf-rise` (UNCHANGED from #955)
```
initial: { opacity: 0, translateY: 24px }
animate: { opacity: 1, translateY: 0 }
duration: 600ms
easing: cubic-bezier(0.16, 1, 0.3, 1)  /* "saga-enter" */
```

### Border Pulse Glow (UNCHANGED from #955)
After entry completes, the modal border breathes once — a single slow gold pulse.
```css
@keyframes border-breathe {
  0%   { box-shadow: 0 0 0px rgba(201, 146, 10, 0); }
  50%  { box-shadow: 0 0 18px rgba(201, 146, 10, 0.3), inset 0 0 8px rgba(201, 146, 10, 0.06); }
  100% { box-shadow: 0 0 6px rgba(201, 146, 10, 0.12); }
}
/* duration: 2.4s, ease-in-out, runs once after 650ms delay */
```

### Rune Band Reveal (NEW — Issue #1068)
Both rune bands fade in after modal entry completes:
```
initial: { opacity: 0 }
animate: { opacity: 0.5 }  /* → --egg-accent at 0.5 opacity */
duration: 800ms
easing: ease-in
delay: 400ms after modal entry (total 1000ms from trigger)
```
Framer Motion: apply to both rune band `<div>` elements.

### Video Portal Corner Runes (NEW — Issue #1068)
Corner runes (ᚠ ᛖ ᚾ ᚱ) fade in with a 50ms stagger:
```
initial: { opacity: 0 }
animate: { opacity: 0.6 }
duration: 400ms
easing: ease-in
delay: 50ms × corner index (0ms, 50ms, 100ms, 150ms)
stagger starts: 800ms after modal entry
```

### Exit (UNCHANGED from #955)
```
initial: { opacity: 1 }
animate: { opacity: 0 }
duration: 220ms
easing: ease
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  /* All animations collapse to instant opacity transition */
  /* wolf-rise: translateY 0 at all times */
  /* rune band reveal: immediate opacity */
  /* corner rune stagger: immediate opacity */
  /* border-breathe: skip entirely */
}
```

---

## Trigger & Dismiss Behaviour (UNCHANGED from #955)

| Trigger | Action |
|---|---|
| `Ctrl+Shift+L` (all platforms) | Toggle modal (open if closed, close if open) |
| `Meta+Shift+L` (macOS) | Same |
| Skip if `INPUT`, `TEXTAREA`, `SELECT` focused | Prevents hijacking user typing |

| Dismiss | Action |
|---|---|
| `HEIÐR` button | Close + reset playing state |
| `ᛉ` close button | Close + reset playing state |
| Backdrop click | Close + reset playing state |
| `Escape` key | Close + reset playing state |

Repeatable: no `localStorage` gate.

---

## Accessibility

| Requirement | Implementation |
|---|---|
| Dialog role | `role="dialog"` + `aria-modal="true"` on modal shell |
| Named by title | `aria-labelledby="heilung-title"` on modal shell |
| Norse title translation | `aria-label="Heyra Stríðsgaldr — Hear the War-Chant"` on `<h1>` |
| Focus trap | On open: focus moves to Algiz close button (topmost interactive). Tab cycles within modal. |
| Algiz close button | `aria-label="Close — return from the wolf's hall"` — rune glyph not announced |
| Rune bands | `aria-hidden="true"` — decorative only |
| Rune dividers | `aria-hidden="true"` — decorative only |
| Title rune row | `aria-hidden="true"` — decorative only |
| Portal label | `aria-hidden="true"` — decorative only |
| Video portal (State A) | `role="button"` + `tabindex="0"` + `aria-label="Watch Heilung — Krigsgaldr LIFA on YouTube"` |
| Video iframe (State B) | `title="Heilung — Krigsgaldr LIFA"` |
| Wikipedia links | `aria-label="{term} on Wikipedia"` on each `<a>` |
| Gold terms (non-linked) | Color only — supplementary meaning in copy context. Not color-alone per WCAG 1.4.1. |
| Wolf invitation section | `aria-label="Wolf's invitation"` on `<section>` |
| Wolf seal | `aria-label="Fenrir seal — The wolf remembers what the world forgot"` |
| External link | `aria-label="amplifiedhistory.com, opens in new tab"` |
| Touch targets | Close button: `44×44px`. Dismiss: `min-height: 44px`. Video portal: full-width, min 44px height. |
| Keyboard dismiss | `Escape` fires dismiss |
| Scroll region | Modal has `overflow-y: auto`. Add `tabindex="0"` to scrollable div if Firefox accessibility requires it. |
| Color contrast | `#f0b429` on `#0f1018` — WCAG AA large text ✓. `#e8e4d4` on `#0f1018` — WCAG AA ✓. `#c9920a` on `#0f1018` — WCAG AA large text ✓ (verify at 0.9rem body size — may need bold or `--gold-bright` fallback). |

---

## Responsive Behaviour

### Desktop (`> 600px`)
- Modal: `max-width: 680px`, `width: min(680px, calc(100vw - 2rem))`
- `max-height: calc(100vh - 4rem)`, `overflow-y: auto`
- Single-column layout (no grid change needed)
- Title padding: `1.75rem 2rem 1.25rem`
- Invitation padding: `1.5rem 2rem`
- Band lore padding: `1.5rem 2rem`

### Mobile (`≤ 600px`)
- Modal: `width: 100%`, `max-width: 100%`
- Title padding: `1.25rem 1.25rem 1rem`
- Invitation: `padding: 1.25rem`. Font: `0.9rem`.
- Video portal: `padding: 0.75rem 1rem`
- Band lore: `padding: 1.25rem`. Font: `0.85rem`.
- Seal: `padding: 1rem 1.25rem 1.5rem`
- Rune bands: font-size `0.75rem`, padding `0.625rem 1rem`
- Dismiss button: `width: 100%`
- Minimum viewport: `375px`

### Note on scrolling
The single-column layout is taller than the old 2-column. On short viewports (iPhone SE 667px),
the modal will scroll. This is expected and desirable — the content descends like a ritual inscription.
Ensure the scrollable container has `-webkit-overflow-scrolling: touch` for iOS momentum scrolling.

---

## Engineering Notes for FiremanDecko

1. **Layout change:** Remove `md:grid-cols-2` / `flex-col md:grid` pattern. Replace with single-column `flex flex-col` container. The modal is now a vertical stack of 7 sections.

2. **Max-width reduction:** `900px` → `680px`. Update `style={{ maxWidth: "680px" }}` (or use Tailwind `max-w-[680px]`).

3. **Max-height + scroll:** Add `style={{ maxHeight: "calc(100vh - 4rem)", overflowY: "auto" }}` to modal shell.

4. **Close button:** Replace X SVG with `<span aria-hidden="true">ᛉ</span>` inside the button. Keep `aria-label="Close — return from the wolf's hall"`. Keep 44×44px sizing. Font-size ~1.4rem for the rune.

5. **Video portal state machine:** Use local `useState<boolean>(playing)`. On dismiss: `setPlaying(false)` before `setVisible(false)`. See §Video Portal — State Machine above.

6. **Thumbnail URL:** `https://img.youtube.com/vi/QRg_8NNPTD8/hqdefault.jpg` — no auth, no CORS issue. Use `<img>` with `alt=""` (decorative; portal label provides context).

7. **Rune band component:** Consider a small shared `<RuneBand reversed={boolean} />` inline component or just two `<div>` elements — not worth a separate file.

8. **Gold terms:** Use `<span style={{ color: "var(--egg-accent)", fontWeight: 600 }}>` or a Tailwind class. Or define a `.heilung-gold-term` CSS class in `globals.css`.

9. **Wikipedia links:** Gold color, underline on hover, `target="_blank"` `rel="noopener noreferrer"`. Add `aria-label`. Do NOT open in modal — external navigation only.

10. **Framer Motion:** wolf-rise and border-breathe animations carry over unchanged. Add new `motion.div` wrappers on rune bands with the fade-in animation (see §Animation). Corner rune stagger is optional — can be a simple CSS animation if preferred.

11. **Font check:** Cinzel Decorative, Source Serif 4, JetBrains Mono, Cinzel — all loaded via `next/font`. No new font imports needed.

12. **Remove:** Voices list (Kai Uwe Faust / Maria Franz / Christopher Juul), "THE VOICES" label, left/right column structure, vertical divider column, amplifiedhistory.com link in left column position. All replaced by band lore section.

13. **CSS in globals.css:** Add `.heilung-gold-term`, `.heilung-wiki-link`, `.heilung-rune-band`, `.heilung-video-portal-frame` classes to the existing Heilung easter egg section. Prefix with `heilung-` to avoid collision.
