/**
 * Unit tests for requireAuth() — Fenrir Ledger
 *
 * Tests the route-level auth guard that extracts Bearer tokens from
 * the Authorization header and verifies them via Fenrir JWT verification.
 *
 * All external dependencies (verifyFenrirJwt, signFenrirJwt, needsSlidingRefresh)
 * are mocked via vi.mock.
 *
 * @see src/lib/auth/require-auth.ts
 * @ref #2060 (Fenrir JWT session migration)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { requireAuth, applyTokenRefresh } from "@/lib/auth/require-auth";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/fenrir-jwt", () => ({
  verifyFenrirJwt: vi.fn(),
  signFenrirJwt: vi.fn(),
  needsSlidingRefresh: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { verifyFenrirJwt, signFenrirJwt, needsSlidingRefresh } from "@/lib/auth/fenrir-jwt";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", { headers });
}

const VALID_PAYLOAD = {
  sub: "google-sub-123",
  email: "odin@fenrir.dev",
  householdId: "google-sub-123",
  iat: Math.floor(Date.now() / 1000) - 5, // 5 seconds old
  exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days from now
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(needsSlidingRefresh).mockReturnValue(false); // fresh by default
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Happy path
  // ═══════════════════════════════════════════════════════════════════════

  it("returns ok:true with verified user for valid Fenrir JWT", async () => {
    vi.mocked(verifyFenrirJwt).mockResolvedValue({ ok: true, payload: VALID_PAYLOAD });

    const result = await requireAuth(
      makeRequest({ authorization: "Bearer valid-fenrir-token" })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.sub).toBe(VALID_PAYLOAD.sub);
      expect(result.user.email).toBe(VALID_PAYLOAD.email);
      expect(result.user.householdId).toBe(VALID_PAYLOAD.householdId);
      expect(result.newToken).toBeUndefined(); // no refresh needed
    }
    expect(verifyFenrirJwt).toHaveBeenCalledWith("valid-fenrir-token");
  });

  it("strips exactly 'Bearer ' prefix and passes remainder to verifyFenrirJwt", async () => {
    vi.mocked(verifyFenrirJwt).mockResolvedValue({ ok: true, payload: VALID_PAYLOAD });

    await requireAuth(
      makeRequest({ authorization: "Bearer token-with-spaces in it" })
    );

    expect(verifyFenrirJwt).toHaveBeenCalledWith("token-with-spaces in it");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Missing token
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 401 missing_token when no Authorization header", async () => {
    const result = await requireAuth(makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(401);
      expect(body.error).toBe("missing_token");
    }
    expect(verifyFenrirJwt).not.toHaveBeenCalled();
  });

  it("returns 401 missing_token when Authorization header has no Bearer prefix", async () => {
    const result = await requireAuth(
      makeRequest({ authorization: "Basic dXNlcjpwYXNz" })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(401);
      expect(body.error).toBe("missing_token");
    }
    expect(verifyFenrirJwt).not.toHaveBeenCalled();
  });

  it("returns 401 missing_token when Authorization header is empty string", async () => {
    const result = await requireAuth(makeRequest({ authorization: "" }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(401);
      expect(body.error).toBe("missing_token");
    }
  });

  it("returns 401 missing_token for lowercase 'bearer' prefix", async () => {
    const result = await requireAuth(
      makeRequest({ authorization: "bearer some-token" })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Invalid / expired token
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 401 invalid_token when Fenrir JWT is expired", async () => {
    vi.mocked(verifyFenrirJwt).mockResolvedValue({
      ok: false,
      error: "Token expired.",
      status: 401,
    });

    const result = await requireAuth(
      makeRequest({ authorization: "Bearer expired-token" })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(401);
      expect(body.error).toBe("invalid_token");
      expect(body.error_description).toBe("Token expired.");
    }
  });

  it("returns 401 invalid_token when Fenrir JWT signature is invalid", async () => {
    vi.mocked(verifyFenrirJwt).mockResolvedValue({
      ok: false,
      error: "Invalid token.",
      status: 401,
    });

    const result = await requireAuth(
      makeRequest({ authorization: "Bearer bad-sig-token" })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(401);
      expect(body.error).toBe("invalid_token");
      expect(body.error_description).toBe("Invalid token.");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Sliding window refresh
  // ═══════════════════════════════════════════════════════════════════════

  it("returns newToken when sliding window refresh is triggered", async () => {
    vi.mocked(verifyFenrirJwt).mockResolvedValue({ ok: true, payload: VALID_PAYLOAD });
    vi.mocked(needsSlidingRefresh).mockReturnValue(true);
    vi.mocked(signFenrirJwt).mockResolvedValue("new-fenrir-token-xyz");

    const result = await requireAuth(
      makeRequest({ authorization: "Bearer old-fenrir-token" })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newToken).toBe("new-fenrir-token-xyz");
    }
    expect(signFenrirJwt).toHaveBeenCalledWith(
      VALID_PAYLOAD.sub,
      VALID_PAYLOAD.email,
      VALID_PAYLOAD.householdId,
    );
  });

  it("returns no newToken when sliding window refresh is not needed", async () => {
    vi.mocked(verifyFenrirJwt).mockResolvedValue({ ok: true, payload: VALID_PAYLOAD });
    vi.mocked(needsSlidingRefresh).mockReturnValue(false);

    const result = await requireAuth(
      makeRequest({ authorization: "Bearer fresh-fenrir-token" })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newToken).toBeUndefined();
    }
    expect(signFenrirJwt).not.toHaveBeenCalled();
  });

  it("succeeds even if sliding window mint throws (non-fatal)", async () => {
    vi.mocked(verifyFenrirJwt).mockResolvedValue({ ok: true, payload: VALID_PAYLOAD });
    vi.mocked(needsSlidingRefresh).mockReturnValue(true);
    vi.mocked(signFenrirJwt).mockRejectedValue(new Error("KMS unavailable"));

    const result = await requireAuth(
      makeRequest({ authorization: "Bearer fenrir-token" })
    );

    // Auth still succeeds — the existing token is still valid
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.newToken).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// applyTokenRefresh helper
// ---------------------------------------------------------------------------

describe("applyTokenRefresh", () => {
  it("sets X-Fenrir-Token header when newToken is present", () => {
    const response = NextResponse.json({ ok: true });
    const auth = { ok: true as const, user: { sub: "s", email: "e", householdId: "h" }, newToken: "new-tok" };
    applyTokenRefresh(response, auth);
    expect(response.headers.get("X-Fenrir-Token")).toBe("new-tok");
  });

  it("does not set X-Fenrir-Token when newToken is absent", () => {
    const response = NextResponse.json({ ok: true });
    const auth = { ok: true as const, user: { sub: "s", email: "e", householdId: "h" } };
    applyTokenRefresh(response, auth);
    expect(response.headers.get("X-Fenrir-Token")).toBeNull();
  });
});
