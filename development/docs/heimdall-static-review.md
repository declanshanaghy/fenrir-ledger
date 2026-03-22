# Heimdall Static Security Review — Google API Integration

**Reviewer**: Heimdall (automated security sub-agent)
**Date**: 2026-03-02
**Scope**: Google API integration — API routes, auth flow, import pipeline, client hooks, configuration

---

## Executive Summary

The Fenrir Ledger Google API integration is overall well-architected with clear security intent. The PKCE flow is correctly implemented with cryptographically strong primitives, all three API route handlers call `requireAuth()` before any handler logic, server secrets carry no `NEXT_PUBLIC_` prefix, and `.env*` files are excluded from git. The LLM prompt contains explicit rules against echoing card numbers, CVVs, and SSNs.

However, several meaningful weaknesses exist. The most significant are: (1) a missing `callbackUrl` origin allowlist that permits open-redirect abuse after OAuth completion; (2) the `GOOGLE_PICKER_API_KEY` being sent in plaintext JSON to every authenticated browser session with no key rotation guidance, making it extractable by any script in the page; (3) complete absence of HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) in `next.config.ts`; (4) no rate limiting on the unauthenticated `/api/auth/token` endpoint, enabling token exchange brute-force or code interception amplification; and (5) the Drive access token is stored in `localStorage` alongside the full session, increasing XSS blast radius.

---

## Risk Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0     |
| HIGH     | 3     |
| MEDIUM   | 4     |
| LOW      | 3     |
| INFO     | 3     |

---

## Findings

### [SEV-001] HIGH — Open Redirect in OAuth Callback via Unvalidated `callbackUrl`

- **Category**: A01 Broken Access Control / A04 Insecure Design
- **Location**: `development/ledger/src/app/auth/callback/page.tsx:177`
- **Description**: After the OAuth token exchange completes, the callback page reads `callbackUrl` from `sessionStorage["fenrir:pkce"]` and performs an unconditional `window.location.href = destination` redirect. The `callbackUrl` value is never validated against an origin allowlist. An attacker who can set `sessionStorage["fenrir:pkce"]` before the OAuth flow (e.g., via XSS or a subdomain takeover) can redirect the freshly authenticated user to any external URL, facilitating phishing and credential theft. The sign-in page hard-codes `callbackUrl: "/"` today, so the current default is safe — but the pattern is fragile; any future feature that makes `callbackUrl` user-supplied (e.g., `?next=` query param) would immediately be exploitable.
- **Impact**: Post-authentication redirect to attacker-controlled domain. Victim lands on a phishing page with a believable URL transition.
- **Evidence**:
  ```typescript
  // src/app/auth/callback/page.tsx:177
  const destination = pkceData.callbackUrl || "/";
  window.location.href = destination;  // No origin check
  ```
- **Remediation**: Validate `callbackUrl` before redirecting. Reject any value whose origin is not in the allowed set:
  ```typescript
  function isSafeCallbackUrl(url: string): boolean {
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.origin === window.location.origin;
    } catch {
      return false;
    }
  }
  const destination = isSafeCallbackUrl(pkceData.callbackUrl) ? pkceData.callbackUrl : "/";
  ```

---

### [SEV-002] HIGH — Absence of HTTP Security Headers

- **Category**: A05 Security Misconfiguration
- **Location**: `development/ledger/next.config.ts`
- **Description**: `next.config.ts` configures only URL rewrites. No security headers are set: no Content Security Policy (CSP), no `Strict-Transport-Security` (HSTS), no `X-Frame-Options`, no `X-Content-Type-Options`, and no `Referrer-Policy`. Because tokens and card data are held in `localStorage`, a successful XSS attack has no browser-enforced boundary to slow it down.
- **Impact**: XSS payloads can exfiltrate tokens from `localStorage`. Without HSTS, downgrade attacks are possible. Without `X-Frame-Options`, the app can be clickjacked.
- **Evidence**:
  ```typescript
  // next.config.ts — only rewrites configured, no headers() function
  ```
- **Remediation**: Add a `headers()` function to `next.config.ts` with CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and Strict-Transport-Security.

---

### [SEV-003] HIGH — No Rate Limiting on Unauthenticated Token Exchange Endpoint

- **Category**: A04 Insecure Design / A07 Identification and Authentication Failures
- **Location**: `development/ledger/src/app/api/auth/token/route.ts`
- **Description**: The `/api/auth/token` endpoint is intentionally exempt from `requireAuth()` (correct). However, there is no rate limiting, no IP-based throttling, and no per-code uniqueness enforcement. This enables: (a) DoS against Google's token endpoint; (b) amplification of authorization code interception; (c) GKE pod resource exhaustion.
- **Impact**: Function cost exhaustion, DoS amplification during PKCE race conditions, potential lockout of GCP OAuth app.
- **Evidence**:
  ```typescript
  // route.ts — no rate limit check before processing
  export async function POST(request: NextRequest): Promise<NextResponse> {
    // Proceeds directly to Google token exchange
  ```
- **Remediation**: Implement per-IP rate limiting (e.g., `@upstash/ratelimit` with KV store). Limit to ~10 requests/minute per IP.

---

### [SEV-004] MEDIUM — Google Picker API Key Transmitted to Browser in Plaintext JSON

- **Category**: A02 Cryptographic Failures / A05 Security Misconfiguration
- **Location**: `development/ledger/src/app/api/config/picker/route.ts:16`
- **Description**: The `GOOGLE_PICKER_API_KEY` is served via auth-gated endpoint as plaintext JSON. Any authenticated user can extract it from the network inspector. Without CSP (SEV-002), XSS can also read it from React state.
- **Impact**: API key extraction by authenticated users or XSS payloads.
- **Remediation**: Add `Cache-Control: no-store` to the response. Document that the GCP key MUST have HTTP referrer restrictions enabled.

---

### [SEV-005] MEDIUM — LLM Prompt Injection via User-Controlled CSV Content

- **Category**: A03 Injection (Prompt Injection)
- **Location**: `development/ledger/src/lib/sheets/prompt.ts:44`
- **Description**: User-supplied CSV is interpolated directly into the LLM system prompt with no structural separation. A user controlling CSV content can inject instructions to override model behavior.
- **Impact**: Denial of extraction service, false negatives on sensitive data detection, attacker-controlled strings in card `notes`.
- **Evidence**:
  ```typescript
  return `You are a data extraction assistant...
  CSV data:
  ${csv}`;  // User CSV appended directly — no structural boundary
  ```
- **Remediation**: Use structured message format — system prompt as `system` parameter, CSV as `user` message role.

---

### [SEV-006] MEDIUM — Drive Access Token Stored in localStorage (XSS Blast Radius)

- **Category**: A07 Identification and Authentication Failures
- **Location**: `development/ledger/src/hooks/useDriveToken.ts:52-57`
- **Description**: Drive-scoped OAuth access token is persisted to `localStorage["fenrir:drive-token"]`. Combined with absent CSP (SEV-002), XSS can exfiltrate it for up to 1 hour.
- **Impact**: Token theft enabling read access to user's Google Drive files.
- **Remediation**: Store Drive token in React state (memory) only — do not persist to localStorage.

---

### [SEV-007] MEDIUM — Error Message from Google Token Endpoint Forwarded to Client

- **Category**: A09 Security Logging and Monitoring / A05 Security Misconfiguration
- **Location**: `development/ledger/src/app/api/auth/token/route.ts:133-140`
- **Description**: Google's raw error response body is forwarded verbatim to the browser client, which then renders it in the DOM via `setErrorMessage(message)`.
- **Impact**: Information disclosure about GCP OAuth configuration.
- **Remediation**: Map known HTTP status codes to user-safe messages. Log raw errors to console only.

---

### [SEV-008] LOW — LLM Provider Singleton May Persist Stale API Key Across Deployments

- **Category**: A05 Security Misconfiguration
- **Location**: `development/ledger/src/lib/llm/extract.ts:75-105`
- **Description**: Module-level singleton caches LLM provider instance. On warm serverless containers, rotated API keys won't take effect until cold start.
- **Remediation**: Document this behavior. Add provider env-var version check to invalidate singleton.

---

### [SEV-009] LOW — `FENRIR_OPENAI_API_KEY` and `LLM_PROVIDER` Absent from `.env.example`

- **Category**: A05 Security Misconfiguration
- **Location**: `development/ledger/.env.example`
- **Description**: `extract.ts` references these env vars but they aren't documented in `.env.example`.
- **Remediation**: Add both to `.env.example` with comments noting no `NEXT_PUBLIC_` prefix.

---

### [SEV-010] LOW — Middleware is a No-op (Defense-in-Depth Gap)

- **Category**: A01 Broken Access Control (defense-in-depth)
- **Location**: `development/ledger/src/middleware.ts`
- **Description**: Middleware calls `NextResponse.next()` unconditionally. No security processing.
- **Remediation**: Use middleware to set security response headers at the Edge. Covered by SEV-002.

---

### [SEV-011] INFO — OAuth Scope Includes `openid email profile` Only at Sign-In (Correct)

- **Category**: A01 Broken Access Control (scope minimization)
- **Location**: `development/ledger/src/app/sign-in/page.tsx:90-93`
- **Description**: Initial OAuth request correctly uses minimal scopes. Drive scopes acquired via incremental consent only when needed.
- **Status**: PASS. No action required.

---

### [SEV-012] INFO — `NEXT_PUBLIC_GOOGLE_CLIENT_ID` Used Server-Side in `verify-id-token.ts`

- **Category**: A05 Security Misconfiguration (naming convention)
- **Location**: `development/ledger/src/lib/auth/verify-id-token.ts:59`
- **Description**: Server-side module reads `NEXT_PUBLIC_` variable. The client ID is legitimately public and the naming is technically correct.
- **Status**: Informational only. No action required.

---

### [SEV-013] INFO — `mergeAnonymousCards` Reads Raw JSON from localStorage Without Schema Validation

- **Category**: A08 Software and Data Integrity Failures
- **Location**: `development/ledger/src/lib/merge-anonymous.ts:57`
- **Description**: `JSON.parse()` result is used without Zod validation before merging into authenticated store.
- **Remediation**: Validate with `CardsArraySchema.safeParse()` before merging.

---

## Data Flow Diagrams

### OAuth 2.0 PKCE Flow

```
User: clicks "Sign in to Google"
  --> /sign-in/page.tsx
    --> generateCodeVerifier() [96-byte random, Web Crypto]
    --> generateCodeChallenge() [SHA-256(verifier), base64url]
    --> generateState() [16-byte random hex]
    --> sessionStorage["fenrir:pkce"] = { verifier, state, callbackUrl: "/" }
    --> window.location = accounts.google.com/o/oauth2/v2/auth
          ?client_id=NEXT_PUBLIC_GOOGLE_CLIENT_ID
          &scope=openid email profile
          &code_challenge=<S256>
          &state=<random>
          &access_type=offline

Google: user consents
  --> Redirects to /auth/callback?code=<auth_code>&state=<state>

/auth/callback/page.tsx
  --> reads sessionStorage["fenrir:pkce"]
  --> verifies state === stateParam  [CSRF check - PASS]
  --> sessionStorage.removeItem("fenrir:pkce")
  --> POST /api/auth/token { code, code_verifier, redirect_uri }
        --> route.ts: validates redirect_uri origin
        --> adds GOOGLE_CLIENT_SECRET (server-only)
        --> proxies to https://oauth2.googleapis.com/token
        --> forwards response verbatim  <-- [SEV-007]
  --> setSession() -> localStorage["fenrir:auth"]
  --> mergeAnonymousCards()  [SEV-013: no schema validation]
  --> window.location = callbackUrl  <-- [SEV-001: no origin check]
```

### URL Import Pipeline (Path A)

```
User: enters Google Sheets URL
  --> POST /api/sheets/import { "url": "<URL>" }
        Authorization: Bearer <id_token>
  --> requireAuth(request) [PASS]
  --> extractSheetId(url) --> hostname.endsWith("google.com") [PASS]
  --> buildCsvExportUrl(sheetId) --> hardcoded google.com [SSRF: PASS]
  --> fetchCsv(csvUrl) --> fetch(google.com only) [PASS]
  --> extractCardsFromCsv(csv)
        --> buildExtractionPrompt(csv) [SEV-005: direct interpolation]
        --> LLM call --> Zod validation --> UUID assignment
  --> returns { cards }
```

### Google Picker Flow (Path B)

```
User: clicks "Browse the Archives"
  --> GIS popup --> Drive consent --> access_token
  --> localStorage["fenrir:drive-token"] [SEV-006]
  --> GET /api/config/picker [auth-gated]
  --> returns { pickerApiKey } [SEV-004]
  --> Google Picker UI --> user selects spreadsheet
  --> Sheets API v4 fetch --> CSV conversion
  --> POST /api/sheets/import { "csv": "<data>" }
  --> Same extraction pipeline as Path A
```

---

## Compliance Checklist

| Check | Status | Notes |
|-------|--------|-------|
| All API routes call `requireAuth()` (except `/api/auth/token`) | PASS | All 3 routes verified |
| No server secrets use `NEXT_PUBLIC_` prefix | PASS | All server secrets correctly scoped |
| `.env*` files are in `.gitignore` | PASS | Confirmed |
| No hardcoded secrets in source code | PASS | None found |
| `GOOGLE_CLIENT_SECRET` is server-side only | PASS | Only in `/api/auth/token/route.ts` |
| `next.config.ts` does not expose secrets | PASS | No `env` blocks |
| Error responses do not leak stack traces | PASS | Generic messages used |
| Error responses do not leak implementation details | PARTIAL FAIL | SEV-007 |
| PKCE is correctly implemented | PASS | Cryptographically sound |
| State parameter validated in callback | PASS | Present with error return |
| Security headers present | FAIL | SEV-002 |
| Rate limiting on sensitive endpoints | FAIL | SEV-003 |
| OAuth scopes are minimal | PASS | Incremental consent used |
| LLM prompt has sensitive data filtering | PASS | Rules present |
| Dependencies have no known critical CVEs | PASS | As of 2026-03-02 |
