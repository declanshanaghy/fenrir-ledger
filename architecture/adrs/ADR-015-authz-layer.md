# ADR-015: Centralized Authorization Layer (requireAuthz)

**Status:** Accepted
**Date:** 2026-03-17
**Author:** FiremanDecko (Principal Engineer)
**Issue:** [#1198](https://github.com/declanshanaghy/fenrir-ledger/issues/1198)
**Supersedes:** Inline Karl checks, per-route `requireKarlOrTrial` calls

---

## Context

### Problem

Fenrir Ledger's API surface has grown to ~20 routes that perform authentication
and authorization inline. This has produced three concrete problems:

1. **IDOR vulnerabilities** — Routes accept a caller-supplied `householdId` query
   param or body field and use it directly for Firestore reads without verifying
   the authenticated user actually belongs to that household. A malicious user can
   enumerate other households' card data by supplying arbitrary UUIDs.

2. **Scattered tier checks** — Karl-tier gating is implemented differently across
   routes: some call `getStripeEntitlement` directly, some call
   `requireKarlOrTrial`, and some omit tier checks entirely. There is no single
   place to audit what is protected.

3. **Missing audit trail** — Authorization denials (wrong household, wrong tier)
   are silently dropped with no structured log output, making security incidents
   hard to investigate.

### Prior Art

`requireAuth()` (ADR-008) solved the authentication layer cleanly: a single
function extracts the Bearer token, verifies the Google id_token, and returns
a typed discriminated union. Authorization was intentionally left to each route —
that decision is now insufficient given the IDOR exposure.

---

## Decision

Introduce `src/lib/auth/authz.ts` exporting a single `requireAuthz()` function
that sequences:

1. **Authentication** — delegates to `requireAuth(request)` → 401 if
   missing/invalid token
2. **User resolution** — calls `getUser(user.sub)` to fetch the `FirestoreUser`
   document (includes `householdId`, `role`)
3. **Household membership check** (optional) — if `requirement.householdId` is
   supplied, compares it against `firestoreUser.householdId` → 403 on mismatch
4. **Tier check** (optional) — if `requirement.tier` is supplied:
   - `"karl"` → `getStripeEntitlement(sub)` → 403 if not active Karl
   - `"karl-or-trial"` → absorbs `requireKarlOrTrial` logic → 402 if neither
5. **Audit log on every denial** — `log.warn("requireAuthz: access denied", { reason, googleSub, ... })`
6. **Return `AuthzSuccess`** → `{ ok: true, user, firestoreUser }`

### Type System

```typescript
interface AuthzRequirement {
  householdId?: string;           // triggers membership check
  tier?: "karl" | "karl-or-trial"; // tier gate (omit for auth-only)
}

type AuthzSuccess = { ok: true; user: VerifiedUser; firestoreUser: FirestoreUser };
type AuthzFailure = { ok: false; response: NextResponse };
type AuthzResult  = AuthzSuccess | AuthzFailure;

async function requireAuthz(
  request: NextRequest,
  requirement?: AuthzRequirement,
): Promise<AuthzResult>
```

### IDOR Fix Pattern

Routes use `authz.firestoreUser.householdId` for all Firestore operations —
**never** the caller-supplied value. The supplied value is validation input only,
used to assert the caller is not attempting cross-household access.

```typescript
// Before (vulnerable — trusts caller-supplied householdId)
const auth = await requireAuth(request);
if (!auth.ok) return auth.response;
const householdId = request.nextUrl.searchParams.get("householdId");
const cards = await getAllFirestoreCards(householdId); // IDOR

// After (safe — uses server-resolved householdId)
const authz = await requireAuthz(request, { householdId: suppliedId, tier: "karl" });
if (!authz.ok) return authz.response;
const cards = await getAllFirestoreCards(authz.firestoreUser.householdId); // safe
```

---

## Consequences

### Positive

- **IDOR eliminated** — household access is gated on the server-resolved
  `firestoreUser.householdId`, not the caller-supplied value.
- **Single audit point** — all authorization logic lives in one file; every
  denial produces a structured `log.warn` with `reason`, `googleSub`, and
  household IDs for forensic investigation.
- **Consistent tier checks** — `requireKarlOrTrial` is deprecated; new routes
  use `requireAuthz({ tier: "karl-or-trial" })`.
- **Typed surface** — `AuthzSuccess` exposes both `user` (VerifiedUser) and
  `firestoreUser` (FirestoreUser) so routes never need to call `getUser`
  again downstream.

### Negative / Trade-offs

- **Extra Firestore read per request** — `getUser(sub)` adds one Firestore
  document read per authenticated API call. At Firestore's free tier this is
  negligible; at scale it is ~0.1 ms latency per read with Workload Identity
  credentials on GKE. No caching is intentional: stale `householdId` data
  after a household join would re-introduce IDOR.
- **requireKarlOrTrial deprecated** — existing callers (#1199, #1200) must be
  migrated to `requireAuthz`. The old function is not deleted until migration
  is complete.
- **Null firestoreUser** — if `getUser` returns null (new user not yet
  bootstrapped), `requireAuthz` returns 403 with reason `"user_not_found"`.
  Routes that create users (e.g., `/api/auth/token`) must NOT call
  `requireAuthz`.

---

## Alternatives Considered

### Next.js Middleware

Next.js Edge middleware runs before route handlers and could enforce auth
globally. Rejected because:

- Edge runtime has no access to Firestore Admin SDK (Node.js-only)
- Cannot perform per-route tier checks from middleware without duplicating
  routing logic
- ADR-008 documents this decision in detail

### Per-route getUser calls

Each route could call `getUser` individually after `requireAuth`. Rejected
because it produces the same scattered pattern we are replacing, and doesn't
enforce the IDOR fix consistently.

### Caching firestoreUser in Redis

Cache the `FirestoreUser` doc in Redis by `sub` with a short TTL (e.g., 60 s)
to reduce Firestore reads. Rejected: cache invalidation after household join
is complex and a stale cache re-introduces IDOR. Firestore latency is
acceptable without caching.

---

## References

- ADR-008 — API authentication (requireAuth, per-route guards)
- ADR-014 — Firestore cloud sync architecture
- Issue #1126 — Firestore sync and household data access security audit
- Issue #1197 — requireAuthz design interview (Odin + FiremanDecko)
- Issue #1198 — This implementation
- Issue #1199 — IDOR fixes (depends on this ADR)
- Issue #1200 — Full route migration (depends on this ADR)
