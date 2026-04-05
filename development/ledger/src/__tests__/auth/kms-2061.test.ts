/**
 * Unit tests for JWT secret init utility — Fenrir Ledger
 *
 * Tests the initJwtSecret / getJwtSecret lifecycle:
 *   - Reads FENRIR_JWT_SECRET env var
 *   - Error paths: missing env var, calling getJwtSecret before init
 *   - Idempotent init
 *
 * @see src/lib/auth/kms.ts
 * @ref #2061
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  initJwtSecret,
  getJwtSecret,
  _resetJwtSecretForTesting,
} from "@/lib/auth/kms";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("initJwtSecret", () => {
  beforeEach(() => {
    _resetJwtSecretForTesting();
  });

  afterEach(() => {
    _resetJwtSecretForTesting();
  });

  it("reads FENRIR_JWT_SECRET and caches it", async () => {
    setEnv({ FENRIR_JWT_SECRET: "test-signing-secret-abc" });
    await initJwtSecret();
    expect(getJwtSecret()).toBe("test-signing-secret-abc");
  });

  it("throws if FENRIR_JWT_SECRET is missing", async () => {
    setEnv({ FENRIR_JWT_SECRET: undefined });
    await expect(initJwtSecret()).rejects.toThrow("FENRIR_JWT_SECRET");
  });

  it("is idempotent — second call is a no-op", async () => {
    setEnv({ FENRIR_JWT_SECRET: "first-secret" });
    await initJwtSecret();

    // Change env — should NOT affect the cached value
    setEnv({ FENRIR_JWT_SECRET: "second-secret" });
    await initJwtSecret();
    expect(getJwtSecret()).toBe("first-secret");
  });

  it("retries after a failure (cache stays empty on error)", async () => {
    setEnv({ FENRIR_JWT_SECRET: undefined });
    await expect(initJwtSecret()).rejects.toThrow("FENRIR_JWT_SECRET");

    // Now set it and retry — should succeed
    setEnv({ FENRIR_JWT_SECRET: "retry-secret" });
    await initJwtSecret();
    expect(getJwtSecret()).toBe("retry-secret");
  });
});

describe("getJwtSecret — before init", () => {
  beforeEach(() => {
    _resetJwtSecretForTesting();
  });

  it("throws a descriptive error if called before initJwtSecret", () => {
    expect(() => getJwtSecret()).toThrow("not initialised");
  });
});
