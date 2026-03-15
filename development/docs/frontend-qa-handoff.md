# QA Handoff -- Feature Flag Registry + Patreon API Route Guards

## What was implemented

**Story 1 of the Stripe Direct pivot**: Phase 1 feature flagging system using
environment variables, plus guards on all 7 Patreon API routes.

## Files created/modified

| File | Action | Description |
|------|--------|-------------|
| `src/lib/feature-flags.ts` | Created | Flag registry: `FeatureFlags` const, `isStripe()`, `isPatreon()`, `isEnabled()` |
| `src/app/api/patreon/authorize/route.ts` | Modified | Added `isPatreon()` guard at top of GET handler |
| `src/app/api/patreon/callback/route.ts` | Modified | Added `isPatreon()` guard at top of GET handler |
| `src/app/api/patreon/membership/route.ts` | Modified | Added `isPatreon()` guard at top of GET handler |
| `src/app/api/patreon/membership-anon/route.ts` | Modified | Added `isPatreon()` guard at top of GET handler |
| `src/app/api/patreon/migrate/route.ts` | Modified | Added `isPatreon()` guard at top of POST handler |
| `src/app/api/patreon/unlink/route.ts` | Modified | Added `isPatreon()` guard at top of POST handler |
| `src/app/api/patreon/webhook/route.ts` | Modified | Added `isPatreon()` guard at top of POST handler |
| `.env.example` | Modified | Added `SUBSCRIPTION_PLATFORM=patreon` with documentation |
| `architecture/adrs/ADR-011-feature-flags.md` | Created | ADR documenting the decision |

## How to test

### Test 1: Default behavior (Patreon active)

1. Ensure `SUBSCRIPTION_PLATFORM` is unset or set to `patreon` in `.env.local`
2. Start the dev server
3. All 7 Patreon API routes should work normally (existing behavior unchanged)

### Test 2: Stripe mode (Patreon disabled)

1. Set `SUBSCRIPTION_PLATFORM=stripe` in `.env.local`
2. Restart the dev server
3. All 7 Patreon API routes should return:
   - HTTP 404
   - JSON body: `{ "error": "Patreon integration is disabled" }`

Routes to test:
- `GET /api/patreon/authorize`
- `GET /api/patreon/callback`
- `GET /api/patreon/membership`
- `GET /api/patreon/membership-anon`
- `POST /api/patreon/migrate`
- `POST /api/patreon/unlink`
- `POST /api/patreon/webhook`

### Test 3: Type check and build

```bash
cd development/frontend
npx tsc --noEmit    # should pass
npx next build      # should succeed
```

## Known limitations

- Feature flags are resolved at build/server-start time -- changing requires a redeploy
- Phase 1 only: no runtime toggling, no user-level targeting
- Client-side UI components (PatreonSettings, SealedRuneModal) are not yet guarded -- that is a separate story
