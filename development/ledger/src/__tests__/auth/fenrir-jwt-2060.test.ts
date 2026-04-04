/**
 * Unit tests for Fenrir JWT sign/verify/sliding-window — Fenrir Ledger
 *
 * Tests the server-issued session token lifecycle:
 *   - signFenrirJwt(): mints HS256 JWT with correct payload and 30-day expiry
 *   - verifyFenrirJwt(): verifies signature and exp, returns typed payload
 *   - needsSlidingRefresh(): triggers at > 15 days, not before
 *   - End-to-end: sign then verify round-trip
 *
 * Uses a real (non-mocked) jose implementation with a test secret.
 * Mocks kms.getJwtSecret() to return the test secret.
 *
 * @see src/lib/auth/fenrir-jwt.ts
 * @ref issue #2060
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock kms module — inject test secret without KMS
// ---------------------------------------------------------------------------

const TEST_SECRET = "test-fenrir-signing-secret-32-chars!!";

vi.mock("@/lib/auth/kms", () => ({
  getJwtSecret: vi.fn(() => TEST_SECRET),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  signFenrirJwt,
  verifyFenrirJwt,
  needsSlidingRefresh,
  JWT_LIFETIME_S,
  SLIDING_WINDOW_S,
} from "@/lib/auth/fenrir-jwt";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_SUB = "google-sub-test-123";
const SAMPLE_EMAIL = "odin@fenrir.dev";
const SAMPLE_HOUSEHOLD = "google-sub-test-123";

// ---------------------------------------------------------------------------
// signFenrirJwt
// ---------------------------------------------------------------------------

describe("signFenrirJwt", () => {
  it("returns a compact JWT string (three dot-separated segments)", async () => {
    const token = await signFenrirJwt(SAMPLE_SUB, SAMPLE_EMAIL, SAMPLE_HOUSEHOLD);
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
  });

  it("embeds the correct sub, email, and householdId in the payload", async () => {
    const token = await signFenrirJwt(SAMPLE_SUB, SAMPLE_EMAIL, SAMPLE_HOUSEHOLD);

    // Decode payload (no signature check — just inspecting the claims)
    const [, payloadB64] = token.split(".");
    const padded = payloadB64!.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(padded + "=".repeat((4 - (padded.length % 4)) % 4))) as Record<string, unknown>;

    expect(decoded.sub).toBe(SAMPLE_SUB);
    expect(decoded.email).toBe(SAMPLE_EMAIL);
    expect(decoded.householdId).toBe(SAMPLE_HOUSEHOLD);
  });

  it("sets exp to approximately 30 days from now", async () => {
    const beforeSign = Math.floor(Date.now() / 1000);
    const token = await signFenrirJwt(SAMPLE_SUB, SAMPLE_EMAIL, SAMPLE_HOUSEHOLD);
    const afterSign = Math.floor(Date.now() / 1000);

    const [, payloadB64] = token.split(".");
    const padded = payloadB64!.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(padded + "=".repeat((4 - (padded.length % 4)) % 4))) as { exp: number; iat: number };

    // exp should be iat + JWT_LIFETIME_S (± 2 seconds tolerance)
    expect(decoded.exp).toBeGreaterThanOrEqual(beforeSign + JWT_LIFETIME_S - 2);
    expect(decoded.exp).toBeLessThanOrEqual(afterSign + JWT_LIFETIME_S + 2);
  });

  it("sets iat to approximately the current time", async () => {
    const beforeSign = Math.floor(Date.now() / 1000);
    const token = await signFenrirJwt(SAMPLE_SUB, SAMPLE_EMAIL, SAMPLE_HOUSEHOLD);
    const afterSign = Math.floor(Date.now() / 1000);

    const [, payloadB64] = token.split(".");
    const padded = payloadB64!.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(padded + "=".repeat((4 - (padded.length % 4)) % 4))) as { iat: number };

    expect(decoded.iat).toBeGreaterThanOrEqual(beforeSign);
    expect(decoded.iat).toBeLessThanOrEqual(afterSign + 2);
  });
});

// ---------------------------------------------------------------------------
// verifyFenrirJwt — valid tokens
// ---------------------------------------------------------------------------

describe("verifyFenrirJwt — valid tokens", () => {
  it("returns ok:true with full payload for a freshly signed token", async () => {
    const token = await signFenrirJwt(SAMPLE_SUB, SAMPLE_EMAIL, SAMPLE_HOUSEHOLD);
    const result = await verifyFenrirJwt(token);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.sub).toBe(SAMPLE_SUB);
      expect(result.payload.email).toBe(SAMPLE_EMAIL);
      expect(result.payload.householdId).toBe(SAMPLE_HOUSEHOLD);
      expect(result.payload.iat).toBeTypeOf("number");
      expect(result.payload.exp).toBeTypeOf("number");
    }
  });

  it("round-trips: sign then verify returns the same sub", async () => {
    const sub = "round-trip-sub-abc";
    const email = "roundtrip@fenrir.dev";
    const household = "round-trip-sub-abc";

    const token = await signFenrirJwt(sub, email, household);
    const result = await verifyFenrirJwt(token);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.sub).toBe(sub);
      expect(result.payload.email).toBe(email);
      expect(result.payload.householdId).toBe(household);
    }
  });
});

// ---------------------------------------------------------------------------
// verifyFenrirJwt — invalid tokens
// ---------------------------------------------------------------------------

describe("verifyFenrirJwt — invalid tokens", () => {
  it("returns ok:false for a completely invalid string", async () => {
    const result = await verifyFenrirJwt("not-a-jwt");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toMatch(/invalid/i);
    }
  });

  it("returns ok:false for a JWT signed with the wrong secret", async () => {
    // Forge a JWT signed with a different secret using jose directly
    const { SignJWT } = await import("jose");
    const wrongKey = new TextEncoder().encode("wrong-secret-never-matches-test");
    const forgedToken = await new SignJWT({ sub: SAMPLE_SUB, email: SAMPLE_EMAIL, householdId: SAMPLE_HOUSEHOLD })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(wrongKey);

    const result = await verifyFenrirJwt(forgedToken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });

  it("returns ok:false with 'expired' error for an expired JWT", async () => {
    // Forge a JWT that is already expired (exp in the past)
    const { SignJWT } = await import("jose");
    const key = new TextEncoder().encode(TEST_SECRET);
    const expiredToken = await new SignJWT({ sub: SAMPLE_SUB, email: SAMPLE_EMAIL, householdId: SAMPLE_HOUSEHOLD })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60) // 31 days ago
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60) // expired 60 seconds ago
      .sign(key);

    const result = await verifyFenrirJwt(expiredToken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toMatch(/expired/i);
    }
  });

  it("returns ok:false for a malformed token (wrong segment count)", async () => {
    const result = await verifyFenrirJwt("header.payload"); // missing signature
    expect(result.ok).toBe(false);
  });

  it("returns ok:false for an empty string", async () => {
    const result = await verifyFenrirJwt("");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// needsSlidingRefresh
// ---------------------------------------------------------------------------

describe("needsSlidingRefresh", () => {
  const nowS = () => Math.floor(Date.now() / 1000);

  it("returns false when token is fresh (just issued)", () => {
    const iat = nowS();
    expect(needsSlidingRefresh(iat)).toBe(false);
  });

  it("returns false when token is 10 days old (below 15-day threshold)", () => {
    const iat = nowS() - 10 * 24 * 60 * 60;
    expect(needsSlidingRefresh(iat)).toBe(false);
  });

  it("returns false when token is exactly at SLIDING_WINDOW_S boundary (not past it)", () => {
    const iat = nowS() - SLIDING_WINDOW_S;
    // Exactly at boundary — not strictly greater than, so false
    expect(needsSlidingRefresh(iat)).toBe(false);
  });

  it("returns true when token is past the 15-day threshold", () => {
    const iat = nowS() - (SLIDING_WINDOW_S + 60); // 15 days + 1 minute old
    expect(needsSlidingRefresh(iat)).toBe(true);
  });

  it("returns true when token is 20 days old", () => {
    const iat = nowS() - 20 * 24 * 60 * 60;
    expect(needsSlidingRefresh(iat)).toBe(true);
  });

  it("returns true when token is 29 days old (still valid, but needs refresh)", () => {
    const iat = nowS() - 29 * 24 * 60 * 60;
    expect(needsSlidingRefresh(iat)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("JWT constants", () => {
  it("JWT_LIFETIME_S is 30 days in seconds", () => {
    expect(JWT_LIFETIME_S).toBe(30 * 24 * 60 * 60);
  });

  it("SLIDING_WINDOW_S is 15 days in seconds", () => {
    expect(SLIDING_WINDOW_S).toBe(15 * 24 * 60 * 60);
  });

  it("sliding window threshold is exactly half of lifetime", () => {
    expect(SLIDING_WINDOW_S).toBe(JWT_LIFETIME_S / 2);
  });
});
