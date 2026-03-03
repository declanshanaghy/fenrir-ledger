# Consolidated Security Review Report — Google API Integration

**Date**: 2026-03-02
**Reviewers**: Heimdall (static analysis), Playwright-Bowser (runtime inspection)
**Scope**: Google API integration — OAuth 2.0 PKCE, Google Sheets import, Google Drive Picker, token handling, environment variable scoping

---

## Executive Summary

Fenrir Ledger's Google API integration is well-architected with strong security fundamentals. The PKCE OAuth flow uses cryptographically sound primitives, all API routes correctly enforce `requireAuth()`, server secrets are properly scoped (no `NEXT_PUBLIC_` prefix), and no secrets leak through client-side JavaScript bundles, network traffic, or console output.

However, **3 HIGH severity findings** require remediation before the security posture is considered production-ready. These involve a missing callback URL origin check (open redirect risk), absent HTTP security headers (no CSP/HSTS), and no rate limiting on the unauthenticated token exchange endpoint. An additional 4 MEDIUM findings and 3 LOW findings represent defense-in-depth improvements.

**Verdict: REMEDIATE** — 3 HIGH findings must be fixed.

---

## Risk Summary

| Severity | Count | Action Required |
|----------|-------|-----------------|
| CRITICAL | 0     | --              |
| HIGH     | 3     | Fix before deploy |
| MEDIUM   | 4     | Fix in current sprint |
| LOW      | 3     | Document / future work |
| INFO     | 3     | No action needed |

---

## Findings (Prioritized Remediation List)

### HIGH — Must Fix

#### 1. [SEV-001] Open Redirect in OAuth Callback
- **Source**: Static analysis (Heimdall)
- **Location**: `development/frontend/src/app/auth/callback/page.tsx:177`
- **Issue**: `callbackUrl` from `sessionStorage["fenrir:pkce"]` is used in `window.location.href = destination` without origin validation. While currently hard-coded to `"/"`, the pattern is fragile — any future user-supplied `callbackUrl` would be immediately exploitable.
- **Fix**: Add origin allowlist check. Reject any `callbackUrl` whose origin does not match `window.location.origin`. Fall back to `"/"`.

#### 2. [SEV-002] Absence of HTTP Security Headers
- **Source**: Static analysis (Heimdall)
- **Location**: `development/frontend/next.config.ts`
- **Issue**: No Content Security Policy, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, or `Referrer-Policy` headers are configured. With tokens in `localStorage`, CSP is the primary XSS mitigation layer.
- **Fix**: Add `headers()` function to `next.config.ts` with full security header set including CSP that allows Google APIs.

#### 3. [SEV-003] No Rate Limiting on Token Exchange Endpoint
- **Source**: Static analysis (Heimdall)
- **Location**: `development/frontend/src/app/api/auth/token/route.ts`
- **Issue**: The unauthenticated `/api/auth/token` endpoint has no rate limiting. Enables DoS amplification, Vercel function cost exhaustion, and authorization code interception race attacks.
- **Fix**: Add in-memory rate limiting per IP. For a serverless environment, use simple IP-based tracking with a per-IP limit (~10 requests/minute). Full distributed rate limiting (e.g., Upstash) is a future enhancement.

### MEDIUM — Should Fix

#### 4. [SEV-004] Picker API Key — No Cache-Control Header
- **Location**: `development/frontend/src/app/api/config/picker/route.ts:16`
- **Issue**: Response lacks `Cache-Control: no-store`, allowing the API key to persist in browser HTTP cache.
- **Fix**: Add `Cache-Control: no-store` header to the response.

#### 5. [SEV-005] LLM Prompt Injection via CSV Content
- **Location**: `development/frontend/src/lib/sheets/prompt.ts:44`
- **Issue**: User-supplied CSV interpolated directly into LLM prompt with no structural boundary.
- **Fix**: Separate system prompt from user data using Anthropic API's `system` parameter vs `user` message role.

#### 6. [SEV-006] Drive Token Persisted to localStorage
- **Location**: `development/frontend/src/hooks/useDriveToken.ts:52-57`
- **Issue**: Short-lived Drive access token persisted to `localStorage`, expanding XSS blast radius.
- **Fix**: Store in React state (memory) only. Remove `localStorage` persistence.

#### 7. [SEV-007] Google Error Responses Forwarded to Client DOM
- **Location**: `development/frontend/src/app/api/auth/token/route.ts:133-140` and `development/frontend/src/app/auth/callback/page.tsx:133-134`
- **Issue**: Raw Google error body is forwarded to browser and rendered in DOM via `setErrorMessage()`.
- **Fix**: Map known error codes to user-safe messages. Log raw details to console only.

### LOW — Document / Future Work

#### 8. [SEV-008] LLM Singleton Stale Key on Warm Instances
- **Location**: `development/frontend/src/lib/llm/extract.ts:75-105`
- **Action**: Document behavior. Add provider version check to invalidate singleton.

#### 9. [SEV-009] Missing `.env.example` Entries
- **Location**: `development/frontend/.env.example`
- **Action**: Add `FENRIR_OPENAI_API_KEY` and `LLM_PROVIDER` with documentation.

#### 10. [SEV-010] Middleware No-op
- **Location**: `development/frontend/src/middleware.ts`
- **Action**: Defense-in-depth gap. Covered by SEV-002 remediation.

### INFO — No Action Required

#### 11. [SEV-011] OAuth Scopes Correctly Minimal — PASS
#### 12. [SEV-012] `NEXT_PUBLIC_GOOGLE_CLIENT_ID` Naming Convention — Acceptable
#### 13. [SEV-013] `mergeAnonymousCards` Missing Schema Validation — Low Risk

---

## Runtime Inspection Results

The Playwright browser traffic inspection found **zero security issues**:

| Check | Result |
|-------|--------|
| Secrets in network traffic during page load | PASS — None found |
| Secrets in JS bundles (14.8 MB scanned) | PASS — None found |
| Secrets in console output | PASS — None found |
| `GET /api/config/picker` without auth | PASS — 401 returned |
| `POST /api/sheets/import` without auth | PASS — 401 returned |
| `POST /api/auth/token` with invalid body | PASS — Generic error, no secrets |
| Source maps accessible | PASS — 404 |
| `.env` files accessible via web | PASS — 404 |
| `NEXT_PUBLIC_` vars are safe | PASS — Only client ID and analytics path |
| Error responses leak internals | PASS — Generic OAuth 2.0 errors |

---

## Compliance Checklist

| Requirement | Status |
|-------------|--------|
| All API routes call `requireAuth()` (except `/api/auth/token`) | PASS |
| All `process.env` references audited for `NEXT_PUBLIC_` scoping | PASS |
| `.env*` files confirmed gitignored | PASS |
| No secrets in JS bundles or console output | PASS |
| Unauthenticated API calls to protected routes return 401 | PASS |
| Error responses don't leak internal details | PASS (partial — SEV-007) |
| SSRF surface constrained to google.com | PASS |
| PKCE correctly implemented | PASS |
| OAuth scopes are minimal | PASS |
| LLM prompt includes sensitive data filtering | PASS |
| `GOOGLE_CLIENT_SECRET` never in client code | PASS |
| No hardcoded secrets in source | PASS |
| HTTP security headers present | FAIL — SEV-002 |
| Rate limiting on sensitive endpoints | FAIL — SEV-003 |
| Callback URL origin validated | FAIL — SEV-001 |

---

## Remediation Plan for FiremanDecko

Fix the 3 HIGH findings. MEDIUM/LOW/INFO are documented as accepted risk or future work.

1. **SEV-001**: Add `isSafeCallbackUrl()` guard in `auth/callback/page.tsx`
2. **SEV-002**: Add `headers()` to `next.config.ts` with CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
3. **SEV-003**: Add in-memory rate limiting to `/api/auth/token` route

After fixes:
- Run `npx tsc --noEmit`
- Run `npx next build`
- Commit on branch `fix/security-review-remediations`
