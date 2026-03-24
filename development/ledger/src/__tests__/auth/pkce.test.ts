/**
 * Unit tests for lib/auth/pkce.ts — Fenrir Ledger
 *
 * Tests PKCE OAuth helper functions:
 *   - generateCodeVerifier: 128-char base64url, only valid chars, unique each call
 *   - generateCodeChallenge: valid base64url, deterministic for same input,
 *     different from verifier, S256 correctness
 *   - generateState: 32-char hex, only hex chars, unique each call
 *
 * Uses Web Crypto API (available in Vitest's jsdom/node environment).
 *
 * @see src/lib/auth/pkce.ts
 * @ref #1848
 */

import { describe, it, expect } from "vitest";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from "@/lib/auth/pkce";

// ─── Base64url character set ───────────────────────────────────────────────────

const BASE64URL_REGEX = /^[A-Za-z0-9\-_]+$/;

// ─── generateCodeVerifier ─────────────────────────────────────────────────────

describe("generateCodeVerifier", () => {
  it("returns a 128-character string (96 bytes → base64url)", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toHaveLength(128);
  });

  it("contains only base64url characters (A-Z a-z 0-9 - _)", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(BASE64URL_REGEX);
  });

  it("generates unique values across calls (cryptographically random)", () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(v1).not.toBe(v2);
  });

});

// ─── generateCodeChallenge ────────────────────────────────────────────────────

describe("generateCodeChallenge", () => {
  it("returns a base64url-encoded string (only valid chars)", async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toMatch(BASE64URL_REGEX);
  });

  it("is deterministic — same verifier always produces same challenge", async () => {
    const verifier = "fixed-verifier-for-determinism-test-abc123";
    const c1 = await generateCodeChallenge(verifier);
    const c2 = await generateCodeChallenge(verifier);
    expect(c1).toBe(c2);
  });

  it("produces different output for different verifiers", async () => {
    const c1 = await generateCodeChallenge("verifier-alpha");
    const c2 = await generateCodeChallenge("verifier-beta");
    expect(c1).not.toBe(c2);
  });

  it("challenge differs from the original verifier (hash not identity)", async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).not.toBe(verifier);
  });

  it("SHA-256 of empty string produces correct base64url", async () => {
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    // base64url = 47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU
    const challenge = await generateCodeChallenge("");
    expect(challenge).toBe("47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU");
  });
});

// ─── generateState ────────────────────────────────────────────────────────────

describe("generateState", () => {
  it("returns a 32-character string (16 bytes → hex)", () => {
    const state = generateState();
    expect(state).toHaveLength(32);
  });

  it("contains only lowercase hex characters", () => {
    const state = generateState();
    expect(state).toMatch(/^[0-9a-f]{32}$/);
  });

  it("generates unique values across calls (cryptographically random)", () => {
    const s1 = generateState();
    const s2 = generateState();
    expect(s1).not.toBe(s2);
  });

});
