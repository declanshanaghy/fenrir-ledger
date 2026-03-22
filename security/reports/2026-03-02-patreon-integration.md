# Heimdall Security Review: Patreon Integration

**Reviewer**: Heimdall
**Date**: 2026-03-02
**Scope**: Patreon OAuth linking flow, membership check API, webhook handler, AES-256-GCM token encryption, Vercel KV entitlement store, and all related supporting modules introduced on the `feat/patreon-api` branch.
**Report**: security/reports/2026-03-02-patreon-integration.md

---

## Executive Summary

This review covers the full Patreon subscription integration: four new API routes (`/api/patreon/authorize`, `/api/patreon/callback`, `/api/patreon/membership`, `/api/patreon/webhook`), three new library modules (`lib/patreon/api.ts`, `lib/patreon/state.ts`, `lib/crypto/encrypt.ts`), and the Vercel KV entitlement store (`lib/kv/entitlement-store.ts`). The integration introduces a two-token authentication model: a Google id_token (existing) and new Patreon OAuth tokens stored server-side in Vercel KV.

The overall security posture of the integration is **good**. The team correctly applied requireAuth to the protected routes, used AES-256-GCM with per-encryption random IVs for token storage, validated CSRF state using encrypted tokens, and implemented HMAC timing-safe comparison for webhook signature validation. No secrets are exposed to the client bundle.

However, six findings require remediation before deployment. The most significant are: (1) HMAC-MD5 is a cryptographically weak algorithm for webhook signature validation and should be replaced with HMAC-SHA256; (2) the `buildRedirectUri` function in both `authorize` and `callback` routes trusts user-controlled HTTP headers (`x-forwarded-proto`, `host`) without allowlist validation, enabling redirect URI manipulation that can cause Patreon to send the authorization code to an attacker-controlled URI; (3) the in-memory rate limiter is ineffective in a serverless multi-instance deployment, leaving all Patreon routes open to distributed abuse; and (4) the CSP `connect-src` directive does not include `https://www.patreon.com`, blocking legitimate OAuth flows from the browser if the frontend ever redirects client-side. Additionally, missing replay protection on the webhook endpoint and the absence of structured audit logging for OAuth link/unlink events are medium-severity concerns.

---

## Risk Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0     |
| HIGH     | 2     |
| MEDIUM   | 3     |
| LOW      | 3     |
| INFO     | 3     |

---

## Findings

### [SEV-001] HIGH: HMAC-MD5 Used for Webhook Signature Validation

- **File**: `development/ledger/src/app/api/patreon/webhook/route.ts:71-74`
- **Category**: A02 Cryptographic Failures
- **Description**: The webhook signature validation uses HMAC-MD5 to authenticate payloads from Patreon. MD5 is a broken hash function; while HMAC construction provides some protection against preimage attacks, MD5's collision vulnerabilities and 128-bit output make it well below the security bar for production cryptographic authentication. Patreon's own documentation states they use MD5, but this is a known weakness in Patreon's design that we absorb by using it.
- **Impact**: A sufficiently resourced attacker who can observe webhook traffic can attempt to forge HMAC-MD5 signatures. A forged webhook could downgrade a paying user to the `thrall` tier or falsely elevate a non-paying user to `karl` tier. While Patreon's own API enforces the MD5 algorithm for webhooks (it is what they send), we have no ability to upgrade the incoming algorithm. The risk is therefore inherent to using Patreon webhooks.
- **Remediation**: This is a Patreon platform constraint — Patreon sends HMAC-MD5 and we cannot change that. However, we must document this explicitly as an accepted residual risk. Additionally:
  1. Add an explicit code comment in `validateSignature()` documenting that MD5 is Patreon's mandated algorithm and cannot be upgraded without Patreon changing their platform.
  2. Consider supplementary verification: after processing any webhook that upgrades a user to `karl`, immediately re-verify membership via the Patreon identity API using stored tokens before committing the upgrade. This makes a successful forgery useless without a valid Patreon account.
  3. Mark this finding as ACCEPTED RISK with appropriate documentation.
- **Evidence**:
  ```typescript
  // development/ledger/src/app/api/patreon/webhook/route.ts:71-74
  const expectedSignature = crypto
    .createHmac("md5", secret)  // MD5 is Patreon's mandated algorithm — platform constraint
    .update(body)
    .digest("hex");
  ```

---

### [SEV-002] HIGH: Redirect URI Built from User-Controlled Headers Without Allowlist Validation

- **File**: `development/ledger/src/app/api/patreon/authorize/route.ts:31-38` and `development/ledger/src/app/api/patreon/callback/route.ts:32-49`
- **Category**: A01 Broken Access Control / A03 Injection
- **Description**: Both `buildRedirectUri()` functions construct the OAuth redirect URI by reading `x-forwarded-proto` and `host` HTTP request headers. These headers can be spoofed by a malicious intermediary or in certain proxy configurations. If an attacker can control the `host` header reaching the Next.js server (e.g., through a misconfigured load balancer, a same-server SSRF, or a host header injection in shared infrastructure), the redirect URI sent to Patreon becomes `https://attacker.com/api/patreon/callback`. Patreon will then redirect the authorization code to the attacker's domain.
- **Impact**: Host header injection in the authorize route causes Patreon to redirect the user's authorization code to an attacker-controlled URI. The attacker can then exchange the code for Patreon tokens and link a victim's Patreon account to their own Fenrir account, or simply steal Patreon access tokens. In the callback route, a manipulated `host` causes the reconstructed redirect URI to mismatch what was sent during authorization, likely causing a Patreon validation error — but the mismatch could also be exploited to redirect the user to an attacker-controlled domain.
- **Remediation**: Replace the dynamic header-based URI construction with a single allowlisted base URL read from a server-side environment variable:
  ```typescript
  // Add to .env.example and .env.local:
  // NEXT_PUBLIC_APP_URL=https://fenrir-ledger.vercel.app  (safe for client bundle)
  // Or preferably a server-only:
  // APP_BASE_URL=https://fenrir-ledger.vercel.app

  function buildRedirectUri(): string {
    const baseUrl = process.env.APP_BASE_URL ?? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:9653";
    return `${baseUrl}/api/patreon/callback`;
  }
  ```
  This removes all reliance on user-controlled headers. Note that `VERCEL_URL` is automatically set by Vercel and is not user-controlled.
- **Evidence**:
  ```typescript
  // development/ledger/src/app/api/patreon/authorize/route.ts:31-38
  function buildRedirectUri(request: NextRequest): string {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";  // user-controlled
    const host = request.headers.get("host") ?? "localhost:9653";        // user-controlled
    const uri = `${proto}://${host}/api/patreon/callback`;
    return uri;
  }
  ```

---

### [SEV-003] MEDIUM: In-Memory Rate Limiter Ineffective in Serverless Multi-Instance Deployment

- **File**: `development/ledger/src/lib/rate-limit.ts:19` (used by all four Patreon routes)
- **Category**: A04 Insecure Design
- **Description**: The rate limiter uses a module-level in-memory `Map`. On Vercel's serverless platform, each function invocation may run on a different instance with its own memory space. A single IP address can make 5 requests per minute per instance, with dozens of concurrent instances, resulting in no effective rate limiting across the fleet. The existing `rate-limit.ts` file itself documents this limitation ("it won't survive cold starts or span across multiple instances") but all four new Patreon routes use it regardless.
- **Impact**: The `/api/patreon/authorize` and `/api/patreon/callback` endpoints are rate-limited at 5 and 10 requests per minute respectively, but these limits are per-instance only. An attacker with a botnet or multiple IP addresses can flood these endpoints, exhausting Patreon API quota, triggering OAuth confusion, or brute-forcing state token validation. The `/api/patreon/membership` route at 20 req/min per instance is similarly trivially bypassed.
- **Remediation**: Replace the in-memory rate limiter with a distributed rate limiter backed by Vercel KV (which is already a project dependency). Upstash's rate limiting library integrates cleanly with `@vercel/kv`:
  ```typescript
  // Use KV-backed sliding window rate limiting
  import { kv } from "@vercel/kv";

  export async function rateLimitKv(key: string, limit: number, windowSeconds: number) {
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `rl:${key}:${Math.floor(now / windowSeconds)}`;
    const count = await kv.incr(windowKey);
    if (count === 1) await kv.expire(windowKey, windowSeconds * 2);
    return { success: count <= limit, remaining: Math.max(0, limit - count) };
  }
  ```
  For now, treat in-memory rate limiting as a best-effort advisory defense only.
- **Evidence**:
  ```typescript
  // development/ledger/src/lib/rate-limit.ts:19
  // Comment in source: "it won't survive cold starts or span across multiple instances"
  const store = new Map<string, RateLimitEntry>();
  ```

---

### [SEV-004] MEDIUM: No Webhook Replay Protection

- **File**: `development/ledger/src/app/api/patreon/webhook/route.ts`
- **Category**: A04 Insecure Design
- **Description**: The webhook handler validates the HMAC-MD5 signature and event type, but does not implement replay protection. An attacker who captures a legitimate `members:pledge:delete` webhook can replay it indefinitely to repeatedly downgrade a user to `thrall` tier. Since Patreon does not include a timestamp in the webhook payload's root attributes, and the current code does not check for one, there is no mechanism to detect replayed requests. Similarly, there is no idempotency key or event deduplication.
- **Impact**: A captured `members:pledge:delete` webhook can be replayed to downgrade a paying user to `thrall` tier. The user would need to re-check membership (which re-queries Patreon's API) to recover. This is a denial-of-service against paying users' entitlements. A captured `members:pledge:create` replay could be used to reset a user's `checkedAt` timestamp but would not grant unauthorized access.
- **Remediation**: Check the `X-Patreon-Request-Id` header (Patreon sends a unique ID per delivery attempt) and store processed event IDs in KV with a short TTL (e.g., 24 hours). Reject duplicate event IDs:
  ```typescript
  const eventId = request.headers.get("x-patreon-request-id");
  if (eventId) {
    const dedupeKey = `webhook-seen:${eventId}`;
    const seen = await kv.get(dedupeKey);
    if (seen) {
      return NextResponse.json({ status: "duplicate" }, { status: 200 });
    }
    await kv.set(dedupeKey, 1, { ex: 86400 }); // 24-hour TTL
  }
  ```
  Additionally, check if Patreon includes a timestamp in payload attributes and reject events older than 5 minutes.
- **Evidence**: No replay protection code exists in `development/ledger/src/app/api/patreon/webhook/route.ts`.

---

### [SEV-005] MEDIUM: CSP `connect-src` Does Not Include Patreon Domain

- **File**: `development/ledger/next.config.ts:31-43`
- **Category**: A05 Security Misconfiguration
- **Description**: The Content Security Policy `connect-src` directive does not include `https://www.patreon.com`. The authorize route redirects the browser to Patreon's OAuth page, which is a navigation (handled by `frame-src` / navigation, not `connect-src`). However, if any future frontend code attempts to make a direct `fetch()` or `XMLHttpRequest` to `www.patreon.com` (e.g., checking Patreon status from the client, or if a Patreon widget is ever embedded), the CSP would block it without clear error messaging. More critically, the `frame-src` directive also does not include `https://www.patreon.com`, which would block any Patreon OAuth consent UI rendered in an iframe.
- **Impact**: Low-impact today because all Patreon communication is server-side. However, it represents a CSP gap that could cause silent failures if client-side Patreon integration is ever added. The missing `frame-src` entry could block Patreon's OAuth consent popup if it is ever rendered in an iframe context.
- **Remediation**: Add Patreon to CSP directives where appropriate:
  ```typescript
  // In next.config.ts cspDirectives:
  "connect-src 'self' ... https://www.patreon.com",
  "frame-src https://accounts.google.com https://docs.google.com https://drive.google.com https://vercel.live https://www.patreon.com",
  ```
- **Evidence**:
  ```typescript
  // development/ledger/next.config.ts:31-43
  // connect-src does not include www.patreon.com
  // frame-src does not include www.patreon.com
  [
    "connect-src 'self'",
    "https://accounts.google.com",
    "https://oauth2.googleapis.com",
    "https://www.googleapis.com",
    // ... no patreon.com
  ].join(" "),
  ```

---

### [SEV-006] LOW: OAuth State Token Nonce Not Bound to Session or Browser Fingerprint

- **File**: `development/ledger/src/lib/patreon/state.ts`
- **Category**: A07 Identification and Authentication Failures
- **Description**: The encrypted OAuth state token contains `googleSub`, `nonce`, and `createdAt`. The `nonce` is a 16-byte random value generated server-side, but it is not stored server-side. Because the token is only decrypted and validated (not looked up in a store), any valid encrypted state token for the correct `googleSub` that is not expired will be accepted. A state token cannot be "used up" — it remains valid for its full 10-minute window and could theoretically be used multiple times.
- **Impact**: An attacker who steals a state token from a user's browser during the 10-minute window (e.g., via network interception, log leakage, or referrer header) could initiate their own callback request using that token. The encrypted state provides integrity and confidentiality, so theft requires compromising the token in transit or from logs. The nonce provides no additional protection without server-side storage. This is a defense-in-depth gap rather than an immediately exploitable vulnerability.
- **Remediation**: Store nonces in KV with a short TTL (matching `STATE_MAX_AGE_MS`) and mark them as consumed on first use:
  ```typescript
  // In generateState(), also store: await kv.set(`oauth-state-nonce:${nonce}`, 1, { ex: 600 })
  // In validateState(), check and consume:
  //   const exists = await kv.getdel(`oauth-state-nonce:${nonce}`)
  //   if (!exists) return null; // already used or expired
  ```
  This makes state tokens single-use, preventing replay.
- **Evidence**:
  ```typescript
  // development/ledger/src/lib/patreon/state.ts:57-93
  // No server-side nonce store; token remains valid for full 10 minutes after use
  export function validateState(stateToken: string): PatreonOAuthState | null {
    // ... decrypts, validates expiry, but does not consume the nonce
  }
  ```

---

### [SEV-007] LOW: Patreon Error Body Logged at ERROR Level May Contain Sensitive Information

- **File**: `development/ledger/src/lib/patreon/api.ts:83-88` and `api.ts:253-258`
- **Category**: A09 Security Logging and Monitoring Failures
- **Description**: When Patreon's token endpoint or identity API returns an error, the raw response body is captured via `await response.text()` and logged at `log.error()` level with the full body text. Patreon error responses may include fields that echo back partial request data (e.g., a truncated `code`, the `client_id`, or error detail strings). While the fenrir logger masks known secret key names, it does not mask arbitrary content inside an opaque error body string.
- **Impact**: Patreon error responses logged verbatim in production logs could expose partial OAuth codes or other data in logs accessible to Vercel dashboard viewers. This is a low-severity concern because: (1) the fenrir logger's regex patterns would catch most token-format strings; (2) Patreon error bodies typically contain non-secret diagnostic information.
- **Remediation**: Limit what is logged from error bodies. Log only the HTTP status code and a length indicator, not the full body:
  ```typescript
  // Instead of: log.error("exchangeCode failed", { status, body: errorBody })
  log.error("exchangeCode failed", { status: response.status, bodyLength: errorBody.length });
  ```
  If the full error body is needed for debugging, log it at `debug` level which is suppressed in production (`minLevel: 2` in production means only `info` and above are emitted).
- **Evidence**:
  ```typescript
  // development/ledger/src/lib/patreon/api.ts:83-88
  const errorBody = await response.text();
  log.error("exchangeCode: Patreon token exchange failed", {
    status: response.status,
    body: errorBody,  // raw Patreon error body at ERROR level in production logs
  });
  ```

---

### [SEV-008] LOW: No Audit Log for Patreon Account Link / Unlink Events

- **File**: `development/ledger/src/app/api/patreon/callback/route.ts` and `development/ledger/src/app/api/patreon/webhook/route.ts`
- **Category**: A09 Security Logging and Monitoring Failures
- **Description**: When a Patreon account is successfully linked (callback route) or when a membership changes (webhook route), only `log.debug()` is used for the success path. In production, `minLevel: 2` suppresses debug logs. There is therefore no persistent audit trail for: account link events, tier upgrades, tier downgrades, or webhook-triggered changes. The only production-level log events are errors.
- **Impact**: If a user disputes a tier change, or if a security incident involves manipulation of entitlements, there is no server-side audit trail to reconstruct what happened and when. This is a compliance and forensics gap.
- **Remediation**: Emit `log.info()` (not `log.debug()`) for all entitlement-mutating events:
  ```typescript
  log.info("Patreon account linked", {
    googleSub: googleSub,  // will be masked? No — googleSub is not a secret key
    patreonUserId: membership.patreonUserId,
    tier: membership.tier,
    active: membership.active,
  });
  ```
  Use structured fields so events are queryable in Vercel log aggregation.
- **Evidence**: All success-path logging in callback and webhook routes uses `log.debug()`, which is suppressed in production.

---

### [SEV-009] INFO: Patreon Token Expiry Not Tracked in Entitlement Store

- **File**: `development/ledger/src/lib/patreon/types.ts:117-134`
- **Category**: A07 Identification and Authentication Failures
- **Description**: The `StoredEntitlement` type does not include a field for when the Patreon `access_token` expires (`expires_in` from the token response). The membership route always attempts a token refresh when the entitlement is stale (> 1 hour), using the `refresh_token`. If the refresh token itself has expired or been revoked by Patreon (users can revoke app access from their Patreon settings), the refresh will fail silently and the stale cached entitlement is returned with `{ stale: true }`. This is the correct degraded behavior, but there is no proactive notification or re-link prompt.
- **Impact**: Users who revoke Patreon access will continue to see stale (potentially incorrect) entitlement data for up to 30 days (KV TTL), with `stale: true` in the API response. If the UI does not surface this flag, users may see incorrect tier information.
- **Remediation**: Store `tokenExpiresAt` in `StoredEntitlement` and use it to optimize refresh scheduling. When a refresh fails with a 401 (invalid refresh token), mark the entitlement as `active: false` and set a flag (e.g., `reAuthRequired: true`) so the UI can prompt re-linking.

---

### [SEV-010] INFO: `PATREON_CLIENT_ID` Used Without `NEXT_PUBLIC_` Prefix — Verify This Is Intentional

- **File**: `development/ledger/src/app/api/patreon/authorize/route.ts:75` and `development/ledger/src/lib/patreon/api.ts:51`
- **Category**: INFO — Environment Variable Hygiene
- **Description**: `PATREON_CLIENT_ID` is correctly a server-only env var (no `NEXT_PUBLIC_` prefix). However, unlike `NEXT_PUBLIC_GOOGLE_CLIENT_ID` which is intentionally public (needed client-side for the OAuth redirect), the Patreon client ID is never needed in the browser. The current design is correct. This is a verification note confirming the intentional difference.
- **Impact**: None. The correct prefix (absence of `NEXT_PUBLIC_`) is applied.
- **Remediation**: No action required. The `.env.example` correctly documents that all Patreon variables are server-side only.

---

### [SEV-011] INFO: `KV_REST_API_TOKEN` Exposure Risk if KV Errors Logged Verbatim

- **File**: `development/ledger/src/lib/kv/entitlement-store.ts:60-65`
- **Category**: A09 Security Logging and Monitoring Failures
- **Description**: KV errors are caught and logged as `err.message`. The `@vercel/kv` client may include the KV REST API URL or a partial token in error messages for connection failures. The fenrir logger's `maskValuesOfKeys` list includes `token` (case-insensitive), which would mask a field named `token`, but a token embedded in a URL string within an error message would only be caught if it matches the regex patterns. `KV_REST_API_TOKEN` is not in the regex pattern list.
- **Impact**: Low. KV error messages that embed the API token in a URL would be logged in production. Vercel's KV client typically does not embed the token in error messages, but this is implementation-dependent.
- **Remediation**: Add `KV_REST_API_TOKEN` pattern to the fenrir logger's `MASKED_PATTERNS` regex, or explicitly strip tokens from KV error messages before logging.

---

### [SEV-012] INFO: `host` Header Used for Response Redirect URL Construction (SSRF-Adjacent)

- **File**: `development/ledger/src/app/api/patreon/callback/route.ts:32-39`
- **Category**: A10 Server-Side Request Forgery
- **Description**: The `getBaseUrl()` function uses the `host` header to construct the base URL used for all redirect responses (e.g., `${baseUrl}/settings?patreon=linked`). If an attacker can inject a malicious `host` header, the user would be redirected to an attacker-controlled domain after the OAuth flow completes. This is related to SEV-002 but affects the final redirect destinations rather than the OAuth redirect URI.
- **Impact**: If `host` injection succeeds, users completing the Patreon OAuth flow would be redirected to `https://attacker.com/settings?patreon=linked&tier=karl` instead of the real application. This is an open redirect that can be used for phishing.
- **Remediation**: This is fixed by the same env-var-based approach recommended in SEV-002. Use `APP_BASE_URL` from environment for all redirect construction, eliminating all reliance on the `host` header.
- **Evidence**:
  ```typescript
  // development/ledger/src/app/api/patreon/callback/route.ts:32-38
  function getBaseUrl(request: NextRequest): string {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";  // user-controlled
    const host = request.headers.get("host") ?? "localhost:9653";        // user-controlled
    const url = `${proto}://${host}`;
    return url;
  }
  ```

---

## Data Flow Analysis

### Patreon OAuth Linking Flow

```
Browser                    /api/patreon/authorize            Patreon
   |                              |                             |
   |-- GET /api/patreon/authorize |                             |
   |   Authorization: Bearer id_token                          |
   |                              |                             |
   |        requireAuth()         |                             |
   |     verifyIdToken(id_token)  |                             |
   |                              |                             |
   |     generateState(googleSub) |                             |
   |     encrypt(stateJson)       |                             |
   |     AES-256-GCM random IV    |                             |
   |                              |                             |
   |<-- 302 Redirect -----------  |                             |
   |    Location: patreon.com/oauth2/authorize                  |
   |    ?client_id=...                                          |
   |    &state=<encrypted-state>  |                             |
   |    &redirect_uri=<host>/api/patreon/callback [SEV-002]    |
   |                                                            |
   |--------------- User grants consent -------------------->   |
   |                                                            |
   |<-- 302 Redirect from Patreon ----------------------------  |
   |    Location: /api/patreon/callback                         |
   |    ?code=<auth_code>&state=<encrypted-state>               |

Browser                    /api/patreon/callback             Patreon / KV
   |                              |                             |
   |-- GET /api/patreon/callback  |                             |
   |   ?code=...&state=...        |                             |
   |                              |                             |
   |     [NO requireAuth]         |                             |
   |     validateState(state)     |                             |
   |     decrypt(state) -> AES-GCM                             |
   |     check expiry (10 min)    |                             |
   |     extract googleSub        |                             |
   |                              |                             |
   |     exchangeCode(code, redirectUri)                        |
   |                              |-- POST /oauth2/token ----> |
   |                              |<-- {access_token, ...} --- |
   |                              |                             |
   |     getMembership(access_token, campaignId)                |
   |                              |-- GET /v2/identity ------> |
   |                              |<-- {data, included} ------ |
   |                              |                             |
   |     encrypt(access_token)    |                             |
   |     encrypt(refresh_token)   |   (AES-256-GCM, random IV) |
   |                              |                             |
   |     setEntitlement(googleSub, {tier, active, ...})         |
   |                              |-- KV.set entitlement:sub ->|
   |                              |-- KV.set patreon-user:pid ->|
   |                              |                             |
   |<-- 302 /settings?patreon=linked&tier=...                   |
```

### Webhook Flow

```
Patreon Platform               /api/patreon/webhook          Vercel KV
       |                              |                           |
       |-- POST /api/patreon/webhook  |                           |
       |   X-Patreon-Signature: <md5>|                           |
       |   X-Patreon-Event: members:pledge:*                     |
       |   Body: {JSON:API payload}   |                           |
       |                              |                           |
       |   [NO requireAuth]           |                           |
       |   rawBody = request.text()   |                           |
       |                              |                           |
       |   validateSignature(body, sig)                           |
       |   HMAC-MD5(secret, body)     | [SEV-001: weak algorithm] |
       |   timingSafeEqual()          |                           |
       |                              |                           |
       |   parse JSON payload         |                           |
       |   extractPatreonUserId()     |                           |
       |                              |                           |
       |   getGoogleSubByPatreonUserId()                          |
       |                              |-- KV.get patreon-user:pid->|
       |                              |                           |
       |   getEntitlement(googleSub)  |                           |
       |                              |-- KV.get entitlement:sub ->|
       |                              |                           |
       |   determineTierFromPayload() |                           |
       |   setEntitlement(updated)    |                           |
       |                              |-- KV.set entitlement:sub ->|
       |                              |                           |
       |<-- 200 {status: "processed"} |                           |
```

### Membership Check Flow (Stale Cache)

```
Browser              /api/patreon/membership     Patreon API     Vercel KV
   |                        |                        |               |
   |-- GET /membership      |                        |               |
   |   Authorization: Bearer id_token               |               |
   |                        |                        |               |
   |   requireAuth()        |                        |               |
   |   verifyIdToken()      |                        |               |
   |                        |                        |               |
   |   getEntitlement()     |                        |               |
   |                        |-- KV.get entitlement:sub -----------> |
   |                        |                        |               |
   |   isStale() (>1hr)     |                        |               |
   |                        |                        |               |
   |   decrypt(refreshToken)|                        |               |
   |   refreshToken()       |                        |               |
   |                        |-- POST /oauth2/token ->|               |
   |                        |<-- {new tokens} -------|               |
   |                        |                        |               |
   |   getMembership()      |                        |               |
   |                        |-- GET /v2/identity --->|               |
   |                        |<-- {data, included} ---|               |
   |                        |                        |               |
   |   encrypt(new tokens)  |                        |               |
   |   setEntitlement()     |                        |               |
   |                        |-- KV.set entitlement:sub -----------> |
   |                        |                        |               |
   |<-- 200 {tier, active} -|                        |               |
```

---

## requireAuth Compliance Checklist

| Route | Handler | requireAuth Called | Returns Early on Failure | Exempt (Justified) |
|-------|---------|-------------------|--------------------------|-------------------|
| `/api/patreon/authorize` | GET | YES | YES | N/A |
| `/api/patreon/callback` | GET | NO | N/A | YES — mid-OAuth flow, CSRF protected by encrypted state |
| `/api/patreon/membership` | GET | YES | YES | N/A |
| `/api/patreon/webhook` | POST | NO | N/A | YES — webhook from Patreon server, HMAC-MD5 authenticated |

Both exemptions are justified. The callback route follows the same exemption pattern as `/api/auth/token` (documented). The webhook route is authenticated by a shared secret.

---

## Compliance Checklist

- [x] All API routes call requireAuth() (except /api/auth/token) — Patreon callback and webhook have documented exemptions
- [x] No server secrets use NEXT_PUBLIC_ prefix — all Patreon vars are server-only
- [x] .env files are in .gitignore — confirmed, `.env.*` is gitignored except `.env.example`
- [x] No hardcoded secrets in source code — all secrets from process.env
- [x] Error responses do not leak internal details — errors return generic messages; stack traces not exposed
- [x] OAuth tokens have expiration handling — Patreon tokens refreshed when entitlement is stale; 30-day KV TTL
- [x] User input is validated before use — state param validated (decryption + expiry); webhook body validated (signature first)
- [x] CORS is configured restrictively — no explicit CORS headers added; Next.js default applies
- [x] Security headers are present (CSP, X-Frame-Options, etc.) — confirmed in next.config.ts
- [ ] Dependencies have no known critical vulnerabilities — @vercel/kv 3.0.0 not audited; package versions look current
- [ ] CSP includes all required domains — Patreon domain missing from connect-src and frame-src (SEV-005)
- [x] Tokens encrypted at rest — AES-256-GCM with random IV per encryption
- [x] Timing-safe comparison used for HMAC — crypto.timingSafeEqual() confirmed
- [ ] Rate limiting is distributed — in-memory only, ineffective in serverless (SEV-003)
- [ ] Webhook replay protection — not implemented (SEV-004)

---

## Recommendations

1. **[HIGH]** Fix host header injection in redirect URI construction (SEV-002 and SEV-012). Add `APP_BASE_URL` (or use `VERCEL_URL`) as a server-side env var and use it exclusively for building redirect URIs. Remove all reliance on `x-forwarded-proto` and `host` headers in both `authorize/route.ts` and `callback/route.ts`. This is the highest-priority fix before deployment.

2. **[HIGH]** Document HMAC-MD5 as an accepted platform risk (SEV-001). Add a code comment in `validateSignature()` explaining that MD5 is Patreon's mandated webhook algorithm. Add supplementary server-side re-verification via the Patreon identity API before committing any webhook-driven tier upgrade to `karl`.

3. **[MEDIUM]** Implement distributed rate limiting using Vercel KV (SEV-003). The existing in-memory rate limiter provides no protection in a multi-instance serverless deployment. Replace with a KV-backed sliding window counter for all four Patreon routes.

4. **[MEDIUM]** Add webhook replay protection using `X-Patreon-Request-Id` header deduplication stored in KV with a 24-hour TTL (SEV-004).

5. **[MEDIUM]** Add Patreon domains to CSP `connect-src` and `frame-src` directives (SEV-005). This future-proofs the CSP and prevents silent failures if client-side Patreon integration is ever added.

6. **[LOW]** Make OAuth state nonces single-use by storing them in KV and deleting on first consumption (SEV-006). This closes a theoretical replay window for the state token.

7. **[LOW]** Reduce verbosity of Patreon API error logging in production (SEV-007). Log status code and body length only at ERROR level; log full body at DEBUG level only.

8. **[LOW]** Add `log.info()` audit events for Patreon link, unlink, and tier change operations (SEV-008). These events must be visible in production logs for incident response.

9. **[INFO]** Store Patreon token expiry time in `StoredEntitlement` and surface a re-link prompt when the refresh token is revoked (SEV-009).

10. **[INFO]** Add `KV_REST_API_TOKEN` pattern to the fenrir logger's masked regex patterns (SEV-011).
