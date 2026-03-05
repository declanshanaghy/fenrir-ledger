# QA Handoff -- Settings Soft Gate

**Branch:** `test/settings-soft-gate-qa`
**Date:** 2026-03-05
**QA:** Loki
**PR Under Test:** https://github.com/declanshanaghy/fenrir-ledger/pull/137

---

## What was tested

PR #137 adds a `mode?: "hard" | "soft"` prop to `SubscriptionGate` and updates the
Settings page to use `mode="soft"` on all 3 premium feature gate wrappers (Cloud Sync,
Multi-Household, Data Export). This allows Thrall users to see the feature placeholder
sections rather than the hard-lock placeholder, while still displaying a subscribe banner
above each section.

## Test file

`quality/test-suites/settings-soft-gate/settings-soft-gate.spec.ts`

## Acceptance criteria covered

| AC | Description | Test IDs |
|----|-------------|----------|
| AC-01 | Soft mode always renders children | TC-SGT-001 to TC-SGT-004 |
| AC-02 | Subscribe banner above children for non-subscribers | TC-SGT-005 to TC-SGT-007 |
| AC-03 | No banner for Karl users | TC-SGT-008 to TC-SGT-009 |
| AC-04 | Children visible during loading | TC-SGT-010 to TC-SGT-011 |
| AC-05 | All 3 sections visible to non-subscribers | TC-SGT-012 to TC-SGT-016 |
| AC-06 | Subscribe banners present above all 3 sections | TC-SGT-017 to TC-SGT-018 |
| AC-07 | Subscribe button 44px touch target | TC-SGT-019 to TC-SGT-021 |
| AC-08 | Subscribe button triggers Stripe checkout | TC-SGT-022 to TC-SGT-023 |
| AC-09 | Hard mode regression: sections hidden when mode="hard" | TC-SGT-024 |
| AC-10 | Hard mode regression: no "Learn more" in soft-mode sections | TC-SGT-025 |
| Regression | No console errors, no hydration errors | TC-SGT-026 to TC-SGT-027 |
| Mobile | 375px viewport coverage | TC-SGT-028 to TC-SGT-030 |

## Test run results (against pre-implementation worktree)

Run against `http://localhost:52505` (pre-PR #137 code, hard mode active):

- **30 tests total**
- **11 passing** (infrastructure tests that hold in both modes)
- **19 failing** (spec-driven tests for soft-gate behavior, expected to fail before implementation)

These 19 failures are the exact defects PR #137 must fix. They serve as the green-light
gate: all 30 tests must pass once the implementation is applied.

## How to run

```bash
cd development/frontend
NODE_PATH=./node_modules SERVER_URL=http://localhost:<port> npx playwright test \
  quality/test-suites/settings-soft-gate/
```

## What cannot be automated

| Scenario | Reason |
|----------|--------|
| Karl user state via real Stripe | Requires active Stripe subscription in KV |
| Soft-gate banner dismiss persistence | Depends on implementation detail of dismiss key (none in spec) |
| Stripe Checkout completion | Requires live Stripe keys + real card input |

Manual test steps for these paths are documented at the bottom of the test file.

## Verdict

**BLOCKED -- awaiting PR #137 implementation.**

Once PR #137 is merged and the worktree is rebuilt against the implementation branch,
re-run the test suite. All 30 tests must pass for a PASS verdict.
