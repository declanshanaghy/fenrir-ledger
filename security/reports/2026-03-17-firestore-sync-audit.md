# Heimdall Security Review: Firestore Sync and Household Data Access

**Date**: 2026-03-17 | **Scope**: Firestore security rules, sync API routes, household API routes, invite code entropy, household isolation, rate limiting
**Issue**: #1126 | **Branch**: `security/issue-1126-firestore-audit`

---

## Executive Summary

Heimdall audited the Firestore-backed cloud sync architecture introduced in issues #1119 and #1123. The review covered Firestore security rules, all six API routes under `/api/sync/` and `/api/household/`, invite code entropy, data classification, and rate limiting posture.

**Two CRITICAL findings** were identified: Insecure Direct Object Reference (IDOR) vulnerabilities in `GET /api/sync/pull` and `POST /api/sync/push` that allow any authenticated Karl-tier user to read and overwrite the card data of **any** household by supplying an arbitrary `householdId`. These routes trust client-supplied household identifiers without verifying the caller is a member of the referenced household. The Admin SDK (used for all production Firestore access) bypasses Firestore security rules entirely, meaning there is no database-layer backstop — exploiting these routes works in production today.

**One HIGH finding**: The invite validate endpoint leaks household member emails (PII) to any authenticated user who presents a valid invite code, enabling harvesting of PII through code guessing.

All other routes (`/api/sync`, `/api/household/invite`, `/api/household/join`, `/api/household/members`) correctly anchor operations to the authenticated user's own household. The invite code implementation is cryptographically sound. `requireAuth` is called correctly on all protected routes.

---

## Risk Summary

| Severity | Count | Items |
|----------|-------|-------|
| CRITICAL | 2     | SEV-001, SEV-002 |
| HIGH     | 1     | SEV-003 |
| MEDIUM   | 3     | SEV-004, SEV-005, SEV-006 |
| LOW      | 3     | SEV-007, SEV-008, SEV-009 |
| INFO     | 3     | SEV-010, SEV-011, SEV-012 |
| **TOTAL**| **12**| |

---

## Findings

---

### [SEV-001] CRITICAL — IDOR: `/api/sync/pull` reads any household's cards

- **File**: `development/ledger/src/app/api/sync/pull/route.ts:64-76`
- **Category**: A01 Broken Access Control (OWASP)
- **Description**: `GET /api/sync/pull` accepts `?householdId=<string>` as a query parameter and calls `getAllFirestoreCards(householdId)` directly, with **no verification that the authenticated user is a member of the requested household**. Any Karl-tier user can exfiltrate the complete card portfolio of any household whose ID they can obtain or guess.
- **Impact**: Full read access to another household's card data: card names, issuers, credit limits, annual fees, open dates, sign-up bonuses, notes. This is PII-adjacent financial metadata. Household IDs are UUIDs (hard to brute force) but are transmitted in API responses (`/api/household/members`, `/api/sync/push`) and could be leaked via logs, browser history, or error messages.
- **Remediation**: After `requireAuth`, fetch the user's record from Firestore (`getUser(googleSub)`), retrieve `user.householdId`, and compare it against the requested `householdId`. Return 403 if they differ. Do not trust `householdId` from the client.

**Evidence**:
```typescript
// pull/route.ts:64-76
const householdId = request.nextUrl.searchParams.get("householdId");
if (!householdId) {
  return NextResponse.json({ error: "missing_param", ... }, { status: 400 });
}
// ❌ No check: is this user a member of `householdId`?
const cards = await getAllFirestoreCards(householdId);
```

**Safe pattern** (used correctly in `/api/sync/route.ts`):
```typescript
const user = await getUser(userId);   // anchor to auth'd user
const cards = await getCards(user.householdId);  // householdId from server, not client
```

---

### [SEV-002] CRITICAL — IDOR: `/api/sync/push` reads and overwrites any household's cards

- **File**: `development/ledger/src/app/api/sync/push/route.ts:85-117`
- **Category**: A01 Broken Access Control (OWASP)
- **Description**: `POST /api/sync/push` accepts `{ householdId, cards }` in the request body. It calls `getAllFirestoreCards(householdId)` and then `setCards(merged)` where `merged` contains cards with the attacker-supplied `householdId`. There is **no verification that the authenticated user is a member of the supplied `householdId`**. Any Karl-tier user can:
  1. Pull all cards from a victim household using a known `householdId` (via the merge response).
  2. Submit arbitrary cards with `householdId` set to the victim's ID, overwriting their card data.
- **Impact**: Full read + write access to any household's card portfolio. A malicious user can corrupt, exfiltrate, or destroy another household's card records. Since `setCards` calls Firestore batch writes via the Admin SDK, there is no Firestore-layer rule to block this.
- **Remediation**: Fetch the authenticated user's record (`getUser(googleSub)`) and use `user.householdId` as the authoritative household ID. Ignore the `householdId` in the request body (or validate it matches `user.householdId` and return 403 if not). Override each card's `householdId` with the server-derived value before writing (pattern already used in `PUT /api/sync`).

**Evidence**:
```typescript
// push/route.ts:85-117
const { householdId, cards } = body as Record<string, unknown>;
// ❌ householdId from client body — no membership check
const remoteCards = await getAllFirestoreCards(householdId);
const { merged } = mergeCardsWithStats(localCards, remoteCards);
await setCards(merged);  // ❌ writes to attacker-supplied householdId
```

---

### [SEV-003] HIGH — PII leakage: member emails returned to invite-code presenter

- **File**: `development/ledger/src/app/api/household/invite/validate/route.ts:102-107`
- **Category**: A02 Cryptographic/Data Failures (OWASP) — PII exposure
- **Description**: `GET /api/household/invite/validate?code=XXXXXX` returns the full member list including `email`, `displayName`, and `role` for every member of the household. Any authenticated user who presents a valid 6-character invite code can harvest these email addresses. While invite codes expire in 30 days and the search space is ~1 billion, invite codes are shared intentionally (pasted in messages, shown on screens) and may persist in browser history, chat logs, etc.
- **Impact**: Household member email addresses (PII per GDPR/CCPA) are disclosed to any holder of a valid invite code. An attacker who socially engineers or observes an invite code can enumerate member emails without the household owner's consent.
- **Remediation**: Remove `email` from the validate response. Return only `displayName` and `role` for the member preview. The email field serves no legitimate UI purpose in a join-flow preview.

**Evidence**:
```typescript
// validate/route.ts:102-107
const members = memberUsers.map((m) => ({
  displayName: m.displayName,
  email: m.email,    // ❌ PII — not needed for join preview
  role: m.role,
}));
```

---

### [SEV-004] MEDIUM — No rate limiting on invite validate/join endpoints (brute-force vector)

- **File**: `development/ledger/src/app/api/household/invite/validate/route.ts`, `development/ledger/src/app/api/household/join/route.ts`
- **Category**: A07 Identification and Authentication Failures (OWASP)
- **Description**: The `rateLimit()` utility exists at `src/lib/rate-limit.ts` but is not applied to the invite validation or join endpoints. An attacker could systematically enumerate invite codes at the rate of Firestore query throughput. With 32^6 = ~1.07 billion combinations and no rate limit, automated enumeration is possible (though slow at human-facing latency).
- **Impact**: Given 1 billion combinations and even 1 request/second throughput, full enumeration would take ~34 years. However, targeted attacks against short-lived codes (knowing approximate generation time) and the PII exposure in SEV-003 raise the effective risk. Additionally, flooding the endpoint causes unnecessary Firestore read costs and latency.
- **Remediation**: Apply `rateLimit()` on both endpoints keyed by authenticated user ID (e.g., `invite-validate:<userId>`). Limit: 10 attempts per 10 minutes. Return 429 on excess. Also consider adding a Firestore composite index on `inviteCode` + `inviteCodeExpiresAt` for efficient lookups.

---

### [SEV-005] MEDIUM — No rate limiting on sync push/pull endpoints (data flooding)

- **File**: `development/ledger/src/app/api/sync/pull/route.ts`, `development/ledger/src/app/api/sync/push/route.ts`
- **Category**: A05 Security Misconfiguration (OWASP)
- **Description**: Sync endpoints have no rate limiting and no maximum payload size validation. A Karl-tier user can call `POST /api/sync/push` in a tight loop, each time with a large array of cards. Each call triggers `getAllFirestoreCards` (full collection read) + a batch write of up to 500 cards. This creates a Firestore cost amplification attack.
- **Impact**: Elevated Firestore read/write costs, potential service degradation for other users sharing GKE pods, possible GCP billing spike.
- **Remediation**: Apply `rateLimit()` keyed by user ID (e.g., `sync-push:<userId>`). Limit: 10 push/pull ops per minute. Add a maximum card array size (e.g., 1000 cards) and return 413 if exceeded.

---

### [SEV-006] MEDIUM — Firestore security rules are not enforced in production (Admin SDK bypasses all rules)

- **File**: `infrastructure/firestore/firestore.rules:12-18`
- **Category**: A05 Security Misconfiguration (OWASP) — defense-in-depth gap
- **Description**: The firestore.rules file explicitly states: _"When Firestore security rules are enforced from the server (Admin SDK), these rules are bypassed — the Admin SDK has root access."_ All production Firestore access flows through the Admin SDK. The rules are **only** enforced by the Firebase Emulator for testing. This means the database layer provides zero isolation guarantee in production — all security depends entirely on API route authorization logic.
- **Impact**: Any IDOR, broken authorization, or access control bug in the API layer (e.g., SEV-001, SEV-002) has no database-layer backstop. The Firestore security rules give a false impression of defense-in-depth.
- **Remediation**: This is an architectural constraint of the Admin SDK model. Mitigate by: (a) fixing SEV-001/SEV-002 to enforce server-side membership checks; (b) adding integration tests that explicitly test cross-household access attempts; (c) documenting this limitation prominently in ADR-014. Consider a future architecture where sensitive reads use the client SDK with proper auth tokens (enforcing rules), while writes use Admin SDK.

---

### [SEV-007] LOW — `already_member` and `user_not_found` errors return generic 500

- **File**: `development/ledger/src/app/api/household/join/route.ts:93-117`
- **Category**: A09 Security Logging and Monitoring Failures (OWASP)
- **Description**: `joinHouseholdTransaction()` can throw `"already_member"` and `"user_not_found"` errors, but the join route handler only handles `"invite_invalid"`, `"invite_expired"`, and `"household_full"`. The remaining errors fall through to a generic 500 response and are logged only via `log.debug` (not `log.error`).
- **Impact**: The `already_member` case is a benign idempotency scenario that should return a 200/409 to the client rather than a 500. The `user_not_found` case is logged at DEBUG level, making it invisible in production error monitoring. No security impact, but poor observability.
- **Remediation**: Add explicit handlers for `already_member` (return 200 or 409 with clear message) and `user_not_found` (return 404). Escalate `user_not_found` to `log.error` since it indicates data integrity issues.

---

### [SEV-008] LOW — Invite code entropy documentation inaccurate (32^6, not 36^6)

- **File**: `development/ledger/src/lib/firebase/firestore-types.ts:110`
- **Category**: INFO / Documentation
- **Description**: Issue #1126 cites the invite code entropy as "36^6 ≈ 2.2 billion combinations." The actual character set `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` contains **32 characters** (26 letters minus I, O; digits 2–9 = 8 digits; total 32). This yields 32^6 = **1,073,741,824 ≈ 1.07 billion** combinations. Notably, since Uint8 values (0–255) and 256 ÷ 32 = 8 exactly, there is **no modulo bias** — the random generation is cryptographically uniform.
- **Impact**: Entropy is lower than documented. Still sufficient for a 30-day rate-limited invite code, but documentation should be corrected to avoid misleading future security reviews.
- **Remediation**: Update issue #1126, ADR, and any documentation to reflect 32^6 ≈ 1.07 billion combinations. The implementation itself is correct.

---

### [SEV-009] LOW — `current_tier` subscription level disclosed in 403 responses

- **File**: `development/ledger/src/app/api/sync/pull/route.ts:52-60`, `development/ledger/src/app/api/sync/push/route.ts:52-65`
- **Category**: A02 Security Misconfiguration — information disclosure
- **Description**: When a non-Karl user calls a sync endpoint, the 403 response includes `current_tier: "thrall"` (or the user's actual tier). While this is likely intentional for UI messaging, it discloses subscription tier to any client, including via API introspection tools.
- **Impact**: Low. Subscription tier is not a secret, but providing it in error responses adds unnecessary information to unauthenticated or probing requests. The `requireAuth` check before the tier gate means only authenticated users see this.
- **Remediation**: Acceptable as-is given auth is required first. If the tier value is needed by the UI, consider returning it in the normal 200 response path rather than error bodies.

---

### [SEV-010] INFO — Firestore rules: `isValidHouseholdWrite` tier enforcement bypassed in production

- **File**: `infrastructure/firestore/firestore.rules:58-65`
- **Category**: INFO — documentation gap
- **Description**: The `isValidHouseholdWrite` function validates `data.tier in ['free', 'karl']`. This is good defense-in-depth for emulator tests, but in production (Admin SDK), the tier field on household documents is set exclusively by the Stripe webhook handler, which should be the only writer. The rule is never enforced in production. Noted for awareness.
- **Remediation**: Document in ADR-014 that tier validation in Firestore rules is emulator-only. Add an integration test that asserts only valid tier values exist.

---

### [SEV-011] INFO — Hard-delete blocked for cards (good pattern, confirm intentional)

- **File**: `infrastructure/firestore/firestore.rules:152`
- **Category**: INFO — positive finding
- **Description**: `allow delete: if false;` on the cards subcollection enforces soft-delete-only semantics. Combined with the `deletedAt` field in `FirestoreCard`, this provides an audit trail of deleted cards. The admin SDK (`softDeleteCard()` in `firestore.ts`) honors this pattern by setting `deletedAt` rather than calling `.delete()`.
- **Remediation**: None. This is a correct pattern. Confirm with product that there are no legitimate hard-delete requirements.

---

### [SEV-012] INFO — No Firestore collection group queries; cross-household card reads not possible via SDK

- **File**: `development/ledger/src/lib/firebase/firestore.ts`
- **Category**: INFO — positive finding
- **Description**: All card reads use the hierarchical path `households/{householdId}/cards` (scoped collection query, not a collection group query). There is no use of `collectionGroup("cards")` anywhere in the codebase. This means even if Admin SDK bypass is exploited, there's no single API call that can enumerate all cards across all households — an attacker must know or discover individual household IDs.
- **Remediation**: None. Maintain this pattern. Explicitly document in ADR-014 that collection group queries on `cards` are prohibited.

---

## Compliance Checklist

| Control | Status | Notes |
|---------|--------|-------|
| `requireAuth` on all routes | **PASS** | All 6 routes call `requireAuth(request)` as first operation |
| Karl entitlement check | **PASS** | All sync routes check `getStripeEntitlement()` before serving data |
| Owner-only invite regeneration | **PASS** | `/api/household/invite` checks `user.role === "owner"` |
| Household membership enforcement — `/api/sync` (GET/PUT) | **PASS** | Uses `user.householdId` from server-side user record |
| Household membership enforcement — `/api/sync/pull` | **FAIL (SEV-001)** | Trusts client-supplied `?householdId=` without membership check |
| Household membership enforcement — `/api/sync/push` | **FAIL (SEV-002)** | Trusts client-supplied body `householdId` without membership check |
| No card numbers / CVVs in Firestore | **PASS** | `Card` type contains only metadata: names, issuers, fees, dates, limits |
| Invite code cryptographic quality | **PASS** | `crypto.getRandomValues()` / Node `randomFillSync`, no modulo bias (256 ÷ 32 = 8 exactly) |
| Invite code expiry enforcement | **PASS** | `isInviteCodeValid()` checked in both validate and join transaction |
| Household capacity cap | **PASS** | Enforced in invite, validate, join routes and Firestore rules |
| No `NEXT_PUBLIC_` server secrets | **PASS** | `FIRESTORE_PROJECT_ID`, `FIRESTORE_DATABASE_ID` — no `NEXT_PUBLIC_` prefix |
| `.gitignore` covers `.env*` | **PASS** | Standard `.gitignore` patterns present |
| No stack traces in error responses | **PASS** | All error responses return structured JSON; internal errors return opaque messages |
| Rate limiting on sync routes | **FAIL (SEV-004, SEV-005)** | `rateLimit()` utility exists but not applied to any sync/household route |
| Soft-delete only for cards | **PASS** | `allow delete: if false` in Firestore rules; `softDeleteCard()` uses `update` |
| CORS / security headers | **PASS** | CSP nonce in middleware; HTTPS-only redirect; static headers in `next.config.ts` |

---

## Recommendations (Prioritized)

### Immediate (CRITICAL — fix before next release)

1. **Fix SEV-001**: In `GET /api/sync/pull`, after `requireAuth`, call `getUser(googleSub)` and compare `user.householdId` against the requested `householdId`. Return 403 if they differ. File: `pull/route.ts:64-76`.

2. **Fix SEV-002**: In `POST /api/sync/push`, after `requireAuth`, call `getUser(googleSub)` and use `user.householdId` as the authoritative household ID, ignoring the request body's `householdId`. Override card `householdId` fields before writing. File: `push/route.ts:85-117`.

### Short-term (HIGH/MEDIUM — next sprint)

3. **Fix SEV-003**: Remove `email` from the `/api/household/invite/validate` response. Return `displayName` and `role` only.

4. **Fix SEV-004/SEV-005**: Apply `rateLimit()` to invite validate, invite join, sync pull, and sync push endpoints. Key by `<route>:<userId>`. Suggested limits: invite ops 10/10min, sync ops 10/min per user.

5. **Fix SEV-005** (payload cap): Add a maximum card array size check (suggest 1000) in both sync push routes. Return 413 if exceeded.

6. **Address SEV-006** (defense-in-depth): Update ADR-014 to explicitly document that Firestore rules are emulator-only, and add integration tests for cross-household access denial.

### Backlog (LOW/INFO)

7. **Fix SEV-007**: Add `already_member` and `user_not_found` error handlers in `/api/household/join`. Escalate `user_not_found` to `log.error`.

8. **Fix SEV-008**: Correct entropy documentation to 32^6 ≈ 1.07 billion.

---

## Appendix: Files Reviewed

| File | Lines | Status |
|------|-------|--------|
| `infrastructure/firestore/firestore.rules` | 162 | Reviewed |
| `development/ledger/src/app/api/sync/route.ts` | 172 | Reviewed |
| `development/ledger/src/app/api/sync/pull/route.ts` | 98 | Reviewed |
| `development/ledger/src/app/api/sync/push/route.ts` | 140 | Reviewed |
| `development/ledger/src/app/api/household/invite/route.ts` | 111 | Reviewed |
| `development/ledger/src/app/api/household/invite/validate/route.ts` | 121 | Reviewed |
| `development/ledger/src/app/api/household/join/route.ts` | 119 | Reviewed |
| `development/ledger/src/app/api/household/members/route.ts` | 113 | Reviewed |
| `development/ledger/src/lib/firebase/firestore.ts` | 457 | Reviewed |
| `development/ledger/src/lib/firebase/firestore-types.ts` | 148 | Reviewed |
| `development/ledger/src/lib/auth/require-auth.ts` | 82 | Reviewed |
| `development/ledger/src/lib/auth/rate-limit.ts` | ~55 | Reviewed |
| `development/ledger/src/middleware.ts` | 99 | Reviewed |
| `development/ledger/src/lib/types.ts` (Card interface) | ~90 | Reviewed |
