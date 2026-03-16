# Interaction Spec — Loki Error Boundary Tablet (Issue #1037)

**Component:** `ErrorBoundary.tsx` (monitor-ui)
**Designer:** Luna
**Date:** 2026-03-16
**Wireframe:** [`loki-error-boundary.html`](loki-error-boundary.html)

---

## Overview

The `ErrorBoundary` is a React class component that catches render-time errors from its
children. When an error is caught, it replaces the children with a fallback UI.

This spec covers the visual and behavioral transition between the **normal** (children visible)
and **error** (Loki tablet visible) states, plus the **retry** flow.

---

## State Machine

```
State B: Normal
  children render → no error → children visible, tablet hidden
     ↓ (child throws during render)
State A: Error Caught
  Loki tablet visible, error.message shown, "Reweave the Thread" button active
     ↓ (user clicks "Reweave the Thread")
  setState({ hasError: false, error: null })
     ↓ (React re-renders children)
  ┌── children render successfully → State B (Loki tablet disappears)
  └── children throw again       → State A (Loki tablet re-appears immediately)
```

---

## Transition: Normal → Error Caught

**Trigger:** React's `getDerivedStateFromError` fires when a child throws during render.

**Behavior:**
- The children are unmounted and replaced by the Loki tablet.
- The tablet renders with `role="alert"` and `aria-live="assertive"` — screen readers
  announce the error immediately without requiring focus.
- `error.message` is captured and displayed in the inscription block.
- No animation on entry — error states should be immediate and legible, not decorative.
- The `console.error` call in `componentDidCatch` remains — provides stack trace to devtools.

**What does NOT change:**
- The containing element's size/position — ErrorBoundary is transparent when not in error state.
- Other panels or sections outside this ErrorBoundary — isolated to the wrapped subtree.

---

## Transition: Error → Retry → Normal (success)

**Trigger:** User clicks "Reweave the Thread" button.

**Behavior:**
1. `onClick` fires `setState({ hasError: false, error: null })`.
2. React re-renders the children.
3. Children render successfully → `hasError` stays `false` → Loki tablet is unmounted.
4. The space is returned to the children as if the error never happened.

**No loading state.** The re-render is synchronous. There is no intermediate "retrying..."
display between click and result.

---

## Transition: Error → Retry → Error (failure)

**Trigger:** Retry fires but child component throws again immediately.

**Behavior:**
1. `setState({ hasError: false })` fires → React re-renders.
2. Child throws during render → `getDerivedStateFromError` fires again.
3. `setState({ hasError: true, error: <new error> })` → Loki tablet re-appears.
4. The new `error.message` is shown (may be the same as before, or different).

**No debounce or retry limit.** If the underlying issue is persistent, the user will keep
seeing the Loki tablet. This is intentional — it surfaces the problem rather than hiding it.

**No toast or "retry failed" message** — the Loki tablet itself is the signal. Re-showing it
immediately after a failed retry is sufficient feedback.

---

## Custom Fallback Prop

If `ErrorBoundary` receives a `fallback` prop, that prop renders instead of the Loki tablet.
The Loki tablet is the **default fallback only** — it activates when no `fallback` prop is
provided.

```tsx
// Loki tablet (default):
<ErrorBoundary>
  <SomeComponent />
</ErrorBoundary>

// Custom fallback (Loki tablet NOT rendered):
<ErrorBoundary fallback={<MyCustomError />}>
  <SomeComponent />
</ErrorBoundary>
```

---

## Theme Behaviour

The Loki tablet uses only CSS custom properties (`--forge`, `--rune-border`, etc.).
When `[data-theme="light"]` is applied to `<html>` by the `useTheme` hook, all
CSS vars are automatically overridden — no component-level theme logic needed.

**Dark mode:** void-black background, trickster-green avatar rune, gold button.
**Light mode:** white background, same trickster-green avatar rune, darker gold button.

The designer's note on light-mode contrast for `--agent-accent-loki` (#22c55e) on
`--forge` (#ffffff): engineer should verify 4.5:1 ratio in browser devtools and adjust
the light-theme override for `--agent-accent-loki` if needed. The dark-theme value is
confirmed safe.

---

## Responsive Breakpoints

| Breakpoint | Behaviour |
|---|---|
| ≥600px | Full tablet with all elements at default sizes. Button centered, natural width. |
| <600px | Same layout — single column, no changes needed except font-size reductions. |
| ≤375px | Font sizes reduce (see wireframe §4). Retry button becomes `width: 100%` for tap target compliance. Rune border rows truncate with `overflow: hidden` — decorative loss is acceptable. |

---

## Accessibility Flow

1. Error is thrown → `role="alert" aria-live="assertive"` causes screen reader to announce
   the tablet's accessible name: "Loki has captured a component error".
2. Screen reader traverses: avatar label "Loki · The Trickster", heading "The Trickster Has
   Snared This Thread", subheading, then inscription label + message.
3. All rune glyphs are `aria-hidden="true"` — screen reader skips them.
4. Seal block is `aria-hidden="true"` entirely.
5. Focus is not automatically moved to the tablet (no `focus()` call). If the user was
   tabbing, focus stays in document flow. The `aria-live` announcement is sufficient.
6. Retry button is reachable via Tab. `aria-label` describes both action and purpose.

---

## Non-Goals (out of scope for this issue)

- Error reporting / telemetry on catch (separate concern).
- Stack trace display (devtools `console.error` covers this).
- Specific Loki animation on tablet entry — no animation, immediate render.
- Countdown or auto-retry — not in spec.
- Different Loki variants per error type — single personality, all errors.
