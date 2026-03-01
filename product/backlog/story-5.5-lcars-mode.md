# Story 5.5: LCARS Mode — Star Trek Easter Egg

- **As a**: Credit card churner and rewards optimizer (and builder / nerd culture enthusiast)
- **I want**: A hidden keyboard trigger that briefly transforms the app's UI into a Star Trek LCARS-style overlay
- **So that**: Developers, power users, and nerd culture explorers who discover it feel the product rewards their curiosity
- **Priority**: P3-Medium
- **Sprint Target**: 5
- **Status**: Ready

---

## Context / Problem

This story was deferred from Sprint 4 due to the sprint cap (5 stories, all higher priority). It is the first item in the deferred backlog (`product/backlog/future-deferred.md`) marked "Sprint 5, if capacity allows."

The full spec exists in `ux/easter-eggs.md` Easter Egg #6. This story is an implementation story — the design is already written. No new UX design work is required beyond Luna confirming the spec still matches the current state of the app.

This is a pure delight feature. It adds no functional value. It is the product's way of saying to FiremanDecko, to Loki, and to any developer who discovers it: "We see you. The wolf howls at stardate now."

---

## Desired Outcome

After this ships:

1. Pressing `Cmd+Shift+W` (Mac) / `Ctrl+Shift+W` (Windows/Linux) on any page triggers LCARS mode.
2. A full-viewport amber overlay fades in over the current page, styled in the LCARS aesthetic (Star Trek: TNG computer panels).
3. The overlay displays:
   - A "STARDATE" reading (derived from today's date in stardate format)
   - Current card counts by status (Active, Fee Approaching, Promo Expiring, Honored Dead)
   - A scan-line animation effect
4. After 5 seconds, the overlay performs a scan-line wipe exit and disappears.
5. The user can also dismiss early by pressing `Escape` or clicking anywhere on the overlay.

---

## LCARS Aesthetic Specification

Per `ux/easter-eggs.md` #6:

- **Background**: deep black (`#0a0a0f`)
- **Primary accent**: LCARS amber (`#ff9900`)
- **Secondary accent**: LCARS dusty orange (`#cc6600`)
- **Tertiary accent**: LCARS lavender (`#cc88ff`)
- **Typography**: `JetBrains Mono` (already in the design system) — monospace data readout feel
- **Layout**: a full-viewport `position: fixed` overlay with `z-index` above all other elements (above modals, above toasts)
- **LCARS panel shapes**: rectangular blocks with rounded corners on one side only — the classic asymmetric LCARS panel geometry. Implemented as simple CSS border-radius applied asymmetrically (e.g. `border-radius: 24px 4px 4px 24px`).
- **Scan-line entry animation**: a horizontal scan line sweeps top-to-bottom across the overlay as it fades in (0.4s)
- **Scan-line exit animation**: the same scan line sweeps bottom-to-top as the overlay fades out (0.4s), then the overlay is removed from the DOM

---

## Stardate Calculation

Classic TNG stardate format: `YYMM.DD` where `YY` is the two-digit year (offset from 2323 to the current year in the show's timeline). For the purposes of this easter egg, use a simplified stardate derived directly from today's date:

```
stardate = (currentYear - 1987) * 1000 + (dayOfYear / 365 * 1000)
```

Display format: `STARDATE [value].{fractional}`

Example: 2026-02-28 → approximately `STARDATE 39154.4`

This does not need to match any canonical formula precisely — the vibe is what matters.

---

## Data Display

The LCARS overlay displays the following card data (read live from the current household at trigger time):

```
FENRIR LEDGER TACTICAL REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STARDATE {value}

CARD STATUS SUMMARY
  ACTIVE              {n}
  FEE APPROACHING     {n}
  PROMO EXPIRING      {n}
  HONORED DEAD        {n}
  ──────────────────
  TOTAL               {n}

SYSTEM STATUS: NOMINAL
RAGNAROK THREAT LEVEL: {NONE / ELEVATED / CRITICAL}
```

`RAGNAROK THREAT LEVEL` maps from the `RagnarokContext` introduced in Story 4.1:
- `NONE` — fewer than 3 urgent cards
- `ELEVATED` — 3–4 urgent cards (Ragnarök active)
- `CRITICAL` — 5+ urgent cards

---

## Trigger

- **Key combo**: `Cmd+Shift+W` (Mac) / `Ctrl+Shift+W` (Windows/Linux)
- **Scope**: global keyboard listener, active on all pages
- **Guard**: if LCARS mode is already visible, the key combo is a no-op
- **Conflict check**: `Ctrl+W` is the browser's "close tab" shortcut; `Ctrl+Shift+W` closes all tabs in some browsers. FiremanDecko must verify `e.preventDefault()` is called on the keydown event to suppress the browser's default behavior. If suppression is not possible across all target browsers, propose an alternative key combo at implementation time.

---

## Interaction with Existing Easter Eggs

- LCARS mode does not conflict with the Konami code howl.
- LCARS mode does not conflict with Ragnarök mode — if both are active simultaneously, the LCARS overlay renders above the Ragnarök red overlay. The LCARS overlay's `z-index` must be above all other layers.
- LCARS mode does not contribute to or subtract from the Gleipnir Hunt fragment collection.

---

## Acceptance Criteria

- [ ] Pressing `Cmd+Shift+W` (Mac) or `Ctrl+Shift+W` (Windows/Linux) on any page triggers the LCARS overlay
- [ ] The overlay covers the full viewport with a fixed-position panel in LCARS amber/black aesthetic
- [ ] The overlay displays the stardate (derived from today's date using the simplified formula)
- [ ] The overlay displays card counts by status (active, fee_approaching, promo_expiring, closed) read live from the current household
- [ ] The overlay displays the Ragnarök threat level derived from the current urgent card count
- [ ] The overlay auto-dismisses after 5 seconds with a scan-line wipe exit animation
- [ ] Pressing `Escape` or clicking anywhere on the overlay dismisses it immediately
- [ ] Triggering the key combo while LCARS mode is already visible is a no-op
- [ ] The overlay's z-index is above all other app elements (modals, toasts, Ragnarök overlay)
- [ ] The entry animation is a downward scan-line sweep (0.4s); the exit animation is an upward scan-line wipe (0.4s)
- [ ] The trigger key combo does not allow the browser's default action (tab close) to fire
- [ ] The overlay is `aria-hidden="true"` — it must not be reachable by keyboard navigation or screen readers
- [ ] After dismissal, keyboard focus returns to whatever element was focused before the overlay appeared
- [ ] `npm run build` passes with zero errors
- [ ] TypeScript strict mode: zero new type errors introduced

---

## Technical Notes for FiremanDecko

**Component**: `LcarsOverlay.tsx` — a new client component rendered in `AppShell` alongside `KonamiHowl` and the Ragnarök overlay. It holds its own `visible` state.

**Keyboard listener**: `useEffect` on mount, `window.addEventListener("keydown", handler)`. Check `e.metaKey` (Mac Cmd) or `e.ctrlKey` plus `e.shiftKey` and `e.key === "W"`. Call `e.preventDefault()` to suppress browser defaults.

**Card data**: Read from the current household using `getAllCardsGlobal(householdId)`. Count by status. The `householdId` is available from whatever auth context the app uses. Use `getClosedCards(householdId)` for the "Honored Dead" count.

**Ragnarök integration**: Consume `useRagnarok()` context (introduced in Story 4.1) to get the `ragnarok` boolean and the raw urgent count. Map count to the three threat levels.

**z-index**: Use `z-index: 500` (above the modal layer at `z-index: 200`, above the Ragnarök overlay at `z-index: 1`). Document in the z-index table in `wireframes.md` or `architecture/`.

**Scan-line animation**: A single `<div>` with `position: absolute`, `width: 100%`, `height: 2px`, `background: amber`, animated via CSS `@keyframes` to translate from `top: 0` to `top: 100%` over 0.4s on entry, reversed on exit.

**Auto-dismiss timer**: Use `useEffect` with a `setTimeout` of 5000ms when `visible` becomes `true`. Clean up with `clearTimeout` on component unmount and on early dismiss to prevent state updates on unmounted components.

**Stardate formula**: Implement as a pure utility function in a new file `development/src/src/lib/stardate.ts`. Keep it separate for testability. The formula is simple arithmetic — no dependencies.

**LCARS font**: Use `JetBrains Mono` — already loaded in the design system. No new font imports needed.

---

## Open Questions for FiremanDecko

1. **`Ctrl+Shift+W` browser conflict**: In Chrome and Firefox on Windows/Linux, `Ctrl+Shift+W` closes all windows in the browser. `e.preventDefault()` may or may not prevent this depending on the browser. If it cannot be prevented reliably, the fallback key combo is `Ctrl+Shift+L` (L for "LCARS"). Product preference: try `Ctrl+Shift+W` first; if it cannot be safely suppressed, use `Ctrl+Shift+L`. Document the actual key combo used in a comment in the component.

2. **Mobile trigger**: There is no physical keyboard on most mobile devices. The LCARS easter egg is effectively desktop-only. Confirm this is acceptable — product preference is yes, desktop-only is fine for this easter egg.

---

## UX Notes

Luna to review `ux/easter-eggs.md` #6 and confirm the LCARS spec is still accurate relative to the current app state. If any visual refinements are needed (color tweaks, layout adjustments), Luna should update the easter eggs doc before FiremanDecko begins implementation.

No new wireframe is required — the easter-eggs.md spec is sufficient for this story.

---

## Mythology Frame

In the halls of the Federation, a war room is a bridge. In the halls of Fenrir, a bridge is a war room. For five seconds, both are true. LCARS is the dream Odin had when he traded his eye for a glimpse of what lay beyond Yggdrasil.

*"Computer: current stardate." — The wolf, briefly.*
