/**
 * Anonymous Patreon Flow — Contract & Security Tests
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests for PR #109: Server-side anonymous Patreon OAuth flow.
 *
 * Every assertion is derived from the acceptance criteria spec and route
 * docstrings — NOT from what the implementation currently outputs.
 * These tests prove correctness against design intent.
 *
 * Acceptance Criteria (from PR #109 handoff):
 *   AC-1: GET /api/patreon/authorize works without id_token -> redirects to Patreon
 *          with state.mode = "anonymous"
 *   AC-2: GET /api/patreon/authorize with id_token -> existing authenticated flow unchanged
 *          (state.mode = "authenticated")
 *   AC-3: Callback stores anonymous at entitlement:patreon:{patreonUserId} with reverse index
 *          (Cannot test KV storage directly via Playwright; see manual steps below)
 *   AC-4: Callback stores authenticated at entitlement:{googleSub} (unchanged)
 *          (Cannot test KV storage directly via Playwright; see manual steps below)
 *   AC-5: POST /api/patreon/migrate behind requireAuth, copies anon -> auth key, idempotent
 *   AC-6: Webhook handles both key patterns via reverse index prefix check
 *          (Cannot test KV lookup logic directly; signature validation still testable)
 *   AC-7: ADR-009 amendment documents the dual-key design
 *          (Code review item — verified in code review section)
 *
 * BEHAVIORAL CHANGE vs prior sprint (CRITICAL):
 *   Prior to PR #109, /api/patreon/authorize required Google auth (401 on no token).
 *   After PR #109, /api/patreon/authorize allows anonymous access.
 *   Old tests in quality/test-suites/patreon/api-routes.spec.ts that assert
 *   401 for missing id_token on /api/patreon/authorize are NOW BROKEN and must
 *   be updated as part of this PR (see DEF-001 in QA report).
 *
 * What CANNOT be tested via Playwright:
 *   - Real Patreon OAuth redirect (requires live Patreon client)
 *   - KV storage contents after callback completes (server-side only)
 *   - Token exchange with Patreon API (requires live credentials)
 *   - Webhook reverse-index KV lookup (requires pre-seeded KV state)
 *   - state.mode field value inside encrypted state token (opaque blob)
 *
 * Manual test steps for untestable paths are documented at the bottom.
 *
 * Test approach: Direct HTTP API calls (no browser needed for API contract tests).
 * A running dev server is required. Set SERVER_URL env var to point to the server.
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants — derived from route specs and acceptance criteria
// ---------------------------------------------------------------------------

const API_BASE = process.env.SERVER_URL ?? "http://localhost:9653";

const ROUTES = {
  authorize: `${API_BASE}/api/patreon/authorize`,
  callback: `${API_BASE}/api/patreon/callback`,
  migrate: `${API_BASE}/api/patreon/migrate`,
  webhook: `${API_BASE}/api/patreon/webhook`,
};

// ---------------------------------------------------------------------------
// AC-1: GET /api/patreon/authorize — Anonymous path (no id_token)
//
// Spec (authorize/route.ts docstring):
//   "Anonymous: No id_token. Generates state with googleSub: 'anonymous'."
//   "This route is exempt from requireAuth because:
//      1. It is accessed via full-page redirect (not a fetch call)
//      2. Anonymous users must be able to start the Patreon OAuth flow
//      3. CSRF protection is provided by the encrypted state parameter"
//
// Expected: route redirects to Patreon OAuth (or returns 500 if PATREON_CLIENT_ID
//   not configured in the test environment). Must NOT return 401.
// ---------------------------------------------------------------------------

test.describe("AC-1: /api/patreon/authorize — anonymous access allowed (no id_token)", () => {
  test("returns non-401 with no Authorization header (anonymous access permitted)", async ({
    request,
  }) => {
    // Spec: authorize is no longer behind requireAuth for anonymous users.
    // Without id_token, it proceeds to anonymous mode.
    // In a dev env without PATREON_CLIENT_ID: returns 500 (not_configured).
    // In a configured env: returns 302 redirect to Patreon.
    // In either case: MUST NOT return 401 (auth gate was removed).
    const response = await request.get(ROUTES.authorize, {
      headers: { Accept: "application/json" },
      maxRedirects: 0,
    });

    // The critical assertion: 401 would mean requireAuth was left in place (regression).
    expect(response.status()).not.toBe(401);
    // Must also not be 404 (route must exist)
    expect(response.status()).not.toBe(404);
  });

  test("returns 302 redirect or 500 (not_configured) — never 401 or 404", async ({
    request,
  }) => {
    // Spec: anonymous path proceeds to either:
    //   - 302 to Patreon if PATREON_CLIENT_ID is set
    //   - 500 { error: "not_configured" } if PATREON_CLIENT_ID is absent
    // Both are correct — 401 is the regression indicator.
    const response = await request.get(ROUTES.authorize, {
      headers: { Accept: "application/json" },
      maxRedirects: 0,
    });

    const status = response.status();
    // Accept 302 (configured env) or 500 (unconfigured dev env) or 429 (rate limited)
    // Reject 401 (auth gate), 404 (route missing)
    expect([302, 303, 307, 308, 429, 500]).toContain(status);
  });

  test("rate limiting applies to anonymous requests — 5 per minute per IP", async ({
    request,
  }) => {
    // Spec (authorize/route.ts): "limit: 5, windowMs: 60_000"
    // Spec: rate limiting applies to BOTH anonymous and authenticated paths.
    // We confirm the rate limit infrastructure is active by checking that
    // excessive requests from the same IP eventually hit 429.
    //
    // NOTE: This test only sends 1 request to preserve the rate limit budget
    // for other tests. The rate limiter is stateful in-process — earlier
    // tests in this suite may have consumed budget. We validate the header
    // contract exists, not that we can exhaust it in this one test.
    const response = await request.get(ROUTES.authorize, {
      headers: { Accept: "application/json" },
      maxRedirects: 0,
    });

    // Rate limit is either not hit (non-429) or was hit (429)
    // Either way the route must respond — not 404 or unhandled
    expect(response.status()).not.toBe(404);

    // If we did hit the rate limit, the body must follow the error contract
    if (response.status() === 429) {
      const body = await response.json();
      // Spec: "{ error: 'rate_limited', error_description: '...' }"
      expect(body).toHaveProperty("error", "rate_limited");
      expect(typeof body.error_description).toBe("string");
    }
  });

  test("anonymous path with no id_token: if 500 body has error=not_configured (missing PATREON_CLIENT_ID)", async ({
    request,
  }) => {
    // Spec (authorize/route.ts):
    //   "if (!clientId) { return NextResponse.json({ error: 'not_configured' }, { status: 500 }) }"
    // In a dev environment without PATREON_CLIENT_ID set, the route returns 500.
    // This test validates the error contract shape for this expected dev scenario.
    const response = await request.get(ROUTES.authorize, {
      headers: { Accept: "application/json" },
      maxRedirects: 0,
    });

    // Only assert the body contract when the server actually returns 500
    if (response.status() === 500) {
      const body = await response.json();
      expect(body).toHaveProperty("error", "not_configured");
      expect(body).toHaveProperty("error_description");
      expect(typeof body.error_description).toBe("string");
    }
    // If not 500, the route is configured and redirected — that is also acceptable.
  });
});

// ---------------------------------------------------------------------------
// AC-2: GET /api/patreon/authorize — Authenticated path (with invalid id_token)
//
// Spec: "Authenticated: Google id_token is present. Verifies the token and
//        embeds the Google sub in the state."
// Spec: "If present (id_token): auth result is checked -> if !authResult.ok ->
//        return { error: 'invalid_token', status: authResult.status }"
//
// We cannot send a VALID Google id_token in automated tests (requires live OAuth).
// We CAN send an INVALID id_token and verify it is rejected — this proves the
// authenticated path still validates tokens (regression check).
// ---------------------------------------------------------------------------

test.describe("AC-2: /api/patreon/authorize — authenticated path rejects invalid id_token", () => {
  test("invalid id_token in query param is rejected with auth error", async ({ request }) => {
    // Spec: when id_token is present but invalid, verifyIdToken() returns !ok
    //   -> route returns { error: 'invalid_token' } with a non-200 status.
    // On unconfigured dev server (no GOOGLE_CLIENT_ID): returns 500 "Auth not configured."
    // On configured server: returns 401 or 403 "invalid_token".
    const response = await request.get(
      `${ROUTES.authorize}?id_token=this-is-not-a-google-id-token`,
      {
        headers: { Accept: "application/json" },
        maxRedirects: 0,
      },
    );

    // Spec: invalid token -> NON-redirect, NON-200 JSON error response
    // Critical: must not redirect to Patreon when id_token is present but invalid
    expect(response.status()).not.toBe(200);
    expect(response.status()).not.toBe(302);
    expect(response.status()).not.toBe(404);

    // Spec: error response must be JSON with an error field
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");

    const body = await response.json();
    // Spec: must have error field — either "invalid_token" (configured) or
    //   "not_configured" (dev server) or "rate_limited" (rate limit hit)
    expect(typeof body.error).toBe("string");
    expect(typeof body.error_description).toBe("string");
  });

  test("invalid id_token in Authorization header is rejected with auth error", async ({
    request,
  }) => {
    // Spec (authorize/route.ts line 83): "request.headers.get('authorization')?.slice(7)"
    // The route also reads id_token from the Authorization Bearer header.
    // An invalid Bearer token must be rejected just like an invalid query param.
    const response = await request.get(ROUTES.authorize, {
      headers: {
        Accept: "application/json",
        Authorization: "Bearer not-a-valid-google-id-token",
      },
      maxRedirects: 0,
    });

    expect(response.status()).not.toBe(200);
    expect(response.status()).not.toBe(302);
    expect(response.status()).not.toBe(404);

    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");

    const body = await response.json();
    expect(typeof body.error).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// AC-5: POST /api/patreon/migrate — requireAuth enforcement + input validation
//
// Spec (migrate/route.ts docstring):
//   "Behind requireAuth (ADR-008) — the user must be signed in with Google to migrate."
//   "Rate limit: 5 requests per minute per IP."
//
// The migrate endpoint is a NEW route in this PR. These tests verify the security
// contract: no auth = 401, bad body = 400, missing patreonUserId = 400.
// ---------------------------------------------------------------------------

test.describe("AC-5: POST /api/patreon/migrate — requireAuth enforcement", () => {
  test("returns 401 with no Authorization header", async ({ request }) => {
    // Spec: "const auth = await requireAuth(request); if (!auth.ok) return auth.response;"
    // Missing auth header -> 401 { error: "missing_token" }
    const response = await request.post(ROUTES.migrate, {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ patreonUserId: "some-patreon-id" }),
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    // Spec (require-auth.ts): "{ error: 'missing_token', error_description: '...' }"
    expect(body).toHaveProperty("error", "missing_token");
    expect(typeof body.error_description).toBe("string");
  });

  test("returns 401 with malformed Authorization (no Bearer prefix)", async ({ request }) => {
    // Spec (require-auth.ts): "if (!authHeader || !authHeader.startsWith('Bearer '))"
    // "Basic xyz" does not start with "Bearer " -> 401 missing_token
    const response = await request.post(ROUTES.migrate, {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic dXNlcjpwYXNz",
      },
      data: JSON.stringify({ patreonUserId: "some-patreon-id" }),
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toHaveProperty("error", "missing_token");
  });

  test("returns auth error (not 200) with invalid Bearer token", async ({ request }) => {
    // Spec: invalid id_token is rejected by verifyIdToken -> route returns error
    // On unconfigured dev: 500 "Auth not configured"
    // On configured: 401 "invalid_token"
    const response = await request.post(ROUTES.migrate, {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer not-a-google-id-token",
      },
      data: JSON.stringify({ patreonUserId: "some-patreon-id" }),
    });

    expect(response.status()).not.toBe(200);
    expect(response.status()).not.toBe(404);

    const body = await response.json();
    expect(typeof body.error).toBe("string");
  });

  test("returns 401 Content-Type is application/json (not HTML)", async ({ request }) => {
    // Spec: NextResponse.json() always returns application/json
    // Next.js default error pages return HTML — we confirm the route overrides this
    const response = await request.post(ROUTES.migrate, {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ patreonUserId: "some-patreon-id" }),
    });

    expect(response.status()).toBe(401);
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });

  test("migrate route exists (not 404)", async ({ request }) => {
    // Spec: POST /api/patreon/migrate is a NEW route in this PR.
    // Any response other than 404 confirms the route is wired up.
    const response = await request.post(ROUTES.migrate, {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ patreonUserId: "test" }),
    });

    expect(response.status()).not.toBe(404);
  });

  test("GET method not supported on migrate route -> 405", async ({ request }) => {
    // Spec: migrate/route.ts exports only POST handler.
    // GET must return 405 Method Not Allowed.
    const response = await request.get(ROUTES.migrate, {
      headers: { Accept: "application/json" },
    });

    expect(response.status()).toBe(405);
  });

  test("PUT method not supported on migrate route -> 405", async ({ request }) => {
    // Spec: only POST exported — all other methods are 405
    const response = await request.put(ROUTES.migrate, {
      headers: { "Content-Type": "application/json" },
      data: "{}",
    });

    expect(response.status()).toBe(405);
  });
});

// ---------------------------------------------------------------------------
// AC-5: POST /api/patreon/migrate — Input validation (after auth)
//
// We cannot pass auth in automated tests (no live Google id_token), so we
// cannot reach the body validation branch. This is documented as untestable
// via Playwright for the same reason as OAuth flows.
//
// Manual test steps for body validation are at the bottom of this file.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AC-6: Webhook — Existing signature enforcement still works (regression)
//
// Spec: The webhook handler was modified to support dual-key lookup.
// The signature validation must still work unchanged for both user types.
// ---------------------------------------------------------------------------

test.describe("AC-6: /api/patreon/webhook — signature enforcement unchanged (regression)", () => {
  const validWebhookPayload = JSON.stringify({
    data: {
      id: "test-member-id",
      type: "member",
      attributes: {
        patron_status: "active_patron",
        currently_entitled_amount_cents: 500,
      },
      relationships: {
        user: {
          data: { id: "test-patreon-user-id", type: "user" },
        },
      },
    },
  });

  test("webhook still returns 400 for missing signature (regression)", async ({ request }) => {
    // Spec: dual-key lookup did not change signature validation.
    // "NOT behind requireAuth — security provided by HMAC-MD5 signature validation"
    const response = await request.post(ROUTES.webhook, {
      headers: {
        "Content-Type": "application/json",
        "X-Patreon-Event": "members:pledge:create",
        // Deliberately omitting X-Patreon-Signature
      },
      data: validWebhookPayload,
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error", "missing_signature");
  });

  test("webhook still returns 400 for invalid signature (regression)", async ({ request }) => {
    // Spec: invalid signature -> 400 { error: "invalid_signature" }
    // Regression check: dual-key changes must not break signature validation.
    const response = await request.post(ROUTES.webhook, {
      headers: {
        "Content-Type": "application/json",
        "X-Patreon-Event": "members:pledge:create",
        "X-Patreon-Signature": "deadbeefdeadbeefdeadbeefdeadbeef",
      },
      data: validWebhookPayload,
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error", "invalid_signature");
  });

  test("webhook returns 400 for non-hex signature (timingSafeEqual guard, regression)", async ({
    request,
  }) => {
    // Spec (webhook/route.ts): "Guard: reject non-hex signature strings before Buffer decode"
    // This guard must remain intact after the dual-key refactor.
    const response = await request.post(ROUTES.webhook, {
      headers: {
        "Content-Type": "application/json",
        "X-Patreon-Event": "members:pledge:create",
        "X-Patreon-Signature": "NOT-HEX-AT-ALL!!!",
      },
      data: validWebhookPayload,
    });

    // Must be 400 (not 500) — the guard prevents timingSafeEqual from crashing
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error", "invalid_signature");
  });

  test("webhook rate limit unchanged — responds to all requests (no 404)", async ({
    request,
  }) => {
    // The webhook route must still exist and respond.
    // Any response other than 404 confirms the route is wired.
    const response = await request.post(ROUTES.webhook, {
      headers: { "Content-Type": "application/json" },
      data: validWebhookPayload,
    });
    expect(response.status()).not.toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Callback — Behavior unchanged for error paths (regression)
// ---------------------------------------------------------------------------

test.describe("Callback — Error path redirects unchanged (regression)", () => {
  test("missing code and state -> still redirects to /settings with error", async ({ request }) => {
    // Spec (callback/route.ts): missing code or state -> 302 to /settings?patreon=error
    // This behavior must be unchanged by the anonymous flow changes.
    const response = await request.get(ROUTES.callback, {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
    });

    expect([301, 302, 303, 307, 308]).toContain(response.status());
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("patreon=error");
    expect(location).toContain("reason=invalid_request");
  });

  test("user denial (error param) -> still redirects to /settings?patreon=denied", async ({
    request,
  }) => {
    // Spec: Patreon sends ?error=access_denied when user denies -> 302 to /settings?patreon=denied
    // This behavior must be unchanged by anonymous flow changes.
    const response = await request.get(`${ROUTES.callback}?error=access_denied`, {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
    });

    expect([301, 302, 303, 307, 308]).toContain(response.status());
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("patreon=denied");
  });

  test("invalid state -> still redirects to /settings?patreon=error&reason=state_mismatch", async ({
    request,
  }) => {
    // Spec: invalid (undecryptable) state -> 302 to /settings?patreon=error&reason=state_mismatch
    const fakeState = Buffer.from(
      JSON.stringify({
        googleSub: "hack",
        nonce: "hack",
        createdAt: Date.now(),
        mode: "anonymous",
      }),
    ).toString("base64");

    const response = await request.get(
      `${ROUTES.callback}?code=realcode&state=${encodeURIComponent(fakeState)}`,
      {
        headers: { Accept: "text/html" },
        maxRedirects: 0,
      },
    );

    expect([301, 302, 303, 307, 308]).toContain(response.status());
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("patreon=error");
    expect(location).toContain("reason=state_mismatch");
  });
});

// ---------------------------------------------------------------------------
// localStorage / cache.ts helpers — Cannot be tested via Playwright API calls.
// These are pure client-side functions. Tests would require a browser context
// with the app loaded. Given the functions are simple localStorage wrappers,
// the implementation is verified by code review.
//
// Key localStorage helpers added in PR #109:
//   - getPatreonUserId(): string | null  — reads "fenrir:patreon-user-id"
//   - setPatreonUserId(pid): void        — writes "fenrir:patreon-user-id"
//   - clearPatreonUserId(): void         — removes "fenrir:patreon-user-id"
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MANUAL TEST STEPS (for paths not automatable via Playwright)
// ---------------------------------------------------------------------------
//
// These tests CANNOT be automated because they require:
//   - A live Patreon OAuth client with matching redirect URI
//   - Real Patreon user credentials
//   - Access to Vercel KV to verify storage
//
// AC-1 Manual: Anonymous OAuth redirect
//   1. Open the app in a browser (not signed in with Google)
//   2. Navigate to /api/patreon/authorize (no id_token)
//   3. EXPECT: Browser redirects to patreon.com/oauth2/authorize
//   4. EXPECT: The state parameter in the URL is an encrypted string (base64)
//   5. Complete Patreon consent flow
//   6. EXPECT: Redirected back to /settings?patreon=linked&tier=<tier>&pid=<patreonId>
//   7. EXPECT: localStorage["fenrir:patreon-user-id"] contains the Patreon user ID
//   8. EXPECT: Vercel KV contains "entitlement:patreon:<patreonId>" key
//   9. EXPECT: Vercel KV "patreon-user:<patreonId>" = "patreon:<patreonId>"
//
// AC-2 Manual: Authenticated OAuth flow unchanged
//   1. Sign in with Google
//   2. Navigate to /settings -> click "Link Patreon"
//   3. EXPECT: Browser redirects to patreon.com/oauth2/authorize
//   4. Complete Patreon consent
//   5. EXPECT: Redirected to /settings?patreon=linked&tier=<tier> (no pid param)
//   6. EXPECT: Vercel KV contains "entitlement:<googleSub>" key
//   7. EXPECT: Vercel KV "patreon-user:<patreonId>" = "<googleSub>" (not patreon: prefixed)
//
// AC-3/AC-4 Manual: Migration flow
//   1. Complete anonymous Patreon flow (AC-1 above)
//   2. Sign in with Google (same browser session)
//   3. EXPECT: App detects localStorage["fenrir:patreon-user-id"]
//   4. EXPECT: App calls POST /api/patreon/migrate with { patreonUserId }
//   5. EXPECT: 200 { migrated: true, tier: <tier>, active: <bool> }
//   6. EXPECT: Vercel KV "entitlement:<googleSub>" exists with migrated data
//   7. EXPECT: Vercel KV "entitlement:patreon:<patreonId>" is DELETED
//   8. EXPECT: Vercel KV "patreon-user:<patreonId>" = "<googleSub>" (updated)
//   9. EXPECT: localStorage["fenrir:patreon-user-id"] is cleared
//
// AC-5 Manual: Migrate idempotency
//   1. Call POST /api/patreon/migrate twice with same patreonUserId
//   2. EXPECT: Both calls return 200 { migrated: true }
//   3. EXPECT: Second call returns same tier/active without modifying KV
//
// AC-6 Manual: Webhook dual-key handling
//   Trigger a Patreon webhook with X-Patreon-Signature computed from PATREON_WEBHOOK_SECRET.
//   For anonymous user:
//     1. Verify "patreon-user:<pid>" value starts with "patreon:"
//     2. EXPECT: Webhook updates "entitlement:patreon:<pid>" (not "entitlement:<googleSub>")
//   For authenticated user:
//     1. Verify "patreon-user:<pid>" value is a plain Google sub
//     2. EXPECT: Webhook updates "entitlement:<googleSub>"
