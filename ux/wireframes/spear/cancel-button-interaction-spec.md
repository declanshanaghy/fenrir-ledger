# Interaction Spec — Odin's Spear: Cancel Controls as Styled Buttons
**Issue #1475 · monitor-ui · Luna UX Design · 2026-03-19**

---

## Overview

Two cancel-job controls exist in Odin's Spear (the agent-monitoring UI):

1. **Session list row** — the running-status icon/badge inside `JobCard.tsx`
2. **Session detail header** — the running-status badge inside `SessionHeader` (in `LogViewer.tsx`)

Both are currently rendered as `<button>` elements but have their button chrome stripped:
- `JobCard` cancel: `.card-status--clickable` — no background, no border, no padding, no `cursor: pointer`
- `SessionHeader` cancel: `.job-status-badge.pulse` + inline `style={{ background:"none", border:"none", padding:0 }}` — inline styles override the badge class entirely

The fix adds full button affordance to both controls: visible chrome, pointer cursor, and explicit hover/focus/active state transitions.

---

## Scope

### What changes

| Location | Element | Class | Change |
|---|---|---|---|
| `JobCard.tsx` L90–102 | `<button className="card-status card-status--clickable pulse">` | `.card-status--clickable` | Add `cursor:pointer`, border, padding, text label, hover/active CSS |
| `LogViewer.tsx` L142–151 | `<button className="job-status-badge pulse">` | `.job-status-badge` (button variant) | Remove inline style overrides, add `.job-status-badge--cancel` modifier with hover/active CSS |

### What does NOT change

- Non-running status indicators (rendered as `<span>`, not `<button>`) — no change
- RagnarökDialog (cancel confirmation dialog) — no change
- Pin button, copy button, avatar button — no change
- Collapsed card (`.card--minimal`) — no cancel button is shown in collapsed state; no change

---

## State Definitions

### 1. Normal (idle, running)

Both controls visible only when `job.status === "running"`.

| Property | JobCard row | SessionHeader badge |
|---|---|---|
| Display | `⚡ Running` (icon + label) | `⚡ Running` (icon + label) |
| Cursor | `pointer` | `pointer` |
| Border | `1px solid --cancel-border` | `1px solid --cancel-border` |
| Background | `transparent` | `transparent` |
| Padding | `0.15rem 0.45rem` | `0.15rem 0.5rem` |
| Border-radius | `3px` | `3px` |
| Animation | `pulse` (opacity 1→0.35→1, 1.5s) | `pulse` (opacity 1→0.35→1, 1.5s) |
| Title tooltip | `"Invoke Ragnarök — click to cancel this job"` | `"Click to cancel this job"` |

### 2. Hover

Triggered by `mouseenter` / `:hover`.

| Property | Value |
|---|---|
| Background | `rgba(192, 80, 32, 0.18)` — warm amber/red tint |
| Border-color | `--cancel-border-hover` (brighter) |
| Color | `--cancel-color-hover` (brighter amber) |
| Animation | `none` (pause pulse on hover for clarity) |
| Transition | `background 0.12s, border-color 0.12s, color 0.12s` |

### 3. Focus (keyboard navigation)

Triggered by `:focus-visible` (Tab key, not mouse click).

| Property | Value |
|---|---|
| Outline | `2px solid var(--gold)` |
| Outline-offset | `2px` |
| Animation | `none` (pause pulse on focus for clarity) |
| Keyboard activation | Enter or Space opens RagnarökDialog |

Accessibility requirement: focus ring must be visible on both light and dark themes.
Use `var(--gold)` (existing token) as the outline color.

### 4. Active (mousedown / Space keydown)

Triggered by `:active`.

| Property | Value |
|---|---|
| Background | `rgba(192, 80, 32, 0.35)` — deeper fill |
| Transform | `scale(0.96)` — visible press depression |
| Border-color | `--cancel-border` (returns to normal, not brighter) |
| Transition | `transform 0.08s` |
| On release | Calls `onCancelJob(job.sessionId)` → opens RagnarökDialog |

### 5. Non-running / absent (disabled equivalent)

When `job.status !== "running"` or `onCancelJob` is not provided, the status indicator
renders as `<span>` (not `<button>`). No hover, no cursor change, no cancel affordance.
This is the existing behaviour — do not add button styling to non-running spans.

---

## CSS Implementation Guide

### New / updated CSS classes

#### `.card-status--clickable` (JobCard, `index.css`)

```css
/* existing */
.card-status--clickable {
  background: none;
  border: none;           /* CHANGE: add border */
  padding: 0;             /* CHANGE: add padding */
  cursor: default;        /* CHANGE: cursor: pointer */
  /* ... */
}

/* after */
.card-status--clickable {
  background: transparent;
  border: 1px solid var(--cancel-border, #c05020);
  padding: 0.15rem 0.45rem;
  border-radius: 3px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.72rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.card-status--clickable:hover {
  background: var(--cancel-bg-hover, rgba(192, 80, 32, 0.18));
  border-color: var(--cancel-border-hover, #e06030);
  color: var(--cancel-color-hover, #f0c040);
  filter: none;           /* remove existing brightness filter on hover */
  transform: none;        /* remove existing scale on hover */
  animation: none;
}
.card-status--clickable:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
  animation: none;
}
.card-status--clickable:active {
  background: var(--cancel-bg-active, rgba(192, 80, 32, 0.35));
  transform: scale(0.96);
  animation: none;
}
```

#### `.job-status-badge--cancel` (SessionHeader, `index.css`)

Add a new modifier class. Remove the inline `style` override from `LogViewer.tsx`.

```css
.job-status-badge--cancel {
  cursor: pointer;
  border-color: var(--cancel-border, #c05020);
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.job-status-badge--cancel:hover {
  background: var(--cancel-bg-hover, rgba(192, 80, 32, 0.18));
  border-color: var(--cancel-border-hover, #e06030);
  color: var(--cancel-color-hover, #f0c040);
  animation: none;
}
.job-status-badge--cancel:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
  animation: none;
}
.job-status-badge--cancel:active {
  background: var(--cancel-bg-active, rgba(192, 80, 32, 0.35));
  transform: scale(0.97);
  animation: none;
}
```

In `LogViewer.tsx`, change:
```tsx
// Before
<button
  className="job-status-badge pulse"
  style={{ color: STATUS_COLORS[job.status], cursor: "pointer", background: "none", border: "none", font: "inherit", padding: 0 }}
  ...
>

// After
<button
  className="job-status-badge job-status-badge--cancel pulse"
  style={{ color: STATUS_COLORS[job.status] }}
  ...
>
```

In `JobCard.tsx`, change (add text label alongside icon):
```tsx
// Before
<button className={`card-status card-status--clickable${pulse}`} style={{ color: sColor }} ...>
  {sIcon}
</button>

// After
<button className={`card-status card-status--clickable${pulse}`} style={{ color: sColor }} ...>
  {sIcon} {sLabel}
</button>
```

### CSS custom property additions (`index.css` `:root`)

```css
:root {
  --cancel-border: #c05020;
  --cancel-border-hover: #e06030;
  --cancel-bg-hover: rgba(192, 80, 32, 0.18);
  --cancel-bg-active: rgba(192, 80, 32, 0.35);
  --cancel-color-hover: #f0c040;
}
```

---

## Consistency Between Controls

Both controls must be visually consistent. The only permitted differences:

| Property | JobCard row | SessionHeader |
|---|---|---|
| Font-size | `0.72rem` (inherits card density) | `0.65rem` (inherits badge size) |
| Padding | `0.15rem 0.45rem` | `0.15rem 0.5rem` |
| Scale on active | `0.96` | `0.97` |
| Label visibility on small viewport | May hide text label at `<480px`, show icon only | Always shows text label |

---

## Accessibility

| Criterion | Requirement |
|---|---|
| WCAG 2.1 SC 1.4.3 (contrast) | Button text + border must meet 3:1 against background in both themes |
| WCAG 2.1 SC 2.1.1 (keyboard) | Both buttons reachable via Tab; Enter/Space activates |
| WCAG 2.1 SC 2.4.7 (focus visible) | Focus ring visible on both buttons in all themes |
| WCAG 2.1 SC 4.1.2 (name, role, value) | `aria-label="Cancel running job"` retained on both |
| Touch target | Min 44×44px touch target on mobile (use padding + min-height if needed) |

---

## Responsive Behaviour

### Viewport ≥ 480px (default)
Both controls: icon + text label (`⚡ Running`).

### Viewport < 480px
- **JobCard row**: text label may be hidden (`font-size: 0` or `display: none` on `.card-status--clickable .cancel-label`), leaving the icon-only button. Button chrome (border, padding) must still be visible.
- **SessionHeader**: text label always visible — it is the primary cancel affordance.

---

## Regression Guard

The following elements must NOT be affected by this change:

- `.card-status` (non-button status span) — no hover, no cursor change
- `.job-status-badge` (non-cancel badge spans for completed/failed/etc.) — no button behaviour
- Pin button (`.pin-btn`, `.card-pin-btn`) — unchanged
- Avatar button (`.card-avatar-btn`) — unchanged
- Copy session ID button — unchanged
- Command palette or any other TUI interactions — out of scope

---

## Files to Change

| File | Change |
|---|---|
| `development/monitor-ui/src/styles/index.css` | Update `.card-status--clickable` hover/active; add `.job-status-badge--cancel`; add CSS custom properties |
| `development/monitor-ui/src/components/LogViewer.tsx` | Replace inline style override with `.job-status-badge--cancel` class; add text label to button content |
| `development/monitor-ui/src/components/JobCard.tsx` | Add text label (`{sLabel}`) alongside `{sIcon}` in the cancel button |
