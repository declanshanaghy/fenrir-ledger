# QA Handoff: Story 1 — Server-Side Anonymous Patreon Flow

**Branch:** `feat/anon-patreon-server`
**Date:** 2026-03-04
**Engineer:** FiremanDecko

## What Was Implemented

All server-side changes to support anonymous (not signed in with Google) users subscribing via Patreon.

### Story References
- Story 1 from `specs/anonymous-patreon-subscription.md`
- Tasks: extend-state-token, extend-kv-store, update-authorize-route, update-callback-route, create-migrate-route, update-webhook-handler, update-cache-helpers, update-adr

## Files Created/Modified

### Modified Files

| File | Description |
|------|-------------|
| `development/frontend/src/lib/patreon/types.ts` | Added `mode: "authenticated" \| "anonymous"` to `PatreonOAuthState`; updated JSDoc on `StoredEntitlement` |
| `development/frontend/src/lib/patreon/state.ts` | Updated `generateState()` to accept optional `googleSub` (defaults to anonymous mode); updated `validateState()` to handle both modes with backwards compatibility |
| `development/frontend/src/lib/kv/entitlement-store.ts` | Added `setAnonymousEntitlement()`, `getAnonymousEntitlement()`, `migrateEntitlement()`, `isAnonymousReverseIndex()`, `extractPatreonUserIdFromReverseIndex()` |
| `development/frontend/src/app/api/patreon/authorize/route.ts` | Made Google auth optional; anonymous requests generate state with `mode: "anonymous"`; authenticated requests work as before |
| `development/frontend/src/app/api/patreon/callback/route.ts` | Handles both modes from state: authenticated stores under `entitlement:{googleSub}`, anonymous stores under `entitlement:patreon:{pid}`; anonymous redirect includes `pid` param |
| `development/frontend/src/app/api/patreon/webhook/route.ts` | Updated to check reverse index value format for dual-key lookup; handles both anonymous and authenticated entitlement keys |
| `development/frontend/src/lib/entitlement/cache.ts` | Added `getPatreonUserId()`, `setPatreonUserId()`, `clearPatreonUserId()` for `fenrir:patreon-user-id` localStorage key |
| `designs/architecture/adr-009-patreon-entitlement.md` | Added Amendment section documenting anonymous flow, dual KV keys, migration, and accepted risks (SEV-003, SEV-004) |

### New Files

| File | Description |
|------|-------------|
| `development/frontend/src/app/api/patreon/migrate/route.ts` | `POST /api/patreon/migrate` — migrates anonymous entitlement to Google-keyed on sign-in; behind `requireAuth`; rate limited 5/min/IP; idempotent |

## How to Deploy

This is a Next.js application deployed on Vercel. The changes are server-side API routes and utility modules. No new environment variables are required.

1. Merge the PR to main
2. Vercel automatically deploys from main

## API Endpoints Available for Testing

### Modified Endpoints

- **`GET /api/patreon/authorize`** — Now accepts requests without `id_token` (anonymous mode)
  - With `?id_token=...`: authenticated flow (unchanged)
  - Without `id_token`: anonymous flow (new)
  - Both paths redirect to Patreon OAuth

- **`GET /api/patreon/callback`** — Handles both modes from state token
  - Authenticated mode: stores at `entitlement:{googleSub}`, redirects to `/settings?patreon=linked&tier={tier}`
  - Anonymous mode: stores at `entitlement:patreon:{pid}`, redirects to `/settings?patreon=linked&tier={tier}&pid={pid}`

- **`POST /api/patreon/webhook`** — Now handles both key types
  - Reverse index value starting with `patreon:` -> updates anonymous entitlement
  - Otherwise -> updates authenticated entitlement (unchanged)

### New Endpoint

- **`POST /api/patreon/migrate`**
  - Requires: `Authorization: Bearer <google_id_token>`
  - Body: `{ "patreonUserId": "<pid>" }`
  - Returns: `{ "migrated": true, "tier": "karl", "active": true }` or `{ "migrated": false, "reason": "not_found" }`
  - Rate limit: 5/min/IP
  - Idempotent

## Known Limitations

- Client-side changes (EntitlementContext, PatreonSettings, PatreonGate, SignInNudgeBanner) are NOT included in this story. They will be in Story 2 (`feat/anon-patreon-client`).
- The anonymous flow is complete server-side but cannot be triggered from the UI yet (the "Link Patreon" button still requires auth in the client).
- Migration can be tested via direct API calls but the automatic trigger on sign-in is in Story 2.

## Suggested Test Focus Areas

1. **Type safety**: `npx tsc --noEmit` passes (verified)
2. **Build**: `npx next build` succeeds (verified)
3. **Backwards compatibility**: Existing authenticated flow must still work. The `generateState(googleSub)` call with a string argument still produces `mode: "authenticated"`. Old state tokens without `mode` field are treated as `"authenticated"`.
4. **Authorize route**: Verify that requests without `id_token` are not rejected (they should proceed in anonymous mode).
5. **Callback route**: Verify the anonymous redirect includes `pid` param.
6. **Migration endpoint**: Verify auth is required, rate limiting works, and idempotent behavior on repeated calls.
7. **Webhook handler**: Verify dual-key lookup works for both `patreon:*` and plain Google sub reverse index values.

## Validation Commands

```bash
cd development/frontend && npx tsc --noEmit
cd development/frontend && npx next build
```
