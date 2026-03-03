# QA Handoff -- Security Review Remediations (SEV-001, SEV-002, SEV-003)

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
