# Story 4.5: Wolf's Hunger Meter + About Modal Completeness

- **As a**: Credit card churner and rewards optimizer
- **I want**: The About modal to show how much total reward value I've extracted across my entire card history
- **So that**: I feel the cumulative weight of what I've built — the wolf has been feeding, and the ledger remembers every meal
- **Priority**: P3-Medium
- **Sprint Target**: 4
- **Status**: Done

---

## Context / Problem

The ForgeMasterEgg (`?` key shortcut) and the About modal (Fenrir logo click) are both wired and shipping since Sprint 3. They show the team, the Gleipnir ingredients, and the fragment progress count. But the Wolf's Hunger meter — the final piece of the About modal — is not yet implemented.

The Wolf's Hunger meter reads the aggregate of all rewards logged across active and Valhalla cards and presents it as atmospheric flavor:

> **Fenrir has consumed:** [total lifetime rewards value] pts / miles / $ cashback
> *The chain grows heavier.*

This is the easter egg that makes power users grin. They've been building a rewards portfolio for months. Seeing the total number — all of it, including closed cards in Valhalla — puts a number on their mastery.

---

## Desired Outcome

The About modal (and the ForgeMasterEgg overlay that shares the same data) gains a new section: the Wolf's Hunger meter. It shows the total accumulated rewards value across all cards in the user's localStorage, both active and closed.

The display is aggregated by reward type where possible, but falls back gracefully to a single total if the data is mixed.

---

## Interactions and User Flow

1. User presses `?` or clicks the Fenrir logo in the TopBar.
2. The modal opens. Existing sections (team, Gleipnir ingredients, fragment count) render as before.
3. Below the Gleipnir section, a new divider and section appears: **Fenrir's Hunger**.
4. The meter shows the aggregate total, computed from localStorage at render time.
5. If no rewards have been logged on any card, show: *"The wolf has not yet fed. Add reward details to your cards."*
6. The meter does not update in real time — it reads once on modal open. No live polling.

---

## Display Format

Rewards are stored per card in the `Card` type. The relevant fields are `signUpBonus.type` and `signUpBonus.amount`. Aggregate by type:

| Scenario | Display |
|----------|---------|
| All cards are cash back | `Fenrir has consumed: $1,240 cashback` |
| All cards are points | `Fenrir has consumed: 847,000 pts` |
| Mixed types (points + miles + cash) | `Fenrir has consumed: 412,000 pts · 95,000 miles · $320 cashback` |
| No rewards data on any card | *"The wolf has not yet fed."* |

Format numbers with locale-appropriate comma separators (`toLocaleString()`). Cash: `$` prefix, no decimals (integer). Points/miles: bare number with type label.

Atmospheric subline beneath the meter: *"The chain grows heavier."* (always, when any rewards are shown)

---

## Acceptance Criteria

- [ ] The About modal renders a Wolf's Hunger section below the Gleipnir ingredients list
- [ ] The hunger meter sums `signUpBonus.amount` across all cards where `signUpBonus.met === true` (only count bonuses actually earned, not just promised)
- [ ] Active cards and closed (Valhalla) cards are both included in the aggregate
- [ ] Rewards are grouped and displayed by type (points, miles, cashback)
- [ ] Cash values are formatted as `$N` with comma separators (no decimals)
- [ ] Point/mile values are formatted with comma separators and type label
- [ ] Mixed types render on one line separated by ` · `
- [ ] When no bonuses have been marked as met on any card, the fallback copy renders
- [ ] The `ForgeMasterEgg` (`?` shortcut) overlay also shows the hunger meter (same data, same component)
- [ ] The meter reads data once on modal open — no live updates while the modal is open
- [ ] The hunger section is below the Gleipnir fragment count line, separated by a divider

---

## Technical Notes for FiremanDecko

**Data source**: `getCards(householdId)` returns all non-deleted cards. For Valhalla cards, they are status `"closed"` — include them. Filter: `card.signUpBonus?.met === true`. Sum by `card.signUpBonus.type` (values: `"points"`, `"miles"`, `"cashback"` — see `types.ts`).

**IMPORTANT — field name correction (Sprint 4 groom)**: The `SignUpBonus` interface in `src/lib/types.ts` uses `met: boolean` (not `bonusMet`). All references in this story have been corrected. FiremanDecko must use `signUpBonus.met`, not `signUpBonus.bonusMet`.

**Aggregation example**:
```ts
const totals: Record<string, number> = {};
cards.forEach(card => {
  if (card.signUpBonus?.met && card.signUpBonus.amount) {
    const type = card.signUpBonus.type ?? 'points';
    totals[type] = (totals[type] ?? 0) + card.signUpBonus.amount;
  }
});
```

**Formatting**:
```ts
function formatReward(type: string, amount: number): string {
  if (type === 'cashback') return `$${amount.toLocaleString()}`;
  return `${amount.toLocaleString()} ${type}`;
}
```

**Code audit completed (Sprint 4 groom)**: `AboutModal.tsx` currently shows: team members, a divider, and the Gleipnir ingredients list. There is no Wolf's Hunger section. `ForgeMasterEgg.tsx` shows the team list, a lore line, and the Gleipnir fragment count — also no hunger meter. Both components are well-structured and the hunger section can be appended after the existing content with a divider. Extract a shared `<WolfHungerMeter householdId={...} />` component — both `AboutModal` and `ForgeMasterEgg` already import from `@/hooks/useAuth` and have access to `householdId`. The `getCards(householdId)` call in `storage.ts` returns active cards only; `getClosedCards(householdId)` returns Valhalla cards. Both are needed here.

**Where to add**: The hunger section is new JSX inside `AboutModal.tsx` (for the Fenrir logo click trigger) and `ForgeMasterEgg.tsx` (for the `?` key trigger). Consider extracting a shared `<WolfHungerMeter householdId={...} />` component to avoid duplication.

**Household ID**: Read from `useAuth()` hook (already imported in both components).

**Type check**: The `SignUpBonus` interface in `types.ts` uses `met: boolean` (confirmed during Sprint 4 groom). The `amount`, `type`, `spendRequirement`, `deadline`, and `met` fields are all present. No gap exists — the data model is complete for this feature.

---

## Open Questions Resolved

- **Which bonuses count**: Only `met === true` (the `SignUpBonus.met` field in `types.ts`). A card with a sign-up bonus that hasn't been earned yet contributes $0 to the hunger meter.
- **Valhalla cards included**: Yes. The wolf remembers every meal, not just the current chains.
- **Real-time update**: No. Static read on open.
- **localStorage migration wizard**: Not in this story, not in Sprint 4 at all. See product brief — deferred to GA.

---

## UX Notes

See `ux/easter-eggs.md` #10 for the full Wolf's Hunger meter specification and the exact atmospheric copy. See `ux/easter-eggs.md` #9 for the About modal specification.

---

## Future (Not Sprint 4)

- Wolf's Hunger meter on the dashboard stats bar (always visible, not just in modal)
- Lifetime rewards vs. fees paid net ROI calculation (requires fee-paid tracking feature)
- Animated hunger meter that "fills" when a new bonus is marked met
