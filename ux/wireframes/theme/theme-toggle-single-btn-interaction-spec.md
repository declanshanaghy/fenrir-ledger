# Interaction Spec: Theme Toggle — Single Button
**Issue:** #1927
**Author:** Luna (UX Designer)
**Date:** 2026-03-23
**Wireframe:** `ux/wireframes/theme/theme-toggle-single-btn.html`

---

## Problem

The current marketing page navbar theme selector uses a two-button radio group inside a bordered container. The pattern is visually noisy: two icons always visible, an outer container border, and an internal divider border between buttons.

## Solution

Replace the `div[role=radiogroup]` + two `button[role=radio]` pattern with a single `<button>` element that cycles the theme on each click and shows the icon for the **opposite** theme (the action the user can take).

---

## Interaction Flow

```
User is in DARK mode
  → Sees: ☀ (sun icon, "Switch to light mode")
  → Clicks button
  → Theme changes to LIGHT
  → Button now shows: ☾ (moon icon, "Switch to dark mode")

User is in LIGHT mode
  → Sees: ☾ (moon icon, "Switch to dark mode")
  → Clicks button
  → Theme changes to DARK
  → Button now shows: ☀ (sun icon, "Switch to light mode")
```

The icon shown always represents the **next state** (what you will switch TO), not the current state. This is the standard affordance used by most modern sites.

---

## Component States

| State | Icon | aria-label |
|-------|------|------------|
| Dark mode active | `<Sun />` (☀) | "Switch to light mode" |
| Light mode active | `<Moon />` (☾) | "Switch to dark mode" |
| Hover (either state) | Same icon, color change | unchanged |
| SSR placeholder (unmounted) | None (empty 44×44 div) | aria-hidden="true" |

---

## Removed Structure

The following structure is **fully removed** from the "inline" variant:

- The outer `<div role="radiogroup" aria-label="Theme">` wrapper
- All `border`, `border-r`, `border-border`, `overflow-hidden` classes on the wrapper
- The `.map()` over `THEME_OPTIONS` to render two radio buttons
- `role="radio"` and `aria-checked` attributes (single button does not need these)

---

## Retained Structure

- `useTheme()` hook from `next-themes`
- `cycleTheme()` helper function (already handles dark ↔ light)
- `isDark` computed variable (already in scope)
- SSR guard (`!mounted` placeholder render)
- `setTheme()` call in onClick

---

## Accessibility Notes

1. **aria-label is dynamic** — must describe the action, not the state:
   - ✓ "Switch to light mode" (action-oriented)
   - ✗ "Dark mode" (state-oriented — does not communicate what clicking will do)

2. **No aria-pressed needed** — this is a cycling action button, not a toggle switch. `aria-pressed` implies a persistent on/off state stored on the button itself; the theme state lives in `next-themes`.

3. **No role override needed** — implicit `role="button"` on a `<button>` element is correct.

4. **Focus ring** — do not suppress the browser default focus ring. The toggle sits in the navbar tab order and must be keyboard-reachable.

5. **Touch target** — 44×44px minimum via inline style `{ minWidth: 44, minHeight: 44 }` (same as existing "icon" variant in ThemeToggle.tsx).

---

## Files Changed

| File | Change |
|------|--------|
| `development/ledger/src/components/layout/ThemeToggle.tsx` | Replace "inline" variant return block (lines 129–159) with single `<button>` |
| `development/ledger/src/components/marketing/MarketingNavbar.tsx` | **No change** — continues to use `<ThemeToggle variant="inline" />` |

---

## Out of Scope

- The `"icon"` variant (already a single button; engineer may optionally remove its border)
- The `"dropdown-icon"` variant (display-only, no click)
- LedgerTopBar or any non-marketing usage
- The `cycleTheme()` function signature
- The `THEME_OPTIONS` export (may be removed if no other consumer; engineer to check)
