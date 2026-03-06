# Interactions & Animations: Fenrir Ledger

Animation philosophy: **one well-orchestrated moment beats ten scattered micro-interactions**. Every animation must earn its place. Dark themes amplify animation — use this.

---

## Principles

1. **Orchestrated reveals, not scattered noise** — staggered entrance animations on page load, not on every button hover
2. **CSS-first** — prefer `@keyframes` + `animation-delay` over JS animation libraries for layout animations
3. **Motion library for React state transitions** — use `framer-motion` for conditional mount/unmount animations (card appearing, Howl panel toggling)
4. **Duration discipline** — entrance: 300–500ms; hover: 150–200ms; emphasis: 600–800ms; easter eggs: no limit
5. **Timing function**: `cubic-bezier(0.16, 1, 0.3, 1)` (expo out) for entrances; `ease-out` for exits

---

## Page Load: The Saga Reveal

On dashboard load, elements stagger in from a unified dark void. This is the primary "wow" moment.

```css
/* Staggered children on .saga-reveal parent */
.saga-reveal > * {
  opacity: 0;
  transform: translateY(12px);
  animation: saga-enter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.saga-reveal > *:nth-child(1) { animation-delay: 0ms; }
.saga-reveal > *:nth-child(2) { animation-delay: 60ms; }
.saga-reveal > *:nth-child(3) { animation-delay: 120ms; }
.saga-reveal > *:nth-child(4) { animation-delay: 180ms; }
.saga-reveal > *:nth-child(n+5) { animation-delay: 240ms; }

@keyframes saga-enter {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Order**: Header nav → Summary stats bar → Card grid (cards stagger individually) → Howl panel

---

## Card Component Animations

### Card Hover

Not a simple `box-shadow` change. The gold aura breathes in:

```css
.card-chain {
  transition: transform 150ms ease-out, box-shadow 200ms ease-out, border-color 200ms ease-out;
}
.card-chain:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 0 1px #2a2d45, 0 0 20px rgba(201, 146, 10, 0.2);
  border-color: #c9920a;
}
```

### Card Appearing (new card added)

Using Framer Motion `AnimatePresence`:

```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.96, y: 8 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.94, y: -4 }}
  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
>
  <CardChain card={card} />
</motion.div>
```

### Card Sent to Valhalla (close/cancel)

```tsx
// Card exit animation — "descends"
exit={{ opacity: 0, y: 24, scale: 0.95, filter: 'sepia(1) brightness(0.4)' }}
transition={{ duration: 0.5, ease: 'easeIn' }}
```

After the animation: rune ᛏ (Tiwaz) briefly appears where the card was, then fades.

---

## Status Ring (Deadline Countdown)

A circular SVG progress ring around each card's issuer initials. As time runs out, it drains and shifts color.

```tsx
// SVG ring — strokeDashoffset drives progress
const circumference = 2 * Math.PI * 18 // r=18
const progress = daysRemaining / totalDays
const offset = circumference * (1 - Math.min(progress, 1))

// Color by realm
const strokeColor =
  daysRemaining <= 0   ? '#ef4444' :  // ragnarok
  daysRemaining <= 30  ? '#c94a0a' :  // muspelheim
  daysRemaining <= 60  ? '#f59e0b' :  // hati
  '#0a8c6e'                           // asgard
```

**Pulse animation** when `daysRemaining <= 30`:

```css
@keyframes muspel-pulse {
  0%, 100% { opacity: 1; filter: drop-shadow(0 0 4px rgba(201, 74, 10, 0.6)); }
  50%       { opacity: 0.7; filter: drop-shadow(0 0 10px rgba(201, 74, 10, 0.9)); }
}
.ring--urgent {
  animation: muspel-pulse 1.8s ease-in-out infinite;
}
```

---

## The Howl Panel

The urgent sidebar slides in from the right using Framer Motion:

```tsx
<AnimatePresence>
  {hasUrgentCards && (
    <motion.aside
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <HowlPanel cards={urgentCards} />
    </motion.aside>
  )}
</AnimatePresence>
```

When a new urgent card appears, the panel header (raven icon) performs a single shake:

```css
@keyframes raven-warn {
  0%, 100% { transform: rotate(0deg); }
  20%       { transform: rotate(-12deg); }
  40%       { transform: rotate(10deg); }
  60%       { transform: rotate(-6deg); }
  80%       { transform: rotate(4deg); }
}
.raven-icon--warning {
  animation: raven-warn 0.6s ease-out;
}
```

---

## Loading States

### Skeleton Screens

Card skeleton uses animated gradient shimmer in the gold palette, not gray:

```css
@keyframes saga-shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.skeleton {
  background: linear-gradient(
    90deg,
    #0f1018 0%, #1e2235 40%, #2a2d45 50%, #1e2235 60%, #0f1018 100%
  );
  background-size: 800px 100%;
  animation: saga-shimmer 1.4s ease-in-out infinite;
}
```

### Loading Copy

A rotating Norn message appears beneath the skeleton (see `../product/copywriting.md`): *"The Norns are weaving..."*

---

## Form Interactions

### Field Focus

```css
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: #c9920a;
  box-shadow: 0 0 0 1px rgba(201, 146, 10, 0.3), 0 0 12px rgba(201, 146, 10, 0.1);
  transition: border-color 150ms ease-out, box-shadow 150ms ease-out;
}
```

### Save Success (Card Forged)

When a card is saved, a brief golden flash on the submit button:

```css
@keyframes forge-flash {
  0%   { background-color: var(--gold); box-shadow: 0 0 0 rgba(201, 146, 10, 0); }
  30%  { background-color: #f0b429; box-shadow: 0 0 20px rgba(201, 146, 10, 0.6); }
  100% { background-color: var(--gold); box-shadow: 0 0 0 rgba(201, 146, 10, 0); }
}
.btn-forge--success {
  animation: forge-flash 0.7s ease-out;
}
```

---

## Easter Egg Animations

### Wolf Rise (Konami Code)

```css
@keyframes wolf-rise {
  0%   { transform: translateY(100%) scaleX(1); opacity: 0; }
  20%  { opacity: 0.8; }
  70%  { transform: translateY(0%) scaleX(1); }
  80%  { transform: translateY(-5%) scaleX(1.05); }  /* head bob */
  90%  { transform: translateY(2%) scaleX(0.98); }
  100% { transform: translateY(0%) scaleX(1); opacity: 0.9; }
}

@keyframes wolf-descend {
  0%   { transform: translateY(0); opacity: 0.9; }
  100% { transform: translateY(100%); opacity: 0; }
}

.wolf-silhouette {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 320px;
  z-index: 9999;
  pointer-events: none;
  animation: wolf-rise 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards,
             wolf-descend 0.6s ease-in 3s forwards;
}
```

### Saga Shake (Konami + Ragnarök)

```css
@keyframes saga-shake {
  0%, 100% { transform: translateX(0); }
  15%       { transform: translateX(-6px); }
  30%       { transform: translateX(6px); }
  45%       { transform: translateX(-4px); }
  60%       { transform: translateX(4px); }
  75%       { transform: translateX(-2px); }
  90%       { transform: translateX(2px); }
}
.saga-shaking {
  animation: saga-shake 0.5s ease-out;
}
```

### Gleipnir Shimmer (Hunt Complete)

```css
@keyframes gleipnir-shimmer {
  0%   { filter: brightness(1) saturate(1); }
  25%  { filter: brightness(1.3) saturate(1.5) hue-rotate(10deg); }
  50%  { filter: brightness(1.1) saturate(1.2) hue-rotate(-5deg); }
  75%  { filter: brightness(1.2) saturate(1.4); }
  100% { filter: brightness(1) saturate(1); }
}
html.gleipnir-complete {
  animation: gleipnir-shimmer 2s ease-in-out;
}
```

---

## Scroll Behavior

- **Smooth scrolling**: `scroll-behavior: smooth` on `html`
- **Header**: Sticky, gains a subtle blur + gold underline on scroll:
  ```css
  .site-header--scrolled {
    backdrop-filter: blur(12px);
    border-bottom-color: rgba(201, 146, 10, 0.3);
    background-color: rgba(7, 7, 13, 0.85);
    transition: all 200ms ease-out;
  }
  ```

---

## Custom Cursor (Optional Enhancement)

On the card grid and timeline view, switch to a wolf paw cursor:

```css
/* Wolf paw SVG cursor — 32x32 hotspot at 8,8 */
.card-grid {
  cursor: url('/cursors/wolf-paw.svg') 8 8, pointer;
}
```

On the Norns/timeline view: switch to a spindle cursor (16x16 hotspot at center).

Only implement if SVG cursors are stable across target browsers. Falls back gracefully to `pointer`.

---

## Typography Scale (Issue #149)

A proportional font size increase across the entire app for modern readability. This is a polish pass, not a redesign -- the Saga Ledger aesthetic (dark Nordic, Cinzel/Source Serif 4/JetBrains Mono) is preserved. Visual hierarchy is maintained; everything simply scales up.

**Reference:** Stripe docs/dashboard typography as the readability benchmark.

### Font Size Scale

| Level | Role | Before (px) | After (px) | Tailwind Before | Tailwind After |
|-------|------|-------------|------------|-----------------|----------------|
| H1 | Page title (display) | 24 | 32 | text-2xl | text-3xl / text-[32px] |
| H2 | Section heading | 18 | 24 | text-lg | text-2xl |
| H3 | Card / panel heading | 14 | 18 | text-sm | text-lg |
| H4 | Subheading / fieldset legend | 12 | 16 | text-xs | text-base |
| Body | Primary body text | 14 | 16 | text-sm | text-base |
| Body Small | Secondary text, descriptions | 12 | 14 | text-xs | text-sm |
| Label | Form labels, stat labels | 12 | 14 | text-xs | text-sm |
| Meta | Timestamps, footnotes, helper | 11 | 13 | text-[11px] | text-[13px] |
| Code / Mono | Dates, amounts, data values | 12 | 14 | text-xs font-mono | text-sm font-mono |
| Button | Button labels, CTAs | 12 | 14 | text-xs | text-sm |
| Badge | Status badges, realm tags | 10 | 12 | text-[10px] | text-xs |
| Nav Item | Sidebar navigation links | 12 | 14 | text-xs | text-sm |
| Input | Form input text | 12 | 16 | text-xs | text-base |

### Base CSS Change

```css
/* globals.css — @layer base */
body {
  font-size: 16px; /* was 14px */
}
```

This single change affects every element that inherits `font-size` from `body` without an explicit Tailwind class.

### Tailwind Migration Strategy

The primary approach is a systematic class migration:

| Current Class | New Class | Scope |
|---------------|-----------|-------|
| `text-xs` (12px) | `text-sm` (14px) | Labels, buttons, nav, body-small, code |
| `text-sm` (14px) | `text-base` (16px) | Body text, card names, descriptions |
| `text-base` (16px) | `text-lg` (18px) | Only where used for subheadings |
| `text-lg` (18px) | `text-2xl` (24px) | Section headings |
| `text-2xl` (24px) | `text-3xl` / `text-[32px]` | Page titles (H1) |
| `text-[10px]` | `text-xs` (12px) | Badges, uppercase labels |
| `text-[11px]` | `text-[13px]` | Metadata, timestamps |

**Audit scope:** 260 occurrences of `text-xs` or `text-sm` across 51 source files. Each should be reviewed in context -- not a blind find-replace.

### Non-Negotiable Requirements

1. **Input font-size must be 16px on all viewports** -- prevents iOS Safari zoom-on-focus. This was already documented for the anonymous checkout email field; it now applies universally to all `<input>`, `<textarea>`, and `<select>` elements.
2. **Visual hierarchy preserved** -- the relative size ratios between levels must remain consistent. H1 is always significantly larger than body, body is always larger than meta.
3. **Mobile at 375px must not overflow** -- the H1 at 32px may need a responsive step-down to 28px on mobile (`text-[28px] md:text-3xl`).

### Exceptions (Do Not Change)

| Component | Current Size | Reason |
|-----------|-------------|--------|
| `ConsoleSignature.tsx` | Various | ASCII art alignment |
| `LcarsOverlay.tsx` | text-xs, text-[10px] | LCARS aesthetic requires dense text |
| Gleipnir copyright tooltip (globals.css `::after`) | 10px | Easter egg hint, not primary UI |

### Components Requiring Special Attention

These components have the highest density of small text and will need careful review:

| Component | Occurrences | Notes |
|-----------|-------------|-------|
| `TopBar.tsx` | 14 | Brand, avatar, dropdown text |
| `HowlPanel.tsx` | 12 | Alert items, deadlines, actions |
| `AboutModal.tsx` | 12 | Team credits, ingredients list |
| `CardForm.tsx` | 11 | Labels, inputs, fieldset legends |
| `ImportWizard.tsx` | 14 | Step labels, instructions |
| `StripeSettings.tsx` | 15 | Subscription status, buttons |
| `valhalla/page.tsx` | 15 | Tombstone cards, metadata |
| `SafetyBanner.tsx` | 12 | Warning text, descriptions |

### Wireframe

See [Font Size Scale wireframe](wireframes/accessibility/font-size-scale.html) for a visual before/after comparison of the typography hierarchy and component samples (card tile, form, sidebar, Howl panel).

---

## Button Feedback States (Issue #150)

All interactive buttons across the app must provide visual feedback on hover, click, and during async operations. See [wireframes/chrome/button-feedback-states.html](wireframes/chrome/button-feedback-states.html) for the full visual spec.

### Trigger
User hovers over, clicks, or triggers an async action via any button.

### Behavior

**Hover (CSS-only, :hover pseudo-class):**
1. Primary (gold) buttons: `filter: brightness(1.15)` + border glow (gold tint box-shadow).
2. Secondary/ghost buttons: subtle background fill (`rgba(255,255,255,0.05)`), border brightens.
3. Destructive buttons: danger color intensifies, subtle red background tint.
4. Transition: `150ms ease-out` on filter, border-color, background-color, box-shadow.

**Active/Pressed (CSS-only, :active pseudo-class):**
1. All variants: `transform: scale(0.97)` + `filter: brightness(0.9)`.
2. Transition: `80ms ease-out` -- must feel instantaneous.
3. Provides "click registered" feedback before any async work begins.

**Loading (React state, for async buttons only):**
1. On click, set `isLoading = true` in component state.
2. Render: 14px circular spinner (CSS rotate animation, 0.8s linear infinite) + contextual text ("Redirecting...", "Saving...", "Canceling...").
3. Button receives `disabled` + `aria-busy="true"` + `aria-disabled="true"`.
4. Opacity drops to 0.7, cursor changes to `not-allowed`, `pointer-events: none`.
5. Sibling action buttons in the same group also become disabled (opacity 0.4) to prevent conflicting actions.
6. On success: loading state clears (redirect happens or operation completes).
7. On error: revert to default state, show error toast via sonner (5s auto-dismiss).

**Disabled (static, not loading):**
1. Opacity 0.4, cursor `not-allowed`, no hover/active effects.
2. `aria-disabled="true"`.

### Flow Diagram

```mermaid
stateDiagram-v2
    classDef primary fill:#03A9F4,stroke:#0288D1,color:#FFF

    [*] --> Default: Button rendered

    Default --> Hover: Mouse enters (CSS :hover)
    Hover --> Default: Mouse leaves
    Hover --> Active: Mouse down (CSS :active)
    Active --> Hover: Mouse up (still hovering)
    Active --> Loading: Mouse up triggers async action

    Default --> Loading: Click triggers async action
    Loading --> Default: Success (redirect or complete)
    Loading --> Default: Failure (revert + error toast)

    Default --> Disabled: External condition
    Disabled --> Default: Condition clears

    class Loading primary
```

### States
- **Default**: Normal appearance, interactive, cursor: pointer.
- **Hover**: Brightness shift + border glow (CSS-only, 150ms).
- **Active**: Scale down + darken (CSS-only, 80ms).
- **Loading**: Spinner + text + disabled + aria-busy (React state).
- **Disabled**: Reduced opacity + not-allowed cursor (static).

### Animations/Transitions

| Property | Duration | Easing | Notes |
|----------|----------|--------|-------|
| filter (hover) | 150ms | ease-out | Brightness shift |
| border-color (hover) | 150ms | ease-out | Glow effect |
| background-color (hover) | 150ms | ease-out | Secondary/destructive fill |
| box-shadow (hover) | 150ms | ease-out | Gold glow on primary |
| transform (active) | 80ms | ease-out | scale(0.97) press effect |
| opacity (loading/disabled) | 150ms | ease-out | Fade to loading/disabled |
| spinner rotation | 800ms | linear | Infinite loop |

### Edge Cases
- **Double-click prevention**: Loading state disables the button immediately on first click. `pointer-events: none` prevents any queued events.
- **Fast operations (localStorage)**: If the operation completes in under 300ms, show loading state for a minimum of 300ms to avoid jarring flicker.
- **Redirect operations (Stripe)**: Loading state persists until the page navigates away. If the redirect takes over 10s, show an error toast and revert.
- **Touch devices**: No hover state available. Active (scale 0.97) provides the primary tap feedback. Use `@media (hover: hover)` to scope hover styles to devices that support it.
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables scale transforms and spinner rotation. Opacity changes are preserved (not motion).
- **Keyboard navigation**: `:focus-visible` ring must remain visible and meet WCAG 2.1 AA 3:1 contrast. Loading state announced via `aria-busy`.
