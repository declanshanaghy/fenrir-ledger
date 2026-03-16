# Chronicle Norse Components — Interaction Spec
**Issue:** #1047 | **Designer:** Luna | **Date:** 2026-03-16

---

## Overview

This spec defines interaction behavior, animation triggers, responsive breakpoints,
accessibility requirements, and CSS architecture for the Norse MDX chronicle
components. Reference alongside `chronicle-agent-page-shell.html` and
`norse-components-catalog.html`.

---

## 1. Collapsible Sections

### 1.1 Agent Turns (`<details class="agent-turn">`)

| Attribute | Value |
|-----------|-------|
| Element | Native HTML `<details>` |
| Default state | **Collapsed** (no `open` attribute) |
| Open trigger | Click anywhere on `<summary>` |
| Close trigger | Click `<summary>` again |
| JavaScript required | **No** — native `<details>` behavior |
| Animation | Chevron rotation only (CSS) |

**Chevron rotation:**
```css
.chronicle-page .agent-turn > summary::before {
  content: '\25B6';           /* ▶ */
  transition: transform 0.15s ease;
}
.chronicle-page .agent-turn[open] > summary::before {
  transform: rotate(90deg);   /* ▼ */
}
```

**Interaction flow:**

```
[Turn collapsed]
  ▶ 01 · Read product brief                        [Read] [Bash]
         ↕ user clicks summary
[Turn expanded]
  ▼ 01 · Read product brief                        [Read] [Bash]
  ┌─────────────────────────────────────────────────────────────┐
  │ [Thinking block — italic, max-height 180px, scrollable]     │
  │ [Agent text output — left-aligned, 60% max-width]           │
  │ ┌─ Toolbox ──────────────────────────────────────────────┐  │
  │ │  ▶ Read   generate-agent-report.mjs                   │  │
  │ │  ▶ Write  chronicle-norse.css                         │  │
  │ └────────────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────┘
```

### 1.2 Nested Tool Blocks (`<details class="agent-tool-block">`)

| Attribute | Value |
|-----------|-------|
| Element | Native HTML `<details>` (nested inside agent-turn body) |
| Default state | **Collapsed** |
| Open trigger | Click `<summary>` of tool block |
| Click propagation | `stopPropagation()` not needed — native `<details>` handles this |
| JavaScript required | **No** |

**Expand-all / Collapse-all (optional enhancement):**
The HTML report has JS `expand-all` / `collapse-all` buttons. For MDX chronicles,
these are **optional** — implement as a client component wrapper if desired.
Not required for initial release.

### 1.3 Thinking Block

- Max-height: 180px
- `overflow-y: auto` (native scroll)
- No collapse behavior — always visible when turn is open
- Prefixed with rune glyph ᛒ (via CSS `::before`)

---

## 2. Animation Spec

### 2.1 `@keyframes norse-tremble`

Applies to: `.heckle-explosion`
Trigger: CSS animation on render (plays once when element appears in DOM)

```css
@keyframes norse-tremble {
  0%,  100% { transform: translate(0, 0) rotate(0deg); }
  10%       { transform: translate(-2px, -1px) rotate(-0.5deg); }
  20%       { transform: translate(3px, 1px) rotate(0.5deg); }
  30%       { transform: translate(-1px, 2px) rotate(-0.3deg); }
  40%       { transform: translate(2px, -2px) rotate(0.4deg); }
  50%       { transform: translate(-3px, 0px) rotate(-0.5deg); }
  60%       { transform: translate(1px, 1px) rotate(0.3deg); }
  70%       { transform: translate(-2px, -1px) rotate(-0.4deg); }
  80%       { transform: translate(3px, 2px) rotate(0.5deg); }
  90%       { transform: translate(-1px, -2px) rotate(-0.3deg); }
}
```

**Application:**
```css
@media (prefers-reduced-motion: no-preference) {
  .chronicle-page .heckle-explosion {
    animation: norse-tremble 0.8s ease-in-out;
    animation-fill-mode: both;
  }
}
```

**WCAG requirement:** Must be wrapped in `@media (prefers-reduced-motion: no-preference)`.
Users with `prefers-reduced-motion: reduce` see NO animation. The element still
renders (content always visible) — only the shake effect is disabled.

### 2.2 `@keyframes explosion-glow`

Applies to: `.heckle-explosion` box-shadow
Trigger: CSS animation, plays once on render, or loops (design decision left to engineer)

```css
@keyframes explosion-glow {
  0%,  100% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.3), 0 0 20px rgba(201, 146, 10, 0.1); }
  50%        { box-shadow: 0 0 15px rgba(239, 68, 68, 0.5), 0 0 40px rgba(201, 146, 10, 0.3); }
}
```

**Recommendation:** Play once (not looping) — looping violates `prefers-reduced-motion`
principles even when wrapped. If the engineer wants a looping glow, use `prefers-reduced-motion`
guard AND set `animation-iteration-count: infinite` only for the glow (no movement).

### 2.3 Chevron Rotation (Collapsible Turns + Tool Blocks)

- CSS `transition: transform 0.15s ease`
- No JavaScript animation
- `::before` pseudo-element on `<summary>`

---

## 3. Responsive Breakpoints

### 3.1 Content Column Width

| Viewport | Max-width | Padding |
|----------|-----------|---------|
| Desktop (>1024px) | 880px | 0 28px |
| Tablet (600–1024px) | 880px | 0 28px |
| Mobile (≤480px) | 100% | 0 16px |
| Mobile (≤375px) | 100% | 0 16px |

### 3.2 Component Breakpoints

**Chat bubbles (`.heckle`, `.heckle-mayo`, `.heckle-comeback`):**
- Desktop/Tablet: `max-width: 60%`
- Mobile (≤480px): `max-width: 90%`

**Toolbox + text-block-agent:**
- Desktop/Tablet: `max-width: 60%`
- Mobile (≤480px): `max-width: 90%` for text-block, `max-width: 100%` for toolbox

**Tool badges in turn summary:**
- Desktop/Tablet: visible
- Mobile (≤480px): `display: none` (save horizontal space)

**Stats grid:**
- Desktop: `repeat(auto-fill, minmax(120px, 1fr))` — typically 4–5 cols
- Tablet: same auto-fill, wraps earlier
- Mobile (≤480px): `repeat(3, 1fr)` — locked to 3 columns

**Changes summary columns:**
- Desktop/Tablet: 2-column grid
- Mobile (≤700px): 1-column stack

**All-Father's Decree padding:**
- Desktop: `24px 32px`
- Mobile (≤480px): `16px 14px`

**Agent Callback padding:**
- Desktop: `24px 32px`
- Mobile (≤480px): `16px 12px`

**Agent callback avatar:**
- Desktop: 48×48px
- Mobile (≤480px): 40×40px

**Decree main title font-size:**
- Desktop: 1.2rem (Cinzel Decorative)
- Mobile (≤480px): 1rem (clamped)

**Explosion text font-size:**
- Desktop: 1.1rem
- Mobile (≤375px): 0.9rem (use `clamp(0.9rem, 3vw, 1.1rem)`)

### 3.3 Nav on Mobile

- Site nav collapses to brand + hamburger button
- Hamburger behavior is handled by the existing marketing layout — not part of this issue

---

## 4. Profile Modal (Clickable Avatars)

Both heckler avatars and agent avatars in the HTML report are clickable and open a
profile overlay modal. In MDX chronicles, this requires a client component because:
1. The MDX content area renders via `next-mdx-remote` (server-side at build time)
2. `onClick` handlers cannot exist in MDX HTML — must be in a React client component

**Design spec for modal:**

```
┌──────────────────────────────────────────────────────────────┐
│  [Backdrop: rgba(7,7,13,0.85), blur(4px), z-index:1000]      │
│                                                              │
│  ┌────────────────────────────────────────┐                  │
│  │  [Avatar: 80×80, circle, theme-border] │                  │
│  │                                        │                  │
│  │  [Name — Cinzel, 1.2rem, accent color] │                  │
│  │  [Role — Cinzel, 0.8rem, gold, upper]  │                  │
│  │                                        │                  │
│  │  [Bio — Source Serif, 0.85rem, 1.6 lh] │                  │
│  │                                        │                  │
│  │  [ Back to the Match!! ]  ← close btn  │                  │
│  └────────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

- Backdrop click closes modal
- Keyboard: `Escape` closes modal
- Focus trap: focus moves to modal on open, returns to avatar on close (WCAG)
- Modal max-width: 400px, width: 90vw

**Implementation path (two options):**

**Option A (simpler):** `ChronicleAvatarModal` client component that attaches
click handlers to `.heckle-avatar` and `.turn-agent-avatar` elements after hydration.
This avoids modifying the MDX generator output.

**Option B (semantic):** MDX generator wraps avatar `<img>` in a `<button>` with
`data-profile-key` attribute. Client component reads `data-profile-key` and renders
the modal. Cleaner but requires generator changes.

**Recommendation:** Option A for this sprint (lower risk). Option B in a future
enhancement.

---

## 5. Accessibility Requirements (WCAG 2.1 AA)

| Element | Requirement |
|---------|-------------|
| `.agent-turn` (`<details>`) | Native keyboard accessible — Tab + Enter/Space to toggle |
| `.agent-tool-block` (`<details>`) | Same — native |
| `.heckle-explosion` animation | `prefers-reduced-motion` guard (see §2.1) |
| `.callback-avatar` / `.heckle-avatar` | `alt` attribute required on `<img>` elements |
| Profile modal | Focus trap, Escape to close, ARIA role="dialog" |
| Tool badge colors | Must not rely on color alone — include text label |
| `.decree-oath` / `.callback-blood-seal` | UPPERCASE text via CSS `text-transform`, not in HTML |
| Rune characters | Wrap in `aria-hidden="true"` — decorative only |

**Rune aria-hidden pattern:**
```html
<span class="decree-rune-row" aria-hidden="true">ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ</span>
```

---

## 6. CSS Extraction Strategy

The HTML generator (`generate-agent-report.mjs`) contains all Norse CSS inline in the
`CSS` constant. The extraction plan:

### 6.1 New file: `chronicle-norse.css`

Location: `development/frontend/src/app/(marketing)/chronicles/chronicle-norse.css`

Scope: All rules prefixed with `.chronicle-page` (matching existing `chronicle.css` pattern)

Extracts these classes from the generator:
- `.chronicle-page .decree` and all `.decree-*` subclasses
- `.chronicle-page .agent-callback` and all `.callback-*` subclasses
- `.chronicle-page .heckle`, `.heckle-comeback`, `.heckle-mayo`
- `.chronicle-page .heckle-entrance`, `.heckle-explosion`
- `@keyframes norse-tremble`, `@keyframes explosion-glow`
- Tool badge color variants: `.agent-tool-bash`, `.agent-tool-read`, etc.

### 6.2 Import in page.tsx

```typescript
// development/frontend/src/app/(marketing)/chronicles/[slug]/page.tsx
import "../chronicle.css";
import "../chronicle-norse.css";  // ← ADD THIS
```

### 6.3 HTML reports (unchanged)

The HTML generator keeps its own inline CSS. `chronicle-norse.css` does NOT affect
the standalone HTML reports in `tmp/agent-logs/`. The generator's CSS is scoped to
`body` / classless rules — no conflict.

### 6.4 CSS custom property mapping

The HTML generator uses raw hex CSS vars (`--void`, `--gold`, etc.).
The MDX chronicle CSS must use the existing `.chronicle-page` token system:

| HTML generator var | Chronicle.css token | Notes |
|--------------------|---------------------|-------|
| `var(--gold)` | `var(--c-gold)` | Primary / gold |
| `var(--gold-bright)` | `var(--c-gold-bright)` | Brighter gold |
| `var(--gold-glow)` | `rgba(var(--c-gold-rgb), 0.15)` | Needs rgb split |
| `var(--teal-asgard)` | `var(--c-teal)` | Teal accent |
| `var(--red-ragnarok)` | `var(--c-fire)` | Destructive red |
| `var(--amber-hati)` | `var(--c-amber)` | Amber |
| `var(--text-saga)` | `var(--c-fg)` | Body text |
| `var(--text-rune)` | `var(--c-fg-muted)` | Muted text |
| `var(--forge)` | `var(--c-bg-card)` | Card background |
| `var(--rune-border)` | `var(--c-border)` | Border |
| `var(--void)` | `var(--c-bg)` | Page background |

---

## 7. Heckler Avatar Image Sources

The HTML reports reference heckler avatar images by filename. For MDX chronicles on
the public site, these must be served as static assets.

**Current paths (HTML reports, local):**
```
agents/profiles/heckler-avatar.png     (patriarch)
agents/profiles/heckler-granny.png
agents/profiles/heckler-da.png
agents/profiles/heckler-mammy.png
agents/profiles/heckler-uncle.png
agents/profiles/heckler-teen.png
agents/profiles/heckler-lad.png
agents/profiles/heckler-lass.png
```

**For MDX chronicles:**
Option 1 (recommended): Copy to `development/frontend/public/agents/profiles/` and serve
as static assets at `/agents/profiles/{filename}`.

Option 2: Inline as base64 in the MDX generator (not recommended — large file size).

**Agent profile images** (already used in chronicles):
```
agents/profiles/fireman-decko-dark.png
agents/profiles/loki-dark.png
agents/profiles/luna-dark.png
agents/profiles/freya-dark.png
agents/profiles/heimdall-dark.png
```

Check: `ls development/frontend/public/agents/profiles/` to confirm what is already there.

---

## 8. MDX Generator — Publish Mode Changes

The `generate-agent-report.mjs --publish` codepath currently emits basic MDX with:
- Frontmatter (title, date, excerpt, rune, category)
- Stats grid (existing)
- Changes + commits (existing)
- Collapsible turns via `<details>` (existing)

**To add (downstream issues #1048, #1049, #1050):**
1. All-Father's Decree block at top of content (after frontmatter)
2. Agent callback footer at bottom of content (after verdict)
3. Heckler chat bubbles interspersed between turns
4. Explosion/entrance events full-width between turns
5. Secret sanitization pass before MDX write

These are engineering tasks for FiremanDecko — the wireframes define the HTML structure
and CSS class names to use.

---

## 9. Open Questions (for FiremanDecko)

1. **CSS delivery:** Single `chronicle-norse.css` or split `chronicle-decree.css` +
   `chronicle-heckler.css`? Single file recommended for simplicity.

2. **Heckler avatars:** Confirm which avatar images exist in `public/`. If missing,
   create placeholder SVGs with rune initial letters (simpler than PNG).

3. **explosion-glow loop:** Should the box-shadow glow animation loop or play once?
   Playing once avoids `prefers-reduced-motion` complexity for the glow. Recommendation: once.

4. **Backward compatibility:** ~25 existing MDX chronicles don't have the Norse ceremonial
   elements. Adding `chronicle-norse.css` won't break them (classes simply won't match),
   but they'll look less ceremonial than new agent chronicles. Accept this divergence.

5. **Profile modal implementation:** Option A (post-hydration JS) or Option B (data attribute)?
   Clarify before implementing.

---

_Spec by Luna · Issue #1047 · 2026-03-16_
