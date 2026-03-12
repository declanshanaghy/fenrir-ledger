# QA Handoff: Fix Component Landmarks, Aria-Labels, and Stale E2E Selectors

**Issue:** #589 -- Fix component landmarks, aria-labels, and stale selectors; cull superseded E2E tests
**Branch:** `fix/issue-589-landmarks-aria`
**PR:** https://github.com/declanshanaghy/fenrir-ledger/pull/592
**Author:** FiremanDecko (Principal Engineer)
**Date:** 2026-03-11

---

## What Was Implemented

### Root Cause

After Issue #371/#372 restructured routes, `/` became the marketing home page and
`/ledger` became the app dashboard. All 27 E2E test suites still navigated to `/`,
hitting the marketing page instead of the dashboard -- causing ~93 failures from
missing dashboard DOM elements (card tiles, tabs, status badges, etc.).

### Changes

1. **Route migration** -- Changed `page.goto("/")` to `page.goto("/ledger")` across 24 spec files
2. **Deleted sidebar.spec.ts** -- 5 tests for a component removed in Issue #403
3. **Deleted footer.spec.ts** -- 7 tests for Ledger Footer which is dead code (not rendered in any active layout)
4. **Pruned a11y.spec.ts** -- Removed 4 stale assertions for nav landmark, footer landmark, and sidebar collapse button that no longer exist in LedgerShell
5. **Fixed auth-callback routes** -- `/auth/callback` to `/ledger/auth/callback`
6. **Fixed topbar expectations** -- Removed stale `target="_blank"` assertion on logo link
7. **Updated test-guidelines.md** -- Suite counts from 29 files/234 tests to 27 files/222 tests

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `quality/test-suites/layout/sidebar.spec.ts` | Deleted | Sidebar removed in #403 |
| `quality/test-suites/layout/footer.spec.ts` | Deleted | Ledger Footer is dead code |
| `quality/test-suites/accessibility/a11y.spec.ts` | Rewritten | Removed 4 stale landmark/sidebar tests |
| `quality/test-suites/layout/topbar.spec.ts` | Modified | Route fix + removed stale target assertion |
| `quality/test-suites/auth/auth-callback.spec.ts` | Modified | Route fix for callback path |
| 22 other spec files | Modified | Route `/` to `/ledger` |
| `quality/test-guidelines.md` | Modified | Updated suite counts and added #589 note |

**Total:** 27 files, +80 / -374 lines

---

## Verification Performed

- `tsc --noEmit`: PASS
- `next build`: PASS (30 routes)
- Rebase on latest `main`: clean, no conflicts

---

## Suggested Test Focus

1. Run full Playwright suite: `npx playwright test` -- target is 0 failures
2. Spot-check dashboard tests load at `/ledger` and see card tiles
3. Verify a11y.spec.ts passes with the reduced test set (12 tests remaining)
4. Confirm auth-callback tests hit `/ledger/auth/callback` correctly
5. Verify no test references bare `/` without the `/ledger` prefix (except marketing tests)

---

## Known Limitations

- No component changes were made -- all fixes are test-side only
- Footer.tsx remains as dead code in source; deletion is out of scope for this issue
- LedgerBottomTabs `<nav>` is mobile-only (`md:hidden`); nav landmark tests were removed rather than added for desktop
- The "No System option" theme test (TC-TH-005) is a weak assertion; could be improved in a future pass
