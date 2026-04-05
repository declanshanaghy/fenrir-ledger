/**
 * Unit tests for JWT secret utility — Fenrir Ledger
 *
 * Tests getJwtSecret() which reads directly from process.env.FENRIR_JWT_SECRET.
 * No init step needed — the env var is available in all worker processes.
 *
 * @see src/lib/auth/kms.ts
 * @ref #2061
 */

import { describe, it, expect, afterEach } from "vitest";

import { initJwtSecret, getJwtSecret } from "@/lib/auth/kms";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORIGINAL_SECRET = process.env.FENRIR_JWT_SECRET;

function restoreEnv() {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.FENRIR_JWT_SECRET;
  } else {
    process.env.FENRIR_JWT_SECRET = ORIGINAL_SECRET;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getJwtSecret", () => {
  afterEach(restoreEnv);

  it("returns the env var value", () => {
    process.env.FENRIR_JWT_SECRET = "test-signing-secret-abc";
    expect(getJwtSecret()).toBe("test-signing-secret-abc");
  });

  it("throws if FENRIR_JWT_SECRET is missing", () => {
    delete process.env.FENRIR_JWT_SECRET;
    expect(() => getJwtSecret()).toThrow("FENRIR_JWT_SECRET");
  });

  it("reads the current env var value each time (no stale cache)", () => {
    process.env.FENRIR_JWT_SECRET = "first-secret";
    expect(getJwtSecret()).toBe("first-secret");

    process.env.FENRIR_JWT_SECRET = "second-secret";
    expect(getJwtSecret()).toBe("second-secret");
  });
});

describe("initJwtSecret", () => {
  afterEach(restoreEnv);

  it("validates the env var is present (no-op otherwise)", async () => {
    process.env.FENRIR_JWT_SECRET = "test-secret";
    await expect(initJwtSecret()).resolves.toBeUndefined();
  });

  it("throws if FENRIR_JWT_SECRET is missing", async () => {
    delete process.env.FENRIR_JWT_SECRET;
    expect(() => initJwtSecret()).toThrow("FENRIR_JWT_SECRET");
  });
});
