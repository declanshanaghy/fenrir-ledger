/**
 * Unit tests for household invite code helpers in firestore-types.ts
 *
 * Issue #1123 — household invite code flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateInviteCode,
  generateInviteCodeExpiry,
  isInviteCodeValid,
} from "@/lib/firebase/firestore-types";

describe("generateInviteCode", () => {
  it("generates a 6-character code", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(6);
  });

  it("uses only allowed characters (A-Z no I/O, 2-9 no 0/1)", () => {
    // Run multiple times to catch character set issues
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it("generates different codes across calls (not deterministic)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    // With 32^6 possible codes, 20 calls should never collide
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("generateInviteCodeExpiry", () => {
  it("returns an ISO 8601 timestamp roughly 30 days in the future", () => {
    const before = Date.now();
    const expiry = generateInviteCodeExpiry();
    const after = Date.now();

    const expiryTime = new Date(expiry).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    expect(expiryTime).toBeGreaterThanOrEqual(before + thirtyDaysMs - 1000);
    expect(expiryTime).toBeLessThanOrEqual(after + thirtyDaysMs + 1000);
  });

  it("returns a valid ISO 8601 string", () => {
    const expiry = generateInviteCodeExpiry();
    expect(new Date(expiry).toISOString()).toBe(expiry);
  });
});

describe("isInviteCodeValid", () => {
  it("returns true for a future expiry timestamp", () => {
    const futureExpiry = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    expect(isInviteCodeValid(futureExpiry)).toBe(true);
  });

  it("returns false for a past expiry timestamp", () => {
    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    expect(isInviteCodeValid(pastExpiry)).toBe(false);
  });

  it("returns false for an expiry exactly at the epoch (very old)", () => {
    expect(isInviteCodeValid("1970-01-01T00:00:00.000Z")).toBe(false);
  });
});
