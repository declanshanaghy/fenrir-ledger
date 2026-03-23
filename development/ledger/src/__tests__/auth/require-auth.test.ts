/**
 * Unit tests for requireAuth() — Fenrir Ledger
 *
 * Tests the route-level auth guard that extracts Bearer tokens from
 * the Authorization header and verifies them via Google id_token verification.
 *
 * All external dependencies (verifyIdToken) are mocked via vi.mock.
 *
 * @see src/lib/auth/require-auth.ts
 * @ref #570
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/verify-id-token", () => ({
  verifyIdToken: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn() },
}));

import { verifyIdToken } from "@/lib/auth/verify-id-token";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", { headers });
}

const VALID_USER = {
  sub: "google-sub-123",
  email: "odin@fenrir.dev",
  name: "Odin Allfather",
  picture: "https://example.com/odin.jpg",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("requireAuth", () => {
  // ═══════════════════════════════════════════════════════════════════════
  // Happy path
  // ═══════════════════════════════════════════════════════════════════════

  it("returns ok:true with verified user for valid Bearer token", async () => {
    vi.mocked(verifyIdToken).mockResolvedValue({ ok: true, user: VALID_USER });

    const result = await requireAuth(
      makeRequest({ authorization: "Bearer valid-token-abc" })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user).toEqual(VALID_USER);
    }
    expect(verifyIdToken).toHaveBeenCalledWith("valid-token-abc");
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
    expect(verifyIdToken).not.toHaveBeenCalled();
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
    expect(verifyIdToken).not.toHaveBeenCalled();
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

  // ═══════════════════════════════════════════════════════════════════════
  // Malformed Authorization header
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 401 missing_token for lowercase 'bearer' prefix", async () => {
    // The check is case-sensitive: "Bearer " not "bearer "
    const result = await requireAuth(
      makeRequest({ authorization: "bearer some-token" })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("strips exactly 'Bearer ' prefix and passes remainder to verifyIdToken", async () => {
    vi.mocked(verifyIdToken).mockResolvedValue({ ok: true, user: VALID_USER });

    await requireAuth(
      makeRequest({ authorization: "Bearer token-with-spaces in it" })
    );

    expect(verifyIdToken).toHaveBeenCalledWith("token-with-spaces in it");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Expired token
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 401 invalid_token when token is expired", async () => {
    vi.mocked(verifyIdToken).mockResolvedValue({
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

  // ═══════════════════════════════════════════════════════════════════════
  // Invalid token (generic)
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 401 invalid_token when token signature is invalid", async () => {
    vi.mocked(verifyIdToken).mockResolvedValue({
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
  // Audience mismatch (403)
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 403 invalid_token when token audience does not match", async () => {
    vi.mocked(verifyIdToken).mockResolvedValue({
      ok: false,
      error: "Token audience mismatch.",
      status: 403,
    });

    const result = await requireAuth(
      makeRequest({ authorization: "Bearer wrong-aud-token" })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(403);
      expect(body.error).toBe("invalid_token");
      expect(body.error_description).toBe("Token audience mismatch.");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Server error (500)
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 500 invalid_token when auth is not configured", async () => {
    vi.mocked(verifyIdToken).mockResolvedValue({
      ok: false,
      error: "Auth not configured.",
      status: 500,
    });

    const result = await requireAuth(
      makeRequest({ authorization: "Bearer any-token" })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(500);
      expect(body.error).toBe("invalid_token");
      expect(body.error_description).toBe("Auth not configured.");
    }
  });
});
