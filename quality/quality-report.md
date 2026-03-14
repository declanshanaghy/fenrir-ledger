# ⚔️ Fenrir Ledger — Quality Report

**_The wolf hunts. The tests must be ruthless._**

<!-- This file is maintained by quality/scripts/loki-critique.sh and Loki QA verdicts. -->
<!-- The "Loki QA Critique" section is auto-generated and will be overwritten on each run. -->
<!-- Styled with the voice of Loki (wolf son of Fenrir) and the dark Norse aesthetic. -->

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
