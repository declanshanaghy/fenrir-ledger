/**
 * /api/auth/token — Fenrir JWT minting tests (Issue #2060)
 *
 * Validates the new mintFenrirSessionResponse behavior introduced in #2060:
 *   - Successful auth code exchange returns fenrir_token (not just Google tokens)
 *   - Response includes { fenrir_token, access_token, refresh_token, expires_in, user }
 *   - expires_in reflects 30-day Fenrir JWT lifetime (JWT_LIFETIME_S), not Google's 1h
 *   - User claims (sub, email, name, picture) are extracted from the Google id_token
 *   - Refresh flow does NOT trigger Fenrir JWT minting
 *   - Graceful fallback: if Fenrir minting fails, raw Google response is returned
 *   - Missing id_token in Google response falls back to raw Google response
 *   - Missing sub in id_token claims falls back to raw Google response
 *
 * AC from issue #2060:
 *   - Google OAuth used only at login — id_token verified once, then Fenrir JWT issued
 *   - JWT payload: { sub, email, householdId, iat, exp } — 30-day expiry
 *   - Deploy/pod restart does not invalidate sessions (JWT is self-contained)
 *
 * @ref Issue #2060
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, remaining: 9, retryAfter: undefined })),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/trial/init-trial", () => ({
  initTrialForUser: vi.fn().mockResolvedValue({ ok: true }),
}));

const mockSignFenrirJwt = vi.hoisted(() => vi.fn());
const JWT_LIFETIME_S_VALUE = 30 * 24 * 60 * 60; // 2592000

vi.mock("@/lib/auth/fenrir-jwt", () => ({
  signFenrirJwt: (...args: unknown[]) => mockSignFenrirJwt(...args),
  JWT_LIFETIME_S: JWT_LIFETIME_S_VALUE,
}));

const mockFetch = vi.hoisted(() => vi.fn());

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:9653/api/auth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "10.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Encode a fake id_token with the given claims.
 * Three base64url segments: header.payload.sig
 */
function makeIdToken(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.fake-sig`;
}

const AUTH_CODE_BODY = {
  code: "auth-code-xyz",
  code_verifier: "pkce-verifier",
  redirect_uri: "http://localhost:9653/ledger/auth/callback",
};

const GOOGLE_USER_CLAIMS = {
  sub: "google-sub-abc123",
  email: "odin@fenrir.dev",
  name: "Odin Allfather",
  picture: "https://example.com/odin.jpg",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("/api/auth/token — Fenrir JWT minting on auth code exchange (issue #2060)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockSignFenrirJwt.mockResolvedValue("minted-fenrir-jwt-abc");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── AC: Fenrir JWT issued after Google login ──────────────────────────────

  it("returns fenrir_token in response body on successful auth code exchange", async () => {
    const idToken = makeIdToken(GOOGLE_USER_CLAIMS);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "ya29.access", id_token: idToken, refresh_token: "1//refresh", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { POST } = await import("@/app/api/auth/token/route");
    const res = await POST(makeRequest(AUTH_CODE_BODY));

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.fenrir_token).toBe("minted-fenrir-jwt-abc");
  });

  it("returns user claims (sub, email, name, picture) decoded from id_token", async () => {
    const idToken = makeIdToken(GOOGLE_USER_CLAIMS);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "ya29.access", id_token: idToken, refresh_token: "1//refresh" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { POST } = await import("@/app/api/auth/token/route");
    const res = await POST(makeRequest(AUTH_CODE_BODY));

    const body = await res.json() as { user: { sub: string; email: string; name: string; picture: string } };
    expect(body.user.sub).toBe(GOOGLE_USER_CLAIMS.sub);
    expect(body.user.email).toBe(GOOGLE_USER_CLAIMS.email);
    expect(body.user.name).toBe(GOOGLE_USER_CLAIMS.name);
    expect(body.user.picture).toBe(GOOGLE_USER_CLAIMS.picture);
  });

  // ── AC: expires_in reflects 30-day Fenrir JWT lifetime ───────────────────

  it("sets expires_in to JWT_LIFETIME_S (30 days), not Google's 1-hour expires_in", async () => {
    const idToken = makeIdToken(GOOGLE_USER_CLAIMS);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "ya29.access", id_token: idToken, expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { POST } = await import("@/app/api/auth/token/route");
    const res = await POST(makeRequest(AUTH_CODE_BODY));

    const body = await res.json() as { expires_in: number };
    // Must be 30 days (2592000), NOT Google's 1 hour (3600)
    expect(body.expires_in).toBe(JWT_LIFETIME_S_VALUE);
    expect(body.expires_in).not.toBe(3600);
  });

  it("passes sub, email, householdId (=sub) to signFenrirJwt", async () => {
    const idToken = makeIdToken(GOOGLE_USER_CLAIMS);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "ya29.access", id_token: idToken }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { POST } = await import("@/app/api/auth/token/route");
    await POST(makeRequest(AUTH_CODE_BODY));

    expect(mockSignFenrirJwt).toHaveBeenCalledWith(
      GOOGLE_USER_CLAIMS.sub,
      GOOGLE_USER_CLAIMS.email,
      GOOGLE_USER_CLAIMS.sub, // householdId defaults to sub
    );
  });

  it("includes Google access_token and refresh_token in Fenrir session response", async () => {
    const idToken = makeIdToken(GOOGLE_USER_CLAIMS);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "ya29.access", id_token: idToken, refresh_token: "1//refresh" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { POST } = await import("@/app/api/auth/token/route");
    const res = await POST(makeRequest(AUTH_CODE_BODY));

    const body = await res.json() as { access_token: string; refresh_token: string };
    // Google tokens preserved for Sheets/Picker API calls
    expect(body.access_token).toBe("ya29.access");
    expect(body.refresh_token).toBe("1//refresh");
  });

  // ── Refresh flow: NO Fenrir minting ───────────────────────────────────────

  it("does NOT mint Fenrir JWT for refresh_token flow", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "ya29.new_access", id_token: "new-id-token", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { POST } = await import("@/app/api/auth/token/route");
    await POST(makeRequest({ refresh_token: "1//valid-refresh" }));

    // Fenrir JWT is NOT minted for refresh flows — Google tokens used directly
    expect(mockSignFenrirJwt).not.toHaveBeenCalled();
  });

  // ── Fallback behavior ─────────────────────────────────────────────────────

  it("falls back to raw Google response when Google response has no id_token", async () => {
    // Google returns access_token but no id_token (unusual but defensive)
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "ya29.access", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { POST } = await import("@/app/api/auth/token/route");
    const res = await POST(makeRequest(AUTH_CODE_BODY));

    // Falls back to raw Google response (no fenrir_token)
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.fenrir_token).toBeUndefined();
    expect(mockSignFenrirJwt).not.toHaveBeenCalled();
  });

  it("falls back to raw Google response when id_token is missing sub claim", async () => {
    const idTokenNoSub = makeIdToken({ email: "odin@fenrir.dev" }); // no sub
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "ya29.access", id_token: idTokenNoSub }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { POST } = await import("@/app/api/auth/token/route");
    const res = await POST(makeRequest(AUTH_CODE_BODY));

    // No sub → cannot mint Fenrir JWT → fall back
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.fenrir_token).toBeUndefined();
  });

  it("falls back to raw Google response when signFenrirJwt throws (KMS failure)", async () => {
    const idToken = makeIdToken(GOOGLE_USER_CLAIMS);
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "ya29.access", id_token: idToken }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    // Simulate KMS unavailability
    mockSignFenrirJwt.mockRejectedValueOnce(new Error("KMS key not initialized"));

    const { POST } = await import("@/app/api/auth/token/route");
    const res = await POST(makeRequest(AUTH_CODE_BODY));

    // Login still succeeds — client receives raw Google response
    expect(res.status).toBe(200);
    // No fenrir_token in the raw fallback response
    const body = await res.json() as Record<string, unknown>;
    expect(body.fenrir_token).toBeUndefined();
  });
});
