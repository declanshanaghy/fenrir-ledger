# QA Handoff — Security Review Remediations (SEV-001, SEV-002, SEV-003)

**Date:** 2026-03-02
**Author:** FiremanDecko (Principal Engineer)
**Branch:** `fix/security-review-remediations`
**Source:** `development/security-review-report.md` (consolidated findings from Heimdall + Playwright-Bowser)

---

## What Was Implemented

Three HIGH severity findings from the security review were remediated. No new dependencies were added. No existing functionality was changed.

### SEV-001: Open Redirect in OAuth Callback

**File modified:** `development/frontend/src/app/auth/callback/page.tsx`

**Change:** Added `isSafeCallbackUrl()` function that validates the callback URL's origin matches `window.location.origin` before redirecting. If the URL fails validation (e.g. points to an external domain), the redirect falls back to `"/"`.

**What to test:**
- Normal sign-in flow still redirects to `/` after authentication
- If `sessionStorage["fenrir:pkce"]` were to contain a `callbackUrl` of `https://evil.com`, the redirect should go to `/` instead
- Relative paths like `/valhalla` should still work as callback URLs

### SEV-002: HTTP Security Headers

**File modified:** `development/frontend/next.config.ts`

**Change:** Added `async headers()` function that applies security headers to all routes:
- `Content-Security-Policy` -- restricts script sources, connect sources, frame sources, etc. Allows Google APIs, Vercel analytics, Anthropic/OpenAI for LLM extraction
- `X-Frame-Options: DENY` -- prevents clickjacking
- `X-Content-Type-Options: nosniff` -- prevents MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

**What to test:**
- Verify headers appear in network responses (any route)
- Google OAuth sign-in still works (accounts.google.com must be allowed in CSP)
- Google Picker still opens and functions (docs.google.com, drive.google.com in frame-src)
- Google profile images still load (lh3.googleusercontent.com in img-src)
- Vercel analytics still loads (va.vercel-scripts.com in script-src and connect-src)
- LLM import (Anthropic) still works (api.anthropic.com in connect-src)
- No CSP violation errors in browser console during normal usage

### SEV-003: Rate Limiting on Token Exchange Endpoint

**Files created/modified:**
- `development/frontend/src/lib/rate-limit.ts` (NEW) -- in-memory rate limiter utility
- `development/frontend/src/app/api/auth/token/route.ts` (MODIFIED) -- applied rate limiting at top of POST handler

**Change:** The `/api/auth/token` endpoint now enforces 10 requests per minute per IP address. Excess requests receive HTTP 429 with `{ error: "rate_limited" }`. The rate limiter uses an in-memory Map (per serverless instance), so it provides per-instance protection only. Distributed rate limiting (e.g. Upstash Redis) is documented as a future enhancement.

**What to test:**
- Normal sign-in flow succeeds (well under 10 requests/minute)
- Sending 11+ POST requests to `/api/auth/token` within 60 seconds from the same IP returns 429 on the 11th request
- After 60 seconds, requests are accepted again
- The 429 response body contains `{ "error": "rate_limited", "error_description": "Too many requests. Try again later." }`

---

## Build Verification

- `npx tsc --noEmit` -- PASS (zero errors)
- `npx next build` -- PASS (all routes compile, no warnings except pre-existing PickerStep useCallback lint warning)

---

## Files Changed Summary

| File | Change Type | SEV |
|------|-------------|-----|
| `development/frontend/src/app/auth/callback/page.tsx` | Modified | SEV-001 |
| `development/frontend/next.config.ts` | Modified | SEV-002 |
| `development/frontend/src/lib/rate-limit.ts` | New | SEV-003 |
| `development/frontend/src/app/api/auth/token/route.ts` | Modified | SEV-003 |
| `development/qa-handoff.md` | Replaced | -- |

---

## Known Limitations

- Rate limiting is per-serverless-instance (in-memory Map). On Vercel with multiple function instances, each instance tracks independently. A determined attacker could bypass by hitting different instances. Distributed rate limiting via Upstash Redis is a future enhancement.
- CSP uses `'unsafe-inline'` for scripts and styles, which is required by Next.js and Tailwind respectively. This reduces CSP's XSS protection compared to nonce-based CSP but is the standard approach for Next.js applications.
- MEDIUM/LOW/INFO findings from the security review are not addressed in this PR. They are documented as accepted risk or future work in the security review report.

---

## Suggested Test Focus

1. **Full sign-in flow** -- The OAuth callback and token exchange are the most impacted paths. Verify end-to-end sign-in still works.
2. **CSP header validation** -- Check browser console for CSP violations during normal usage (dashboard, card CRUD, import wizard, sign-in/sign-out).
3. **Rate limit boundary** -- Script 11 rapid requests to `/api/auth/token` and verify the 11th is rejected with 429.
4. **Google Picker** -- Verify the Picker iframe still loads (frame-src must allow Google domains).

---

---

# Loki QA Verdict — Security Review Remediations

**Date:** 2026-03-02
**Validator:** Loki (QA Tester)
**Branch:** `fix/security-review-remediations`

## Verdict: FIX REQUIRED

---

## Validation Results

### SEV-001: Open Redirect Guard
- [x] `isSafeCallbackUrl()` exists and validates origin
- [x] Redirect uses guard with `"/"` fallback
- [x] Edge cases handled

**Analysis:** Implementation is correct. `isSafeCallbackUrl()` at line 68 of `src/app/auth/callback/page.tsx` correctly:
- Short-circuits on empty string or `"/"` (returns `true`)
- Uses `new URL(url, window.location.origin)` to normalize both relative and absolute URLs
- Compares `parsed.origin === window.location.origin`
- Returns `false` in the catch block for malformed URLs

Verified edge cases via Node.js:
- `""` → SAFE (short-circuit)
- `"/"` → SAFE (short-circuit)
- `"/valhalla"` → SAFE (relative path, same origin)
- `"https://evil.com"` → BLOCKED
- `"javascript:alert(1)"` → BLOCKED (origin is `null`)
- `"//evil.com"` → BLOCKED
- `"data:text/html,..."` → BLOCKED
- `"http://localhost:9653"` → SAFE
- `"http://localhost:9653/dashboard"` → SAFE

Redirect at line 194-197 correctly uses the guard with `"/"` fallback. **SEV-001 fix is correct.**

---

### SEV-002: HTTP Security Headers
- [x] `headers()` function in next.config.ts
- [x] All 6 security headers present
- [x] CSP allows required Google domains
- [x] CSP includes 'unsafe-inline' for scripts
- [ ] **DEFECT: CSP blocks `'unsafe-eval'` — breaks Next.js dev server**

**Analysis:** The `headers()` function at line 91 of `next.config.ts` is implemented and applies security headers to all routes (`source: "/(.*)"` pattern). All 6 required headers are present and verified served from the live dev server:

```
Content-Security-Policy: [full CSP string]
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

CSP correctly includes all required Google domains in `connect-src`:
`accounts.google.com`, `oauth2.googleapis.com`, `www.googleapis.com`, `sheets.googleapis.com`, `docs.google.com`, `apis.google.com`

Google frame sources (`docs.google.com`, `drive.google.com`) and script sources (`accounts.google.com`, `apis.google.com`) are present.

**DEFECT FOUND — DEF-SEC-001:** The `script-src` directive does not include `'unsafe-eval'`. Next.js development mode requires `'unsafe-eval'` for React Fast Refresh / Hot Module Replacement (HMR). The omission causes the following CSP violation in the dev server browser console:

```
EvalError: Evaluating a string as JavaScript violates the following Content Security
Policy directive because 'unsafe-eval' is not an allowed source of script:
script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com
https://va.vercel-scripts.com
  at next/dist/compiled/@next/react-refresh-utils/dist/runtime.js
```

**Impact:** React components fail to hydrate in development mode. The add-card form, edit-card form, card action buttons, and all interactive components do not render. The Playwright test suite (which runs against the dev server) fails massively — 57 of 66 completed tests failed at time of measurement. This is a direct regression from main (where 0 of 216 tests failed).

**Correct fix:** Detect `NODE_ENV` in `next.config.ts` and add `'unsafe-eval'` to `script-src` only in development:

```typescript
const isDev = process.env.NODE_ENV === 'development';
const scriptSrc = isDev
  ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com ...`
  : `script-src 'self' 'unsafe-inline' https://accounts.google.com ...`;
```

Note: The production CSP (without `'unsafe-eval'`) is correct. This defect only manifests in dev mode. Production deployments would not be affected by this specific issue, but the test suite cannot validate them without fixing it.

---

### SEV-003: Rate Limiting
- [x] rate-limit.ts implements in-memory limiter
- [x] Token route checks rate limit before body parsing
- [x] 429 response on rate exceed

**Analysis:** `src/lib/rate-limit.ts` implements a clean in-memory rate limiter using a `Map<string, RateLimitEntry>`. Logic is correct:
- Window resets correctly (`now >= entry.resetAt`)
- Count increments before the limit check (off-by-one verified correct: requests 1-10 pass, request 11 fails)
- Returns `{ success: boolean, remaining: number }`

In `src/app/api/auth/token/route.ts`, the rate limit check is at the TOP of the POST handler (lines 63-75), before `request.json()` is called (line 80). IP extraction uses `x-forwarded-for` header, split on comma, trimmed (handles proxy chains). Falls back to `"unknown"` for direct connections.

**Live test results — 11 rapid requests to `POST /api/auth/token`:**
- Requests 1-10: HTTP 400 (`invalid_grant` from Google — expected, invalid test codes)
- Request 11: HTTP 429 `{"error":"rate_limited","error_description":"Too many requests. Try again later."}`

Rate limiting fires exactly on the 11th request as specified. **SEV-003 fix is correct.**

---

### Build Verification
- [x] `tsc --noEmit` passes — zero errors
- [x] `next build` passes — all 12 routes compiled, 1 pre-existing ESLint warning (PickerStep useCallback)

---

### Runtime Verification
- [x] Security headers served in HTTP responses — all 6 headers confirmed present via `curl -I http://localhost:9653`
- [x] Rate limiting works — 11th request returns HTTP 429 with correct body
- [ ] **Dev server runtime broken** — CSP `EvalError` prevents React hydration in dev mode

---

### Playwright Tests
- [ ] Tests FAIL — 57 failures (of 66 completed at measurement) due to CSP `'unsafe-eval'` regression

**Pre-existing issue also found:** `development/frontend/tsconfig.playwright.json` still references `../../quality/scripts/**/*.spec.ts` (deleted in PR #80). The correct path is `../../quality/test-suites/**/*.ts`. This is a pre-existing regression from PR #80, not introduced by this branch. A `quality/node_modules/@playwright` symlink was created as a workaround to resolve module resolution, but the tsconfig stale path remains and should be fixed.

---

## Defects Found

### DEF-SEC-001 [HIGH] — CSP Missing `'unsafe-eval'` Breaks Dev Server and Playwright Suite

- **File:** `development/frontend/next.config.ts`
- **Expected:** Next.js dev mode functions correctly — React components hydrate, form fields render, interactive elements are accessible
- **Actual:** CSP violation `EvalError` at `react-refresh-utils/dist/runtime.js` — React Fast Refresh cannot eval() — components fail to mount — form fields, buttons, and all interactive elements absent in DOM
- **Impact:** Playwright test suite regresses from 216/0 failures (on main) to ~57+ failures on this branch. Dev server is non-functional for interactive testing.
- **Fix:** Add `'unsafe-eval'` to `script-src` when `NODE_ENV === 'development'`. Production CSP (without it) is correct and should not change.

### DEF-SEC-002 [LOW] — `tsconfig.playwright.json` Path Stale (Pre-existing from PR #80)

- **File:** `development/frontend/tsconfig.playwright.json`
- **Expected:** `"include": ["../../quality/test-suites/**/*.ts"]`
- **Actual:** `"include": ["../../quality/scripts/**/*.spec.ts"]` (path deleted in PR #80)
- **Impact:** Playwright's TypeScript transform cannot resolve `@playwright/test` when specs are loaded from `quality/test-suites/`. Workaround applied (symlink), but the root cause should be fixed in the tsconfig.
- **Note:** This is pre-existing from PR #80 and not introduced by this branch.

---

## Notes

- SEV-001 and SEV-003 are fully correct implementations. No issues found.
- SEV-002 headers are all present and correctly configured for production. The sole defect is dev-mode `'unsafe-eval'` omission.
- The production security posture is stronger than before — all 6 required headers are served. The DEF-SEC-001 fix is a one-line conditional and does not require any security trade-offs (production CSP stays strict).
- After DEF-SEC-001 is fixed, this branch should ship. The security improvements are real and material.
