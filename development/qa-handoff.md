# QA Handoff -- Story 2: Client-side Anonymous Patreon Support

**Branch:** `feat/anon-patreon-client`
**Base:** `feat/anon-patreon-server` (PR #109)
**Date:** 2026-03-04
**Engineer:** FiremanDecko

## What Was Implemented

Story 2 of the anonymous Patreon linking feature. This builds on Story 1 (server-side,
branch `feat/anon-patreon-server`, PR #109) which added the server-side anonymous
OAuth flow, KV storage for anonymous entitlements, and the migration endpoint.

Story 2 adds the **client-side** logic so anonymous users (not signed in with Google)
can subscribe via Patreon and see their tier status in the UI.

### Key behaviors added:

1. Anonymous users can click "Subscribe via Patreon" on the settings page (no Google sign-in needed)
2. After Patreon OAuth, the callback stores the Patreon user ID in localStorage
3. The EntitlementContext fetches anonymous membership status from a new endpoint
4. After anonymous linking, the UI shows a "Sign in with Google" nudge
5. On sign-in, auto-migration fires: moves the anonymous entitlement to Google-keyed storage
6. All existing authenticated behavior is preserved (no regressions)

## Files Created/Modified

### New Files

| File | Description |
|------|-------------|
| `development/frontend/src/app/api/patreon/membership-anon/route.ts` | New API endpoint for anonymous membership lookup. Accepts `?pid=` query param, returns tier/active status from KV. Rate-limited (10/min/IP), no auth required. |

### Modified Files

| File | Description |
|------|-------------|
| `development/frontend/src/contexts/EntitlementContext.tsx` | Dual-path `linkPatreon` (auth vs anon), anonymous membership fetching via `/api/patreon/membership-anon`, `?pid=` query param handling on callback, auto-migration on sign-in, new context fields (`isAnonymouslyLinked`, `isMigrating`, `migrateAnonymousEntitlement`). |
| `development/frontend/src/components/entitlement/PatreonSettings.tsx` | 7-state UI: anonymous+unlinked (CTA), anonymous+linked (tier display + sign-in nudge), migration in-progress, authenticated+unlinked, authenticated+Karl, authenticated+Thrall, authenticated+expired. No longer depends on external AuthGate. |
| `development/frontend/src/app/settings/page.tsx` | Removed AuthGate wrapper around PatreonSettings. Removed unused AuthGate import. PatreonSettings now handles auth-awareness internally. |

## How to Deploy

Standard Vercel deployment -- no new env vars required beyond what Story 1 already needs.
The new API route `/api/patreon/membership-anon` is serverless and auto-deploys.

## Test Flows

### Flow 1: Anonymous Subscribe via Patreon

1. Open the app in a fresh browser (no Google sign-in, clear localStorage).
2. Navigate to `/settings`.
3. Verify: PatreonSettings section is visible (not hidden behind AuthGate).
4. Verify: "Subscribe via Patreon" button is shown with feature preview list (all locked).
5. Click "Subscribe via Patreon".
6. Verify: Redirected to `/api/patreon/authorize` WITHOUT `?id_token=` param.
7. Verify: Patreon OAuth consent screen appears.
8. Grant consent on Patreon.
9. Verify: Redirected back to `/settings?patreon=linked&tier=karl&pid=<id>` (or tier=thrall if no active pledge).
10. Verify: URL is cleaned (query params removed).
11. Verify: `fenrir:patreon-user-id` is set in localStorage.
12. Verify: Tier badge and feature list are shown.
13. Verify: "Sign in with Google to unlock Cloud Sync" nudge is displayed below the tier info.

### Flow 2: Sign-in After Anonymous Link (Migration)

1. Complete Flow 1 first (anonymous Patreon link).
2. Sign in with Google (click "Sign in with Google" in the nudge or via nav).
3. Verify: Auto-migration fires -- "Linking your Patreon..." transitional state appears briefly.
4. Verify: After migration succeeds:
   - `fenrir:patreon-user-id` is cleared from localStorage.
   - Entitlement is now keyed by Google sub in KV (check via server logs).
   - Full authenticated PatreonSettings UI is shown (Karl badge, features unlocked, Unlink button).
5. Verify: If migration fails (e.g., anonymous KV entry expired), the error does not block sign-in. The user sees the normal authenticated UI.

### Flow 3: Authenticated Link (Existing Behavior, No Regression)

1. Sign in with Google first.
2. Navigate to `/settings`.
3. Verify: "Link Patreon" button is shown (authenticated copy).
4. Click "Link Patreon".
5. Verify: Redirected to `/api/patreon/authorize?id_token=<token>`.
6. Complete Patreon OAuth.
7. Verify: Redirected back, standard Karl/Thrall UI appears.
8. Verify: Unlink button works.

### Flow 4: Page Refresh After Anonymous Link

1. Complete Flow 1 (anonymous Patreon link).
2. Refresh the page.
3. Verify: Entitlement cache loads instantly (no loading flash).
4. Verify: If cache is stale, background refresh calls `/api/patreon/membership-anon?pid=<id>`.
5. Verify: Tier and features display correctly.

## API Endpoints for Testing

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/patreon/membership-anon?pid=<id>` | GET | None | Returns anonymous entitlement status. Rate: 10/min/IP. |
| `/api/patreon/authorize` | GET | Optional | Starts OAuth. With `?id_token=`: authenticated. Without: anonymous. |
| `/api/patreon/callback` | GET | None | OAuth callback. Anonymous includes `&pid=` in redirect. |
| `/api/patreon/migrate` | POST | Required | Migrates anonymous entitlement to Google-keyed. Body: `{ patreonUserId }`. |

## Known Limitations

1. **Anonymous entitlement refresh**: The anonymous membership endpoint reads from KV only --
   it does not re-check the Patreon API with a fresh token (that requires the stored tokens,
   which are encrypted in KV). Staleness is handled by the 30-day TTL on KV entries and the
   webhook handler (Story 1) which updates entries when Patreon sends events.

2. **Anonymous unlink**: Anonymous users cannot server-side unlink (no auth for the unlink endpoint).
   They can clear localStorage, which effectively resets their local state. The KV entry expires
   after 30 days.

3. **Multiple devices**: Anonymous Patreon linking is per-device (pid stored in localStorage).
   If a user links on device A, device B will not know. The sign-in nudge encourages migration
   to Google-keyed storage for cross-device access.

## Suggested Test Focus Areas

- **State transitions**: The PatreonSettings component now has 7 states. Verify each renders correctly.
- **Migration edge cases**: What happens if the user signs in, migration starts, but the anonymous KV entry is gone? (Should gracefully fall through to normal authenticated flow.)
- **Rate limiting on membership-anon**: Hit the endpoint > 10 times per minute from the same IP to confirm 429 response.
- **URL cleanup**: Ensure `?patreon=linked&tier=karl&pid=12345` params are fully cleaned from the URL after processing.
- **localStorage persistence**: Verify `fenrir:patreon-user-id` survives page refresh and is correctly read on mount.

## Validation Commands

```bash
cd development/frontend && npx tsc --noEmit
cd development/frontend && npx next build
```

Both pass as of 2026-03-04.
