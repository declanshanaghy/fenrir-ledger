# Playwright E2E Test Assessment

**Issue:** #573 | **Date:** 2026-03-12 | **Author:** FiremanDecko (Principal Engineer)

## Context

After PRs #580, #588, and #592, the test suite stands at:
- **229 Vitest tests** (136 unit + 93 integration) — ~5s total
- **~222 E2E tests** across 27 Playwright spec files — ~6min total

This assessment classifies each E2E suite as **KEEP** (needs real browser),
**MIGRATE** (Vitest integration candidate), or **SPLIT** (partial migration).

## Summary

| Classification | Suites | Tests | Action |
|---------------|--------|-------|--------|
| KEEP          | 16     | ~145  | Retain as E2E |
| MIGRATE       | 8      | ~87   | Convert to Vitest integration |
| SPLIT         | 3      | ~30   | Migrate subset, keep remainder |

**Phase 2 migration would reduce E2E tests by ~40% (87 + ~10 from splits ≈ 97 tests).**

---

## Suite-by-Suite Assessment

### KEEP — Requires Real Browser (16 suites)

| Suite | File | Tests | Rationale |
|-------|------|-------|-----------|
| Accessibility | `accessibility/a11y.spec.ts` | 9 | Keyboard navigation (Tab, Enter), focus management, and screen reader live regions require real browser event handling. |
| Close Card | `card-lifecycle/close-card.spec.ts` | 5 | Confirmation dialog interaction and cross-page state verification (card removed from dashboard after close). |
| Delete Card | `card-lifecycle/delete-card.spec.ts` | 6 | Same as close-card: dialog + multi-card state verification across pages. |
| Chronicles | `chronicles/chronicles.spec.ts` | 8 | Multi-page navigation (index → detail → breadcrumb back), responsive grid layout, prev/next links. |
| Credit Limit Step 2 | `credit-limit-step2/credit-limit-step2.spec.ts` | 3 | Multi-step wizard Select interaction; value must persist through localStorage after save. |
| CSV Format Help | `csv-format-help/csv-format-help.spec.ts` | 4 | Import wizard dialog navigation; content appears in Step 2 but not Step 1. |
| Dashboard Tabs | `dashboard-tabs/dashboard-tabs.spec.ts` | 6 | Tab switching with Arrow key keyboard navigation, focus management, default tab logic. |
| Fee/Bonus Step 2 | `fee-bonus-step2/fee-bonus-step2.spec.ts` | 7 | Wizard step navigation with date inputs and checkbox interaction on Step 2. |
| Howl Panel | `layout/howl-panel.spec.ts` | 6 | Tab bar switching, panel visibility toggling, card categorization across tabs. |
| TopBar | `layout/topbar.spec.ts` | 6 | Upsell dialog interaction, Escape key dismissal, logo navigation. Some overlap with `ledger-topbar.test.tsx` integration test but tests real dialog behavior. |
| Profile Dropdown | `profile-dropdown/profile-dropdown.spec.ts` | 30 | Complex dropdown interaction: keyboard navigation, focus management, mobile touch targets, theme toggle integration. |
| Tab Order | `reverse-tab-order/dashboard-tab-order.spec.ts` | 7 | Arrow key, Home/End keyboard navigation verifying reversed tab order. |
| Select Reset | `select-reset/select-reset.spec.ts` | 8 | Wizard Back button preserves Select component values (Issuer, Bonus Type, Min Spend). |
| Wizard Back | `wizard-back-button/wizard-back-button.spec.ts` | 4 | Multi-step wizard navigation with form state preservation across back-and-forth cycles. |
| Wizard Step 2 | `wizard-step2/wizard-step2.spec.ts` | 11 | Full wizard flow: validation, step advancement, save from both steps, cancel navigation. |

### MIGRATE — Vitest Integration Candidates (8 suites)

| Suite | File | Tests | Rationale |
|-------|------|-------|-----------|
| Auth Callback | `auth/auth-callback.spec.ts` | 17 | Error state rendering with sessionStorage manipulation. No navigation flow — just conditional rendering based on URL params and PKCE state. Convert to component render test. |
| Auth ReturnTo | `auth-returnto/auth-returnto.spec.ts` | 11 | URL validation logic (`validateReturnTo`) and sessionStorage PKCE management. Pure logic + conditional rendering — no multi-page flow. |
| Sign-In Page | `auth/sign-in.spec.ts` | 18 | Component rendering: headings, buttons, feature list, conditional content based on card count. Viewport tests (375px) can use JSDOM width simulation. |
| Dialog A11y | `dialog-a11y/dialog-a11y.spec.ts` | 6 | ARIA attribute checks (`aria-describedby`) on DialogContent components. Already partially covered by integration tests. API route sanity checks belong in route handler tests. |
| Empty State CTA | `empty-state-cta/empty-state-cta.spec.ts` | 14 | Conditional rendering based on card count and auth state. UpsellBanner visibility, CTA deduplication — all props-driven rendering. |
| Howl Count Badge | `howl-count/howl-count-badge.spec.ts` | 3 | Badge count computation from card status data. Pure component rendering with mock data — no browser interaction needed. |
| Stale Auth Nudge | `stale-auth-nudge/stale-auth-nudge.spec.ts` | 9 | Banner rendering based on localStorage/sessionStorage state. Dismiss clears cache + sets flag. Navigation testable with router mocks. |
| Theme Toggle | `theme-toggle/theme-toggle-ui.spec.ts` | 5 | CSS class manipulation on `<html>`, localStorage persistence, OS preference detection. All testable in JSDOM with `next-themes` mocks. |

### SPLIT — Partial Migration (3 suites)

| Suite | File | Tests | Keep (E2E) | Migrate (Vitest) |
|-------|------|-------|------------|------------------|
| Add Card | `card-lifecycle/add-card.spec.ts` | 6 | 3 (form submit, Select interaction, cancel navigation) | 3 (validation error messages on empty submit) |
| Edit Card | `card-lifecycle/edit-card.spec.ts` | 6 | 4 (form pre-population, save flow, cancel) | 2 (unknown card ID redirect logic) |
| Dashboard | `dashboard/dashboard.spec.ts` | 15 | 7 (card tile navigation, grid layout, empty state CTA clicks) | 8 (badge rendering, status counts, summary stat display) |
| Settings Gate | `settings-gate/settings-gate.spec.ts` | 8 | 3 (page structure, interactive upsell flow) | 5 (gate rendering with locked/unlocked states, API route checks already in integration) |

---

## Phase 2 Migration Priorities

Ordered by impact (tests moved) and ease (similarity to existing integration patterns):

| Priority | Suite | Tests to Migrate | Effort | Pattern |
|----------|-------|-----------------|--------|---------|
| **P1** | `auth/sign-in.spec.ts` | 18 | Low | Same as `ledger-topbar.test.tsx` — component render + conditional logic |
| **P2** | `auth/auth-callback.spec.ts` | 17 | Low | Component render with sessionStorage mocks |
| **P3** | `empty-state-cta/empty-state-cta.spec.ts` | 14 | Low | Props-driven rendering, same as existing component tests |
| **P4** | `auth-returnto/auth-returnto.spec.ts` | 11 | Low | URL validation (unit) + sessionStorage render (integration) |
| **P5** | `stale-auth-nudge/stale-auth-nudge.spec.ts` | 9 | Low | Banner render with storage mocks |
| **P6** | `dashboard/dashboard.spec.ts` (partial) | 8 | Medium | Badge + stats rendering, needs mock data setup |
| **P7** | `dialog-a11y/dialog-a11y.spec.ts` | 6 | Low | ARIA checks — partially already covered |
| **P8** | `settings-gate/settings-gate.spec.ts` (partial) | 5 | Medium | Gate component rendering with tier props |
| **P9** | `theme-toggle/theme-toggle-ui.spec.ts` | 5 | Low | `next-themes` mock, CSS class checks |
| **P10** | `card-lifecycle/add-card.spec.ts` (partial) | 3 | Low | Validation message rendering |
| **P11** | `howl-count/howl-count-badge.spec.ts` | 3 | Low | Pure component render test |
| **P12** | `card-lifecycle/edit-card.spec.ts` (partial) | 2 | Low | Redirect logic test |

**Total Phase 2 migration: ~101 tests** (8 full suites + 4 partial splits)

After migration, E2E suite would drop from ~222 to ~121 tests, reducing
E2E runtime by roughly 45%.

---

## Notes

- Integration test patterns are well-established from PR #588 (see `quality/test-guidelines.md`)
- All MIGRATE candidates follow existing patterns: component renders with mocked Next.js, or pure logic tests
- KEEP suites are browser-essential: wizard flows, keyboard navigation, multi-page state, dialog interaction
- The `profile-dropdown/` suite at 30 tests is the largest single suite but genuinely requires browser for dropdown + keyboard interaction
