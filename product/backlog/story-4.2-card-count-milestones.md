# Story 4.2: Card Count Milestone Toasts

- **As a**: Credit card churner and rewards optimizer
- **I want**: The app to acknowledge when I hit significant portfolio milestones
- **So that**: I feel the satisfying weight of building a serious rewards portfolio — not just adding cards silently into a list
- **Priority**: P2-High
- **Sprint Target**: 4
- **Status**: Ready

---

## Context / Problem

Adding a card right now is purely transactional. Form filled, card appears in the grid. Done. There is no ceremony. This wastes a perfect emotional hook: the moment when a power user's portfolio reaches a meaningful size is a real milestone, and the mythology gives us exactly the right voice for it.

The easter eggs doc defines 5 milestone thresholds with copy already written. The copy is great. This story is the implementation.

---

## Desired Outcome

When the user's count of **active** cards (not counting Valhalla/closed) crosses specific thresholds for the first time, a toast fires. Each threshold is one-time-only — it never fires again for that user.

| Active card count | Toast copy |
|---|---|
| 1 | *"The first chain is forged. Fenrir stirs."* |
| 5 | *"Five chains. The Pack grows."* |
| 9 | *"Nine chains — one for each realm. Odin watches."* |
| 13 | *"Thirteen chains. Even Loki is impressed."* |
| 20 | *"Twenty chains. The great wolf is bound no longer — it is the gods who should fear you."* |

---

## Interactions and User Flow

1. User adds a card. After the form saves and the dashboard re-renders:
2. The new active card count is computed.
3. If the count matches a threshold AND the user has not seen this milestone toast before, fire the toast.
4. Toast appears in the standard shadcn `Toaster` position (top-right or bottom-right — match existing toast placement).
5. Toast uses atmospheric Voice 2 copy. No emoji. No action buttons.
6. Toast auto-dismisses after 5 seconds. Not sticky.
7. `localStorage` key `egg:milestone-N` (where N = the count) is set on first fire — never fires again.

**Edge case**: User adds 3 cards at once via some future bulk import. Each threshold that was crossed fires its toast. Toasts stack. This is correct behavior — don't suppress earlier thresholds just because a later one fired.

---

## Look and Feel Direction

- Toast background: `#0f1018` (slightly elevated from void-black — same as Gleipnir modals)
- Border: `1px solid #2a2d45` (rune-border)
- Text: `#e8e4d4` body copy, gold accent rune prefix
- A rune character as a visual prefix: use ᚠ (Fehu — cattle/wealth) for milestones 1-5, ᛊ (Sowilo — sun/glory) for 9+
- Duration: 5 seconds, then auto-dismiss with a fade-out
- No close button required — these are celebratory, not actionable

---

## Acceptance Criteria

- [ ] Adding a card that brings the active count to 1 fires the milestone-1 toast exactly once
- [ ] Adding a card that brings the active count to 5 fires the milestone-5 toast exactly once
- [ ] Adding a card that brings the active count to 9 fires the milestone-9 toast exactly once
- [ ] Adding a card that brings the active count to 13 fires the milestone-13 toast exactly once
- [ ] Adding a card that brings the active count to 20 fires the milestone-20 toast exactly once
- [ ] No toast fires if that threshold has already been seen (checked against `localStorage`)
- [ ] Toasts use the exact copy from the easter eggs doc (see above table) — no paraphrasing
- [ ] Toast auto-dismisses after 5 seconds
- [ ] Closing a card (sending to Valhalla) that drops the count below a threshold does NOT re-fire the toast when the threshold is re-crossed later (milestones are one-time)
- [ ] Milestone tracking uses localStorage keys `egg:milestone-1`, `egg:milestone-5`, `egg:milestone-9`, `egg:milestone-13`, `egg:milestone-20`
- [ ] Milestone count is based on active cards only — `closed` cards are not counted
- [ ] No milestone toast fires during page load/hydration — only on explicit user action (card add/edit)

---

## Technical Notes for FiremanDecko

**Where to fire**: The best location is in the `onSubmit` success handler of `CardForm.tsx` (after `storage.ts` write completes). Alternatively, a `useEffect` watching the card count in `Dashboard.tsx` will also work — but be careful to suppress the effect on initial page load (use a `mounted` ref or compare previous count).

**Count computation**: Filter cards from `getCards(householdId)` where `status !== 'closed'`. Length = active count.

**Storage keys**: `egg:milestone-1`, `egg:milestone-5`, `egg:milestone-9`, `egg:milestone-13`, `egg:milestone-20`. Check before firing; set on fire.

**Toast system**: shadcn/ui's `useToast` (or `sonner` if that's what's installed — check `package.json`). The toast needs custom styling (dark background, gold accent). Use the `className` prop on the toast call or a custom toast variant.

**Multiple thresholds in one action**: If a user has 4 cards and adds 5 at once (future bulk import), both the 5-card and 9-card toasts may fire. Handle this by iterating all thresholds and queueing multiple toasts with a short delay between them (200ms stagger). This is unlikely to occur in Sprint 4 but the implementation should not assume a single threshold per save.

**The 20-card toast**: The copy is long. Ensure the toast container has `max-w-sm` or wider — don't clip it.

---

## Open Questions Resolved

- **Which count**: Active cards only. Closed cards in Valhalla do not count.
- **Re-fire behavior**: Never. Once seen, never again. localStorage is the gate.
- **Milestone at app load**: Suppress. Milestones celebrate adding a card, not page load.
- **Toast duration**: 5 seconds. Not configurable in Sprint 4.

---

## UX Notes

See `product/copywriting.md` and `ux/easter-eggs.md` #11 for the full milestone table and copy. Voice 2 (atmospheric) throughout — no functional copy mixed in.

---

## Future (Not Sprint 4)

- Additional milestones beyond 20
- Milestone for total lifetime rewards value extracted (Wolf's Hunger meter integration)
- Milestone animation: brief card-grid flash on threshold crossing
