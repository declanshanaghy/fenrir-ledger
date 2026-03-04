# QA Handoff -- Story 2: Client-Side Feature Flag Guards

**Branch:** `feat/feature-flags-client`
**Base:** `feat/feature-flags` (PR #113)
**Date:** 2026-03-04
**Engineer:** FiremanDecko

## What Was Implemented

Story 2 of the Stripe platform pivot feature flags. This builds on Story 1 (PR #113)
which added `src/lib/feature-flags.ts` with `isPatreon()`, `isStripe()` helpers and
guarded all 7 Patreon API routes with server-side checks.

Story 2 adds **client-side feature flag guards** so that when
`NEXT_PUBLIC_SUBSCRIPTION_PLATFORM=stripe`, all Patreon-specific UI and API calls
are suppressed. When the flag is unset or set to `patreon`, all existing behavior
is preserved with zero changes.

### Key behaviors added:

1. `PatreonSettings` does not render when stripe mode -- replaced with a "Subscription management coming soon" placeholder
2. `SealedRuneModal` hides Patreon campaign URL, tier row, and "Pledge on Patreon" CTA when stripe mode -- shows generic "Premium feature -- subscription coming soon" instead
3. `UpsellBanner` returns null (hidden entirely) when stripe mode
4. `EntitlementContext` skips all Patreon API calls (`linkPatreon`, `unlinkPatreon`, `refreshEntitlement`, `migrateAnonymousEntitlement`, OAuth callback processing) when stripe mode
5. `PatreonGate` renders children unconditionally when stripe mode (no lockout)

## Files Modified

| File | Description |
|------|-------------|
| `development/frontend/src/app/settings/page.tsx` | Import `isPatreon`, conditionally render `<PatreonSettings />` vs placeholder section |
| `development/frontend/src/components/entitlement/SealedRuneModal.tsx` | Import `isPatreon`, wrap Patreon tier row + CTA in conditional, show generic message in stripe mode |
| `development/frontend/src/components/entitlement/UpsellBanner.tsx` | Import `isPatreon`, early return null when `!isPatreon()` |
| `development/frontend/src/contexts/EntitlementContext.tsx` | Import `isPatreon`, guard `refreshEntitlement`, `linkPatreon`, `unlinkPatreon`, `migrateAnonymousEntitlement`, and OAuth callback useEffect |
| `development/frontend/src/components/entitlement/PatreonGate.tsx` | Import `isPatreon`, render children unconditionally when `!isPatreon()` |

## How to Test

### Test 1: Default behavior (Patreon mode -- no regression)

1. Ensure `NEXT_PUBLIC_SUBSCRIPTION_PLATFORM` is **unset** (or set to `patreon`).
2. Run the app: `cd development/frontend && npm run dev`
3. Navigate to `/settings`.
4. Verify: `PatreonSettings` component renders normally.
5. Verify: `PatreonGate` sections show locked/unlocked state normally.
6. Verify: `UpsellBanner` appears for Thrall users.
7. Verify: `SealedRuneModal` shows Patreon CTA when opened.

### Test 2: Stripe mode

1. Set `NEXT_PUBLIC_SUBSCRIPTION_PLATFORM=stripe` in `.env.local`.
2. Restart the dev server.
3. Navigate to `/settings`.
4. Verify: "Subscription Management" placeholder with "coming soon" text appears instead of PatreonSettings.
5. Verify: PatreonGate sections render their children directly (Cloud Sync, Multi-Household, Data Export placeholders all visible).
6. Verify: No Patreon API calls in the network tab.
7. Navigate to dashboard -- verify UpsellBanner does not appear.
8. If SealedRuneModal is triggered, verify it shows "Premium feature -- subscription coming soon" instead of Patreon CTA.

### Test 3: Build validation

```bash
cd development/frontend && npx tsc --noEmit   # Should pass
cd development/frontend && npx next build      # Should succeed
```

## Known Limitations

1. **Stripe gating not built yet**: When stripe mode is active, PatreonGate renders children unconditionally. This is intentional -- disabling Patreon should not lock users out of features before Stripe gating exists.

2. **EntitlementContext still mounts**: The provider still renders and creates context, but all Patreon-specific API calls and OAuth processing are skipped. The context returns Thrall defaults.

## Suggested Test Focus Areas

- **No regressions in patreon mode**: All existing Patreon flows must work identically when the flag is unset.
- **No network calls in stripe mode**: Confirm zero `/api/patreon/*` requests are made.
- **PatreonGate passthrough**: Verify premium feature sections are accessible (not locked) in stripe mode.
- **SealedRuneModal dismiss**: Verify the "Not now" dismiss button works in stripe mode.
