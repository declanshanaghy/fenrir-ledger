# Story 4.3: Gleipnir Hunt — Wire the Two Missing Triggers (Fragments 4 and 6)

- **As a**: Credit card churner and rewards optimizer who has been exploring the app
- **I want**: All six Gleipnir fragments to be discoverable through natural app use
- **So that**: Finding all six and watching the app shimmer is a real, achievable reward for curious exploration — not a half-finished promise
- **Priority**: P2-High
- **Sprint Target**: 4
- **Status**: Done

---

## Context / Problem

The Gleipnir Hunt is the signature easter egg of Fenrir Ledger — six hidden phrases scattered across the UI that, when all found, unlock a special Valhalla entry. It is the most ambitious hidden system in the product.

After Sprint 3, the status is:

| Fragment | Ingredient | Trigger | Status |
|----------|-----------|---------|--------|
| 1 | *The sound of a cat's footfall* | Click/hover the SyncIndicator dot (bottom-right) | **Wired and shipped** |
| 2 | *The beard of a woman* | Click the ingredient text in the About modal | **Wired and shipped** |
| 3 | *The roots of a mountain* | First sidebar collapse | **Wired and shipped** |
| 4 | *The sinews of a bear* | TBD — trigger undefined | **Modal exists; trigger missing** |
| 5 | *The breath of a fish* | Hover the © in the Footer | **Wired and shipped** |
| 6 | *The spittle of a bird* | TBD — trigger undefined | **Modal exists; trigger missing** |

Fragments 4 and 6 have modals (`GleipnirBearSinews.tsx` and `GleipnirBirdSpittle.tsx`) fully implemented but no trigger is wired. The hunt is uncompletable. This story fixes that.

Additionally, when all 6 fragments are found, the Valhalla page should gain a special "Gleipnir" entry and the page should play the `gleipnir-shimmer` CSS animation. This unlock mechanic is also not yet implemented.

---

## Fragment 4: The Sinews of a Bear — Trigger Decision

**Placement**: The card detail view / edit form (`/cards/[id]` or the edit dialog). When the user saves a card for the **seventh time** — the number 7 is already a magic number in Fenrir Ledger (Loki's children). On the seventh save of any card, the ingredient *"The sinews of a bear"* briefly appears as a flash over the forge-success animation, and the modal fires.

**Rationale**: Bears are associated with strength and endurance. Editing a card 7 times means you've been maintaining it — persistent, methodical. This rewards the dedicated optimizer who keeps their ledger updated.

**Alternative placement considered and rejected**: A tooltip on the credit limit field — too discoverable, breaks the "impossible things" theme (the sinews of a bear are invisible, not something you'd hover over a number field to find).

**Implementation approach**: Count saves per card in localStorage under `fenrir:card-saves:{cardId}`. On reaching 7, trigger the fragment. The count only needs to track "has this threshold been hit for this card" — it does not need to count across cards.

**Simpler alternative** (if 7-save tracking adds complexity FiremanDecko wants to defer): The trigger can be the card-delete confirm button — a long press (600ms) on the "Delete" button in the confirmation dialog. Long-press is unexpected, rewarding, and thematically appropriate (the sinews of a bear require force to break). This is a valid fallback.

---

## Fragment 6: The Spittle of a Bird — Trigger Decision

**Placement**: The Valhalla page empty state. When a user visits Valhalla with zero closed cards and waits on the page for **15 seconds without interaction**, the `GleipnirBirdSpittle` modal fires.

**Rationale**: The Valhalla empty state already has an `aria-description="the beard of a woman"` placeholder comment from Sprint 3 — but that was a mistake in the naming (beard = fragment 2, already taken). The intended fragment here is 6 (bird spittle). Birds are the carriers of messages — waiting in an empty hall, listening. The 15-second idle trigger rewards patience.

**Implementation**: In the Valhalla page empty state component (`ValhallaEmptyState`), add a `setTimeout` that fires after 15 seconds of the component being mounted. If the user navigates away, the `useEffect` cleanup cancels the timer. One-time: check `localStorage` before firing.

**Fallback note**: If the product team finds the 15-second wait too long in testing, reduce to 10 seconds. FiremanDecko can tune this without a story update.

---

## The Gleipnir Complete Unlock

When all 6 fragments are found (detected via all 6 `egg:gleipnir-N` localStorage keys being set), the following happens:

1. **Page shimmer**: The `gleipnir-shimmer` CSS animation fires on `<html>` (already defined in `interactions.md`). Duration: 2 seconds.
2. **Valhalla special entry**: The `/valhalla` page adds a special card at the top of the list:
   > **Gleipnir** — *The chain that bound the great wolf. Made of impossible things. No chain is stronger.*
   > Opened: [user's first card open date] · Closed: [today's date] · Rewards extracted: *Freedom itself*
3. **localStorage key**: `egg:gleipnir-complete` is set to `"1"` to mark the achievement.

The Valhalla special entry persists across page refreshes (read from the `egg:gleipnir-complete` key + the fragment completion check).

---

## Acceptance Criteria

**Fragment 4 — Sinews of a Bear:**
- [ ] Saving a card for the 7th time (any card, cumulative per-card) triggers the `GleipnirBearSinews` modal
- [ ] The trigger fires only once per user (`egg:gleipnir-4` localStorage key gates it)
- [ ] The per-card save count is stored in localStorage and does not reset on page reload

**Fragment 6 — Spittle of a Bird:**
- [ ] Visiting the Valhalla page empty state and remaining idle for 15 seconds triggers the `GleipnirBirdSpittle` modal
- [ ] The trigger fires only if the empty state is visible (no closed cards) AND the user is on the Valhalla route
- [ ] Navigating away before 15 seconds cancels the timer (no modal fires after navigation)
- [ ] The trigger fires only once per user (`egg:gleipnir-6` localStorage key gates it)

**Gleipnir Complete Unlock:**
- [ ] When all 6 `egg:gleipnir-N` keys are set, the `gleipnir-shimmer` animation fires on `<html>` for 2 seconds
- [ ] The Valhalla page shows the Gleipnir special entry at the top when `egg:gleipnir-complete` is set
- [ ] The Gleipnir entry displays: name "Gleipnir", atmospheric subtext, first card open date, today's date, and "Freedom itself" as rewards
- [ ] If the user has no active or closed cards, the first card open date field shows "Before memory" (fallback)
- [ ] The Gleipnir entry is visually distinct from normal Valhalla tombstone cards (gold border, no issuer badge, italicized rewards field)
- [ ] `ForgeMasterEgg` (`?` shortcut) shows "6 of 6 Gleipnir fragments found" when complete

**General:**
- [ ] All 6 fragment triggers are independently discoverable without documentation
- [ ] Fragment modals show the correct "N of 6 found" count when opened
- [ ] The fragment-found modal for the completing fragment (whichever is 6th) shows "6 of 6 found" and displays the shimmer unlock message

---

## Technical Notes for FiremanDecko

**Code audit completed (Sprint 4 groom)**: Both `GleipnirBearSinews.tsx` and `GleipnirBirdSpittle.tsx` exist in `src/components/cards/` and are fully implemented — modal, accessibility description, fragment counter display, and `useGleipnirFragment4()` / `useGleipnirFragment6()` hooks with localStorage gating. The `trigger()` and `dismiss()` functions are ready to consume. This story is purely about wiring the triggers — no new component work is needed. Similarly, `GleipnirWomansBeard.tsx` (fragment 2) and `GleipnirMountainRoots.tsx` (fragment 3) demonstrate the established wiring pattern to follow.

**Fragment 4 (save count)**:
- localStorage key pattern: `fenrir:card-saves:{cardId}` — store as a stringified integer
- Increment in the `onSubmit` success path of `CardForm.tsx` (same place as milestone toasts)
- Check `!localStorage.getItem('egg:gleipnir-4')` before triggering
- The `GleipnirBearSinews` component and `useGleipnirBearSinews` hook are already built in `components/cards/GleipnirBearSinews.tsx`

**Fragment 6 (idle timer)**:
- `useEffect` in `ValhallaEmptyState` (or the parent `ValhallaPage`):
  ```tsx
  useEffect(() => {
    if (localStorage.getItem('egg:gleipnir-6')) return; // already found
    const id = setTimeout(() => triggerBirdSpittle(), 15_000);
    return () => clearTimeout(id);
  }, []); // run once on mount; cleanup on unmount cancels timer
  ```
- Wire `triggerBirdSpittle` from `useGleipnirFragment6()` hook (already exists in `GleipnirBirdSpittle.tsx`)
- The `ValhallaEmptyState` only renders when there are zero closed cards — the mount condition is correct by construction

**Gleipnir complete check** (shared utility — recommend adding to `lib/storage.ts` or a new `lib/gleipnir-utils.ts`):
```ts
export function getGleipnirFoundCount(): number {
  return Array.from({ length: 6 }, (_, i) =>
    localStorage.getItem(`egg:gleipnir-${i + 1}`)
  ).filter(Boolean).length;
}

export function isGleipnirComplete(): boolean {
  return getGleipnirFoundCount() === 6;
}
```

**Shimmer animation**: Already defined in `ux/interactions.md` as `@keyframes gleipnir-shimmer` on `html.gleipnir-complete`. Add the class to `<html>` via `document.documentElement.classList.add('gleipnir-complete')`, then remove it after 2 seconds.

**Valhalla special entry**: The Gleipnir entry should render at the top of the card list in `ValhallaPage`, before the normal tombstone cards. It is not a real `Card` object — render it as a separate JSX element conditional on `isGleipnirComplete()`. First card open date: `Math.min` of all card `openedDate` values across active + closed cards, formatted as a date string.

**`aria-description` cleanup (DEF-001 from Loki's Sprint 3 QA verdict)**: The `ValhallaEmptyState` in `valhalla/page.tsx` has `aria-description="the beard of a woman"` — this was a Sprint 3 bug identified by Loki (QA hold: `quality/story-3.5-verdict.md`). The beard is fragment 2, already wired in `AboutModal.tsx`. The Valhalla empty state's `aria-description` must be removed as part of this story. The idle timer (15-second mount delay) is the correct fragment 6 trigger — no DOM aria annotation is needed or wanted.

---

## Open Questions Resolved

- **Fragment 4 trigger**: 7th card save. Fallback: long-press on Delete button. FiremanDecko chooses based on implementation complexity.
- **Fragment 6 trigger**: 15-second idle on Valhalla empty state.
- **localStorage migration wizard**: Explicitly out of scope — see product brief. This story does NOT introduce any migration tooling.
- **Gleipnir entry data**: First card open date sourced from all cards in localStorage (active + closed combined).

---

## UX Notes

See `ux/easter-eggs.md` #1 for the full Gleipnir Hunt specification, including the `@keyframes gleipnir-shimmer` animation and the Valhalla unlock card copy. See `ux/interactions.md` for the shimmer animation definition.

---

## Future (Not Sprint 4)

- LCARS mode (Star Trek easter egg, `Cmd+Shift+W`) — deferred; see story-4.x-future-deferred.md
- Wolf's Hunger meter in the About modal — deferred (requires reward tracking feature first)
- Sound effect on Gleipnir complete (distinct from the growl)
