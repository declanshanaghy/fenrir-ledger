# QA Handoff: Task #5 — Client-Side useEntitlement Hook (Platform-Agnostic)

**Task**: #5 -- Client-side entitlement hook
**Branch**: `feat/patreon-client`
**Author**: FiremanDecko (Principal Engineer)
**Date**: 2026-03-02
**Depends on**: Task #4 (PR #93, branch `feat/patreon-api`)

---

## What Was Implemented

Platform-agnostic client-side entitlement system for Patreon subscription integration. This is the React data layer that connects to the server-side Patreon API routes from Task #4.

### Components

1. **Entitlement types** -- Platform-agnostic type definitions: `EntitlementTier`, `EntitlementPlatform`, `PremiumFeature`, `PREMIUM_FEATURES` registry, `tierMeetsRequirement()`
2. **localStorage cache** -- Client-side cache (`fenrir:entitlement`) with staleness detection, corruption-safe parsing, and graceful degradation
3. **EntitlementProvider context** -- React context managing tier state, OAuth callback query param handling, server API refresh, and linking/unlinking
4. **useEntitlement hook** -- Thin wrapper hook for consuming entitlement state
5. **Unlink API route** -- `POST /api/patreon/unlink` to delete server-side KV entitlement
6. **Auth integration** -- Sign-out clears entitlement cache; authorize route accepts id_token via query param for redirect-based flow

---

## Files Created

| File | Description |
|------|-------------|
| `development/frontend/src/lib/entitlement/types.ts` | `EntitlementTier`, `EntitlementPlatform`, `Entitlement`, `PremiumFeature`, `PREMIUM_FEATURES` registry (6 features), `tierMeetsRequirement()` |
| `development/frontend/src/lib/entitlement/cache.ts` | localStorage cache: `getEntitlementCache()`, `setEntitlementCache()`, `clearEntitlementCache()`, `isEntitlementStale()` |
| `development/frontend/src/lib/entitlement/index.ts` | Barrel re-export for clean imports |
| `development/frontend/src/contexts/EntitlementContext.tsx` | `EntitlementProvider` + `useEntitlementContext()`: manages tier state, OAuth callback params, API refresh, link/unlink |
| `development/frontend/src/hooks/useEntitlement.ts` | `useEntitlement()` thin wrapper hook |
| `development/frontend/src/app/api/patreon/unlink/route.ts` | `POST /api/patreon/unlink`: deletes KV entitlement record (behind `requireAuth`) |

## Files Modified

| File | Change |
|------|--------|
| `development/frontend/src/contexts/AuthContext.tsx` | Added `clearEntitlementCache()` call in `signOut()` |
| `development/frontend/src/app/layout.tsx` | Added `EntitlementProvider` in provider hierarchy (inside `AuthProvider`, outside `RagnarokProvider`) |
| `development/frontend/src/app/api/patreon/authorize/route.ts` | Changed auth from `requireAuth` (header-only) to `verifyIdToken` with query param support for redirect-based flows |
| `development/frontend/src/app/api/patreon/membership/route.ts` | Added `userId` and `linkedAt` fields to all response paths |
| `development/frontend/src/lib/patreon/types.ts` | Added `userId?` and `linkedAt?` fields to `MembershipResponse` |

---

## Hook Interface

```typescript
const {
  tier,               // "thrall" | "karl"
  isActive,           // boolean — is subscription active
  isLinked,           // boolean — is any platform linked
  isLoading,          // boolean — checking entitlement status
  platform,           // "patreon" | null
  linkPatreon,        // () => void — redirects to Patreon OAuth
  unlinkPatreon,      // () => Promise<void> — clears cache + KV
  refreshEntitlement, // () => Promise<void> — re-checks server
  hasFeature,         // (feature: PremiumFeature) => boolean
} = useEntitlement();
```

---

## Premium Features (6 total)

All require Karl tier:

| Slug | Display Name |
|------|-------------|
| `cloud-sync` | Cloud Sync |
| `multi-household` | Multi-Household |
| `advanced-analytics` | Advanced Analytics |
| `data-export` | Data Export |
| `extended-history` | Extended History |
| `cosmetic-perks` | Cosmetic Perks |

Removed from earlier specs: Priority Import, Custom Notifications.

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/patreon/authorize?id_token=...` | GET | id_token via query param | Initiates Patreon OAuth |
| `/api/patreon/membership` | GET | Bearer id_token | Checks entitlement status, now includes userId and linkedAt |
| `/api/patreon/unlink` | POST | Bearer id_token | Deletes entitlement from KV |

---

## Suggested Test Focus Areas

### 1. Entitlement Cache (localStorage)
- Verify `fenrir:entitlement` is written to localStorage after successful linking
- Verify cache is cleared on sign-out (`signOut()` in AuthContext)
- Verify cache is cleared on unlink (`unlinkPatreon()`)
- Corrupted cache: manually set invalid JSON in `fenrir:entitlement`, reload -- should not crash, treats as no cache
- Missing fields: set a partial object in the cache, reload -- should treat as no cache
- Staleness: set `checkedAt` to >1 hour ago, verify membership API is called

### 2. OAuth Callback Query Params
- `?patreon=linked&tier=karl` -- triggers refresh, updates cache
- `?patreon=linked&tier=thrall` -- triggers refresh
- `?patreon=error&reason=oauth_failed` -- logs error, no state change
- `?patreon=denied` -- logs cancellation, no state change
- All query params are cleaned from URL after processing (check address bar)
- Params are only processed once per mount (no duplicate API calls)

### 3. Feature Gating
- `hasFeature("cloud-sync")` returns `false` for Thrall tier
- `hasFeature("cloud-sync")` returns `true` for active Karl tier
- `hasFeature("cloud-sync")` returns `false` for Karl tier with `active: false` (expired)
- All 6 premium features require Karl tier

### 4. Auth Integration
- Anonymous users: `tier` is "thrall", `isLinked` is false, no API calls made
- Signed-in users with no Patreon link: `tier` is "thrall" after API check
- Signed-in users with active Karl pledge: `tier` is "karl", `isActive` is true
- Sign-out clears entitlement cache (check localStorage)
- Entitlement state resets to null when user signs out

### 5. Graceful Degradation
- API failure with existing cache: use stale cache data (no error thrown)
- API failure with no cache: default to Thrall
- Network offline: default to Thrall (or stale cache if available)
- Never block UI on API failure

### 6. Unlink Flow
- `unlinkPatreon()` clears localStorage immediately (responsive UI)
- `unlinkPatreon()` calls `POST /api/patreon/unlink` to clear KV
- If server call fails, local cache is still cleared (graceful degradation)
- After unlink: `isLinked` is false, `tier` is "thrall", `isActive` is false

### 7. Provider Hierarchy
- `EntitlementProvider` is inside `AuthProvider` (needs auth context)
- `EntitlementProvider` is outside `RagnarokProvider` (independent)
- Verify the app renders without errors at all provider nesting levels

### 8. Authorize Route Change
- `GET /api/patreon/authorize?id_token=<valid>` returns 302 redirect to Patreon
- `GET /api/patreon/authorize` (no token) returns 401
- `GET /api/patreon/authorize?id_token=<invalid>` returns 401

---

## Known Limitations

1. **No UI components in this task** -- This implements the data layer only. Settings section, TierBadge, Hard Gate Modal, and Upsell Banners are in subsequent tasks.
2. **linkPatreon passes id_token in URL** -- The authorize route receives the token as a query parameter since it is a full-page redirect. The token is validated server-side and not stored.
3. **No toast notifications** -- OAuth callback param handling logs to `console.debug` but does not show toasts (toast UI is in a subsequent task).
4. **Single concurrent API call** -- `fetchInProgressRef` prevents duplicate membership API calls but does not queue pending requests.

---

## Build Status

- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- All routes visible in build output including new `/api/patreon/unlink`
