# E2E Test Audit — Issue #610 (ARCHIVED)

> **This audit is a historical point-in-time snapshot from 2026-03-12.**
> The test suite has since been significantly restructured. For current state,
> see [`quality-report.md`](quality-report.md) and [`test-guidelines.md`](test-guidelines.md).

**Date:** 2026-03-12
**Author:** FiremanDecko (Principal Engineer)
**Related:** #589, PR #594

## Executive Summary

Audited 29 Playwright E2E test files containing 262 test cases (6,295 lines).
Identified 104 tests for removal and 2 files for consolidation, reducing the
suite to approximately 158 tests — a 40% reduction in test count and an
estimated 35-45% reduction in CI wall-clock time.

## Current State

| Metric | Value |
|--------|-------|
| Test files | 29 |
| Test cases | 262 |
| Total lines | 6,295 |

## Audit Categories

### Category A: REMOVE — Static Content / Text Verification (42 tests)

Tests that verify static text, heading content, or CSS classes that don't change
unless deliberately redesigned. These provide zero regression value and break on
any copy change.

| File | Tests | Reason |
|------|-------|--------|
| `sign-in.spec.ts` | 8 of 17 | TC: h1 text "Name the wolf.", feature list count, SVG presence, touch target heights, overflow box math, variant B heading text. Static content assertions. |
| `auth-callback.spec.ts` | 5 of 13 | "The Bifrost trembled" heading text (x2), "Return to the gate" link text, "Binding the oath" text, responsive readability. Static copy checks. |
| `dashboard.spec.ts` | 4 of 16 | Summary stat singular/plural ("1 card" vs "1 cards"), "needs attention" text presence/absence. Static label logic covered by unit tests. |
| `a11y.spec.ts` | 3 of 9 | TC-A05/A06: h1 "The Ledger of Fates" text check. TC-A07: heading "has text". Static content. |
| `chronicles.spec.ts` | 4 of 8 | TC-1 title "Prose Edda", description "sagas of the forge", TC-3 marketing layout, TC-4 "Prose Edda" link count. Static marketing content. |
| `runic-empty-states.spec.ts` | 8 of 13 | AC2 rune character counting (x2), AC3 verbose text absence, AC5 CSS class inspection ("flex", "items-center"), AC6 CSS class inspection ("px-6"), edge case CSS class check. CSS class and static rune assertions. |
| `status-tooltips.spec.ts` | 5 of 16 | AC-1 (typeof check), AC-2 three-part structure (paragraph count + class inspection), AC-6 Voice 1/Voice 2 class checks, AC-8 role="tooltip" (redundant — already asserted by other tooltip tests). |
| `theme-toggle-ui.spec.ts` | 2 of 5 | "No System option" test (evaluates console.error.toString — not meaningful), first-load OS preference (flaky timing). |
| `dialog-a11y.spec.ts` | 3 of 5 | DialogDescription text presence, sr-only class inspection, sr-only text length check. CSS class auditing, not behavior testing. |

### Category B: REMOVE — Excessive Duplication (38 tests)

Tests that duplicate coverage already present in other E2E files or unit tests.

| File | Tests | Duplicates |
|------|-------|------------|
| `wizard-back-button.spec.ts` | ALL 4 | Fully duplicated by `wizard-step2.spec.ts` Suite 5 (Back Navigation) and `select-reset.spec.ts` (value preservation). Remove entire file. |
| `fee-bonus-step2.spec.ts` | 5 of 7 | Suite 1 "More Details advances" duplicated by `wizard-step2.spec.ts`. Field visibility tests (annual fee date, bonus deadline, bonus met) are 3 copies of "click More Details, check field visible" — keep 1 consolidated test for all Step 2 fields. |
| `credit-limit-step2.spec.ts` | 1 of 3 | "credit limit NOT visible on Step 1" already implied by wizard-step2 "Step 1 renders" (only 3 fields). |
| `reverse-tab-order.spec.ts` | 5 of 7 | "can switch between tabs" duplicated by `dashboard-tabs.spec.ts` TC-6. "default selected tab" duplicated by `howl-panel.spec.ts` default tab tests. Arrow keyboard nav duplicated by `dashboard-tabs.spec.ts`. Keep only: AC1 (tab order assertion) and AC3 (mobile order). |
| `dashboard-tabs.spec.ts` | 3 of 8 | TC-3 "Dashboard renders with appropriate default tab" duplicated by `howl-panel.spec.ts`. TC-6 "Tab panels show/hide" duplicated by `howl-panel.spec.ts` tab switching. TC-6 keyboard nav duplicated by `reverse-tab-order.spec.ts`. |
| `howl-panel.spec.ts` | 2 of 6 | "tab bar renders with tabs" duplicated by `dashboard-tabs.spec.ts` and `reverse-tab-order.spec.ts`. "clicking back to Howl restores panel" is inverse of "clicking Active switches panel". |
| `empty-state-cta.spec.ts` | 6 of 14 | "EmptyState headline Gleipnir" duplicated by `dashboard.spec.ts` Suite 1. "no competing CTAs" is same assertion as AC-1 "header Add Card button absent". "mobile 375px single Add Card" same as AC-1. "zero-cards nudge full banner absent" same as AC-2. |
| `select-reset.spec.ts` | 4 of 8 | Tests 4-8 are variations of "select preserves value after Back" that test the same code path with minor input differences. Keep 3 representative tests. |
| `dashboard.spec.ts` | 2 of 16 | "renders exactly 3 card tiles" + "renders MANY_CARDS — no empty state" are redundant with card name visibility assertions. |
| `profile-dropdown.spec.ts` | 6 of 20 | TC-PD-M04 through TC-PD-M06 duplicate TC-PD09 (touch targets already tested desktop). TC-PD-A02 duplicates TC-PD02 (theme row assertion). TC-PD08 "dropdown reopens" is trivial UI toggle. |

### Category C: REMOVE — Low-Value / Barely-Testable (14 tests)

| File | Tests | Reason |
|------|-------|--------|
| `status-tooltips.spec.ts` | 6 of 16 | Tests skip when no cards exist (no seed data), making them effectively no-ops in CI with empty state. AC-5 positioning test (+/- 50px tolerance = always passes). Edge case "tooltip remains on hover" is browser default behavior. |
| `dialog-a11y.spec.ts` | 2 of 5 | COOP header test always passes (if header is missing, passes; if present, pattern matches). API route 404 check duplicated by `settings-gate.spec.ts`. |
| `theme-toggle-ui.spec.ts` | 1 of 5 | "page loads successfully" is not a theme toggle test. |
| `chronicles.spec.ts` | 2 of 8 | TC-5 "/blog returns 404" — tests a route that was removed months ago. TC-6 "responsive grid" only checks two cards are visible. |
| `auth-returnto.spec.ts` | 3 of 11 | Suite 1 tests 1/2/3 just navigate to URLs and assert they loaded — no real validation of returnTo behavior. |

### Category D: KEEP — Migration Behavior Tests (10 tests, recommend archiving)

These test migration-era behavior that is now stable.

| File | Tests | Action |
|------|-------|--------|
| `chronicles.spec.ts` | TC-5, TC-8 | /blog 404 and slug accessibility — migration from HTML to Next.js completed months ago. **Archive to `quality/test-suites/_archived/`.** |
| `stale-auth-nudge.spec.ts` | ALL 7 | **KEEP** — Tests active feature (stale auth detection + nudge dismiss). Not migration-related despite the name. |

## Projected State After Culling

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Test files | 29 | 26 (-3 deleted) | -10% |
| Test cases | 262 | ~158 | -40% |
| Est. CI time | ~4-5 min | ~2.5-3 min | -35-45% |

Files to delete entirely:
1. `wizard-back-button/wizard-back-button.spec.ts` (fully duplicated)

Files to archive:
1. None (chronicles migration tests can just be removed — stable for months)

## Consolidation Recommendations

### Pattern 1: Merge Wizard Step 2 Tests

Consolidate `wizard-step2.spec.ts`, `fee-bonus-step2.spec.ts`, and
`credit-limit-step2.spec.ts` into a single `wizard-step2.spec.ts` that tests:
- Step 1 renders required fields
- More Details advances to Step 2
- All Step 2 fields visible (credit limit, annual fee date, bonus deadline, bonus met, notes)
- Back button returns to Step 1 with preserved data
- Save from Step 1 and Step 2
- Cancel returns to dashboard

### Pattern 2: Merge Dashboard Tab Tests

Consolidate `dashboard-tabs.spec.ts`, `reverse-tab-order.spec.ts`, and
`howl-panel.spec.ts` into a single `dashboard-tabs.spec.ts` that tests:
- Tab order (All > Valhalla > Active > Hunt > Howl)
- Default tab selection (Howl if urgent, else Active)
- Tab switching and panel show/hide
- Keyboard navigation (arrow keys, home/end)
- Card distribution (no duplication)
- Empty states per tab
- Mobile tab order

### Pattern 3: Merge Empty State Tests

Consolidate `empty-state-cta.spec.ts` and `dashboard.spec.ts` Suite 1 into
dashboard.spec.ts with a focused "Empty State" describe block:
- Gleipnir heading visible
- Single Add Card CTA (no header duplicate)
- Upsell banner hidden when zero cards
- Subtle sign-in nudge

### Pattern 4: Merge Profile Dropdown Mobile/Desktop

Keep `profile-dropdown.spec.ts` but remove mobile duplicates (TC-PD-M04 through
TC-PD-M06) that just re-check touch targets already validated at desktop. Keep
TC-PD-M01 (opens on mobile), TC-PD-M02 (fits viewport), TC-PD-M03 (touch friendly).

## Tests to Remove (Detailed List)

### Files to Delete Entirely

1. **`wizard-back-button/wizard-back-button.spec.ts`** (4 tests)
   - All 4 tests duplicated by `wizard-step2.spec.ts` Suite 5 + `select-reset.spec.ts`

### Tests to Remove Per File

**`sign-in.spec.ts`** — Remove 8, keep 9:
- REMOVE: "page has a visible main content area" (aria-labelledby check)
- REMOVE: "h1 is visible and reads 'Name the wolf.'" (static text)
- REMOVE: "heading is labeled correctly for screen readers" (static attribute)
- REMOVE: "Google sign-in button contains the Google G glyph SVG" (static markup)
- REMOVE: "Google sign-in button meets minimum touch target height" (CSS check)
- REMOVE: "at least one feature item is shown" (static count)
- REMOVE: "sign-in card does not overflow viewport" (CSS math)
- REMOVE: "h1 reads 'Your chains are already here.'" (static text variant)

**`auth-callback.spec.ts`** — Remove 5, keep 8:
- REMOVE: "shows error heading 'The Bifrost trembled' when params are absent" (static copy)
- REMOVE: "shows error heading when Google returns an error" (duplicate of above)
- REMOVE: "'Return to the gate' link..." (static element, tested by other callback tests)
- REMOVE: "error state is readable at 375px viewport" (CSS layout check)
- REMOVE: "Suspense fallback contains 'Binding the oath...'" (static text + stall trick)

**`auth-returnto.spec.ts`** — Remove 3, keep 8:
- REMOVE: "sign-in from /ledger includes returnTo=/ledger" (just navigates and checks URL loaded)
- REMOVE: "sign-in from /ledger/settings includes returnTo=/ledger/settings" (URL echo)
- REMOVE: "sign-in from /ledger/valhalla includes returnTo=/ledger/valhalla" (URL echo)

**`dashboard.spec.ts`** — Remove 6, keep 10:
- REMOVE: "renders exactly 3 card tiles for FEW_CARDS" (redundant with name visibility)
- REMOVE: "renders MANY_CARDS (10 cards) — no empty state" (count check)
- REMOVE: "summary shows correct card count for MANY_CARDS" (static label)
- REMOVE: "summary shows '1 card' singular" (unit-testable plural logic)
- REMOVE: "shows 'needs attention' count for URGENT_CARDS" (body contains "5")
- REMOVE: "no 'needs attention' shown when all cards active" (body text absence)

**`dashboard-tabs.spec.ts`** — Remove 3, keep 5:
- REMOVE: "Dashboard renders with appropriate default tab" (duplicate of howl-panel)
- REMOVE: "Tab panels show/hide correctly" (duplicate of howl-panel switching)
- REMOVE: "Arrow Right keyboard navigation" (duplicate of reverse-tab-order)

**`reverse-tab-order.spec.ts`** — Remove 5, keep 2:
- REMOVE: "AC2: default selected tab unchanged" (duplicate of howl-panel)
- REMOVE: "can switch between tabs in new order" (duplicate of dashboard-tabs TC-6)
- REMOVE: "arrow right keyboard navigation" (keep only left or right, not both)
- REMOVE: "arrow left keyboard navigation" (keep home/end + one direction)
- REMOVE: "home/end keys navigate" (keep — actually this is unique, un-remove)
- Revised: Remove 4, keep 3 (AC1 tab order, AC3 mobile, home/end)

**`howl-panel.spec.ts`** — Remove 2, keep 4:
- REMOVE: "tab bar renders with tabs" (duplicate)
- REMOVE: "clicking back to Howl tab restores panel" (inverse of forward switch)

**`runic-empty-states.spec.ts`** — Remove 8, keep 5:
- REMOVE: AC2 "Empty Howl tab uses correct rune from config" (rune count assertion)
- REMOVE: AC2 "Empty Active tab uses correct rune from config" (rune count assertion)
- REMOVE: AC3 "All empty states lack verbose text" (negative text search)
- REMOVE: AC5 "Empty state text is centered" (CSS class inspection)
- REMOVE: AC6 "Empty state text displays correctly at mobile size" (CSS class check)
- REMOVE: "Empty state uses correct muted styling" (CSS class check)
- REMOVE: "All tab shows runic empty state when no non-Valhalla cards" (ambiguous)
- REMOVE: "Empty state persists when all cards of a type are deleted" (re-setup dance)

**`empty-state-cta.spec.ts`** — Remove 6, keep 8:
- REMOVE: "EmptyState headline Gleipnir" (duplicate of dashboard Suite 1)
- REMOVE: "no competing CTAs" (duplicate of AC-1)
- REMOVE: "mobile 375px single Add Card" (duplicate of AC-1)
- REMOVE: "mobile 375px subtle sign-in nudge" (duplicate of AC-3 desktop)
- REMOVE: "zero-cards nudge full banner absent" (duplicate of AC-2)
- REMOVE: "subtle nudge wrapped in muted-foreground paragraph" (CSS class)

**`profile-dropdown.spec.ts`** — Remove 6, keep 14:
- REMOVE: TC-PD-M04 "Theme toggle accessible on mobile" (duplicate of desktop)
- REMOVE: TC-PD-M05 "Settings and Sign out accessible on mobile" (duplicate)
- REMOVE: TC-PD-M06 "Icons visible on mobile" (duplicate)
- REMOVE: TC-PD-A02 "Theme toggle has descriptive aria-label" (duplicate of TC-PD02)
- REMOVE: TC-PD08 "Dropdown reopens after closing" (trivial toggle)
- REMOVE: TC-PD09 "Dropdown layout has clean visual hierarchy" (CSS inspection)

**`status-tooltips.spec.ts`** — Remove 11, keep 5:
- REMOVE: AC-1 (typeof boolean check — meaningless)
- REMOVE: AC-2 "three-part structure" (paragraph count + class check)
- REMOVE: AC-5 "positioning" (tolerance too wide)
- REMOVE: AC-6 Voice 1 (class check)
- REMOVE: AC-6 Voice 2 (class check)
- REMOVE: AC-8 role="tooltip" (redundant with visibility assertions)
- REMOVE: AC-8 "aria-label with status description" (duplicate of dashboard badge tests)
- REMOVE: "Multiple badges have independent tooltips" (skip-heavy, unreliable)
- REMOVE: "Tooltip remains visible when hovering" (browser default)
- REMOVE: AC-2 "Desktop hover hides with 100ms delay" (timing-sensitive, flaky)
- REMOVE: AC-3 "Mobile tap outside dismisses" (skip-heavy)

**`dialog-a11y.spec.ts`** — Remove all 5, keep 0:
- All tests are CSS class inspections or API route checks duplicated elsewhere.
- **Delete entire file.**

**`theme-toggle-ui.spec.ts`** — Remove 3, keep 2:
- REMOVE: "No System option" (evaluates console.error toString — meaningless)
- REMOVE: "First load detects OS dark preference" (flaky timing)
- REMOVE: (one of the dark/light tests is sufficient with the persistence test)
- Revised: keep "dark mode applies .dark", "light mode removes .dark", "dark persists after reload". Remove 2, keep 3.

**`chronicles.spec.ts`** — Remove 4, keep 4:
- REMOVE: TC-1 static title "Prose Edda" + description text
- REMOVE: TC-3 marketing layout (navbar/footer presence)
- REMOVE: TC-4 "Prose Edda" link count >= 2
- REMOVE: TC-5 "/blog returns 404" (dead route)

**`fee-bonus-step2.spec.ts`** — Remove 5, keep 2:
- REMOVE: "More Details advances from Step 1" (duplicate of wizard-step2)
- REMOVE: "Annual Fee Date visible on Step 2" (keep one consolidated field check)
- REMOVE: "Bonus Deadline visible on Step 2" (keep one consolidated field check)
- REMOVE: "Annual Fee Date editable" (duplicate — visibility + fill = editable)
- REMOVE: "Bonus Deadline editable" (duplicate — visibility + fill = editable)

**`credit-limit-step2.spec.ts`** — Remove 1, keep 2:
- REMOVE: "credit limit select NOT visible on Step 1" (implicit from wizard-step2)

**`select-reset.spec.ts`** — Remove 4, keep 4:
- REMOVE: "Clearing a select and going Back preserves the cleared state" (variant)
- REMOVE: "Changing bonus type selection preserves new value" (variant)
- REMOVE: "Form submission still works correctly" (doesn't actually submit)
- REMOVE: "Issuer select reflects correct value in form state" (duplicate of test 1)

**`a11y.spec.ts`** — Remove 3, keep 6:
- REMOVE: TC-A05 "dashboard has h1 with correct text" (static text)
- REMOVE: TC-A06 "Valhalla route redirects with accessible heading" (static text + redirect)
- REMOVE: TC-A07 "add card page has a heading" (has non-empty text — low value)

## Summary of Removals

| Action | Count |
|--------|-------|
| Tests to remove | 104 |
| Tests to keep | 158 |
| Files to delete entirely | 2 (wizard-back-button, dialog-a11y) |
| Files unchanged | 8 |
| Files with removals | 19 |
