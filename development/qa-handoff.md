# QA Handoff -- Remove Patreon (Story 1)

**Branch:** `refactor/remove-patreon`
**Date:** 2026-03-04
**Engineer:** FiremanDecko

## What was implemented

Complete removal of all Patreon code paths, feature flag system, and Patreon-specific test suites. Stripe is now the sole subscription platform with no feature flag gating.

## Summary of changes by task

### Task 1: Delete Patreon Backend and Library
- Deleted `src/app/api/patreon/` (7 route directories: authorize, callback, membership, membership-anon, migrate, unlink, webhook)
- Deleted `src/lib/patreon/` (3 files: api.ts, state.ts, types.ts)
- Deleted `src/components/entitlement/PatreonSettings.tsx`
- Removed `PatreonSettings` export from `src/components/entitlement/index.ts`
- Simplified `src/app/settings/page.tsx` to render `<StripeSettings />` directly

### Task 2: Delete Patreon Test Suites and Design Docs
- Deleted `quality/test-suites/patreon/` (6 spec files)
- Deleted `quality/test-suites/anon-patreon/` (1 spec file)
- Deleted `quality/test-suites/anon-patreon-client/` (1 spec file)
- Deleted `designs/product/backlog/patreon-subscription-brief.md`
- Deleted `designs/product/backlog/patreon-subscription-integration.md`
- Deleted `designs/architecture/adr-009-patreon-entitlement.md`
- Updated `designs/architecture/adr-feature-flags.md` with "Status: Superseded" header

### Task 3: Remove Feature Flag System
- Deleted `src/lib/feature-flags.ts` entirely (no other flags remained)
- Removed `isStripe()` guard blocks from all 5 Stripe API routes (checkout, webhook, membership, portal, unlink)
- Stripe routes are now always active

### Task 4: Simplify Entitlement System to Stripe-Only
- `EntitlementContext.tsx`: Removed all Patreon code paths (anonymous Patreon linking, migration, Patreon membership fetching). Removed `isAnonymouslyLinked`, `isMigrating`, `linkPatreon`, `unlinkPatreon`, `migrateAnonymousEntitlement` from context value.
- `cache.ts`: Removed `getPatreonUserId`, `setPatreonUserId`, `clearPatreonUserId` functions
- `types.ts`: Changed `EntitlementPlatform` from `"patreon" | "stripe"` to just `"stripe"`
- `entitlement-store.ts`: Removed all Patreon-specific KV operations. Kept only Stripe operations.
- `SubscriptionGate.tsx`: Removed platform branching. Gates all users through Stripe checks.
- `SealedRuneModal.tsx`: Removed Patreon CTA. Stripe CTA always renders.
- `UpsellBanner.tsx`: Simplified to Stripe-only with permanent dismiss.
- `UnlinkConfirmDialog.tsx`: Changed copy from "Patreon" to "Subscription"/"Stripe"
- Various comment updates in: `page.tsx`, `globals.css`, `logger.ts`, `encrypt.ts`, `stripe/types.ts`, `stripe/webhook.ts`, `stripe/membership/route.ts`

### Task 5: Update Test Suites
- `feature-flags.spec.ts`: Rewrote entirely for Stripe-only world
- `stripe-direct.spec.ts`: Removed platform isolation tests and Patreon-mode fallback logic

## Validation results

All three checks pass:
- `npx tsc --noEmit` -- zero errors
- `npx next lint` -- zero warnings or errors
- `npx next build` -- builds successfully, `/api/patreon/*` routes absent from output

Zero-match verification:
- `grep -ri "patreon" src/ --include="*.ts" --include="*.tsx"` -- zero matches
- `grep -ri "isPatreon\|isStripe" src/` -- zero matches
- `ls src/app/api/patreon/` -- "No such file or directory"

## How to deploy

Standard Vercel deployment. No new env vars needed. The following env vars can be removed from Vercel after deployment:
- `SUBSCRIPTION_PLATFORM`
- `NEXT_PUBLIC_SUBSCRIPTION_PLATFORM`
- Any Patreon-specific env vars (PATREON_CLIENT_ID, PATREON_CLIENT_SECRET, PATREON_CAMPAIGN_ID, PATREON_WEBHOOK_SECRET)

## Suggested test focus areas

1. Verify `/settings` page renders the Stripe subscription section correctly
2. Verify premium feature gates show "Learn more" -> SealedRuneModal with Stripe CTA
3. Verify UpsellBanner appears on dashboard for Thrall users and dismisses correctly
4. Verify all 5 Stripe API routes respond (no 404s, auth routes return 401)
5. Verify no console errors or hydration warnings on page load
6. Verify mobile responsiveness at 375px
7. Run `quality/test-suites/feature-flags/feature-flags.spec.ts`
8. Run `quality/test-suites/stripe-direct/stripe-direct.spec.ts`

## Known limitations

- The `EntitlementPlatform` type is now just `"stripe"` -- any code checking for `"patreon"` will get a TypeScript error (desired behavior)
- The `encrypt.ts` module remains but is no longer used for Patreon tokens -- it may still be used by other code paths
