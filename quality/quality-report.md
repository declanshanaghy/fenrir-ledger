# Fenrir Ledger — Quality Report

<!-- This file is maintained by quality/scripts/loki-critique.sh and Loki QA verdicts. -->
<!-- The "Loki QA Critique" section is auto-generated and will be overwritten on each run. -->

## Loki QA Critique

_Last run: 2026-03-12 09:51 PDT_
_Script: `quality/scripts/loki-critique.sh`_

### Summary

| Metric | Value |
|--------|-------|
| Total E2E spec files | 29 |
| Total E2E tests | 248 |
| Flagged files | 16 |
| Critical violations (>15 tests/file) | 4 |
| Bloat warnings | 19 |
| Bloat exposure (% of files flagged) | 79% |
| Overall health | **CRITICAL** |

### Flagged Files

| Suite | Tests | Finding |
|-------|-------|---------|
| `quality/test-suites/auth-returnto/auth-returnto.spec.ts` | 11 | WARNING: >10 tests in one file |
| `quality/test-suites/auth/auth-callback.spec.ts` | 13 | WARNING: >10 tests in one file |
| `quality/test-suites/auth/sign-in.spec.ts` | 17 | BLOAT: >15 tests in one file, WARNING: CSS measurement calls, remove |
| `quality/test-suites/chronicles/chronicles.spec.ts` | 8 | WARNING: static text assertion, use integration test |
| `quality/test-suites/credit-limit-step2/credit-limit-step2.spec.ts` | 3 | WARNING: issue/step-scoped dir, consolidate, WARNING: tiny suite (1-3 tests), merge, WARNING: guard-clause test, low value |
| `quality/test-suites/csv-format-help/csv-format-help.spec.ts` | 3 | WARNING: tiny suite (1-3 tests), merge |
| `quality/test-suites/dashboard/dashboard.spec.ts` | 16 | BLOAT: >15 tests in one file |
| `quality/test-suites/empty-state-cta/empty-state-cta.spec.ts` | 14 | WARNING: >10 tests in one file |
| `quality/test-suites/fee-bonus-step2/fee-bonus-step2.spec.ts` | 7 | WARNING: issue/step-scoped dir, consolidate |
| `quality/test-suites/howl-count/howl-count-badge.spec.ts` | 3 | WARNING: tiny suite (1-3 tests), merge |
| `quality/test-suites/profile-dropdown/profile-dropdown.spec.ts` | 20 | BLOAT: >15 tests in one file, WARNING: CSS measurement calls, remove |
| `quality/test-suites/reverse-tab-order/dashboard-tab-order.spec.ts` | 7 | WARNING: keyboard over-specification (>3 keys) |
| `quality/test-suites/runic-empty-states/runic-empty-states.spec.ts` | 13 | WARNING: >10 tests in one file, WARNING: static text assertion, use integration test |
| `quality/test-suites/status-tooltips/status-tooltips.spec.ts` | 16 | BLOAT: >15 tests in one file, WARNING: CSS measurement calls, remove |
| `quality/test-suites/wizard-back-button/wizard-back-button.spec.ts` | 4 | WARNING: issue/step-scoped dir, consolidate |
| `quality/test-suites/wizard-step2/wizard-step2.spec.ts` | 11 | WARNING: >10 tests in one file, WARNING: issue/step-scoped dir, consolidate |

### Bloat Pattern Breakdown

**Issue/step-scoped directories** (should be merged into feature suites):
- `wizard-step2/`, `wizard-back-button/`, `select-reset/`, `credit-limit-step2/`, `fee-bonus-step2/`
- These were created as one-shot regression suites for individual issues.
  Once the fix is confirmed stable, the tests belong in `card-lifecycle/` or a `wizard/` suite.

**Tiny isolated suites** (should be merged):
- `howl-count/` (3 tests) — belongs in `dashboard-tabs/`
- `csv-format-help/` (3 tests) — belongs in the import wizard suite
- `credit-limit-step2/` (3 tests) — belongs in `card-lifecycle/`

**CSS measurement tests** (should be removed):
- `profile-dropdown/profile-dropdown.spec.ts` — TC-PD09 uses `boundingBox()` and `computedStyle`
  to verify pixel widths and padding. These are unreliable across viewports and add no behavioral value.

**Keyboard over-specification**:
- `reverse-tab-order/dashboard-tab-order.spec.ts` — 7 tests, 8 ArrowRight/ArrowLeft/Home/End
  key presses. Overlaps with `dashboard-tabs/`. Keep 1 smoke test for tab order verification.

**Static content assertions**:
- `chronicles/chronicles.spec.ts` — TC-1 asserts on h1 text "Prose Edda" and paragraph copy
  "sagas of the forge". These are MDX content assertions that break on every copy edit.

### Consolidation Recommendations

1. **Merge step-scoped wizard suites** — `wizard-step2/`, `wizard-back-button/`, `select-reset/`, `credit-limit-step2/`, `fee-bonus-step2/` all cover the card wizard flow. Consolidate into `card-lifecycle/wizard.spec.ts` (max 8 tests covering: step navigation, field visibility on step 2, select persistence, back-button, save).

2. **Merge tiny-isolated suites** — `howl-count/` (3 tests) belongs in `dashboard-tabs/`. `csv-format-help/` (3 tests) belongs in the import wizard suite (create `import/` if absent).

3. **Merge `reverse-tab-order/`** — 7 keyboard navigation tests that overlap with `dashboard-tabs/`. Move AC1/AC3 (tab order) there; drop the per-key-press over-specification.

4. **Remove CSS measurement tests in `profile-dropdown/`** — TC-PD09 (`boundingBox`, `computedStyle`) is a CSS test. The touch-target minimum is already covered by the a11y suite. Remove or replace with a single `toBeVisible` assertion.

5. **Trim `chronicles/`** — TC-3 (layout renders marketing navbar + footer) and TC-4 (Chronicles links in navbar) test static content structure. These belong in a component render test. TC-8 (loop over 2 chronicles) is a fragile integration test — replace with a single "first chronicle is accessible" assertion.

6. **Split `profile-dropdown/`** — 20 tests across 3 describe blocks (desktop, mobile, a11y). Desktop and mobile blocks repeat the same open/close/navigate assertions. Cull to: opens, navigates to settings, sign-out works, mobile viewport fits. Max 6 tests total.

### Rules Enforced

See `quality/test-guidelines.md` §"Bloat Detection Rules" for the authoritative checklist.
The thresholds evaluated by this script:

| Rule | Threshold | Severity |
|------|-----------|----------|
| Tests per file | >15 | CRITICAL |
| Tests per file | >10 | WARNING |
| Issue/step-scoped directory name | any | WARNING |
| Tiny isolated suite | 1-3 tests | WARNING |
| CSS measurement calls | any | WARNING |
| Static heading text assertions | any | WARNING |
| Keyboard nav over-specification | >3 key presses | WARNING |
| Guard-clause tests (negative step-1) | any | WARNING |
