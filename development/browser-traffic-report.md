# Browser Traffic Security Inspection Report

## Test Environment
- **URL**: http://localhost:9653
- **Date**: 2026-03-02
- **Auth state**: Unauthenticated
- **Browser**: Chromium (headless, via Playwright)
- **Next.js mode**: Development

## Findings

**No secrets, API keys, or sensitive data were found leaking through any inspected channel.**

All tests passed. The application demonstrates proper secret hygiene across network traffic, JS bundles, console output, and API error responses.

---

## 1. Unauthenticated Page Load

### Network Requests

No API calls to secret-bearing endpoints were made during unauthenticated page load. All requests were for static assets (HTML, CSS, JS chunks, fonts).

| # | Method | URL | Status |
|---|--------|-----|--------|
| 1 | GET | `http://localhost:9653/` | 200 |
| 2 | GET | `/_next/static/media/4e3d37bae4c63e50-s.p.woff2` | 200 |
| 3 | GET | `/_next/static/media/558ca1a6aa3cb55e-s.p.woff2` | 200 |
| 4 | GET | `/_next/static/media/97ac91773d3121b2-s.p.woff2` | 200 |
| 5 | GET | `/_next/static/media/a273567b21a7c318-s.p.woff2` | 200 |
| 6 | GET | `/_next/static/media/d7415d89107c7d21-s.p.woff2` | 200 |
| 7 | GET | `/_next/static/media/ff113fc7f46481dd-s.p.woff2` | 200 |
| 8 | GET | `/_next/static/css/app/layout.css` | 200 |
| 9 | GET | `/_next/static/chunks/webpack.js` | 200 |
| 10 | GET | `/_next/static/chunks/main-app.js` | 200 |
| 11 | GET | `/_next/static/chunks/app-pages-internals.js` | 200 |
| 12 | GET | `/_next/static/chunks/app/layout.js` | 200 |
| 13 | GET | `/_next/static/chunks/app/page.js` | 200 |
| 14 | GET | `https://va.vercel-scripts.com/v1/script.debug.js` | 200 |

**Result**: PASS -- No secret-bearing requests during page load.

### Console Messages

12 console messages were captured. All are benign:

- React DevTools development suggestion
- ConsoleSignature easter egg (ASCII art + Norse flavor text)
- FenrirLedger schema migration info log
- Vercel Web Analytics debug messages (development mode, no actual requests sent)

**Secret patterns searched**: `GOOGLE_CLIENT_SECRET`, `FENRIR_ANTHROPIC_API_KEY`, `ANTHROPIC_API_KEY`, `FENRIR_OPENAI_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_PICKER_API_KEY`, `sk-`, `AIza`, `goog_`, `ya29.`

**Result**: PASS -- No secrets or sensitive data in console output.

### Screenshots

- Homepage: `development/security-audit-homepage.png`
- Cards/new page: `development/security-audit-cards-new.png`

---

## 2. Protected API Routes -- Unauthenticated Access

### API Route Auth Tests

| Route | Method | Auth | Expected | Actual Status | Response Body | Result |
|-------|--------|------|----------|---------------|---------------|--------|
| `/api/config/picker` | GET | None | 401 | 401 | `{"error":"missing_token","error_description":"Authorization: Bearer <id_token> header is required."}` | PASS |
| `/api/sheets/import` | POST | None | 401 | 401 | `{"error":"missing_token","error_description":"Authorization: Bearer <id_token> header is required."}` | PASS |
| `/api/auth/token` | POST | None (incomplete body) | 400 | 400 | `{"error":"invalid_request","error_description":"Missing required fields: code, code_verifier, redirect_uri."}` | PASS |
| `/api/auth/token` | POST | None (complete invalid body) | 400 | 400 | `{"error":"invalid_grant","error_description":"Malformed auth code."}` | PASS |
| `/api/config/picker` | GET | Invalid Bearer token | 401 | 401 | `{"error":"invalid_token","error_description":"Invalid token."}` | PASS |
| `/api/sheets/import` | POST | Invalid Bearer token | 401 | 401 | `{"error":"invalid_token","error_description":"Invalid token."}` | PASS |

**Key observations**:
- All protected routes correctly return 401 without auth
- The `/api/auth/token` route (exempt from Bearer auth per ADR-008) correctly validates required fields and returns 400 for invalid inputs
- No response body contains `GOOGLE_CLIENT_SECRET`, stack traces, file paths, or internal error details
- Error messages are generic and follow OAuth 2.0 error response conventions

---

## 3. Error Response Analysis

| Check | Result |
|-------|--------|
| Stack traces in error responses | None found |
| File paths (e.g., `/src/lib/...`) in error responses | None found |
| Internal error details | None found |
| `GOOGLE_CLIENT_SECRET` in any response | Not found |
| `FENRIR_ANTHROPIC_API_KEY` in any response | Not found |
| `client_secret` in any response | Not found |

**404 page**: Returns standard Next.js 404 page. Contains no file paths, stack traces, or sensitive information. Title reads "404: This page could not be found."

**Result**: PASS -- All error messages are generic and safe for public exposure.

---

## 4. JS Bundle Analysis

Five JavaScript bundles were downloaded and scanned (total ~14.8 MB in dev mode):

| Bundle | Size | Secrets Found |
|--------|------|---------------|
| `webpack.js` | 56 KB | None |
| `main-app.js` | 6.4 MB | None |
| `app-pages-internals.js` | 331 KB | None |
| `app/layout.js` | 3.9 MB | None |
| `app/page.js` | 4.2 MB | None |

### Patterns Searched

| Pattern | Matches | Context |
|---------|---------|---------|
| `GOOGLE_CLIENT_SECRET` | 0 | -- |
| `FENRIR_ANTHROPIC_API_KEY` | 0 | -- |
| `ANTHROPIC_API_KEY` | 0 | -- |
| `FENRIR_OPENAI_API_KEY` | 0 | -- |
| `OPENAI_API_KEY` | 0 | -- |
| `client_secret` | 0 | -- |
| `sk-ant-*` (Anthropic key pattern) | 0 | -- |
| `sk-proj-*` (OpenAI key pattern) | 0 | -- |
| `AIzaSy*` (Google API key pattern) | 0 | -- |
| `ya29.*` (Google access token pattern) | 0 | -- |
| `goog_*` (Google token pattern) | 0 | -- |
| Hardcoded Bearer tokens | 0 | -- |
| `process.env.*SECRET` | 0 | -- |
| `process.env.*KEY` | 0 | -- |
| `process.env.*TOKEN` | 0 | -- |

### NEXT_PUBLIC_ Environment Variables in Bundles

| Variable | Assessment |
|----------|------------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Safe. Public OAuth client ID, used for client-side GIS consent flow. Not a secret. |
| `NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH` | Safe. Standard Vercel analytics configuration path. Not a secret. |

### Notable Reference (Non-Issue)

`GOOGLE_PICKER_API_KEY` appears once in `page.js` as a JSDoc comment inside the `openPicker()` function: `@param apiKey - Google API key (GOOGLE_PICKER_API_KEY, served via /api/config/picker)`. This is documentation only -- no actual key value is present. The Picker API key is correctly served only via the auth-gated `/api/config/picker` endpoint.

**Result**: PASS -- No secrets or sensitive values in any JavaScript bundle.

---

## 5. Navigation Check

### /cards/new Route

- Page loads successfully at `http://localhost:9653/cards/new`
- No API requests were made during navigation (only static JS/CSS assets)
- URL contains no query parameters or hash fragments: `search: ""`, `hash: ""`
- No credentials appear in URL parameters
- Console output: Only React DevTools suggestion and Vercel Analytics debug messages
- No auth tokens sent in unauthenticated state

**Result**: PASS -- No credentials leaked through navigation.

---

## 6. Additional Security Checks

| Check | Result |
|-------|--------|
| Source maps accessible (`page.js.map`) | 404 -- Not publicly accessible |
| `.env` accessible via web | 404 -- Not served |
| `.env.local` accessible via web | 404 -- Not served |
| Non-existent API route (`/api/nonexistent`) | 404 -- Standard Next.js 404 page, no info disclosure |

**Result**: PASS -- No additional information disclosure vectors found.

---

## Console Message Analysis

### Homepage Console (12 messages, 0 errors, 0 warnings)

All messages are expected development-mode output:

1. React DevTools suggestion (standard Next.js dev)
2. ConsoleSignature ASCII art easter egg (intentional, Norse-themed)
3. ConsoleSignature rune labels (intentional)
4. ConsoleSignature flavor text lines (intentional)
5. FenrirLedger schema migration v0 to v1 (expected on first load)
6. Vercel Web Analytics debug messages (dev mode, no requests sent to server)

### /cards/new Console (4 messages, 0 errors, 0 warnings)

1. React DevTools suggestion
2. Vercel Web Analytics debug messages (3x)

**No secrets, tokens, stack traces, or internal paths in any console message.**

---

## Screenshots

| File | Description |
|------|-------------|
| `development/security-audit-homepage.png` | Homepage in unauthenticated state |
| `development/security-audit-cards-new.png` | Card creation form in unauthenticated state |

---

## Conclusion

**Overall assessment: PASS -- No security issues found.**

The Fenrir Ledger frontend demonstrates strong secret hygiene:

1. **Server-side secrets stay server-side.** `GOOGLE_CLIENT_SECRET`, `FENRIR_ANTHROPIC_API_KEY`, `FENRIR_OPENAI_API_KEY`, and `GOOGLE_PICKER_API_KEY` are never present in client-side JavaScript bundles, HTML, CSS, or console output.

2. **API routes enforce authentication.** All protected routes (`/api/config/picker`, `/api/sheets/import`) correctly return 401 for unauthenticated requests. The `/api/auth/token` endpoint (the only auth-exempt route per ADR-008) validates input and returns generic error messages.

3. **Error responses are safe for public exposure.** No stack traces, file paths, or internal error details are leaked in any error response. Error messages follow OAuth 2.0 conventions (`missing_token`, `invalid_token`, `invalid_grant`).

4. **No secret patterns in JS bundles.** A thorough scan of all 14.8 MB of JavaScript bundles found zero matches for any secret pattern (API keys, tokens, client secrets, bearer tokens).

5. **Source maps and env files are not publicly accessible.** Both return 404.

6. **Only safe NEXT_PUBLIC_ variables are exposed.** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (public OAuth client ID) is the only public env var and is not a secret. (**Note:** `@vercel/analytics` was removed in issue #748; `NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH` is no longer present.)
