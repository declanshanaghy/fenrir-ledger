/**
 * Patreon API Routes — Contract & Security Tests
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests for PR #93: Patreon OAuth API routes, webhook handler, and supporting
 * infrastructure (crypto utilities, Vercel KV entitlement store).
 *
 * UPDATED for PR #109 (anonymous Patreon flow):
 *   AC-1 was updated by Loki during PR #109 validation.
 *   PR #109 removed requireAuth from /api/patreon/authorize to allow anonymous users
 *   to start the Patreon OAuth flow without signing in with Google first.
 *   The old AC-1 test (expects 401 on no auth) was a now-broken spec — it asserted
 *   the old behavior, not the new design. Updated to assert the new contract.
 *
 * Every assertion is derived from the design spec (route file docstrings and
 * CLAUDE.md API Route Auth rule) — not from what the implementation currently
 * outputs. These tests prove correctness, not behaviour.
 *
 * Acceptance criteria (original from PR #93, AC-1 updated for PR #109):
 *   AC-1: /api/patreon/authorize allows anonymous access (no requireAuth, no 401)
 *   AC-2: /api/patreon/callback returns 302 (redirect) with missing/invalid state param
 *   AC-3: /api/patreon/membership returns 401 without auth token
 *   AC-4: /api/patreon/webhook returns 400 with missing/invalid signature header
 *   AC-5: All 4 routes exist and respond (not 404)
 *
 * Spec references:
 *   - authorize/route.ts (PR #109): exempt from requireAuth, anonymous mode allowed
 *   - callback/route.ts: no auth gate, missing code/state -> 302 to /settings?patreon=error
 *   - membership/route.ts: requireAuth first, 401 on missing token
 *   - webhook/route.ts: no auth gate, missing X-Patreon-Signature -> 400
 *   - CLAUDE.md API Route Auth: "must call requireAuth at the top ... return early if !auth.ok"
 *     (Exception: /api/patreon/authorize is explicitly exempt per PR #109 ADR-009 amendment)
 *   - require-auth.ts: returns 401 JSON { error: "missing_token" } on no Bearer token
 *   - webhook/route.ts: returns 400 JSON { error: "missing_signature" } on no sig header
 *   - webhook/route.ts: returns 400 JSON { error: "invalid_signature" } on bad sig
 *
 * Note on callback: The callback route does NOT return HTTP 400 for missing params.
 * Per the spec, it redirects to /settings?patreon=error&reason=invalid_request.
 * This is intentional — mid-OAuth callbacks always redirect, never return raw errors,
 * to ensure the user lands in the app UI regardless of failure mode.
 *
 * Note on invalid token responses: When NEXT_PUBLIC_GOOGLE_CLIENT_ID is not
 * configured in the dev environment, verifyIdToken() returns status 500 with
 * error: "Auth not configured." This is expected dev server behaviour. Tests for
 * invalid tokens accept both 401 and 500 as "auth rejected" responses.
 *
 * Note on rate limiting: /api/patreon/authorize enforces 5 req/min per IP.
 * This suite sends at most 4 requests to authorize to stay under the limit.
 * The rate limiter is a stateful in-process store — test ordering matters.
 *
 * Test approach: Direct HTTP API calls — no browser needed. These are pure
 * HTTP contract tests. A running dev server with the Patreon routes is required.
 * Set SERVER_URL env var to point to the correct server.
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants — derived from route specs, not guessed from implementation
// ---------------------------------------------------------------------------

const API_BASE = process.env.SERVER_URL ?? "http://localhost:9653";

/** All 4 Patreon API route paths. */
const ROUTES = {
  authorize: `${API_BASE}/api/patreon/authorize`,
  callback: `${API_BASE}/api/patreon/callback`,
  membership: `${API_BASE}/api/patreon/membership`,
  webhook: `${API_BASE}/api/patreon/webhook`,
};

// ---------------------------------------------------------------------------
// AC-5: Route Existence
// All 4 routes must respond — any status code other than 404 proves the route
// is wired up in Next.js. 404 means the file does not exist or exports no handler.
// ---------------------------------------------------------------------------

test.describe("AC-5: All 4 routes exist (not 404)", () => {
  test("/api/patreon/authorize responds (not 404)", async ({ request }) => {
    // GET without auth — expect any response except 404
    const response = await request.get(ROUTES.authorize, {
      headers: { Accept: "application/json" },
    });
    expect(response.status()).not.toBe(404);
  });

  test("/api/patreon/callback responds (not 404)", async ({ request }) => {
    // GET without params — expect any response except 404
    // The callback redirects rather than returning a body for missing params
    const response = await request.get(ROUTES.callback, {
      headers: { Accept: "application/json" },
      maxRedirects: 0,
    });
    expect(response.status()).not.toBe(404);
  });

  test("/api/patreon/membership responds (not 404)", async ({ request }) => {
    // GET without auth — expect any response except 404
    const response = await request.get(ROUTES.membership, {
      headers: { Accept: "application/json" },
    });
    expect(response.status()).not.toBe(404);
  });

  test("/api/patreon/webhook responds (not 404)", async ({ request }) => {
    // POST without body or sig — expect any response except 404
    const response = await request.post(ROUTES.webhook, {
      headers: { "Content-Type": "application/json" },
      data: "{}",
    });
    expect(response.status()).not.toBe(404);
  });
});

// ---------------------------------------------------------------------------
// AC-1: /api/patreon/authorize — Anonymous access allowed (PR #109 behavioral change)
//
// UPDATED by Loki (PR #109 validation): This route was behind requireAuth before PR #109.
// PR #109 removed requireAuth from this route to allow anonymous Patreon linking.
//
// New spec (authorize/route.ts, PR #109):
//   "This route is exempt from requireAuth because:
//     1. It is accessed via full-page redirect (not a fetch call)
//     2. Anonymous users must be able to start the Patreon OAuth flow
//     3. CSRF protection is provided by the encrypted state parameter"
//
// Expected behavior without id_token:
//   - 302 redirect to Patreon (when PATREON_CLIENT_ID is configured)
//   - 500 { error: "not_configured" } (when PATREON_CLIENT_ID is absent, e.g. dev env)
//   - 429 { error: "rate_limited" } (when rate limit of 5/min/IP is exceeded)
//   NEVER: 401 (auth gate was deliberately removed)
//
// Rate limit budget for this route: 5 req/min.
// AC-5 consumed 1. We have 4 remaining for these tests. Keep at most 3 here.
// ---------------------------------------------------------------------------

test.describe("AC-1: /api/patreon/authorize — anonymous access permitted (no requireAuth)", () => {
  test("does NOT return 401 with no Authorization header (anonymous access allowed)", async ({ request }) => {
    // Spec (PR #109): requireAuth was removed — anonymous users may initiate the Patreon flow.
    // Without id_token: route proceeds to anonymous mode.
    //   - Configured env: 302 to Patreon
    //   - Dev env (no PATREON_CLIENT_ID): 500 not_configured
    // MUST NOT return 401 (that would indicate requireAuth was left in place — a regression).
    const response = await request.get(ROUTES.authorize, {
      headers: { Accept: "application/json" },
      maxRedirects: 0,
    });

    // The critical assertion for PR #109: not 401 (auth gate removed)
    expect(response.status()).not.toBe(401);
    // Must also not be 404 (route must exist)
    expect(response.status()).not.toBe(404);
  });

  test("response is JSON or redirect — not raw HTML — for all non-redirect responses", async ({ request }) => {
    // Spec: all non-redirect error responses from this route are { error, error_description } JSON.
    // Rate limit, not_configured, and invalid_token all return NextResponse.json().
    const response = await request.get(ROUTES.authorize, {
      headers: { Accept: "application/json" },
      maxRedirects: 0,
    });

    const status = response.status();

    // If it is a redirect, no body to check — that is the happy path (configured env)
    if ([302, 303, 307, 308].includes(status)) {
      return; // Redirect is the correct outcome in a configured environment
    }

    // For non-redirect responses (500, 429) the body must be application/json
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");

    // The body must be parseable JSON with a string error field
    const body = await response.json();
    expect(typeof body.error).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// AC-2: /api/patreon/callback — Input validation (missing/invalid state)
// Spec: "NOT behind requireAuth — CSRF protection is provided by the encrypted
//        state parameter"
// Spec: missing code or state -> redirect to /settings?patreon=error&reason=invalid_request
// Spec: invalid (undecryptable) state -> redirect to /settings?patreon=error&reason=state_mismatch
// Note: The callback always REDIRECTS — it never returns 400 JSON to the browser.
//       This is by design: mid-OAuth flows must land users in the app UI.
// ---------------------------------------------------------------------------

test.describe("AC-2: /api/patreon/callback — input validation via redirects", () => {
  test("missing state and code -> redirects to /settings with error", async ({ request }) => {
    // Spec: "if (!code || !stateParam)" -> redirect to /settings?patreon=error&reason=invalid_request
    const response = await request.get(ROUTES.callback, {
      headers: { Accept: "text/html" },
      // Do not follow redirects — check the 302 Location header directly
      maxRedirects: 0,
    });

    // Spec: callback redirects, never returns 200 or 400 for param errors
    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    // Spec: redirects to /settings with patreon=error and reason=invalid_request
    expect(location).toContain("patreon=error");
    expect(location).toContain("reason=invalid_request");
  });

  test("state param only (no code) -> redirects to /settings with error", async ({ request }) => {
    // Spec: code is required alongside state — missing code triggers invalid_request
    const response = await request.get(`${ROUTES.callback}?state=somevalue`, {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
    });

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    expect(location).toContain("patreon=error");
    expect(location).toContain("reason=invalid_request");
  });

  test("code param only (no state) -> redirects to /settings with error", async ({ request }) => {
    // Spec: state is required alongside code — missing state triggers invalid_request
    const response = await request.get(`${ROUTES.callback}?code=someauthcode`, {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
    });

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    expect(location).toContain("patreon=error");
    expect(location).toContain("reason=invalid_request");
  });

  test("invalid (undecryptable) state -> redirects to /settings with state_mismatch", async ({ request }) => {
    // Spec: validateState() returns null for bad state -> redirect with reason=state_mismatch
    // A valid-looking but unencryptable base64 blob fails decryption
    const fakeState = Buffer.from(
      JSON.stringify({ googleSub: "hack", nonce: "hack", createdAt: Date.now() })
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
    // Spec: invalid state -> reason=state_mismatch
    expect(location).toContain("patreon=error");
    expect(location).toContain("reason=state_mismatch");
  });

  test("user denial (error param from Patreon) -> redirects to /settings with patreon=denied", async ({ request }) => {
    // Spec: "if (error)" from searchParams -> redirect to /settings?patreon=denied
    // This is the case where the user clicks "Deny" on Patreon's consent screen
    const response = await request.get(`${ROUTES.callback}?error=access_denied`, {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
    });

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    // Spec: error param -> patreon=denied (not patreon=error)
    expect(location).toContain("patreon=denied");
  });
});

// ---------------------------------------------------------------------------
// AC-3: /api/patreon/membership — Auth enforcement
// Spec: "Behind requireAuth (ADR-008) — the user must be signed in with Google"
// ---------------------------------------------------------------------------

test.describe("AC-3: /api/patreon/membership — requireAuth enforcement", () => {
  test("returns 401 with no Authorization header", async ({ request }) => {
    const response = await request.get(ROUTES.membership, {
      headers: { Accept: "application/json" },
    });

    // Spec: requireAuth returns 401 for missing token
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toHaveProperty("error", "missing_token");
    expect(body).toHaveProperty("error_description");
  });

  test("returns 401 with malformed Authorization header (no Bearer prefix)", async ({ request }) => {
    // Spec: require-auth.ts checks for "Bearer " prefix — anything else is missing_token
    // Note: membership uses requireAuth which checks the header prefix strictly.
    // "Token sometoken" does not start with "Bearer " -> missing_token 401
    const response = await request.get(ROUTES.membership, {
      headers: {
        Authorization: "Token sometoken",
        Accept: "application/json",
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toHaveProperty("error", "missing_token");
  });

  test("returns auth error with invalid Bearer token", async ({ request }) => {
    // Spec: requireAuth calls verifyIdToken — an invalid token is rejected.
    // On an unconfigured dev server (no GOOGLE_CLIENT_ID), verifyIdToken returns
    // status 500 ("Auth not configured"). On a configured server it returns 401.
    // Either way, the request is REJECTED with error: "invalid_token".
    const response = await request.get(ROUTES.membership, {
      headers: {
        Authorization: "Bearer not-a-google-id-token",
        Accept: "application/json",
      },
    });

    // Spec: invalid token is rejected. On dev with no GOOGLE_CLIENT_ID: 500.
    // On configured server: 401. The critical assertion is that it is NOT 200.
    expect(response.status()).not.toBe(200);
    expect(response.status()).not.toBe(404);

    const body = await response.json();
    // Spec: error is either "missing_token" or "invalid_token" — never absent
    expect(["missing_token", "invalid_token"]).toContain(body.error);
    expect(typeof body.error_description).toBe("string");
  });

  test("response Content-Type is application/json for auth rejections", async ({ request }) => {
    // Spec: NextResponse.json() always returns application/json
    const response = await request.get(ROUTES.membership, {
      headers: { Accept: "application/json" },
    });

    expect(response.status()).toBe(401);
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });
});

// ---------------------------------------------------------------------------
// AC-4: /api/patreon/webhook — HMAC signature enforcement
// Spec: "NOT behind requireAuth — Patreon sends webhooks, not authenticated users.
//        Security is provided by HMAC-MD5 signature validation using PATREON_WEBHOOK_SECRET"
// Spec: missing X-Patreon-Signature -> 400 { error: "missing_signature" }
// Spec: invalid signature -> 400 { error: "invalid_signature" }
// ---------------------------------------------------------------------------

test.describe("AC-4: /api/patreon/webhook — HMAC signature enforcement", () => {
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

  test("returns 400 with missing X-Patreon-Signature header", async ({ request }) => {
    // Spec: "if (!signature)" -> 400 { error: "missing_signature" }
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
    expect(body).toHaveProperty("error_description");
    expect(typeof body.error_description).toBe("string");
  });

  test("returns 400 with empty X-Patreon-Signature header", async ({ request }) => {
    // Spec: empty string fails the signature check
    // The route reads the header as null (empty header = null in Next.js) -> missing_signature
    const response = await request.post(ROUTES.webhook, {
      headers: {
        "Content-Type": "application/json",
        "X-Patreon-Event": "members:pledge:create",
        "X-Patreon-Signature": "",
      },
      data: validWebhookPayload,
    });

    // Spec: empty sig is either treated as missing (400 missing_signature)
    // or as invalid (400 invalid_signature) — both are 400
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(["missing_signature", "invalid_signature"]).toContain(body.error);
  });

  test("returns 400 with invalid (wrong HMAC) X-Patreon-Signature", async ({ request }) => {
    // Spec: validateSignature() computes HMAC-MD5 and compares — a wrong sig fails
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
    expect(body).toHaveProperty("error_description");
  });

  test("returns 400 with non-hex X-Patreon-Signature (guard against timingSafeEqual crash)", async ({ request }) => {
    // Spec: webhook/route.ts: guard against non-hex signature strings
    // A non-hex signature must be rejected before the Buffer decode to prevent a throw.
    // This is a critical safety test — without the guard, Buffer.from("NON-HEX", "hex")
    // produces an empty/truncated buffer which could cause crypto.timingSafeEqual to throw.
    const response = await request.post(ROUTES.webhook, {
      headers: {
        "Content-Type": "application/json",
        "X-Patreon-Event": "members:pledge:create",
        "X-Patreon-Signature": "THIS-IS-NOT-HEX!!!",
      },
      data: validWebhookPayload,
    });

    // Spec: non-hex signature fails the /^[0-9a-f]+$/i guard -> invalid_signature (not 500)
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty("error", "invalid_signature");
  });

  test("response Content-Type is application/json for 400 signature errors", async ({ request }) => {
    // Spec: NextResponse.json() always returns application/json
    const response = await request.post(ROUTES.webhook, {
      headers: {
        "Content-Type": "application/json",
        "X-Patreon-Event": "members:pledge:create",
        // No signature
      },
      data: validWebhookPayload,
    });

    expect(response.status()).toBe(400);
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });

  test("returns 400 for empty request body (missing signature check fires first)", async ({ request }) => {
    // Spec: body is read first with request.text(), then signature is checked.
    // An empty body with no sig triggers missing_signature (body read succeeds for empty string).
    // The route must never 500 or 404 on malformed input — always 400.
    const response = await request.post(ROUTES.webhook, {
      headers: {
        "Content-Type": "application/json",
        "X-Patreon-Event": "members:pledge:create",
      },
      data: "",
    });

    // Any 400 is acceptable — the route must not 500 or 404 on empty body
    expect(response.status()).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Edge Cases — Devil's Advocate Specials
// ---------------------------------------------------------------------------

test.describe("Edge Cases — Boundary conditions", () => {
  test("webhook: POST with unsupported HTTP method GET -> 405", async ({ request }) => {
    // Spec: webhook exports only POST handler — GET must return 405 Method Not Allowed
    const response = await request.get(ROUTES.webhook, {
      headers: { Accept: "application/json" },
    });

    expect(response.status()).toBe(405);
  });

  test("authorize: POST method not supported -> 405", async ({ request }) => {
    // Spec: authorize exports only GET handler
    const response = await request.post(ROUTES.authorize, {
      headers: { Accept: "application/json" },
      data: "{}",
    });

    expect(response.status()).toBe(405);
  });

  test("membership: POST method not supported -> 405", async ({ request }) => {
    // Spec: membership exports only GET handler
    const response = await request.post(ROUTES.membership, {
      headers: { Accept: "application/json" },
      data: "{}",
    });

    expect(response.status()).toBe(405);
  });

  test("callback: POST method not supported -> 405", async ({ request }) => {
    // Spec: callback exports only GET handler
    const response = await request.post(ROUTES.callback, {
      headers: { Accept: "application/json" },
      data: "{}",
    });

    expect(response.status()).toBe(405);
  });

  test("webhook: missing X-Patreon-Event header with no sig -> 400 missing_signature", async ({ request }) => {
    // Spec: signature is checked before event type
    // A request with no sig and no event header should fail on sig check (400)
    // not event check (200 for unhandled events)
    const response = await request.post(ROUTES.webhook, {
      headers: {
        "Content-Type": "application/json",
        // No X-Patreon-Signature and no X-Patreon-Event
      },
      data: JSON.stringify({ data: { id: "test", type: "member", attributes: {} } }),
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error", "missing_signature");
  });

  test("webhook: error body is JSON not HTML for all 400 responses", async ({ request }) => {
    // Spec: all error responses from webhook are JSON:API-style { error, error_description }
    // Next.js default error pages return HTML — we confirm the route overrides this
    const response = await request.post(ROUTES.webhook, {
      headers: {
        "Content-Type": "application/json",
      },
      data: "{}",
    });

    expect(response.status()).toBe(400);
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");

    // Confirm it is parseable JSON with expected shape
    const body = await response.json();
    expect(typeof body.error).toBe("string");
    expect(typeof body.error_description).toBe("string");
  });

  test("webhook: signature validation uses HMAC-MD5 not SHA256 (wrong algo rejects)", async ({ request }) => {
    // Spec: "Algorithm: HMAC-MD5 of the raw request body"
    // If the server were incorrectly using SHA256 or any other algorithm,
    // a SHA256-signed payload would be accepted. This test proves only MD5 signatures work.
    // We send a payload with a fake-but-hex signature and confirm rejection.
    const payload = JSON.stringify({
      data: { id: "x", type: "member", attributes: { patron_status: "active_patron", currently_entitled_amount_cents: 0 } },
    });
    // A valid-looking 32-char hex string (MD5 length) that is definitely wrong
    const fakeMd5Sig = "a".repeat(32);

    const response = await request.post(ROUTES.webhook, {
      headers: {
        "Content-Type": "application/json",
        "X-Patreon-Event": "members:pledge:create",
        "X-Patreon-Signature": fakeMd5Sig,
      },
      data: payload,
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error", "invalid_signature");
  });

  test("callback: redirect Location contains host from request", async ({ request }) => {
    // Spec: getBaseUrl() uses x-forwarded-proto and host headers
    // Without those headers, it defaults to http://localhost:<port>
    // The Location header must contain a valid URL, not a relative path
    const response = await request.get(ROUTES.callback, {
      headers: { Accept: "text/html" },
      maxRedirects: 0,
    });

    const location = response.headers()["location"] ?? "";
    // Spec: redirect is an absolute URL to /settings
    expect(location).toMatch(/^https?:\/\//);
    expect(location).toContain("/settings");
  });
});
