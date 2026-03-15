# ⚔️ Fenrir Ledger — Quality Report

**_The wolf hunts. The tests must be ruthless._**

<!-- This file is maintained by quality/scripts/loki-critique.sh and Loki QA verdicts. -->
<!-- The "Loki QA Critique" section is auto-generated and will be overwritten on each run. -->
<!-- Styled with the voice of Loki (wolf son of Fenrir) and the dark Norse aesthetic. -->

## QA Verdict: Issue #933 — Migrate Odin's Throne Auth to oauth2-proxy Sidecar

**Branch:** `security/issue-933-oauth2-proxy-odin-throne`
**Date:** 2026-03-15
**Verdict: PASS**

### Scope Assessment

This is an infrastructure-only change. No frontend application code (`development/frontend/`) was modified. The changed files are:

| File | Change | Category |
|------|--------|----------|
| `development/monitor/src/auth.ts` | Deleted | Monitor service — infrastructure |
| `development/monitor/src/index.ts` | Stripped auth middleware | Monitor service — infrastructure |
| `infrastructure/helm/odin-throne/templates/deployment.yaml` | Added oauth2-proxy sidecar | Helm chart — banned from automated testing |
| `infrastructure/helm/odin-throne/values.yaml` | oauth2Proxy section | Helm values — banned from automated testing |
| `security/architecture/auth-architecture.md` | New section 8 documenting sidecar pattern | Static documentation |

**Infrastructure-only change — 0 new tests written. This is correct per test guidelines.**

### Rationale — Why Zero Tests

The decision tree (per test guidelines §"Decision Order"):

1. Can this be tested with pure logic? — No. The deleted `auth.ts` contained handrolled HMAC-SHA256 session logic running in Node.js, but it is now deleted. There is no application logic to unit test.
2. Can this be tested with component render or API route handler? — No. `development/monitor/` is a standalone Hono service, not a Next.js route handler. It has no `src/__tests__/` directory and no vitest integration with the frontend test runner.
3. Does this require multi-page navigation or real browser? — No. The oauth2-proxy sidecar enforces auth at the infrastructure layer (Kubernetes reverse proxy). Functional validation requires a live GKE cluster with the oauth2-proxy pod running, which is outside automated test scope.

The auth delegation to oauth2-proxy is validated at deploy time, not in unit tests. This matches the pattern already established for Umami (issue #943).

### Vitest Suite Status

- Frontend Vitest: 771 tests across 59 files — all passing
- No tests added, none removed, no regressions introduced

### TypeScript

- `tsc --noEmit` via `quality/scripts/verify.sh --step tsc`: PASS

### Security Notes

The deletion of `auth.ts` removes a custom auth implementation in favor of the battle-tested oauth2-proxy sidecar. This is a reduction of attack surface, not an increase. The `/healthz` route remains correctly public (`--skip-auth-route=GET=^/healthz$`). All other routes (`/api/jobs`, `/ws`) are now gated by oauth2-proxy before reaching the Hono process.

The `AUTH_DISABLED` escape hatch (which allowed bypassing auth when `SESSION_SECRET` was absent in non-production) is also removed — a security improvement.

---

## QA Verdict: Issue #893 — Free Trial Nav Highlight

**Branch:** `fix/issue-893-free-trial-nav-highlight`
**Date:** 2026-03-14
**Verdict: PASS**

### What Was Broken

The "Free Trial" nav link in `MarketingNavbar` had a hardcoded `isFreeTrial` flag in the className logic for both desktop and mobile renders. This caused the Free Trial link to permanently carry the active-highlight styling (border box on desktop, `font-semibold` on mobile) regardless of the current route. On the homepage and any page other than `/free-trial`, the link appeared highlighted when it should not have been — and on pages like `/features` or `/pricing`, two links appeared highlighted simultaneously.

### The Fix

FiremanDecko removed the `isFreeTrial` flag entirely from both the desktop and mobile render loops in `MarketingNavbar.tsx`. Both now unconditionally delegate to `isNavLinkActive(pathname, href)`, which implements exact-or-subpath matching (`pathname === href || pathname.startsWith(href + "/")`). The Free Trial link now receives the active style only when the current pathname is exactly `/free-trial` or a sub-path of it (e.g., `/free-trial/signup`).

The `isNavLinkActive` helper is already correct: it guards `null` pathname, requires a trailing-slash boundary to prevent `/free-trialXYZ` false positives, and is exported for direct unit testing.

### Edge Case Analysis

| Scenario | Expected | Result |
|---|---|---|
| pathname = `/free-trial` | active | PASS |
| pathname = `/free-trial/signup` (sub-route) | active | PASS |
| pathname = `/free-trial/` (trailing slash) | active | PASS |
| pathname = `/free-trialXYZ` (partial prefix, no slash) | inactive | PASS |
| pathname = `/` (homepage) | inactive | PASS |
| pathname = `/pricing` | inactive | PASS |
| pathname = `/features` | inactive | PASS |
| pathname = `/about` | inactive | PASS |
| pathname = `null` (Next.js pre-render) | inactive | PASS |
| other nav links unaffected (Pricing, Features, About) | each highlights only on own route | PASS |
| mobile overlay: same logic applies | same | PASS |

All edge cases pass. The guard against partial prefix (`/free-trialXYZ`) relies on the `+ "/"` in `startsWith(href + "/")`, which is correct and already tested in both `nav-active-link.test.tsx` and `marketing-navbar.test.tsx`.

### Test Coverage

**New Vitest tests (this PR):**

| File | Tests added | Who |
|---|---|---|
| `src/__tests__/marketing/nav-active-link.test.tsx` | 20 (FiremanDecko) + 4 (Loki) = 24 | Both |

All 24 tests in `nav-active-link.test.tsx` pass. The existing `marketing-navbar.test.tsx` (15 tests) also passes and covers `isNavLinkActive` edge cases from a prior issue.

Total nav-related Vitest tests: 39. All passing.

**Playwright E2E tests:** None written. This fix is pure logic — className computation driven by a pathname comparison. A Vitest component render test that inspects `aria-current` and `className` is sufficient and faster (183ms vs 5s). No browser-only behavior exists.

### Acceptance Criteria Status

- "Free Trial" only highlighted when on /free-trial — VERIFIED (tests + manual edge case analysis)
- Other nav links highlight correctly on their respective pages — VERIFIED (Pricing, Features, About all have dedicated test cases)
- No link highlighted on the homepage — VERIFIED (explicit test: `no nav link is highlighted on the home page`)

### Build / TypeScript

- `tsc --noEmit`: PASS (no errors in nav component)
- `npm run build`: PASS (compiled successfully in 24.7s, 57 static pages generated)

### Pre-Existing Failures (Not Regressions)

`deploy-workflow.test.ts` has 2 failing tests (`Deploy job needs: array vs string mismatch`) — predates this PR, confirmed in Loki's augmentation commit message.

---

## Loki QA Critique

_Bite sharpened. Chains weighed. Last hunt: 2026-03-12 09:51 PDT_
_Weapon: `quality/scripts/loki-critique.sh`_

### Summary — The Hunt Continues

| Metric | Value |
|--------|-------|
| Total E2E spec files | 27 |
| Total E2E tests | 159 |
| Flagged files | 5 🔴 _packs of bloat_ |
| Critical violations (>15 tests/file) | 3 ⚔️ _mortal wounds_ |
| Bloat warnings | 4 |
| Bloat exposure (% of files flagged) | 19% |
| Overall health | **🐺 WARNING — THE WOLF WATCHES** |

### Flagged Files

| Suite | Tests | Finding |
|-------|-------|---------|
| `quality/test-suites/trial-expiry-modal/trial-expiry-modal.spec.ts` | 28 | BLOAT: >15 tests in one file — split by sub-feature |
| `quality/test-suites/trial-state/trial-state.spec.ts` | 20 | BLOAT: >15 tests in one file |
| `quality/test-suites/settings-cleanup/settings-cleanup.spec.ts` | 17 | BLOAT: >15 tests in one file |
| `quality/test-suites/trust-safety/marketing-pages-trust-messaging.spec.ts` | 15 | WARNING: at threshold (15 tests) |
| `quality/test-suites/trial-panel-nudge/trial-panel-nudge.spec.ts` | 12 | WARNING: >10 tests in one file |
| `quality/test-suites/gke-migration/gke-migration.spec.ts` | 5 | NOTE: consolidated from issue-682/ — now properly placed |

### Bloat Pattern Breakdown — Fangs Sink Deep

**🐁 Issue-scoped directories** — _Easy prey, left scattered. Consolidate._
- `issue-682/` (5 tests) — ✅ Consolidated into `gke-migration/gke-migration.spec.ts`.

**Oversized suites** (split or cull):
- `trial-expiry-modal/` (28 tests) — split by sub-feature (modal display, timer logic, dismissal)
- `trial-state/` (20 tests) — split API contract tests from integration patterns
- `settings-cleanup/` (17 tests) — split by settings area

### Consolidation Recommendations

1. **Merge `issue-682/`** — 5 GKE migration tests that overlap with `gke-migration/`. Consolidate into `gke-migration/gke-migration.spec.ts`.

2. **Split `trial-expiry-modal/`** — 28 tests is nearly double the hard limit. Split into `trial-expiry-modal/modal-display.spec.ts` and `trial-expiry-modal/timer-logic.spec.ts`.

3. **Split `trial-state/`** — 20 tests covering API contracts and integration patterns. Separate API tests into Vitest integration tests where possible.

4. **Split `settings-cleanup/`** — 17 tests across multiple settings areas. Split by sub-feature or move pure logic tests to Vitest.

### Rules Enforced — The Pack's Law

_From the howling wastelands of Valheim, carved in bone and stone._

See `quality/test-guidelines.md` §"Bloat Detection Rules" for the authoritative checklist.
The thresholds Loki's teeth sink into:

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
