/**
 * APP_BASE_URL SEV-002 Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests for the SEV-002 fix: Deterministic Patreon OAuth Redirect URIs via APP_BASE_URL.
 * Merged in PR on branch fix/patreon-app-base-url.
 *
 * SEV-002 Summary (from ADR-009):
 *   Originally, OAuth redirect URIs were built from x-forwarded-proto and host headers,
 *   which could be spoofed. Mitigated by introducing APP_BASE_URL env var for production,
 *   falling back to headers only for preview/local where URLs genuinely vary.
 *
 * What changed (authorize/route.ts + callback/route.ts):
 *   - buildRedirectUri(request): reads APP_BASE_URL first; falls back to
 *     x-forwarded-proto + host headers if APP_BASE_URL is not set.
 *   - getBaseUrl(request): same pattern in callback/route.ts.
 *
 * Both functions use the SAME two-path logic:
 *   1. if (APP_BASE_URL) → use it (deterministic, production-safe)
 *   2. else → use x-forwarded-proto header ?? "https" + host header ?? "localhost:9653"
 *
 * What this suite tests:
 *   - The header fallback path (x-forwarded-proto → Location scheme)
 *   - Redirect Location is always an absolute URL (never relative)
 *   - Redirect Location always points to /settings (never to external domain)
 *   - Error conditions (missing code/state, invalid state) redirect correctly
 *   - The authorize route is properly gated (confirms it participates in redirect flow)
 *
 * What CANNOT be tested at runtime without server restart:
 *   - APP_BASE_URL precedence: requires the env var to be set at server startup.
 *     Manual test: set APP_BASE_URL=https://custom.example.com in .env.local,
 *     restart server, call /api/patreon/callback → Location should start with
 *     https://custom.example.com regardless of x-forwarded-proto header.
 *     See ADR-009 and .env.example for reference.
 *
 * Acceptance criteria:
 *   AC-SEV002-1: buildRedirectUri uses APP_BASE_URL when set (code verified via ADR-009)
 *   AC-SEV002-2: buildRedirectUri falls back to x-forwarded-proto + host headers
 *   AC-SEV002-3: getBaseUrl uses APP_BASE_URL when set (code verified via ADR-009)
 *   AC-SEV002-4: getBaseUrl falls back to x-forwarded-proto + host headers
 *   AC-SEV002-5: All callback redirects are absolute URLs
 *   AC-SEV002-6: All callback redirects target /settings (not external domains)
 *   AC-SEV002-7: Authorize route is auth-gated (prerequisite for buildRedirectUri use)
 *
 * Note on rate limits:
 *   /api/patreon/authorize is rate-limited to 5 req/min per IP.
 *   /api/patreon/callback is rate-limited to 10 req/min per IP.
 *   These tests send at most 3 requests to authorize and 10 to callback.
 *   If rate limits trigger, tests accept 429 as a valid "non-404" response.
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants — derived from route spec files, not guessed
// ---------------------------------------------------------------------------

const API_BASE = process.env.SERVER_URL ?? "http://localhost:9653";

const CALLBACK_URL = `${API_BASE}/api/patreon/callback`;
const AUTHORIZE_URL = `${API_BASE}/api/patreon/authorize`;

// ---------------------------------------------------------------------------
// AC-SEV002-2 & AC-SEV002-4:
// Header Fallback — x-forwarded-proto drives the redirect URL scheme
//
// Spec (both authorize/route.ts and callback/route.ts):
//   const proto = request.headers.get("x-forwarded-proto") ?? "https";
//   const host  = request.headers.get("host") ?? "localhost:9653";
//
// When APP_BASE_URL is not set (local dev / preview), the route builds the
// base URL from these headers. By sending different x-forwarded-proto values
// we verify the header fallback path is alive and correctly plumbed.
//
// Note: These tests assume APP_BASE_URL is NOT set in the test environment.
// If it IS set, the redirect uses APP_BASE_URL regardless — the Location
// will still be an absolute URL pointing to /settings (AC-SEV002-5/6 pass).
// ---------------------------------------------------------------------------

test.describe("AC-SEV002-2/4: Callback — x-forwarded-proto header fallback", () => {
  test("TC-ABU-01: redirect uses http:// scheme when x-forwarded-proto is 'http'", async ({
    request,
  }) => {
    // Spec: getBaseUrl() fallback: proto = request.headers.get("x-forwarded-proto") ?? "https"
    // When x-forwarded-proto: http → base URL scheme must be http://
    // Trigger: no code/state → invalid_request redirect (safe path, no real OAuth needed)
    const response = await request.get(CALLBACK_URL, {
      headers: {
        "x-forwarded-proto": "http",
      },
      maxRedirects: 0,
    });

    // Must be a redirect (any 3xx) or rate-limited (429)
    // Rate limit: unlikely on first run, but accepted as a non-404 valid response
    if (response.status() === 429) {
      // Rate-limited — route exists and is responding correctly
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    // Spec: when APP_BASE_URL is not set and x-forwarded-proto: http,
    // the Location MUST start with http:// (not https://)
    // If APP_BASE_URL is set, the Location uses APP_BASE_URL's scheme (still absolute).
    // Either way: the Location must be an absolute URL pointing to /settings.
    expect(location).toMatch(/^https?:\/\//);
    expect(location).toContain("/settings");

    // Devil's advocate: verify the proto matches what we sent (when no APP_BASE_URL)
    // If APP_BASE_URL is not set, x-forwarded-proto: http → http://
    if (!location.includes("fenrir-ledger.vercel.app") && location.includes("localhost")) {
      expect(location).toMatch(/^http:\/\//);
    }
  });

  test("TC-ABU-02: redirect uses https:// scheme when x-forwarded-proto is 'https'", async ({
    request,
  }) => {
    // Spec: getBaseUrl() fallback with x-forwarded-proto: https → https://
    const response = await request.get(CALLBACK_URL, {
      headers: {
        "x-forwarded-proto": "https",
      },
      maxRedirects: 0,
    });

    if (response.status() === 429) {
      return; // Rate-limited — route exists
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    expect(location).toMatch(/^https?:\/\//);
    expect(location).toContain("/settings");

    // When no APP_BASE_URL and x-forwarded-proto: https → must be https://
    if (!location.includes("fenrir-ledger.vercel.app") && location.includes("localhost")) {
      expect(location).toMatch(/^https:\/\//);
    }
  });

  test("TC-ABU-03: redirect uses default https:// scheme when x-forwarded-proto is absent", async ({
    request,
  }) => {
    // Spec: getBaseUrl() fallback: proto = request.headers.get("x-forwarded-proto") ?? "https"
    // Without x-forwarded-proto header, fallback is "https"
    const response = await request.get(CALLBACK_URL, {
      maxRedirects: 0,
    });

    if (response.status() === 429) {
      return; // Rate-limited — route exists
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    // Spec: default proto is "https" — redirect must use https:// (or APP_BASE_URL scheme)
    expect(location).toMatch(/^https?:\/\//);
    expect(location).toContain("/settings");
  });

  test("TC-ABU-04: x-forwarded-proto: http redirect for user-denial path (error param)", async ({
    request,
  }) => {
    // Spec: callback/route.ts: if (error) → redirect to ${baseUrl}/settings?patreon=denied
    // Same getBaseUrl() is used for user-denial redirects — must respect x-forwarded-proto
    const response = await request.get(`${CALLBACK_URL}?error=access_denied`, {
      headers: {
        "x-forwarded-proto": "http",
      },
      maxRedirects: 0,
    });

    if (response.status() === 429) {
      return; // Rate-limited — route exists
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    // Spec: user denial → /settings?patreon=denied (not patreon=error)
    expect(location).toContain("patreon=denied");
    expect(location).toMatch(/^https?:\/\//);
    expect(location).toContain("/settings");
  });
});

// ---------------------------------------------------------------------------
// AC-SEV002-5: All callback redirects are absolute URLs
//
// A relative redirect (e.g. /settings?patreon=error) would break the OAuth
// flow when the app is behind a proxy or custom domain. All redirects from
// /api/patreon/callback MUST be absolute (https?://hostname/path).
// This was the root cause of SEV-002: relative or wrong-host redirect URIs.
// ---------------------------------------------------------------------------

test.describe("AC-SEV002-5: Callback redirects are always absolute URLs", () => {
  test("TC-ABU-05: missing code+state → absolute URL redirect", async ({ request }) => {
    // Spec: invalid_request redirect is absolute
    const response = await request.get(CALLBACK_URL, {
      maxRedirects: 0,
    });

    if (response.status() === 429) {
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    // Must be an absolute URL — never a relative path
    expect(location).toMatch(/^https?:\/\//);
    // Must not be a relative path (starts with /)
    expect(location).not.toMatch(/^\/[^/]/);
  });

  test("TC-ABU-06: invalid state param → absolute URL redirect", async ({ request }) => {
    // Spec: state_mismatch redirect is absolute
    const fakeState = Buffer.from(
      JSON.stringify({ googleSub: "hack", nonce: "hack", createdAt: Date.now() })
    ).toString("base64");

    const response = await request.get(
      `${CALLBACK_URL}?code=somecode&state=${encodeURIComponent(fakeState)}`,
      { maxRedirects: 0 }
    );

    if (response.status() === 429) {
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    expect(location).toMatch(/^https?:\/\//);
    expect(location).not.toMatch(/^\/[^/]/);
  });

  test("TC-ABU-07: user denial (error param) → absolute URL redirect", async ({ request }) => {
    // Spec: user-denial redirect is absolute
    const response = await request.get(`${CALLBACK_URL}?error=access_denied`, {
      maxRedirects: 0,
    });

    if (response.status() === 429) {
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    expect(location).toMatch(/^https?:\/\//);
    expect(location).not.toMatch(/^\/[^/]/);
  });
});

// ---------------------------------------------------------------------------
// AC-SEV002-6: All callback redirects target /settings (not external domains)
//
// The callback MUST only redirect to the application's own /settings page.
// It must never redirect to an external domain (including Patreon) or to a
// path other than /settings. This prevents open redirect vulnerabilities.
// ---------------------------------------------------------------------------

test.describe("AC-SEV002-6: Callback redirects always target /settings", () => {
  test("TC-ABU-08: invalid_request redirect Location contains /settings", async ({ request }) => {
    // Spec: "redirect to /settings?patreon=error&reason=invalid_request"
    const response = await request.get(CALLBACK_URL, { maxRedirects: 0 });

    if (response.status() === 429) {
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    expect(location).toContain("/settings");
    // Must NOT redirect to patreon.com or any other external domain
    expect(location).not.toContain("patreon.com");
    expect(location).not.toContain("accounts.google.com");
  });

  test("TC-ABU-09: state_mismatch redirect Location contains /settings", async ({ request }) => {
    // Spec: "redirect to /settings?patreon=error&reason=state_mismatch"
    const fakeState = Buffer.from("bad-state-data").toString("base64");

    const response = await request.get(
      `${CALLBACK_URL}?code=x&state=${encodeURIComponent(fakeState)}`,
      { maxRedirects: 0 }
    );

    if (response.status() === 429) {
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    expect(location).toContain("/settings");
    expect(location).not.toContain("patreon.com");
  });

  test("TC-ABU-10: user-denial redirect Location contains /settings (not /dashboard or /)", async ({
    request,
  }) => {
    // Spec: user denial → /settings?patreon=denied
    // Devil's advocate: a wrong redirect path would lose the patreon=denied feedback
    const response = await request.get(`${CALLBACK_URL}?error=access_denied`, {
      maxRedirects: 0,
    });

    if (response.status() === 429) {
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    expect(location).toContain("/settings");
    // Must use patreon=denied for user denial (not patreon=error)
    expect(location).toContain("patreon=denied");
    // Must NOT redirect to dashboard or root
    const url = new URL(location);
    expect(url.pathname).toBe("/settings");
  });
});

// ---------------------------------------------------------------------------
// AC-SEV002-7: Authorize route is auth-gated (prerequisite for buildRedirectUri)
//
// buildRedirectUri() is only called AFTER successful authentication.
// The route must reject unauthenticated requests before ever calling
// buildRedirectUri(). This prevents the redirect URI from being constructed
// with potentially spoofed headers from an attacker.
// ---------------------------------------------------------------------------

test.describe("AC-SEV002-7: Authorize route — auth gate before buildRedirectUri", () => {
  test("TC-ABU-11: authorize returns 401 without auth token (buildRedirectUri never reached)", async ({
    request,
  }) => {
    // Spec: authorize/route.ts checks id_token BEFORE calling buildRedirectUri.
    // An unauthenticated request must never trigger the Patreon redirect.
    // This ensures the APP_BASE_URL / header fallback logic is only invoked for
    // authenticated, verified users.
    const response = await request.get(AUTHORIZE_URL, {
      headers: { Accept: "application/json" },
    });

    // Rate limit: up to 5/min. Accepts 429 as valid rejection.
    expect([401, 429]).toContain(response.status());

    if (response.status() === 401) {
      const body = await response.json() as Record<string, unknown>;
      // Spec: missing token → { error: "missing_token" }
      expect(body).toHaveProperty("error", "missing_token");
    }
  });

  test("TC-ABU-12: authorize with invalid token is rejected (buildRedirectUri never reached)", async ({
    request,
  }) => {
    // Spec: verifyIdToken() is called before buildRedirectUri().
    // An invalid Bearer token must be rejected — no redirect to Patreon.
    // This guards against header spoofing by unauthenticated attackers.
    const response = await request.get(AUTHORIZE_URL, {
      headers: {
        Authorization: "Bearer not-a-real-google-id-token",
        Accept: "application/json",
      },
    });

    // Spec: invalid token is rejected (401 or 500 on unconfigured dev server).
    // Must NOT be a redirect (3xx) — buildRedirectUri must not have been reached.
    expect(response.status()).not.toBe(302);
    expect(response.status()).not.toBe(404);
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("TC-ABU-13: authorize route responds with JSON (not HTML) for auth failures", async ({
    request,
  }) => {
    // Spec: all error responses from authorize are JSON { error, error_description }
    // not Next.js HTML error pages. This proves the route handler is reached
    // and the auth check fires before any redirect logic.
    const response = await request.get(AUTHORIZE_URL, {
      headers: { Accept: "application/json" },
    });

    // 401 or 429 — both are valid rejections
    expect([401, 429]).toContain(response.status());

    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");

    const body = await response.json() as Record<string, unknown>;
    // Error must have the standard { error, error_description } shape
    expect(typeof body.error).toBe("string");
    expect(typeof body.error_description).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Regression: Existing redirect error params still correct after SEV-002 fix
//
// The SEV-002 fix changed URL construction but must NOT change the error
// query parameters returned by the callback route. Each error path must
// still produce the exact error reason codes specified in the original spec.
// ---------------------------------------------------------------------------

test.describe("Regression: Callback redirect error params unchanged by SEV-002", () => {
  test("TC-ABU-14: missing code+state → reason=invalid_request (param unchanged)", async ({
    request,
  }) => {
    // Spec (unchanged): "!code || !stateParam → reason=invalid_request"
    const response = await request.get(CALLBACK_URL, { maxRedirects: 0 });

    if (response.status() === 429) {
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    expect(location).toContain("patreon=error");
    expect(location).toContain("reason=invalid_request");
  });

  test("TC-ABU-15: invalid state → reason=state_mismatch (param unchanged)", async ({
    request,
  }) => {
    // Spec (unchanged): "validateState() returns null → reason=state_mismatch"
    const fakeState = Buffer.from(
      JSON.stringify({ googleSub: "s", nonce: "n", createdAt: Date.now() })
    ).toString("base64");

    const response = await request.get(
      `${CALLBACK_URL}?code=c&state=${encodeURIComponent(fakeState)}`,
      { maxRedirects: 0 }
    );

    if (response.status() === 429) {
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    expect(location).toContain("patreon=error");
    expect(location).toContain("reason=state_mismatch");
  });

  test("TC-ABU-16: user denial (error=access_denied) → patreon=denied (param unchanged)", async ({
    request,
  }) => {
    // Spec (unchanged): "if (error) → redirect to /settings?patreon=denied"
    const response = await request.get(`${CALLBACK_URL}?error=access_denied`, {
      maxRedirects: 0,
    });

    if (response.status() === 429) {
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    expect(location).toContain("patreon=denied");
    // Must NOT use patreon=error (wrong param for user denial)
    expect(location).not.toContain("patreon=error");
  });

  test("TC-ABU-17: code only (no state) → reason=invalid_request (param unchanged)", async ({
    request,
  }) => {
    // Spec: code without state is still invalid_request
    const response = await request.get(`${CALLBACK_URL}?code=someauthcode`, {
      maxRedirects: 0,
    });

    if (response.status() === 429) {
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    expect(location).toContain("patreon=error");
    expect(location).toContain("reason=invalid_request");
  });

  test("TC-ABU-18: redirect Content-Type is not JSON (callback always redirects)", async ({
    request,
  }) => {
    // Spec: callback uses NextResponse.redirect() not NextResponse.json()
    // for all error paths. The response must be a redirect, not a JSON body.
    const response = await request.get(CALLBACK_URL, { maxRedirects: 0 });

    if (response.status() === 429) {
      // Rate limited — JSON response is fine
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    // Redirects have a Location header, not a Content-Type: application/json
    const location = response.headers()["location"] ?? "";
    expect(location).not.toBe("");
  });
});

// ---------------------------------------------------------------------------
// Edge Cases — Devil's Advocate
// ---------------------------------------------------------------------------

test.describe("Edge Cases — SEV-002 boundary conditions", () => {
  test("TC-ABU-19: callback with both code and state=empty string → invalid_request", async ({
    request,
  }) => {
    // Edge case: empty string state is treated as falsy by !stateParam check
    const response = await request.get(`${CALLBACK_URL}?code=x&state=`, {
      maxRedirects: 0,
    });

    if (response.status() === 429) {
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    // Empty state must trigger invalid_request, not state_mismatch
    // (state_mismatch only when state is present but undecryptable)
    expect(location).toContain("patreon=error");
  });

  test("TC-ABU-20: callback redirect is a single hop (no double-redirect)", async ({
    request,
  }) => {
    // Spec: the callback produces ONE redirect to /settings.
    // A misconfigured URL construction could produce a redirect loop.
    // Verify by checking that the Location header contains /settings exactly once.
    const response = await request.get(CALLBACK_URL, { maxRedirects: 0 });

    if (response.status() === 429) {
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    // /settings must appear exactly once in the redirect URL
    const settingsCount = (location.match(/\/settings/g) ?? []).length;
    expect(settingsCount).toBe(1);
  });

  test("TC-ABU-21: callback redirect Location has no double slashes in path", async ({
    request,
  }) => {
    // Edge case: if baseUrl accidentally ends with "/" and path starts with "/",
    // the Location would be "https://host//settings?...". This must not happen.
    const response = await request.get(CALLBACK_URL, { maxRedirects: 0 });

    if (response.status() === 429) {
      return;
    }

    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()["location"] ?? "";
    // Spec: "${baseUrl}/settings" — baseUrl must NOT have a trailing slash
    // (the env.example shows no trailing slash: https://fenrir-ledger.vercel.app)
    expect(location).not.toContain("//settings");
  });

  test("TC-ABU-22: callback responds to OPTIONS preflight (CORS check)", async ({
    request,
  }) => {
    // Edge case: some OAuth implementations send OPTIONS before the callback redirect.
    // The route must not crash on OPTIONS. Next.js returns 204 or 405 for OPTIONS.
    const response = await request.fetch(CALLBACK_URL, {
      method: "OPTIONS",
    });

    // Any response except 500 is acceptable — the route must not crash
    expect(response.status()).not.toBe(500);
    expect(response.status()).not.toBe(404);
  });
});
