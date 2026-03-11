# Playwright Test Coverage Report

**Date:** 2026-03-11
**Branch:** fix/issue-554-test-cleanup (after PR #567 route fix + #568 suite cleanup)
**Suites:** 40 | **Spec files:** 53 | **Test cases:** ~502

## Coverage Summary

| Area | Status | Suites | Tests | Notes |
|------|--------|--------|-------|-------|
| **Auth / Sign-in** | Covered | 4 | 55 | auth, auth-returnto, sign-in-transitions, google-session-refresh |
| **Dashboard** | Covered | 4 | 44 | dashboard, dashboard-tabs, dashboard-5-tabs, status-badges |
| **Card CRUD** | Covered | 2 | 37 | card-crud, card-lifecycle (add/edit/close/delete) |
| **Card Wizard** | Covered | 4 | 54 | wizard-animations, wizard-step2, wizard-back-button, fee-bonus-step2 |
| **Valhalla** | Covered | 2 | 24 | valhalla, valhalla-financial-sort |
| **Import** | Covered | 2 | 37 | import (wizard + norse copy), csv-format-help |
| **Layout / Nav** | Covered | 3 | 19 | layout (topbar/footer/sidebar/howl), homepage-logo |
| **Theme** | Covered | 2 | 24 | theme-toggle, theme-toggle-cycling |
| **Accessibility** | Covered | 2 | 20 | accessibility, dialog-a11y |
| **Profile** | Covered | 1 | 40 | profile-dropdown (2 spec files) |
| **Settings** | Covered | 2 | 23 | settings-soft-gate, feature-flags |
| **Empty States** | Covered | 2 | 17 | empty-state-cta, stale-auth-nudge |
| **Security** | Covered | 2 | 28 | csp-nonce, csp-youtube |
| **Other** | Covered | 8 | 80 | chronicles, credit-limit, howl-count, issue-333, nextjs-upgrade, reverse-tab-order, select-reset, sync-indicator |

## Route Coverage

### Protected Routes (/ledger/*)

| Route | Test Coverage | Suites |
|-------|--------------|--------|
| `/ledger` (dashboard) | Strong | dashboard, dashboard-tabs, dashboard-5-tabs, empty-state-cta, status-badges |
| `/ledger/cards/new` | Strong | card-lifecycle/add-card, wizard-animations, wizard-step2, wizard-back-button, fee-bonus-step2 |
| `/ledger/cards/[id]/edit` | Strong | card-lifecycle/edit-card, card-crud/edit-card |
| `/ledger/valhalla` | Moderate | valhalla, valhalla-financial-sort |
| `/ledger/settings` | Moderate | settings-soft-gate, feature-flags |
| `/ledger/sign-in` | Strong | auth/sign-in, sign-in-transitions |
| `/ledger/auth/callback` | Strong | auth/auth-callback |

### Marketing Routes

| Route | Test Coverage | Suites |
|-------|--------------|--------|
| `/` (home) | Light | homepage-logo, layout/topbar |
| `/chronicles` | Light | chronicles |
| `/about` | Light | about-profile-images |
| `/features` | None | -- |
| `/pricing` | None | -- |
| `/faq` | None | -- |
| `/privacy` | None | -- |
| `/terms` | None | -- |

### API Routes

| Route | Test Coverage | Notes |
|-------|--------------|-------|
| `/api/stripe/checkout` | None | Was covered by stripe-direct (deleted - needed secrets) |
| `/api/stripe/webhook` | None | Was covered by webhook-dedup (deleted - needed secrets) |
| `/api/stripe/portal` | None | -- |
| `/api/stripe/unlink` | None | Was covered by unlink-kv-dedup (deleted - needed secrets) |
| `/api/stripe/membership` | None | -- |
| `/api/sheets/import` | None | Backend route - tested indirectly via import wizard UI |
| `/api/config/picker` | None | Backend route |
| `/api/auth/token` | None | Backend route |

## Gaps Identified

### Critical Gaps (should address)
1. **Stripe integration** - No Playwright coverage since tests need secrets. Consider Vitest unit tests with mocked Stripe SDK instead.
2. **API route auth** - requireAuth middleware is untested in CI. Consider Vitest unit tests.

### Moderate Gaps
3. **Marketing pages** (/features, /pricing, /faq) - No coverage. Low risk (static content).
4. **Settings page** - Only soft-gate and feature-flag tests; no subscription management UI tests.

### Acceptable Gaps
5. **Privacy/Terms** - Static legal pages, no behavioral tests needed.
6. **API routes** - Backend logic better suited to Vitest unit tests than Playwright.

## Deleted Suites (PR #568)

| Category | Count | Reason |
|----------|-------|--------|
| Stale content tests | 3 | Hardcoded slugs, routes that don't exist |
| Backend API tests | 5 | Need Stripe secrets + KV, always fail in preview CI |
| Implementation tests | 6 | readFileSync to check source code, not behavior |
| One-off verifications | 16 | Verified a one-time change, no ongoing value |
| Unimplemented features | 2 | Test features never built |
| Misc obsolete | 11 | Accumulated test rot |
| **Total deleted** | **43** | **646 tests removed** |

## Recommendations

1. **Short-term:** Merge PR #568 to get CI green, then rebase #562 and #566
2. **Medium-term:** Add Vitest unit tests for API routes (Stripe checkout, webhook, auth) with mocked dependencies
3. **Long-term:** Establish test hygiene rule: when a feature PR changes UI structure, failing tests must be updated in the same PR
