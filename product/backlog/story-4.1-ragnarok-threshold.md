# Story 4.1: Ragnarök Threshold Mode

- **As a**: Credit card churner and rewards optimizer
- **I want**: The app to visually escalate when I have multiple cards in critical status simultaneously
- **So that**: I feel the urgency of multiple approaching deadlines — not just one card's badge turning orange, but the entire war room going to red
- **Priority**: P1-Critical
- **Sprint Target**: 4
- **Status**: Done

---

## Context / Problem

The Saga Ledger's mythology is built around the idea that annual fees are wolves chasing you across the sky. When multiple wolves catch up at once — that is Ragnarök. Right now, a user with 4 cards all going fee-critical at the same time sees the same UI as a user with zero urgent cards. There is no escalation. The emotional design contract is broken.

Ragnarök threshold mode is the app's single most important visual alarm: when ≥ 3 cards are simultaneously `fee_approaching` or `promo_expiring`, the entire UI shifts register. This is not a toast. This is an atmosphere change.

This story is P1 because it directly serves the core product promise: never let a fee surprise you. Visual escalation is the last line of defense before a missed deadline.

---

## Desired Outcome

When a user reaches ≥ 3 cards with `fee_approaching` or `promo_expiring` status simultaneously:

1. The background gains a deep red radial overlay (CSS-only, no JS layout thrash)
2. Gold accents shift toward blood orange (`#c94a0a`)
3. The browser `<title>` becomes `Ragnarök — Fenrir Ledger`
4. The Howl panel header glows red and reads: *"Ragnarök approaches. Multiple chains tighten."*
5. Konami code during Ragnarök plays the wolf howl at maximum intensity (existing `KonamiHowl` component reads a context flag)
6. When cards drop below threshold, the mode resolves automatically — no manual dismiss needed

---

## Interactions and User Flow

1. User has 0-2 urgent cards: normal UI. No change.
2. User reaches 3rd urgent card (by adding a card, editing a date, or time passing): Ragnarök mode activates within one render cycle.
3. Ragnarök mode active: red overlay visible across all pages (not just dashboard). Title updates.
4. User closes/resolves a card so urgent count drops to 2: Ragnarök resolves. UI returns to normal. Transition must be graceful (CSS transition, not a flash).
5. During Ragnarök: if user triggers Konami code, the howl plays at `volume = 1.0` instead of `0.25`.

---

## Look and Feel Direction

- **Red overlay**: `radial-gradient(ellipse at 50% 0%, rgba(150, 30, 10, 0.18) 0%, transparent 65%)` applied as a pseudo-element on `<body>` or a fixed full-viewport `<div>` with `pointer-events: none`. Do NOT use `filter` on the root — it will break stacking contexts for all the modals.
- **Accent shift**: CSS custom property `--ragnarok` toggled on `<html>` (e.g. `class="ragnarok"`) so all downstream gold-colored elements can optionally shift via the class. Keep shifts subtle — only Howl panel header and key accents, not every element on screen.
- **No layout shift**: The overlay must be `position: fixed`, `inset: 0`, `pointer-events: none`, and `z-index` below modals/toasts.
- **Transition**: 1.2s ease-in on activation; 0.8s ease-out on deactivation.

---

## Acceptance Criteria

- [ ] When ≥ 3 cards have `fee_approaching` or `promo_expiring` status, the app enters Ragnarök mode within one render cycle of the threshold being crossed
- [ ] Ragnarök mode: a red radial overlay is visible on the dashboard — does not obstruct readability or interaction
- [ ] Ragnarök mode: the browser `<title>` on the dashboard page reads `Ragnarök — Fenrir Ledger`
- [ ] Ragnarök mode: the HowlPanel header reads *"Ragnarök approaches. Multiple chains tighten."* (overrides normal empty-state copy)
- [ ] When the urgent card count drops below 3, Ragnarök mode deactivates within one render cycle
- [ ] Transitions in and out are CSS-animated (no jarring flash)
- [ ] Ragnarök overlay does not block clicks, form inputs, or keyboard navigation
- [ ] Konami code during Ragnarök triggers the wolf howl at maximum volume (`1.0`)
- [ ] Konami code outside Ragnarök continues to use normal volume (`0.25`)
- [ ] Ragnarök mode does not affect the Valhalla page (closed cards are beyond the storm)
- [ ] No WCAG AA contrast violations introduced by the red overlay on foreground text
- [ ] Ragnarök state is computed from live card data — does not require a page refresh to activate/deactivate

---

## Technical Notes for FiremanDecko

**Code audit completed (Sprint 4 groom)**: `KonamiHowl.tsx` already reads card data from `getAllCardsGlobal()` and checks for `fee_approaching || promo_expiring` cards to decide whether to show the Ragnarök pulse flash. However, it does not read a shared `RagnarokContext` — it reads cards independently. This story must add the shared context so `HowlPanel` and the volume escalation are coordinated. The existing pulse check in `KonamiHowl` is complementary, not conflicting.

**State computation**: `computeCardStatus()` in `card-utils.ts` already determines `fee_approaching` and `promo_expiring`. Count urgentCards where `status === 'fee_approaching' || status === 'promo_expiring'`. If `urgentCards.length >= 3`, Ragnarök.

**React context pattern** (recommended): Create a `RagnarokContext` (or add a `ragnarok: boolean` field to an existing dashboard state) and provide it from the `AppShell` or a dedicated `RagnarokProvider` wrapping the layout. Components that need to read the state (HowlPanel, KonamiHowl) consume this context.

**KonamiHowl volume escalation**: The component currently hardcodes no volume variable — the wolf silhouette SVG plays via `AudioContext`. Inspect `KonamiHowl.tsx` to find the audio trigger path. If it uses a static amplitude, add a `useRagnarok()` context consumer that adjusts gain on the audio node. If no audio node is currently wired (the howl is visual-only), this criterion is trivially met and may be annotated as "audio not yet implemented" in the QA handoff.

**Overlay approach**: A `<div>` in AppShell with:
```tsx
<div
  aria-hidden="true"
  className={`fixed inset-0 pointer-events-none transition-opacity duration-[1200ms]
              ${ragnarok ? 'opacity-100' : 'opacity-0'}`}
  style={{
    background: 'radial-gradient(ellipse at 50% 0%, rgba(150,30,10,0.18) 0%, transparent 65%)',
    zIndex: 1, // above background, below all content
  }}
/>
```

**KonamiHowl integration**: `KonamiHowl.tsx` currently hardcodes `HOWL_TARGET_VOLUME = 0.25`. It needs to read the `ragnarok` context flag and use `1.0` when active. The component is already in AppShell — wiring context is straightforward.

**Title update**: Use Next.js `<title>` metadata — but since metadata is per-route, the simplest approach is a `useEffect` on the dashboard page that sets `document.title` when `ragnarok` is true and resets it on cleanup. Not ideal for SEO but acceptable for an easter egg state.

**HowlPanel header copy**: HowlPanel currently renders a fixed header. It needs to accept a `ragnarok` prop (or consume context) and conditionally render the Ragnarök copy.

**Do NOT**: use CSS `filter` on any layout-level element. It will create a stacking context and break all portal-rendered modals (Dialog, Sheet, etc.).

**Valhalla exclusion**: Ragnarök mode should not activate on `/valhalla`. The overlay div can read `pathname` from `usePathname()` and render `null` on that route.

---

## Open Questions Resolved

- **Threshold**: ≥ 3 urgent cards. This matches the easter eggs doc and mythology-map. Not configurable in Sprint 4 — hard-coded.
- **Which statuses count**: `fee_approaching` and `promo_expiring` both count. `active` and `closed` do not. Overdue (future status) would count.
- **Konami volume behavior**: Double intensity = `volume: 1.0`, not literally double the normal value. Capped at max.
- **localStorage migration wizard**: Explicitly deferred — see future section.

---

## UX Notes

See `ux/easter-eggs.md` #8 and `ux/interactions.md` for the saga-shake animation spec (reused during Konami in Ragnarök state). The wolf-rise animation is unchanged — only volume increases.

---

## Future (Not Sprint 4)

- Configurable Ragnarök threshold in settings
- Ragnarök-specific sound effect distinct from the normal howl
