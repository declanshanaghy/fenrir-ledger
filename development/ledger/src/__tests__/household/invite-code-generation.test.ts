/**
 * Unit tests — Invite code generation and validation
 *
 * Tests the pure utility functions in firestore-types.ts:
 *   - generateInviteCode() format + randomness
 *   - generateInviteCodeExpiry() 1-month window
 *   - isInviteCodeValid() expiry check
 *
 * Issue #1123 — Household invite code flow
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  generateInviteCode,
  generateInviteCodeExpiry,
  isInviteCodeValid,
} from "@/lib/firebase/firestore-types";

const VALID_CODE_PATTERN = /^[A-Z2-9]{6}$/;
/** Characters that should never appear (ambiguous: O, 0, I, 1) */
const AMBIGUOUS_CHARS = /[O01I]/;

describe("generateInviteCode()", () => {
  it("returns a 6-character string", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(6);
  });

  it("contains only unambiguous alphanumeric characters (A-Z2-9, no O/0/I/1)", () => {
    const code = generateInviteCode();
    expect(code).toMatch(VALID_CODE_PATTERN);
    expect(code).not.toMatch(AMBIGUOUS_CHARS);
  });

  it("produces different codes on successive calls (randomness check)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    // With 32^6 ≈ 1 billion possibilities, 20 collisions would be astronomically unlikely
    expect(codes.size).toBeGreaterThan(1);
  });

  it("never includes lowercase characters", () => {
    for (let i = 0; i < 10; i++) {
      const code = generateInviteCode();
      expect(code).toBe(code.toUpperCase());
    }
  });
});

describe("generateInviteCodeExpiry()", () => {
  it("returns a valid ISO 8601 timestamp", () => {
    const expiry = generateInviteCodeExpiry();
    expect(() => new Date(expiry)).not.toThrow();
    expect(new Date(expiry).toISOString()).toBe(expiry);
  });

  it("is approximately 30 days from now", () => {
    const before = Date.now();
    const expiry = generateInviteCodeExpiry();
    const after = Date.now();

    const expiryMs = new Date(expiry).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    // Allow 1 second tolerance
    expect(expiryMs).toBeGreaterThanOrEqual(before + thirtyDaysMs - 1000);
    expect(expiryMs).toBeLessThanOrEqual(after + thirtyDaysMs + 1000);
  });
});

describe("isInviteCodeValid()", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for an expiry in the future", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isInviteCodeValid(future)).toBe(true);
  });

  it("returns false for an expiry in the past", () => {
    const past = new Date(Date.now() - 1).toISOString();
    expect(isInviteCodeValid(past)).toBe(false);
  });

  it("returns false for an expiry exactly at now (boundary)", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const boundary = new Date(now).toISOString();
    // now === expiresAt, so not strictly greater
    expect(isInviteCodeValid(boundary)).toBe(false);
    vi.useRealTimers();
  });

  it("returns true for a freshly generated expiry", () => {
    const expiry = generateInviteCodeExpiry();
    expect(isInviteCodeValid(expiry)).toBe(true);
  });

  it("handles expired codes 1 year old", () => {
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(isInviteCodeValid(yearAgo)).toBe(false);
  });
});
