# Interaction Spec: About Modal v2 — Easter Eggs, Compressed Layout, Profile Icons

**Issue:** #1806
**Wireframe:** [wireframes/modals/about-modal-v2-easter-eggs.html](about-modal-v2-easter-eggs.html)
**Author:** Luna (UX Designer)

---

## 1. Overview

Two improvements to `AboutModal.tsx`:

1. **Gleipnir fragment discovery states** — each of the 6 ingredients shows a visual found/unfound state based on `localStorage` keys.
2. **Compressed layout with profile icons** — Pack member rows are condensed using themed rune-icon circles; quotes truncate to one line. The dialog fits without scrolling at 900px+ viewport height.

---

## 2. Gleipnir Fragment Discovery States

### 2.1 Data Source

| Key | Meaning |
|-----|---------|
| `egg:gleipnir-1` | Cat's footfall found |
| `egg:gleipnir-2` | Beard of a woman found (also Fragment II trigger) |
| `egg:gleipnir-3` | Roots of a mountain found |
| `egg:gleipnir-4` | Sinews of a bear found |
| `egg:gleipnir-5` | Breath of a fish found |
| `egg:gleipnir-6` | Spittle of a bird found |

Read all 6 keys on modal open via `localStorage.getItem("egg:gleipnir-N")`.

### 2.2 State Machine per Fragment

```
localStorage key absent/null → UNFOUND state
localStorage key = "1"       → FOUND state
```

State is read **once on modal open**. No live polling. If user finds a fragment while the modal is open, the state does not update until the modal is closed and reopened.

### 2.3 Visual Treatment

**FOUND fragment:**
- Roman numeral: gold accent, full brightness
- Status indicator (14×14px): checkmark `✓` glyph in gold
- Label text: full opacity, upright (not italic)
- aria-label on status span: `"fragment N found"`

**UNFOUND fragment:**
- Roman numeral: muted (gold at 40% opacity)
- Status indicator (14×14px): lock rune `ᛜ` in muted foreground
- Label text: opacity 0.35, italic
- aria-label on status span: `"fragment N not yet found"`

**Fragment II (The Beard of a Woman):**
- Always rendered as a `<button type="button">` regardless of found/unfound state
- Visual presentation follows found/unfound rules above
- `cursor: default` — no visible affordance
- `aria-label="The beard of a woman — easter egg trigger"` so keyboard users can locate it
- Clicking triggers `useGleipnirFragment2().trigger()` (existing hook — no change needed)
- If already found: clicking the button does nothing (trigger() checks localStorage before acting)

### 2.4 Fragment Progress Counter

Below the Gleipnir list:

```
N of 6 fragments found
```

- N = count of set keys among `egg:gleipnir-1` through `egg:gleipnir-6`
- When N = 6: append line `✦ Gleipnir is complete. The wolf stirs.` (pulsing, themed gold)
- Font: monospace, 10px

### 2.5 Fragment Discovery Flow (when user clicks Fragment II)

```
User clicks "The beard of a woman" text
  → trigger() called
  → If NOT yet found:
      localStorage.setItem("egg:gleipnir-2", "1")
      GleipnirWomansBeard modal opens (above About modal, z-index 9653)
      Audio: fenrir-growl.mp3 fades in
  → If already found:
      No action (trigger() guards on localStorage check)
```

The About modal remains open behind the easter egg modal. On dismissal of the egg modal, the About modal is visible again. The fragment list does NOT re-render on egg modal close — it keeps the state from when About opened. (This is acceptable; user can re-open About to see updated state.)

---

## 3. Compressed Layout — Pack Section

### 3.1 Profile Icons

Each Pack member gets a **32×32px themed circle** to their left.

| Member | Rune | Rationale |
|--------|------|-----------|
| Freya | ᚠ (fehu) | Wealth, prosperity — Freya's domain as Product Owner |
| Luna | ᛚ (laguz) | Water, moon, flow — UX intuition |
| FiremanDecko | ᚦ (thurisaz) | Giant, forge power — Principal Engineer |
| Loki | ᛏ (tiwaz) | Justice, the trickster's order — QA as rule-enforcer |

**Styling (for engineer reference):**
- Shape: `rounded-full` (circle)
- Border: `border border-gold/40`
- Background: `bg-void` or `bg-transparent`
- Glyph: `text-gold font-mono text-sm` centered inside circle
- Do NOT use external images or SVGs — pure CSS + Unicode rune

**Fallback:** If the rune renders poorly at small sizes, use initials instead:
- Freya → F, Luna → L, FiremanDecko → FD, Loki → Lo

### 3.2 Pack Member Row Structure

```
[32px icon] [Name BOLD UPPERCASE 12px] [Role muted 10px]
            ["Quote in italic 11px max one line, overflow ellipsis"]
```

Row height target: ~36px.

Full quote in `title` attribute for hover/focus tooltip.

### 3.3 Shortened Quotes (1-line max)

| Member | Shortened Quote (1 line) |
|--------|--------------------------|
| Freya | "She decides what the wolf hunts next." |
| Luna | "She shapes the shadows where the wolf walks." |
| FiremanDecko | "He forged the chain. Then taught the wolf to wear it." |
| Loki | "He tests every lock. He is, after all, the reason locks exist." |

FiremanDecko's quote is the only one trimmed (original: "...taught the wolf to wear it willingly."). The others already fit; confirmed via wireframe.

---

## 4. Height Budget

Target: entire dialog visible at 900px viewport height without scrolling.

| Component | Estimated Height |
|-----------|-----------------|
| Modal header | 42px |
| Pack section label | 20px |
| Pack list (4 × 36px + gaps) | 162px |
| Divider + margins | 26px |
| Gleipnir section label | 20px |
| Gleipnir list (6 × 22px + gaps) | 162px |
| Fragment progress | 18px |
| Divider + margins | 26px |
| Wolf's Plunder section | 40px |
| Modal footer | 44px |
| **Total** | **~560px** |

Browser chrome + overlay backdrop padding ≈ 190px on a 900px viewport leaves ~710px for dialog. Target comfortably fits.

Right column `overflow-y: auto` is preserved for safety on very short viewports or extreme content.

---

## 5. Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| < md (768px) | Single column; rune ᛟ in header; profile icons 28×28; text sizes reduced |
| ≥ md | Two-column grid (190px left + divider + flexible right) |

Mobile: dialog is scrollable (right column overflow-y auto, full height used).
At 900px+: no scrolling needed.

---

## 6. Component Change Summary

| File | Change |
|------|--------|
| `AboutModal.tsx` | Read localStorage keys for all 6 fragments on open; pass `found: boolean` to each ingredient item; add profile icon to Pack members; compress typography and spacing; shorten FiremanDecko quote |
| New internal helper: `useGleipnirFragments()` | Returns `{ found: boolean[] }` — array of 6 booleans, index 0–5 mapping to fragments 1–6 |
| CSS | No new classes needed — use existing Tailwind utilities |

`useGleipnirFragment2` hook in `GleipnirWomansBeard.tsx` is unchanged. Fragment II click still uses the existing `trigger()` function.

---

## 7. Edge Cases

| Scenario | Behavior |
|----------|----------|
| localStorage unavailable (SSR, private mode) | All fragments show UNFOUND; no error thrown; `try/catch` around `localStorage.getItem` |
| Fragment found while modal is open | Visual state does not update live; user must reopen modal |
| All 6 found | "Gleipnir is complete. The wolf stirs." pulse message appears |
| Fragment II already found, user clicks it | `trigger()` exits early (localStorage guard); no modal; no audio |
| Quote too long for single line | Truncated with ellipsis; full text in `title` attribute |
| Viewport < 375px | Dialog is scrollable; no layout breakage |

---

## 8. AC-to-Wireframe Mapping

| Acceptance Criterion | Wireframe Reference |
|----------------------|---------------------|
| Gleipnir list items highlight/mark when found | Section C: Found state — checkmark ✓, full opacity |
| Unfound fragments remain dimmed/locked | Section C: Unfound state — lock ᛜ, opacity 0.35 |
| Pack member entries have small themed profile icons | Section B After: 32px rune circles |
| Quotes shorter (1 line max per member) | Section B After: truncated with ellipsis |
| Dialog fits without scrolling on 900px+ | Section 4 height budget: ~560px |
| Icons match theme (gold/muted on dark background) | Section 3.1 styling spec |
| Mobile: dialog scrollable at smaller viewports | Section E: mobile wireframe, overflow-y auto |
