# Plan: Remove Patreon Integration Completely

## Task Description
Remove all Patreon integration code, API routes, components, test suites, environment variables, and design docs from the Fenrir Ledger codebase. Stripe is now the sole subscription platform. The feature flag system that toggles between Patreon/Stripe becomes unnecessary and should be removed, with all code simplified to assume Stripe-only.

## Objective
After this plan is complete, the codebase will have zero Patreon references in application code. Stripe will be the only subscription platform with no feature flag indirection. The entitlement system will be simplified. All Patreon env vars will be removed from Vercel.

## Problem Statement
The codebase maintains a dual Patreon/Stripe subscription system behind feature flags. This adds unnecessary complexity — branching logic in 19+ files, 7 Patreon API routes that are disabled in production, 8 Patreon-specific test suites that must be platform-gated, and environment variables that serve no purpose. Patreon has been superseded by Stripe.

## Solution Approach
Two-phase removal:
1. **Delete Patreon-only artifacts** — API routes, lib/patreon/, PatreonSettings component, all Patreon test suites, design docs
2. **Simplify shared code to Stripe-only** — Remove feature flag toggle, remove isPatreon/isStripe branching from entitlement components, remove Patreon env vars from Vercel

## Relevant Files
Use these files to complete the task:

### Files to DELETE entirely

**API Routes (7 files):**
- `src/app/api/patreon/authorize/route.ts` — Patreon OAuth authorize redirect
- `src/app/api/patreon/callback/route.ts` — Patreon OAuth callback handler
- `src/app/api/patreon/membership/route.ts` — Authenticated membership lookup
- `src/app/api/patreon/membership-anon/route.ts` — Anonymous membership lookup
- `src/app/api/patreon/migrate/route.ts` — Anonymous-to-authenticated migration
- `src/app/api/patreon/unlink/route.ts` — Unlink Patreon account
- `src/app/api/patreon/webhook/route.ts` — Patreon webhook handler

**Library (3 files):**
- `src/lib/patreon/api.ts` — Patreon API client
- `src/lib/patreon/state.ts` — Patreon state management
- `src/lib/patreon/types.ts` — Patreon type definitions

**Component:**
- `src/components/entitlement/PatreonSettings.tsx` — Patreon settings UI

**Test Suites (8 spec files across 3 directories):**
- `quality/test-suites/patreon/` — 6 spec files (entitlement-hook, gate-components, app-base-url, upsell-banner, api-routes, settings-page)
- `quality/test-suites/anon-patreon/anon-patreon.spec.ts`
- `quality/test-suites/anon-patreon-client/anon-patreon-client.spec.ts`

**Design Docs (3 files):**
- `designs/product/backlog/patreon-subscription-brief.md`
- `designs/product/backlog/patreon-subscription-integration.md`
- `designs/architecture/adr-009-patreon-entitlement.md`

### Files to EDIT (remove Patreon branches, simplify to Stripe-only)

**Feature flags — remove entirely:**
- `src/lib/feature-flags.ts` — Delete `isPatreon()`, `isStripe()`, `SUBSCRIPTION_PLATFORM`. Replace with a simple constant or remove the file if nothing else uses it.

**Entitlement system — remove Patreon paths:**
- `src/contexts/EntitlementContext.tsx` (~64 Patreon refs) — Remove Patreon membership API paths, anonymous Patreon linking, `getPatreonUserId`/`setPatreonUserId`/`clearPatreonUserId` imports, migration logic. Keep only Stripe membership path.
- `src/hooks/useEntitlement.ts` — Remove Patreon references
- `src/lib/entitlement/cache.ts` — Remove `getPatreonUserId`, `setPatreonUserId`, `clearPatreonUserId` exports
- `src/lib/entitlement/types.ts` — Remove Patreon-specific type references
- `src/lib/kv/entitlement-store.ts` — Remove Patreon-specific KV schema/logic

**Components — remove platform branching:**
- `src/components/entitlement/SubscriptionGate.tsx` — Remove `isPatreon()`/`isStripe()` imports and branching. Anonymous users are now always gated (Stripe behavior). Remove the "neither platform active" fallthrough.
- `src/components/entitlement/SealedRuneModal.tsx` — Remove Patreon CTA branch, keep Stripe CTA only
- `src/components/entitlement/UpsellBanner.tsx` — Remove Patreon references
- `src/components/entitlement/UnlinkConfirmDialog.tsx` — Remove Patreon references
- `src/components/entitlement/index.ts` — Remove `PatreonSettings` export

**Pages:**
- `src/app/settings/page.tsx` — Remove `PatreonSettings` import, remove `isPatreon()`/`isStripe()` conditional, render `StripeSettings` directly
- `src/app/page.tsx` — Remove Patreon references

**Supporting:**
- `src/app/globals.css` — Remove Patreon-related CSS comments/rules
- `src/lib/logger.ts` — Remove Patreon-specific masking references
- `src/lib/crypto/encrypt.ts` — Remove Patreon references
- `src/lib/stripe/types.ts` — Remove Patreon references in comments
- `src/lib/stripe/webhook.ts` — Remove Patreon references in comments

**Stripe API routes — remove `isStripe()` guards:**
- `src/app/api/stripe/checkout/route.ts` — Remove `isStripe()` check (always enabled now)
- `src/app/api/stripe/webhook/route.ts` — Remove `isStripe()` check
- `src/app/api/stripe/membership/route.ts` — Remove `isStripe()` check
- `src/app/api/stripe/portal/route.ts` — Remove `isStripe()` check
- `src/app/api/stripe/unlink/route.ts` — Remove `isStripe()` check

**Test suites — remove Patreon groups:**
- `quality/test-suites/feature-flags/feature-flags.spec.ts` — Remove all "default patreon mode" test groups, remove platform detection guards (no longer needed), keep Stripe-relevant tests
- `quality/test-suites/stripe-direct/stripe-direct.spec.ts` — Remove Patreon platform isolation tests, simplify to assert Stripe is always active

**ADR to update:**
- `designs/architecture/adr-feature-flags.md` — Mark as superseded or update to document Stripe-only

## Implementation Phases

### Phase 1: Foundation
- Identify all import chains that reference Patreon modules
- Map which shared files need edits vs full deletion
- Verify no runtime code paths depend on Patreon-specific localStorage keys for non-Patreon features

### Phase 2: Core Implementation
- Delete all Patreon-only files (routes, lib, component, test suites, docs)
- Edit shared files to remove Patreon branches and simplify to Stripe-only
- Remove feature flag system (isPatreon/isStripe/SUBSCRIPTION_PLATFORM)
- Remove `isStripe()` guards from Stripe API routes (always enabled)
- Update test suites to remove Patreon groups and platform detection guards

### Phase 3: Integration & Polish
- Verify TypeScript compiles with no errors (`npx tsc --noEmit`)
- Verify lint passes (`npx next lint`)
- Verify build succeeds (`npx next build`)
- Remove Patreon env vars from Vercel (all environments)
- Remove SUBSCRIPTION_PLATFORM env vars from Vercel (no longer needed)
- Trigger production redeploy

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to to the building, validating, testing, deploying, and other tasks.
  - This is critical. You're job is to act as a high level director of the team, not a builder.
  - You're role is to validate all work is going well and make sure the team is on track to complete the plan.
  - You'll orchestrate this by using the Task* Tools to manage coordination between the team members.
  - Communication is paramount. You'll use the Task* Tools to communicate with the team members and ensure they're on track to complete the plan.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Builder
  - Name: fireman-decko
  - Role: Architecture, system design, implementation
  - Agent Type: fireman-decko-principal-engineer
  - Resume: true
- Validator
  - Name: loki
  - Role: QA testing, validation, ship/no-ship decision
  - Agent Type: loki-qa-tester
  - Resume: true

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom. Each task maps directly to a `TaskCreate` call.
- Before you start, run `TaskCreate` to create the initial task list that all team members can see and execute.

### 1. Delete Patreon Backend and Library
- **Task ID**: delete-patreon-backend
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: true (with task 2)
- Delete the entire `src/app/api/patreon/` directory (7 route files)
- Delete the entire `src/lib/patreon/` directory (3 files)
- Remove `PatreonSettings.tsx` from `src/components/entitlement/`
- Remove `PatreonSettings` export from `src/components/entitlement/index.ts`
- Remove Patreon imports and conditional rendering from `src/app/settings/page.tsx` — render `<StripeSettings />` directly
- Remove `isPatreon()`/`isStripe()` imports wherever they appear

### 2. Delete Patreon Test Suites and Design Docs
- **Task ID**: delete-patreon-tests
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: true (with task 1)
- Delete `quality/test-suites/patreon/` directory (6 spec files)
- Delete `quality/test-suites/anon-patreon/` directory (1 spec file)
- Delete `quality/test-suites/anon-patreon-client/` directory (1 spec file)
- Delete `designs/product/backlog/patreon-subscription-brief.md`
- Delete `designs/product/backlog/patreon-subscription-integration.md`
- Delete `designs/architecture/adr-009-patreon-entitlement.md`
- Update `designs/architecture/adr-feature-flags.md` — add "Status: Superseded" header noting Stripe is now the sole platform

### 3. Remove Feature Flag System
- **Task ID**: remove-feature-flags
- **Depends On**: delete-patreon-backend
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- In `src/lib/feature-flags.ts`: remove `SUBSCRIPTION_PLATFORM`, `isPatreon()`, `isStripe()`. If no other flags remain, delete the file entirely. If other flags exist, keep only those.
- Remove all `isStripe()` guard blocks from Stripe API routes (`checkout`, `webhook`, `membership`, `portal`, `unlink`) — these routes are now always active
- Remove `isPatreon()`/`isStripe()` imports from all component files

### 4. Simplify Entitlement System to Stripe-Only
- **Task ID**: simplify-entitlement
- **Depends On**: remove-feature-flags
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- `src/contexts/EntitlementContext.tsx` — Remove all Patreon code paths: anonymous Patreon linking, `getPatreonUserId`/`setPatreonUserId`/`clearPatreonUserId`, Patreon membership API calls, migration logic. Keep only Stripe membership path.
- `src/lib/entitlement/cache.ts` — Remove Patreon-specific localStorage key functions
- `src/lib/entitlement/types.ts` — Remove Patreon-specific type references
- `src/lib/kv/entitlement-store.ts` — Remove Patreon-specific KV logic
- `src/hooks/useEntitlement.ts` — Remove Patreon references
- `src/components/entitlement/SubscriptionGate.tsx` — Remove platform branching, simplify to Stripe-only gating
- `src/components/entitlement/SealedRuneModal.tsx` — Remove Patreon CTA, keep Stripe CTA only
- `src/components/entitlement/UpsellBanner.tsx` — Remove Patreon references
- `src/components/entitlement/UnlinkConfirmDialog.tsx` — Remove Patreon references
- `src/app/page.tsx`, `src/app/globals.css`, `src/lib/logger.ts`, `src/lib/crypto/encrypt.ts`, `src/lib/stripe/types.ts`, `src/lib/stripe/webhook.ts` — Remove Patreon references in comments and code

### 5. Update Test Suites
- **Task ID**: update-test-suites
- **Depends On**: simplify-entitlement
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- `quality/test-suites/feature-flags/feature-flags.spec.ts` — Remove all "default patreon mode" test groups, remove `detectStripeMode()` platform detection (no longer needed), remove skip guards. Keep only tests that validate Stripe behavior and general page structure. Rename test descriptions from "patreon mode" to just describe the behavior.
- `quality/test-suites/stripe-direct/stripe-direct.spec.ts` — Remove "Platform isolation" tests (no longer relevant — there's only one platform). Remove any `isPatreon` references.
- Verify: `npx tsc --noEmit`, `npx next lint`, `npx next build`

### 6. Write Playwright Tests
- **Task ID**: write-playwright-tests
- **Depends On**: update-test-suites
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: false
- Write Playwright tests covering acceptance criteria for each PR
- Tests in `quality/test-suites/patreon-removal/`
- Key assertions:
  - All `/api/patreon/*` routes return 404
  - Settings page renders StripeSettings (no PatreonSettings)
  - No "Patreon" text appears anywhere in the UI
  - Stripe checkout flow still works
  - SealedRuneModal shows only Stripe CTA
- Run tests, verify all pass, commit to each PR's branch

### 7. Final Validation
- **Task ID**: validate-all
- **Depends On**: write-playwright-tests
- **Assigned To**: loki
- **Agent Type**: loki-qa-tester
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met
- Verify Playwright test coverage exists for all new functionality
- Grep entire codebase for "patreon" — only matches should be in ADR superseded notes, git history references, or test assertions proving routes are gone

## Stories

Group the tasks above into max 5 PR-sized stories. Each story becomes one branch + one PR.
The orchestrator (`/orchestrate`) reads this section to know how to execute.

### Story 1: Remove Patreon Code and Simplify to Stripe-Only
- **Slug**: remove-patreon
- **Branch**: refactor/remove-patreon
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Tasks**: delete-patreon-backend, delete-patreon-tests, remove-feature-flags, simplify-entitlement, update-test-suites
- **Acceptance Criteria**:
  - All 7 Patreon API route files are deleted
  - All 3 `lib/patreon/` files are deleted
  - `PatreonSettings.tsx` is deleted
  - All 8 Patreon test spec files are deleted (3 directories)
  - 3 Patreon design docs are deleted
  - `feature-flags.ts` no longer exports `isPatreon()` or `isStripe()`
  - No `isStripe()` guards in Stripe API routes (always active)
  - `EntitlementContext` has zero Patreon code paths
  - `SubscriptionGate` has no platform branching
  - `SealedRuneModal` shows only Stripe CTA
  - `settings/page.tsx` renders `<StripeSettings />` directly (no conditional)
  - `npx tsc --noEmit` passes
  - `npx next lint` passes
  - `npx next build` succeeds
  - `grep -ri patreon src/` returns zero matches in application code (comments about removal are acceptable in test assertions only)

### Story 2: QA Validation and Patreon Removal Tests
- **Slug**: patreon-removal-qa
- **Branch**: test/patreon-removal-qa
- **Depends On**: Story 1
- **Assigned To**: loki
- **Tasks**: write-playwright-tests, validate-all
- **Acceptance Criteria**:
  - Playwright tests verify all `/api/patreon/*` routes return 404
  - Playwright tests verify no "Patreon" text in UI
  - Playwright tests verify Stripe checkout and SealedRuneModal work
  - All existing tests pass (no regressions)
  - Full validation commands pass

## Deployment Configuration

### Environment Variables

| Variable | Action | Environments |
|----------|--------|-------------|
| `PATREON_CLIENT_ID` | **REMOVE** | development, preview, production |
| `PATREON_CLIENT_SECRET` | **REMOVE** | development, preview, production |
| `PATREON_CAMPAIGN_ID` | **REMOVE** | development, preview, production |
| `PATREON_WEBHOOK_SECRET` | **REMOVE** | development, preview, production |
| `SUBSCRIPTION_PLATFORM` | **REMOVE** | preview, production |
| `NEXT_PUBLIC_SUBSCRIPTION_PLATFORM` | **REMOVE** | preview, production |

That's 16 env var deletions total across all environments.

### Infrastructure Changes
None — Stripe is already the active platform. Removing Patreon env vars has no infra impact.

### Deployment Steps
1. Merge Story 1 PR to main (triggers production deploy automatically)
2. After deploy succeeds, remove all 16 Patreon/SUBSCRIPTION_PLATFORM env vars from Vercel using:
   ```bash
   for var in PATREON_CLIENT_ID PATREON_CLIENT_SECRET PATREON_CAMPAIGN_ID PATREON_WEBHOOK_SECRET; do
     for env in development preview production; do
       vercel env rm "$var" "$env" --yes
     done
   done
   for var in SUBSCRIPTION_PLATFORM NEXT_PUBLIC_SUBSCRIPTION_PLATFORM; do
     for env in preview production; do
       vercel env rm "$var" "$env" --yes
     done
   done
   ```
3. Trigger final production redeploy: `gh workflow run vercel-production.yml --ref main`

## Acceptance Criteria
- Zero Patreon references in application source code (`src/`)
- Zero Patreon API routes exist
- Zero Patreon test suites exist
- Feature flag system removed (no isPatreon/isStripe toggle)
- Stripe API routes have no feature flag guards
- Settings page renders Stripe UI directly
- Entitlement context uses Stripe path only
- All Patreon env vars removed from Vercel
- SUBSCRIPTION_PLATFORM env vars removed from Vercel
- TypeScript compiles, lint passes, build succeeds
- All Playwright tests pass

## Validation Commands
Execute these commands to validate the task is complete:

- `cd development/frontend && npx tsc --noEmit` - Type-check the codebase
- `cd development/frontend && npx next lint` - Lint the codebase
- `cd development/frontend && npx next build` - Verify the build succeeds
- `grep -ri "patreon" development/frontend/src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"` - Should return zero matches
- `grep -ri "isPatreon\|isStripe" development/frontend/src/ | grep -v "node_modules"` - Should return zero matches
- `ls development/frontend/src/app/api/patreon/ 2>&1` - Should return "No such file or directory"
- `ls development/frontend/src/lib/patreon/ 2>&1` - Should return "No such file or directory"
- `ls quality/test-suites/patreon/ 2>&1` - Should return "No such file or directory"

## Notes
- The `.env.local` file may still have `PATREON_*` vars locally — builders should clean those up but it's not blocking since the code no longer references them.
- The `APP_BASE_URL` env var on Vercel was used for Patreon OAuth redirects. Check if Stripe needs it; if not, it can be removed too.
- `src/lib/kv/entitlement-store.ts` may have Patreon-specific KV key patterns (`patreon:*`). These should be removed from the code but existing KV entries can be left to expire naturally.
- After this plan, the `src/components/entitlement/` directory should still exist but only contain Stripe-relevant components (StripeSettings, SubscriptionGate, SealedRuneModal, UpsellBanner, UnlinkConfirmDialog, index.ts).
