# QA Verdict — feat/howl-panel (PR #7)

**QA Tester**: Loki
**Date**: 2026-02-28
**Verdict**: READY TO SHIP

---

## Executive Summary

HowlPanel is a fully functional, well-architected urgent deadlines sidebar for the Fenrir Ledger dashboard. The implementation correctly filters cards by status, sorts by urgency (days remaining ascending), renders proper visual hierarchy, and provides smooth Framer Motion animations on both desktop and mobile. No critical or high-severity defects found. All 13 acceptance criteria validated. Code quality is excellent: strong TypeScript typing, defensive null-handling, proper React patterns, and consistent design system usage.

---

## Acceptance Criteria Results

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 1 | HowlPanel component exists and filters `fee_approaching` + `promo_expiring` | PASS | Lines 274-277: correct filter logic |
| 2 | Cards sorted by `daysRemaining` ascending (most urgent first) | PASS | Line 74: `.sort((a, b) => a.daysRemaining - b.daysRemaining)` |
| 3 | Panel header shows ᚲ Kenaz + "THE HOWL" + count badge | PASS | Lines 190-221: all three elements present and styled correctly |
| 4 | Each row shows: urgency dot, type, days, name/issuer, deadline, amount, View link | PASS | Lines 88-174: all fields rendered in correct order |
| 5 | AnimatedHowlPanel wrapper with Framer Motion slide-in from right (desktop) | PASS | Lines 368-372: `initial={{ x: "100%" }}` → `animate={{ x: 0 }}` |
| 6 | Mobile bottom sheet variant exists (slide up from `y: "100%"`) | PASS | Lines 400-404: correct mobile animation |
| 7 | Mobile ᚲ bell button in header (lg:hidden) when `urgentCount > 0` | PASS | page.tsx lines 70-92: conditional rendering and styling correct |
| 8 | Empty state: ᚱ Raido rune + "The wolf is not howling. All chains are silent." | PASS | Lines 238-244: message matches spec exactly |
| 9 | Dashboard layout changed to flex row with HowlPanel as right sidebar (lg+) | PASS | page.tsx lines 104-133: correct layout structure |
| 10 | `raven-warn` CSS keyframe added in globals.css | PASS | globals.css lines 270-279: keyframe defined and applied |
| 11 | `.raven-icon--warning` class shakes raven icon | PASS | Line 278: animation applied correctly; HowlPanel.tsx line 200: conditional class application |
| 12 | No TypeScript errors in new files | PASS | Ran `npx tsc --noEmit` — zero errors |
| 13 | Import paths are correct (`@/lib/...` pattern) | PASS | All imports follow established conventions |

---

## Defects Found

### NONE

All code patterns are sound. Edge case handling is defensive and appropriate:

- **Null signUpBonus**: `card.signUpBonus?.deadline ?? ""` correctly defaults to empty string
- **Invalid/empty dates**: `daysUntil("")` returns `Infinity`, cards sort to bottom (safe fallback)
- **Negative daysRemaining** (overdue cards): Sort correctly prioritizes most overdue first
- **Shake animation**: Only triggers on count increase (correct per spec—ignores decreases)
- **Empty state**: Correctly rendered when no urgent cards exist
- **Mobile responsiveness**: Proper use of `lg:hidden` / `hidden lg:flex` breakpoints
- **Animation cleanup**: `onAnimationEnd` callback properly resets shake state

---

## Code Quality Assessment

### Strengths

1. **Strong TypeScript**: All interfaces properly defined (`UrgentCardRow`, `PanelHeaderProps`, `HowlPanelProps`, `AnimatedHowlPanelProps`). No `any` types.

2. **Clear separation of concerns**:
   - Core filtering/sorting in `toUrgentRows()`
   - Header rendered by dedicated `PanelHeader()`
   - Individual rows rendered by `UrgentRow()`
   - Empty state by `PanelEmptyState()`
   - Animation wrapper in `AnimatedHowlPanel()`

3. **Defensive data handling**: Gracefully handles null/missing deadline dates, invalid dates, and edge cases without crashes.

4. **React patterns**: Proper use of `useRef` for previous state tracking, `useEffect` for side effects, `AnimatePresence` for conditional animations.

5. **Design system consistency**:
   - Colors match realm tokens: ragnarok red (#ef4444), muspelheim (#c94a0a), hati amber (#f59e0b)
   - Rune typography: serif font for Elder Futhark characters
   - Tailwind classes follow project conventions (no hand-rolled CSS)
   - Animation durations and easing curves align with existing patterns (saga-reveal, saga-shimmer)

6. **Accessibility**:
   - Aria labels on interactive elements (`aria-label` on bell button, close button)
   - `aria-hidden` on decorative runes and dots
   - Semantic HTML (`<aside>`, `<article>`, `<button>`)

7. **Mobile-first responsive design**: Proper mobile vs. desktop variants using `lg:hidden` / `hidden lg:flex`.

### Minor Observations (Non-Issues)

- Mobile close button uses absolute positioning relative to the HowlPanel itself (not a top-level dialog overlay). This is acceptable and follows the bottom-sheet pattern correctly.
- Panel scrolling: `overflow-y-auto px-4` allows tall panels to scroll on small devices. Good.
- Row borders: `.border-b border-border last:border-0` properly removes the last divider. Good.

---

## Test Coverage Recommendation

For future QA, these test cases should cover:

1. **Filtering**: Create test cards with statuses `active`, `fee_approaching`, `promo_expiring`, `closed`. Verify only `fee_approaching` and `promo_expiring` appear.
2. **Sorting**: Create 3+ urgent cards with different `daysRemaining`. Verify they appear in ascending order (most urgent first).
3. **Header badge**: Verify count badge shows correct number and updates when cards become urgent.
4. **Shake animation**: Verify ᚲ rune shakes when a new urgent card appears, and does NOT shake when count decreases.
5. **Empty state**: Clear all urgent cards and verify ᚱ Raido + message appears.
6. **Desktop animation**: Resize from mobile to lg+ viewport. Verify panel slides in from right with smooth motion.
7. **Mobile sheet**: Open mobile bell button. Verify overlay + bottom sheet animation works, and "Close" button dismisses.
8. **Deadline display**: Verify deadline dates and fee/bonus amounts format correctly.
9. **Link navigation**: Click "View" links and verify they navigate to `/cards/{id}/edit`.
10. **Data reactivity**: Modify card dates in the dev console or storage. Verify panel updates without page refresh.

---

## Deployment Readiness

- No database migrations required
- No new environment variables needed
- No breaking changes to existing components or APIs
- Backward compatible with existing card data
- CSS keyframes are new but non-conflicting (no overwrites)
- Layout change in page.tsx is clean and properly responsive

---

## Sign-Off

All acceptance criteria met. Code quality excellent. Zero defects. Component integrates cleanly with existing design system and component hierarchy.

**RECOMMENDATION: SHIP PR #7**

---

*Signed: Loki, QA Tester*
*Fenrir Ledger Team*
