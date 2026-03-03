# Quality Report: feat/patreon-api — Server-Side Patreon Integration (Task #4)

## QA Verdict: FAIL

**Validated by**: Loki (QA Tester)
**Date**: 2026-03-02
**Branch**: `feat/patreon-api`
**PR**: #93
**Scope**: 9 new files (Patreon types, API client, OAuth state, AES-256-GCM encryption,
Vercel KV entitlement store, 4 API routes). 3 modified files (.env.example, package.json,
qa-handoff.md).

---

## Test Execution

- Total: 18 | Passed: 15 | Failed: 2 | Advisory: 1

---

## Summary

The implementation is well-structured and follows team patterns in the majority of its
surface area. The fenrir logger is used throughout. Auth guards are correctly placed.
No Patreon secrets are exposed to the client bundle. The TypeScript compiler and
Next.js build both pass clean with zero errors.

Two blocking defects were found during security review:

1. **DEF-001 [HIGH]** — `validateSignature` in the webhook route will throw an uncaught
   exception and return HTTP 500 instead of 400 when an attacker sends a correctly-length
   but non-hexadecimal `X-Patreon-Signature` header. This is an unhandled crash path on
   a public, unauthenticated endpoint.

2. **DEF-002 [MEDIUM]** — `getMembership()` accepts a `campaignId` parameter and the
   JSDoc promises it filters to that campaign, but the filtering loop does not check
   `resource.relationships?.campaign?.data?.id`. A user who is an active patron of ANY
   Patreon campaign (not just Fenrir Ledger's) would be granted `karl` tier. This is an
   entitlement privilege-escalation bug.

Both defects must be fixed before this PR ships.

---

## Issues for FiremanDecko

### DEF-001 [HIGH] — `validateSignature` throws uncaught exception on non-hex signature input

**File**: `development/frontend/src/app/api/patreon/webhook/route.ts`
**Lines**: 65-79 (`validateSignature`), 149 (call site)

**Root Cause**: The length guard at line 72 compares the raw hex-string lengths
(`signature.length === expectedSignature.length`). A valid MD5 hex string is always
32 characters. An attacker can send any 32-character string containing non-hex characters
(e.g. `ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ`). This passes the length check. Then
`Buffer.from(signature, "hex")` decodes to 0 bytes (Node.js silently drops invalid hex
pairs), while `Buffer.from(expectedSignature, "hex")` decodes to 16 bytes. Node's
`crypto.timingSafeEqual` throws `Error: Input buffers must have the same byte length`
when given buffers of unequal length. The call site at line 149 is outside any try/catch,
so this exception propagates as an unhandled rejection, resulting in a 500 response.

**Impact**: A malicious actor can reliably trigger 500 errors on the public webhook
endpoint by sending garbage signatures. While this does not bypass signature validation
(the attacker still cannot forge a valid signature), it:
- Causes unhandled exceptions logged as server errors (noise in production logs)
- Returns HTTP 500 instead of 400, which may cause Patreon to retry the webhook
- Is a denial-of-service vector if Patreon retries on 500s

**Confirmed by**:
```
node -e "
  const crypto = require('crypto');
  const sig = 'ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'; // 32-char non-hex
  const exp = 'a1bf10825f943bd9b16ee890d3241b3c'; // 32-char valid hex
  const sBuf = Buffer.from(sig, 'hex'); // => 0 bytes
  const eBuf = Buffer.from(exp, 'hex'); // => 16 bytes
  crypto.timingSafeEqual(sBuf, eBuf); // THROWS: Input buffers must have the same byte length
"
```

**Required Fix**: Validate that `signature` is a valid lowercase hex string before
decoding, OR wrap the `timingSafeEqual` call in a try/catch and return `false`:

```typescript
// Option A: hex validation guard
const HEX_RE = /^[0-9a-f]+$/i;
const valid =
  signature.length === expectedSignature.length &&
  HEX_RE.test(signature) &&
  crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex"),
  );

// Option B: try/catch (simpler, equally correct)
try {
  const valid =
    signature.length === expectedSignature.length &&
    crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex"),
    );
  log.debug("validateSignature returning", { valid });
  return valid;
} catch {
  log.debug("validateSignature returning", { valid: false, reason: "buffer decode error" });
  return false;
}
```

---

### DEF-002 [MEDIUM] — `getMembership` does not filter by `campaignId`; any active Patreon patron receives `karl` tier

**File**: `development/frontend/src/lib/patreon/api.ts`
**Lines**: 112-188

**Root Cause**: The `getMembership()` function signature accepts `campaignId: string`,
and the JSDoc states _"Calls the Patreon identity endpoint with membership includes, then
matches the membership to the specified campaign ID to determine the user's tier."_
However, the filtering loop at lines 154-179 iterates over all `member` resources in the
response's `included` array and checks only `patron_status === "active_patron"`. There is
no check of `resource.relationships?.campaign?.data?.id === campaignId`.

The Patreon `/identity?include=memberships` endpoint returns **all** memberships for the
authenticated user across **all campaigns**. A user who pledges to an unrelated creator's
campaign would have `patron_status: "active_patron"` in the response, and the current
code would grant them `karl` tier in Fenrir Ledger.

The `campaignId` parameter is correctly passed to `log.debug` and stored in the
entitlement record, but is never used for membership matching.

**Impact**: Entitlement privilege escalation. Any Patreon user who is an active patron
of any campaign (not just Fenrir Ledger) can link their Patreon account and receive
`karl` tier without paying for Fenrir Ledger support.

**Required Fix**: Filter the member resources by matching the campaign relationship:

```typescript
// In getMembership(), replace the filtering loop with campaign-aware matching:
if (identity.included) {
  for (const resource of identity.included) {
    if (resource.type === "member") {
      // Check this membership belongs to our campaign
      const memberCampaignId = (
        resource.relationships as Record<string, { data?: { id?: string } }> | undefined
      )?.campaign?.data?.id;

      if (memberCampaignId && memberCampaignId !== campaignId) {
        log.debug("getMembership: skipping membership for different campaign", {
          memberCampaignId,
          expectedCampaignId: campaignId,
        });
        continue;
      }

      const patronStatus = resource.attributes.patron_status as string | null;
      const amountCents =
        resource.attributes.currently_entitled_amount_cents as number | undefined;

      if (patronStatus === "active_patron") {
        active = true;
        if (amountCents && amountCents > 0) {
          tier = "karl";
        }
      }
    }
  }
}
```

Note: The Patreon identity endpoint's `included` member resources expose the campaign
relationship only when `&include=memberships.campaign` is added to the query. The current
`PATREON_IDENTITY_URL` includes `memberships` but not `memberships.campaign`. The URL
must also be updated to include the campaign relationship data:

```typescript
const PATREON_IDENTITY_URL =
  "https://www.patreon.com/api/oauth2/v2/identity" +
  "?include=memberships.campaign" +  // <-- was "memberships"
  "&fields%5Buser%5D=email,full_name" +
  "&fields%5Bmember%5D=patron_status,currently_entitled_amount_cents,campaign_lifetime_support_cents";
```

---

## Advisory Items (Non-Blocking)

### ADV-001 [LOW] — `@vercel/kv` is deprecated; plan for Upstash Redis migration

**File**: `development/frontend/package.json` line 20

**Description**: FiremanDecko acknowledged this in `development/qa-handoff.md`
(Known Limitation #1). The package is functional but deprecated. Vercel recommends
migrating to Upstash Redis. This is not a blocker for this PR — the package works —
but a follow-up card should be created to track the migration before `@vercel/kv`
becomes unsupported.

**Action required**: Create a follow-up backlog item for Upstash Redis migration.
Not blocking this PR.

---

## Checks Passed

| Check | Result |
|-------|--------|
| `/api/patreon/authorize` requires `requireAuth` (ADR-008) | PASS |
| `/api/patreon/membership` requires `requireAuth` (ADR-008) | PASS |
| `/api/patreon/callback` correctly exempt from `requireAuth` (CSRF via state) | PASS |
| `/api/patreon/webhook` correctly exempt from `requireAuth` (HMAC-MD5 validation) | PASS |
| `PATREON_CLIENT_SECRET` accessed only via `process.env` in server-side modules | PASS |
| No `NEXT_PUBLIC_` prefix on any Patreon/KV/encryption secret variable | PASS |
| Fenrir logger (`log.*`) used throughout — no raw `console.*` in backend code | PASS |
| Method entry/exit `log.debug` on all functions | PASS |
| AES-256-GCM: 12-byte IV, 16-byte auth tag, correct buffer concatenation | PASS |
| AES-256-GCM: `decipher.setAuthTag()` called before `decipher.final()` | PASS |
| Tokens encrypted before KV storage (callback and membership refresh) | PASS |
| OAuth state: 16-byte nonce generated via `crypto.randomBytes(16)` | PASS |
| OAuth state: 10-minute expiry enforced in `validateState()` | PASS |
| Webhook: `timingSafeEqual` used (constant-time comparison) | PASS (with DEF-001 caveat) |
| KV secondary index (`patreon-user:{id}` -> `googleSub`) maintained in `setEntitlement` | PASS |
| KV TTL (30 days) set on both primary and secondary index entries | PASS |
| Graceful degradation: stale cache returned with `{ stale: true }` on Patreon API failure | PASS |
| TypeScript: `npx tsc --noEmit` — zero errors | PASS |
| Build: `npm run build` — zero errors, all 4 routes in build manifest | PASS |
| `.env.example` updated with all required variables, no secrets as plaintext | PASS |
| `.gitignore` covers `.env`, `*.env`, `.env.*` (excludes `.env.example`) | PASS |
| GH Actions: `deploy-preview` | PENDING (still running at time of report) |

---

## Defects Found

### DEF-001 [HIGH] — Uncaught exception in `validateSignature` on non-hex input
- Severity: HIGH — public unauthenticated endpoint, 500 error from garbage input
- File: `development/frontend/src/app/api/patreon/webhook/route.ts` lines 65-79
- Root cause: `timingSafeEqual` throws when decoded buffers have unequal byte lengths
- Fix: wrap `timingSafeEqual` in try/catch or add hex format guard before decode

### DEF-002 [MEDIUM] — `getMembership` grants `karl` tier for any active Patreon membership
- Severity: MEDIUM — entitlement privilege escalation
- File: `development/frontend/src/lib/patreon/api.ts` lines 154-179
- Root cause: filtering loop checks `patron_status` but not `campaign.id`
- Fix: add campaign relationship check; update `PATREON_IDENTITY_URL` to include `memberships.campaign`

---

## Risk Assessment

| Risk | Severity | Likelihood | Notes |
|------|----------|------------|-------|
| DEF-001: 500 crash on malformed webhook signature | HIGH | Certain if targeted | Any 32-char non-hex sig triggers it |
| DEF-002: Karl tier granted to unrelated Patreon patrons | MEDIUM | Plausible | Any Patreon user can exploit |
| ADV-001: @vercel/kv deprecation | LOW | Long-term | Functional now, needs migration tracking |
| Rate limiter is per-instance (KL-003) | LOW | Known | Acknowledged in handoff, acceptable now |

---

## Recommendation: HOLD FOR FIXES

Fix DEF-001 and DEF-002, then re-submit for QA. Both fixes are small and targeted.
No architectural changes are required — the overall implementation structure is sound.
