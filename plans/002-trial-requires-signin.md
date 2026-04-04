# Plan 002: Trial Requires Google Sign-In

## Context

The trial system uses a random UUID in localStorage as "device ID". Clearing localStorage = new trial — trivially abused. No stable browser identifier exists that survives storage clears.

**Decision:** Require Google sign-in before starting a trial. Trial record moves inside the household, keyed by the creator's Google `sub` (userId). The userId becomes the householdId — predictable, server-side, can't be deleted locally to restart a trial.

## New Firestore Schema

```
/users/{userId}                          ← userId = Google sub claim throughout
/households/{userId}                     ← householdId = creator's userId (not random UUID)
/households/{userId}/cards/{cardId}      ← unchanged subcollection
/households/{userId}/trial               ← NEW: trial record lives inside household
/processedEvents/{eventId}              ← unchanged (Stripe dedup TTL)
```

**Removed:** `/entitlements/` collection — not used. Stripe tier lives on the household doc directly.

**Trial document** (`/households/{userId}/trial`):
```typescript
{
  startDate: string;        // UTC ISO 8601
  expiresAt: string;        // UTC ISO 8601 — when the trial period ends (startDate + 30 days)
  convertedDate?: string;   // Set when user pays
}
```

**`expiresAt` is a timestamp for when the trial period ends** — NOT a Firestore TTL. The document is never auto-deleted. The trial record is permanent so we can always detect restart attempts. `expiresAt` is simply used for expiry checks (`expiresAt < now` = expired).

**Key change:** `householdId = userId` (Google sub). No more random UUIDs for households. This makes the trial tamper-proof — you can't clear localStorage to get a new household/trial because the ID is derived from your Google account.

**Multi-device:** Same Google account on any device sees the same user/household/trial state (all server-side). Card sync (push/pull) is Karl-only — Thrall/trial users see their local cards only.

## Changes by Area

### 1. Use `userId` throughout (Google sub — no legacy `clerkUserId` naming)

Files affected:
- `development/ledger/src/lib/firebase/firestore-types.ts` — `FirestoreUser.userId`, `FIRESTORE_PATHS.user()` param name
- `development/ledger/src/lib/firebase/firestore.ts` — all references in `ensureSoloHousehold()`, user doc creation, household `ownerId`/`memberIds`
- `development/ledger/src/lib/auth/authz.ts` — userId references in authz resolution
- All test files referencing userId

### 2. HouseholdId = userId (not random UUID)

**File: `firestore.ts` — `ensureSoloHousehold()`**
- Change: `householdId = userId` (was `crypto.randomUUID()`)
- Household doc path: `/households/{userId}`
- User doc `householdId` field = `userId`

**File: `household.ts`**
- Authenticated path: `householdId = session.user.sub` (already the case conceptually, now explicit)
- Anonymous path: unchanged (localStorage UUID for anonymous Thrall use)

### 3. Remove Entitlements Collection — Move Stripe Tier to Household

The `/entitlements/{docId}` collection is removed. Stripe subscription state moves onto the household doc.

**File: `firestore-types.ts`**
- Delete `FirestoreEntitlement` interface
- Delete `FIRESTORE_PATHS.entitlement()`
- Add Stripe fields to `FirestoreHousehold`:
  ```typescript
  tier: "free" | "karl";                  // already exists
  stripeCustomerId?: string;              // moved from User
  stripeSubscriptionId?: string;          // moved from Entitlement
  stripeStatus?: string;                  // moved from Entitlement
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
  ```

**File: `firestore.ts`**
- Delete `getEntitlement()`, `setEntitlement()`, `deleteEntitlement()`, `migrateStripeEntitlement()`
- Stripe webhook handlers write tier/status directly to household doc

**File: `entitlement-store.ts`** — Delete or rewrite to read from household doc
**File: `lib/entitlement/index.ts` + `cache.ts`** — Rewrite to read tier from household
**File: `EntitlementContext.tsx`** — Read tier from household doc, not entitlements collection
**File: `/api/stripe/membership/route.ts`** — Read from household, not entitlements
**File: `StaleAuthNudge.tsx`** — Update entitlement references

**29 files reference entitlements** — all need updating (mostly tests).

### 4. Move Trial Into Household

**File: `trial-store.ts`** — Complete rewrite:
- `initTrial(userId)` → writes to `/households/{userId}/trial` (not `/trials/{fingerprint}`)
- `getTrial(userId)` → reads from `/households/{userId}/trial`
- `markTrialConverted(userId)` → updates `/households/{userId}/trial`
- Delete: `linkTrialToUser()`, `getFingerprintByUserId()`, `getTrialWithKey()`, `legacyFingerprint()`, `UUID_RE`
- **Guard against restart:** `initTrial()` checks if trial doc exists. If it does AND is expired, return error state — do NOT create a new trial. Only create if no trial doc exists at all.

**Delete** the top-level `/trials/` collection concept entirely.

### 5. Remove Fingerprint/DeviceId

**File: `trial-utils.ts`**
- Delete: `computeFingerprint()`, `getOrCreateDeviceId()`, `generateUUID()`, `isValidFingerprint()`, `LS_DEVICE_ID`
- Keep: toast flags, cache version, `TrialStatus`, `THRALL_CARD_LIMIT`, `TRIAL_DURATION_DAYS`

### 6. API Routes — Require Auth, Remove Fingerprint

**`/api/trial/init`**
- Add `requireAuth()`, extract `userId` from `auth.user.sub`
- Remove fingerprint body parsing entirely
- Call `initTrial(userId)`
- If trial already exists and expired: return `{ error: "trial_expired", message: "Contact customer service" }` with 409 status
- If trial already exists and active: return existing trial (idempotent)
- If no trial: create new trial record inside household

**`/api/trial/status`**
- Add `requireAuth()`, use `auth.user.sub`
- Remove fingerprint body parsing
- Read from `/households/{userId}/trial`
- Anonymous users: don't call this route (client returns `"none"` immediately)

**`/api/trial/convert`**
- Already auth-gated. Remove fingerprint from body, use `auth.user.sub`

### 7. Auth Middleware

**File: `authz.ts` — `checkKarlOrTrial()`**
- Remove `X-Trial-Fingerprint` header reading
- Look up trial by `userId` directly: read `/households/{userId}/trial`
- Remove auto-init fallback

### 8. Client Contexts

**`TrialStatusContext.tsx`**
- Only fetch trial status when authenticated
- Anonymous users: set status `"none"` immediately, no API call
- Remove `computeFingerprint` import
- Send auth token only, no fingerprint in request

**`EntitlementContext.tsx`**
- Remove `computeFingerprint` import
- Trial convert sends auth token only

### 9. Client Hooks

- **`useSheetImport.ts`** — Remove `X-Trial-Fingerprint` header
- **`usePickerConfig.ts`** — Remove `X-Trial-Fingerprint` header

### 10. Trial Starts on Google Login (not add card)

**File: `auth/callback/page.tsx`**
- After session stored + household ensured: call `/api/trial/init` with Bearer token
- Handle 409 (expired trial restart): show "contact customer service" message
- This is THE place trial starts — nowhere else

**File: `CardForm.tsx`**
- Remove trial init block (lines 361-383) entirely
- Anonymous users create cards normally (Thrall tier, limited features)
- No trial prompt on card creation

**File: `ledger/page.tsx`**
- Remove trial init from import success handler

### 11. Error State: Trial Restart Blocked

When `/api/trial/init` returns 409 (trial already existed and expired):
- Auth callback shows a message: "Your free trial has ended. Contact customer service to discuss options."
- Link to support email or help page
- User can still use app in Thrall tier (free features)
- No way to restart trial — this is by design

### 12. Settings Page Copy

**File: `settings/page.tsx` + related sections**
- Update trial-related copy to reflect that trial is tied to Google account
- Remove any references to "device" or "fingerprint"
- Add clarity: "Your trial is linked to your Google account"

### 13. Tests

- Delete `trial-stable-fingerprint-1615.test.ts` entirely
- Update all tests mocking `computeFingerprint`, `X-Trial-Fingerprint`, fingerprint-based trial
- Add new tests:
  - `initTrial()` creates doc at `/households/{userId}/trial`
  - `initTrial()` returns error for expired trial restart
  - `initTrial()` is idempotent for active trial
  - Auth callback triggers trial init
  - Anonymous user gets `"none"` trial status without API call
  - CardForm does NOT trigger trial init

## Dependency Order

1. Rename `clerkUserId` → `userId` globally
2. Change `householdId` generation to use `userId` (not random UUID)
3. Remove entitlements collection — move Stripe tier to household doc
4. Rewrite `trial-store.ts` (household subcollection)
5. Remove fingerprint functions from `trial-utils.ts`
6. Update API routes (init, status, convert)
7. Update `authz.ts` middleware
8. Update `TrialStatusContext.tsx` + `EntitlementContext.tsx`
9. Update client hooks (remove fingerprint headers)
10. Move trial init to auth callback only, remove from CardForm/ledger page
11. Add trial restart error handling UI
12. Update settings page copy
13. Update tests

## Migration

- Existing `/trials/{fingerprint}` docs: expire via 60-day TTL. No migration.
- Existing `/households/{randomUUID}` docs: need migration script OR dual-lookup (check by userId first, fall back to user doc's householdId FK). Recommend: dual-lookup in code, gradual migration as users sign in.
- On sign-in: if user doc exists with old `householdId` (random UUID), migrate household to `/households/{userId}` path.

## Verification

- Anonymous user: uses app (Thrall), cannot start trial, no trial-related API calls
- Google sign-in: creates user + household + trial atomically
- Trial record at `/households/{userId}/trial` in Firestore — no TTL, permanent
- Clear localStorage, sign in again: same trial (server-side, keyed by Google sub)
- Expired trial + sign in again: 409 error, "contact customer service" message
- Same Google account on different device: sees same trial state, same household
- Card sync only available for Karl tier (Thrall/trial = local cards only)
- Stripe conversion: still works via auth-based trial lookup
- `tsc` + `build` + Vitest pass
