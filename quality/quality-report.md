# Quality Report: PR #110 — feat/anon-patreon-client

**Date:** 2026-03-04
**Branch:** `feat/anon-patreon-client` (based on `feat/anon-patreon-server`)
**Engineer:** FiremanDecko
**QA Tester:** Loki

---

## Summary

PR #110 adds the client-side anonymous Patreon subscription flow (Story 2 of 2). It builds on
PR #109's server-side foundation and allows users who have not signed in with Google to subscribe
via Patreon and see their tier status on the settings page.

**Recommendation: HOLD FOR FIX — 1 medium defect (DEF-APC-001) must be resolved before ship.**

---

## Test Execution

| Category | Total | Passed | Failed | Blocked |
|----------|-------|--------|--------|---------|
| New Playwright tests (anon-patreon-client suite) | 34 | 33 | 1 | 0 |
| Updated existing tests (settings-page.spec.ts TC-SP-12) | 1 | 1 | 0 | 0 |
| TypeScript validation (`npx tsc --noEmit`) | — | PASS | — | — |
| Next.js build (`npx next build`) | — | PASS | — | — |
| GH Actions (deploy-preview) | — | PENDING | — | — |

**Total: 35 tests, 34 passed, 1 failed.**

---

## Defects Found

### DEF-APC-001: Duplicate KARL Badge in Header for Anonymous Linked Karl User

- **Severity:** MEDIUM
- **File:** `development/frontend/src/components/entitlement/PatreonSettings.tsx`
- **Lines:** 238–262

**Reproduction steps:**
1. Seed `fenrir:patreon-user-id` and `fenrir:entitlement` (tier=karl, active=true) in localStorage.
2. Navigate to `/settings` as an anonymous (non-authenticated) user.
3. Observe the Patreon section header.

**Expected:** One KARL badge (the anonymous badge, `aria-label="Karl Supporter tier (anonymous)"`).

**Actual:** Two KARL badges render simultaneously — `aria-label="Karl Supporter tier"` (line 241)
AND `aria-label="Karl Supporter tier (anonymous)"` (line 257).

**Root cause:** `isKarlActive` is computed as `isLinked && isActive && tier === "karl"` with no
`isAuthenticated` guard. When an anonymous user has a seeded Karl entitlement, `isKarlActive = true`
and renders the first badge (line 238). The anonymous badge condition (line 255) also evaluates to
true, rendering a second badge.

**Fix:** Add `isAuthenticated &&` to the derived state computations at lines 204–206:

```typescript
// Before:
const isKarlActive = isLinked && isActive && tier === "karl";
const isLinkedThrall = isLinked && !isActive && tier === "thrall";
const isExpired = isLinked && !isActive && tier === "karl";

// After:
const isKarlActive = isAuthenticated && isLinked && isActive && tier === "karl";
const isLinkedThrall = isAuthenticated && isLinked && !isActive && tier === "thrall";
const isExpired = isAuthenticated && isLinked && !isActive && tier === "karl";
```

---

## Code Review: Findings

### Verified Correct

- **`/api/patreon/membership-anon/route.ts`** — Rate limiting (10/min/IP), pid validation
  (400 on missing/empty/whitespace), Cache-Control: no-store, no auth required (intentional),
  correct 200 response shape (`tier`, `active`, `platform`, `checkedAt`), no token/secret
  leakage in responses, method gating (GET only, POST returns 405).

- **`EntitlementContext.tsx` dual-path `linkPatreon()`** — Anonymous path redirects to
  `/api/patreon/authorize` without `id_token`. Authenticated path appends `id_token`. Correct.

- **OAuth callback `?pid=` handling** — `pidParam` read before URL cleaning. `setPatreonUserId(pid)`
  called only on `patreon=linked`. `patreon=denied` and `patreon=error` do NOT save pid. URL
  cleaned via `window.history.replaceState()`. All correct.

- **`refreshEntitlement()` anonymous path** — Reads pid from localStorage, calls
  `/api/patreon/membership-anon`, updates cache and state. Graceful degradation when API
  fails (keeps stale cache). Correct.

- **`migrateAnonymousEntitlement()`** — Guards on `isAuthenticated` and valid token. POSTs
  to `/api/patreon/migrate` with `{ patreonUserId: pid }`. Clears localStorage pid on
  success. Handles `not_found` reason gracefully. Correct.

- **Post-sign-in migration hook** — `useEffect` fires when `isAuthenticated` becomes true
  and stored pid exists. `migrationAttemptedRef` prevents re-triggering. Correct.

- **`settings/page.tsx` AuthGate removal** — `PatreonSettings` rendered directly, no
  `<AuthGate>` wrapper. `PatreonGate` feature gates below it are unaffected. Correct.

### Observations (Non-Blocking)

1. **Rate limiter is in-memory** — Applies per-serverless-instance on Vercel. Documented
   in route file and QA handoff. Not a defect.

2. **Anonymous `unlinkPatreon()` only clears localStorage** — No server-side KV cleanup
   for anonymous users (no auth token available). KV entry expires after 30-day TTL.
   Documented in handoff. Not a defect.

---

## Security Review

| Check | Result |
|-------|--------|
| `/api/patreon/membership-anon` does not leak tokens (access_token, refresh_token) | PASS |
| `/api/patreon/membership-anon` does not leak Google sub | PASS |
| 400 error responses contain only `error`/`error_description` fields | PASS |
| Rate limiting on membership-anon: 10/min/IP | PASS |
| `/api/patreon/authorize` intentionally exempt from requireAuth (anonymous OAuth flow) | PASS — documented exemption |
| Anonymous pid stored in localStorage only (not in cookies or URL) | PASS |
| URL parameters cleaned from browser URL after OAuth callback | PASS |
| No pid saved on `patreon=denied` or `patreon=error` callbacks | PASS |
| CLAUDE.md API Route Auth rule: all other routes unaffected | PASS |

---

## Acceptance Criteria Coverage

| AC | Description | Status |
|----|-------------|--------|
| AC-1 | Anonymous users can see "Subscribe via Patreon" on /settings without signing in | PASS (TC-APC-01–06) |
| AC-2 | `linkPatreon()` works without Google auth — redirects without id_token | PASS (TC-APC-07, 08) |
| AC-3 | After anonymous linking, callback saves pid to localStorage and shows tier + nudge | PASS (TC-APC-09–15) |
| AC-4 | `/api/patreon/membership-anon?pid=X` returns tier for anonymous users | PASS (TC-APC-16–23) |
| AC-5 | Post-sign-in auto-migration: localStorage patreonUserId triggers POST /api/patreon/migrate | CANNOT AUTOMATE — verified by code review |
| AC-6 | Existing authenticated flow unchanged | PASS (TC-APC-24, 25) |
| AC-7 | PatreonSettings renders all 7 states correctly | PARTIAL — State 2 (anon+karl) renders duplicate badge (DEF-APC-001) |

---

## Playwright Tests: 34 new tests written, 33 passing (1 failing — DEF-APC-001)

**Test file:** `quality/test-suites/anon-patreon-client/anon-patreon-client.spec.ts`

| Test ID | Description | Result |
|---------|-------------|--------|
| TC-APC-01 | /settings loads without auth (HTTP 200) | PASS |
| TC-APC-02 | Patreon section visible to anonymous users (no AuthGate) | PASS |
| TC-APC-03 | "Subscribe via Patreon" button visible for anonymous unlinked user | PASS |
| TC-APC-04 | Anonymous unlinked state shows "No sign-in required" description | PASS |
| TC-APC-05 | Authenticated unlinked state shows Patreon section | PASS |
| TC-APC-06 | /settings renders on mobile viewport (375px) with Patreon section | PASS |
| TC-APC-07 | Subscribe button initiates navigation to /api/patreon/authorize | PASS |
| TC-APC-08 | /api/patreon/authorize GET without id_token responds (not 404, not 401) | PASS |
| TC-APC-09 | Patreon section visible with pid in localStorage (anon+linked state) | PASS |
| TC-APC-10 | Anonymous linked state shows "Sign in with Google" nudge link | PASS |
| TC-APC-11 | Anonymous linked state shows "Unlock Cloud Sync" nudge heading | PASS |
| TC-APC-12 | URL query params cleaned after OAuth callback processing | PASS |
| TC-APC-13 | pid saved in localStorage after linked callback with pid param | PASS |
| TC-APC-14 | denied callback does NOT save pid | PASS |
| TC-APC-15 | error callback does NOT save pid | PASS |
| TC-APC-16 | GET without pid returns 400 error: missing_pid | PASS |
| TC-APC-17 | GET with empty pid returns 400 error: missing_pid | PASS |
| TC-APC-18 | GET with whitespace-only pid returns 400 error: missing_pid | PASS |
| TC-APC-19 | GET with valid pid returns 200 with correct shape | PASS |
| TC-APC-20 | GET response has Cache-Control: no-store header | PASS |
| TC-APC-21 | GET response has Content-Type: application/json | PASS |
| TC-APC-22 | POST method returns 405 | PASS |
| TC-APC-23 | Rate limiting returns 429 after 10 requests (best-effort in distributed env) | PASS |
| TC-APC-24 | /api/patreon/membership still requires auth (401 on missing token) | PASS |
| TC-APC-25 | Authenticated unlinked state renders Patreon section | PASS |
| TC-APC-26 | Karl badge appears only once (no duplicate badges) | FAIL — DEF-APC-001 |
| TC-APC-27 | State 1 (anon+unlinked) renders "Subscribe via Patreon" button with aria-label | PASS |
| TC-APC-28 | State 1 (anon+unlinked) description mentions "No sign-in required" | PASS |
| TC-APC-29 | Migration state NOT visible in default state | PASS |
| TC-APC-30 | Sign-in link points to /sign-in (relative, not external) | PASS |
| TC-APC-31 | Sign-in nudge link has min-h-[44px] touch target | PASS |
| TC-APC-32 | 200 response does not include tokens, secrets, or Google sub | PASS |
| TC-APC-33 | 400 response contains only error/error_description fields | PASS |
| TC-APC-34 | /api/patreon/authorize accepts anonymous requests (not 401) | PASS |

**Also updated:** TC-SP-12 in `quality/test-suites/patreon/settings-page.spec.ts` — reversed
assertion from "Patreon section NOT visible" (previous AuthGate behavior) to "Patreon section
IS visible" (post-PR #110 behavior). TC-SP-12 now passes.

---

## Cannot-Automate Paths

| Path | Reason | Manual Test Steps |
|------|--------|-------------------|
| AC-5: Post-sign-in auto-migration | Requires real Google OIDC auth and live Vercel KV | 1. Link Patreon anonymously. 2. Verify pid in localStorage. 3. Sign in with Google. 4. Verify migration spinner appears briefly. 5. Verify pid cleared from localStorage. 6. Verify Karl badge in authenticated state. |
| Anonymous Patreon OAuth end-to-end | Requires real Patreon OAuth consent screen | See QA handoff Flow 1 |

---

## Risk Assessment

| Risk | Severity | Likelihood | Notes |
|------|----------|------------|-------|
| DEF-APC-001: Duplicate KARL badge for anon Karl user | MEDIUM | Certain when anon Karl user visits /settings | One-line fix |
| Rate limiter is per-instance | LOW | Known | Documented in handoff, acceptable |
| Anonymous unlink is client-side only | LOW | By design | KV expires in 30 days |

---

## Recommendation: HOLD FOR FIX

Fix DEF-APC-001 (`isKarlActive` missing `isAuthenticated &&` guard), re-run TC-APC-26, then ship.
The fix is a one-line change. All other acceptance criteria pass. The overall implementation
is well-structured with correct security posture and graceful degradation.
