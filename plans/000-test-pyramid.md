# Testing Pyramid Overhaul — Phase 1: Unit Tests + Coverage Foundation

## Context

Fenrir Ledger has an inverted testing pyramid: 41 Playwright E2E suites (~502 tests) and only 9 Vitest unit test files (all Stripe-related). Critical backend modules — requireAuth, rate limiter, entitlement store — have zero unit coverage. Many Playwright tests exercise logic (form validation, data utils, auth state) that belongs at the unit level. Phase 1 establishes the unit test foundation, coverage infrastructure, and an assessment of which Playwright tests to migrate in Phase 2.

## Issue Breakdown (5 issues)

### Issue 1: Vitest coverage infrastructure and npm scripts
**Type:** enhancement | **Priority:** high | **Depends on:** nothing

- Add `@vitest/coverage-v8` to devDeps
- Configure coverage in `vitest.config.ts` (reporters: text-summary, html, lcov → `quality/reports/coverage/vitest/`)
- Add `npm run test:unit` and `npm run test:unit:coverage` scripts to `package.json`
- Verify existing 9 test files pass under new config
- Update `/coverage-report` skill and `quality/scripts/coverage.mjs` to support `--unit-only` mode

**Key files:** `development/ledger/vitest.config.ts`, `development/ledger/package.json`, `quality/scripts/coverage.mjs`, `.claude/skills/coverage-report/SKILL.md`

### Issue 2: Unit tests for requireAuth, require-karl, and rate limiter
**Type:** enhancement | **Priority:** high | **Depends on:** #1

- `require-auth.test.ts`: valid token, expired token, missing token, malformed Authorization header
- `require-karl.test.ts`: Karl-entitled user passes, Thrall blocked, missing entitlement
- `rate-limit.test.ts`: under limit passes, at limit blocked, window reset
- All mock external deps (KV, Google token verification) via `vi.mock`

**Key files:** `src/lib/auth/require-auth.ts` (82 LOC), `src/lib/auth/require-karl.ts` (75 LOC), `src/lib/rate-limit.ts` (55 LOC)

### Issue 3: Unit tests for Stripe checkout, webhook, portal, and unlink routes
**Type:** enhancement | **Priority:** high | **Depends on:** #1

- Extend/consolidate existing 8 Stripe test files in `src/__tests__/stripe/`
- `checkout/route.test.ts`: session creation, auth failure, duplicate prevention (#565 guard), revive flow
- `webhook/route.test.ts`: valid signature + event routing, invalid signature, each event handler
- `portal/route.test.ts`: redirect generation, auth failure
- `unlink/route.test.ts`: successful unlink, auth failure, missing subscription
- All Stripe SDK calls mocked via `vi.mock("stripe")`

**Key files:** `src/app/api/stripe/checkout/route.ts` (306 LOC), `src/app/api/stripe/webhook/route.ts` (420 LOC), `src/app/api/stripe/portal/route.ts` (118 LOC), `src/app/api/stripe/unlink/route.ts` (134 LOC), `src/lib/stripe/webhook.ts` (123 LOC), existing tests in `src/__tests__/stripe/`

### Issue 4: Unit tests for entitlement-store, card-utils, storage, milestone-utils, gleipnir-utils
**Type:** enhancement | **Priority:** high | **Depends on:** #1

- `entitlement-store.test.ts`: get/set/delete entitlement, cache behavior, KV failure handling
- `card-utils.test.ts`: computeCardStatus for each status, boundary dates, no-date edge cases
- `storage.test.ts`: CRUD operations, localStorage mock (happy-dom provides this), data migration
- `milestone-utils.test.ts`: threshold checks for 1/5/9/13/20 card counts
- `gleipnir-utils.test.ts`: fragment count, isGleipnirComplete with all/some/no fragments

**Key files:** `src/lib/kv/entitlement-store.ts` (365 LOC), `src/lib/card-utils.ts` (271 LOC), `src/lib/storage.ts` (478 LOC), `src/lib/milestone-utils.ts` (39 LOC), `src/lib/gleipnir-utils.ts` (32 LOC)

### Issue 5: Playwright test assessment + combined coverage report
**Type:** enhancement | **Priority:** high | **Depends on:** #2, #3, #4

- Audit all 41 Playwright test suites in `quality/test-suites/`
- Produce `quality/reports/playwright-assessment.md` tagging each suite: **KEEP** (needs browser), **MIGRATE** (unit test candidate), **SPLIT** (some assertions migrate)
- Include rationale per suite (1-2 sentences)
- Update `quality/scripts/coverage.mjs` to merge Vitest lcov + Playwright V8 lcov into combined report at `quality/reports/coverage/`
- Update `/coverage-report` skill to invoke merged pipeline
- NO Playwright tests deleted or modified — assessment only

**Key files:** `quality/test-suites/` (41 suites), `quality/scripts/coverage.mjs`, `quality/reports/playwright-assessment.md` (new)

## Dependency Graph

```
#1 (infra) ──→ #2 (auth/rate)  ──┐
           ──→ #3 (stripe)     ──┼──→ #5 (assessment + combined coverage)
           ──→ #4 (utils)      ──┘
```

Issues 2, 3, 4 can run in parallel after 1 lands. Issue 5 runs last.

## Existing Patterns to Reuse

- `src/__tests__/setup.ts` — already mocks STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, APP_BASE_URL, GOOGLE_CLIENT_ID, KV_REST_API_URL, KV_REST_API_TOKEN
- `vitest.config.ts` — already uses happy-dom environment and `@/` alias
- `src/__tests__/stripe/` — 8 existing test files showing Stripe mock patterns
- `quality/scripts/coverage.mjs` — existing V8 coverage collection (needs merge capability added)

## Verification

After all 5 issues merge:
1. `cd development/ledger && npm run test:unit:coverage` — all unit tests pass, coverage HTML report generated
2. `/coverage-report` — combined Vitest + Playwright coverage report at `quality/reports/coverage/`
3. `quality/reports/playwright-assessment.md` exists with KEEP/MIGRATE/SPLIT tags for all 41 suites
