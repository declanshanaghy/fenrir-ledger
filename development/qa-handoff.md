# QA Handoff: Patreon OAuth + API Routes + Webhooks + Vercel KV

**Task**: #4 -- Patreon server-side integration
**Branch**: `feat/patreon-api`
**Author**: FiremanDecko (Principal Engineer)
**Date**: 2026-03-02

---

## What Was Implemented

Complete server-side Patreon integration including:

1. **Vercel KV entitlement store** -- persistent storage for Patreon entitlements keyed by Google user sub, with a secondary index for webhook reverse lookups
2. **Patreon types** -- full TypeScript type definitions for Patreon API v2 responses, webhook payloads, and stored entitlements
3. **Patreon API client** -- server-side functions for OAuth token exchange, membership checking, and token refresh
4. **AES-256-GCM encryption** -- encrypt/decrypt utilities for Patreon tokens stored in KV
5. **OAuth state management** -- encrypted state parameter generation and validation for CSRF protection
6. **4 API routes**:
   - `GET /api/patreon/authorize` -- initiates OAuth (behind requireAuth)
   - `GET /api/patreon/callback` -- OAuth callback (NOT behind requireAuth, same pattern as /api/auth/token)
   - `GET /api/patreon/membership` -- checks current membership status (behind requireAuth)
   - `POST /api/patreon/webhook` -- receives Patreon webhook events (validated by HMAC-MD5 signature)

---

## Files Created

| File | Description |
|------|-------------|
| `development/frontend/src/lib/patreon/types.ts` | PatreonTier, PatreonTokenResponse, PatreonIdentityResponse, PatreonMember, PatreonWebhookPayload, StoredEntitlement, PatreonOAuthState, MembershipResponse |
| `development/frontend/src/lib/patreon/api.ts` | Server-side Patreon API client: exchangeCode(), getMembership(), refreshToken() |
| `development/frontend/src/lib/patreon/state.ts` | OAuth state parameter: generateState(), validateState() |
| `development/frontend/src/lib/crypto/encrypt.ts` | AES-256-GCM: encrypt(), decrypt() using ENTITLEMENT_ENCRYPTION_KEY |
| `development/frontend/src/lib/kv/entitlement-store.ts` | Vercel KV operations: getEntitlement(), setEntitlement(), deleteEntitlement(), getGoogleSubByPatreonUserId() |
| `development/frontend/src/app/api/patreon/authorize/route.ts` | GET -- OAuth initiation (requireAuth) |
| `development/frontend/src/app/api/patreon/callback/route.ts` | GET -- OAuth callback (no auth, CSRF via state) |
| `development/frontend/src/app/api/patreon/membership/route.ts` | GET -- Membership check with KV cache + refresh (requireAuth) |
| `development/frontend/src/app/api/patreon/webhook/route.ts` | POST -- Webhook handler with HMAC-MD5 validation |

## Files Modified

| File | Description |
|------|-------------|
| `development/frontend/.env.example` | Added PATREON_CLIENT_ID, PATREON_CLIENT_SECRET, PATREON_CAMPAIGN_ID, PATREON_WEBHOOK_SECRET, ENTITLEMENT_ENCRYPTION_KEY, KV_REST_API_URL, KV_REST_API_TOKEN |
| `development/frontend/package.json` | Added @vercel/kv dependency |
| `development/frontend/package-lock.json` | Updated lockfile for @vercel/kv |

---

## Environment Variables Required

All server-side only (no NEXT_PUBLIC_ prefix):

| Variable | Purpose | How to obtain |
|----------|---------|---------------|
| `PATREON_CLIENT_ID` | OAuth client identifier | Patreon developer portal |
| `PATREON_CLIENT_SECRET` | OAuth client secret for token exchange | Patreon developer portal |
| `PATREON_CAMPAIGN_ID` | Campaign ID for membership verification | Patreon campaign URL |
| `PATREON_WEBHOOK_SECRET` | HMAC-MD5 key for webhook signature validation | Patreon webhook config |
| `ENTITLEMENT_ENCRYPTION_KEY` | 64-char hex (32 bytes) for AES-256-GCM | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `KV_REST_API_URL` | Vercel KV REST API URL | Auto-populated by Vercel when KV store is linked |
| `KV_REST_API_TOKEN` | Vercel KV REST API token | Auto-populated by Vercel when KV store is linked |

---

## API Endpoints for Testing

### GET /api/patreon/authorize
- **Auth**: Requires Google id_token (Bearer token in Authorization header)
- **Response**: 302 redirect to Patreon OAuth authorize URL
- **Rate limit**: 5/min per IP
- **Test scenarios**:
  - Without auth header -> 401
  - With valid auth -> 302 to patreon.com
  - Without PATREON_CLIENT_ID env -> 500

### GET /api/patreon/callback
- **Auth**: None (exempt from requireAuth, CSRF via state param)
- **Query params**: `code`, `state` (from Patreon redirect)
- **Response**: 302 redirect to /settings with query params
- **Rate limit**: 10/min per IP
- **Test scenarios**:
  - Missing code/state -> redirect to /settings?patreon=error&reason=invalid_request
  - Invalid state -> redirect to /settings?patreon=error&reason=state_mismatch
  - Expired state (>10min) -> redirect to /settings?patreon=error&reason=state_mismatch
  - Patreon user denied -> redirect to /settings?patreon=denied
  - Success + Karl tier -> redirect to /settings?patreon=linked&tier=karl
  - Success + no pledge -> redirect to /settings?patreon=linked&tier=thrall
  - Patreon API failure -> redirect to /settings?patreon=error&reason=oauth_failed

### GET /api/patreon/membership
- **Auth**: Requires Google id_token (Bearer token)
- **Response**: JSON `{ tier, active, platform: "patreon", checkedAt, stale? }`
- **Rate limit**: 20/min per IP
- **Test scenarios**:
  - No auth -> 401
  - User not linked (no KV entry) -> { tier: "thrall", active: false }
  - Fresh KV entry (<1hr) -> returns cached data
  - Stale KV entry (>1hr) -> refreshes from Patreon API
  - Stale + Patreon API failure -> returns cached data with { stale: true }

### POST /api/patreon/webhook
- **Auth**: None (validated by HMAC-MD5 signature)
- **Headers**: `X-Patreon-Signature`, `X-Patreon-Event`
- **Response**: JSON with processing status
- **Test scenarios**:
  - Missing signature -> 400
  - Invalid signature -> 400
  - members:pledge:create with active pledge -> updates KV to karl
  - members:pledge:update downgrade -> updates KV to thrall
  - members:pledge:delete -> sets KV to thrall, active=false
  - Unknown Patreon user (no reverse index) -> 200 with status: "ignored"
  - Unknown event type -> 200 with status: "ignored"

---

## Vercel KV Key Schema

| Key Pattern | Value | TTL |
|-------------|-------|-----|
| `entitlement:{googleSub}` | StoredEntitlement JSON | 30 days |
| `patreon-user:{patreonUserId}` | Google sub string | 30 days |

---

## Security Notes

1. **Patreon tokens are encrypted at rest** in KV using AES-256-GCM
2. **PATREON_CLIENT_SECRET** is server-side only, never in client bundle
3. **OAuth state** is encrypted + time-limited (10min) for CSRF protection
4. **Webhook signatures** are validated using constant-time comparison
5. **All routes** have IP-based rate limiting
6. **Fenrir logger** masks all sensitive values automatically

---

## Known Limitations

1. **@vercel/kv is deprecated** -- Vercel recommends migrating to Upstash Redis. The package works but may not receive updates. Consider migrating when Upstash Redis is officially the replacement.
2. **No frontend UI** -- This is the server-side only. Task #5 (useEntitlement hook) and later tasks will build the frontend.
3. **Rate limiter is per-instance** -- In-memory rate limiting does not span across serverless instances. For production, consider Upstash Redis rate limiting.
4. **State token nonce is not stored server-side** -- The CSRF nonce is embedded in the encrypted state and validated by decryption integrity, not by server-side lookup. This is acceptable because the encryption key provides authentication.

---

## Build Status

- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- All 4 new routes visible in build output

---

## Deployment Instructions

1. Create a Vercel KV store and link it to the project (auto-populates KV_REST_API_URL and KV_REST_API_TOKEN)
2. Set all PATREON_* and ENTITLEMENT_ENCRYPTION_KEY env vars in Vercel project settings
3. Register the Patreon OAuth client with redirect URIs for both localhost and production
4. Configure Patreon webhooks pointing to `https://fenrir-ledger.vercel.app/api/patreon/webhook`
5. Deploy via Vercel (standard git push workflow)

---

## Suggested Test Focus Areas

1. **OAuth state round-trip**: Generate state -> validate state with correct key -> validate state with wrong key
2. **Encryption round-trip**: encrypt(value) -> decrypt(result) == value
3. **Webhook signature validation**: Compute expected HMAC-MD5 and verify the route accepts/rejects correctly
4. **KV secondary index**: After setEntitlement, verify getGoogleSubByPatreonUserId returns the correct mapping
5. **Staleness logic**: Verify membership route re-checks Patreon API when entitlement is older than 1 hour
6. **Graceful degradation**: When Patreon API is down, membership route returns stale cache instead of error
