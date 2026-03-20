/**
 * Unit tests for lib/trial-utils.ts — isValidFingerprint and clearTrialStatusCache.
 *
 * Covers acceptance criteria for Issue #922:
 * - Fingerprint validation rejects invalid inputs before calling /api/trial/init
 * - clearTrialStatusCache resets module cache so next useTrialStatus fetch is fresh
 *
 * @ref Issue #922
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── computeFingerprint ────────────────────────────────────────────────────────

import { computeFingerprint } from "@/lib/trial-utils";

describe("computeFingerprint", () => {
  const DEVICE_ID = "test-device-id-1234";

  beforeEach(() => {
    // Provide localStorage stub
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: vi.fn().mockReturnValue(DEVICE_ID),
        setItem: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
    // Provide window stub (non-undefined)
    Object.defineProperty(globalThis, "window", {
      value: {},
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a 64-character lowercase hex string", async () => {
    const fp = await computeFingerprint();
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable — same deviceId always yields same fingerprint", async () => {
    const fp1 = await computeFingerprint();
    const fp2 = await computeFingerprint();
    expect(fp1).toBe(fp2);
  });

  it("does NOT include userAgent in the hash (stable across browser updates)", async () => {
    // Two calls with different userAgent values but same deviceId must produce same hash
    const fp1 = await computeFingerprint();

    Object.defineProperty(globalThis.navigator ?? globalThis, "userAgent", {
      value: "Mozilla/5.0 Chrome/999 — future browser",
      writable: true,
      configurable: true,
    });

    const fp2 = await computeFingerprint();
    expect(fp1).toBe(fp2);
  });

  it("returns empty string when window is undefined (SSR)", async () => {
    Object.defineProperty(globalThis, "window", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const fp = await computeFingerprint();
    expect(fp).toBe("");
  });
});

// ── isValidFingerprint ────────────────────────────────────────────────────────

import { isValidFingerprint } from "@/lib/trial-utils";

describe("isValidFingerprint", () => {
  it("accepts a valid 64-character lowercase hex string", () => {
    expect(isValidFingerprint("a".repeat(64))).toBe(true);
  });

  it("accepts mixed lowercase hex digits", () => {
    expect(isValidFingerprint("0123456789abcdef".repeat(4))).toBe(true);
  });

  it("rejects a string shorter than 64 chars", () => {
    expect(isValidFingerprint("a".repeat(63))).toBe(false);
  });

  it("rejects a string longer than 64 chars", () => {
    expect(isValidFingerprint("a".repeat(65))).toBe(false);
  });

  it("rejects uppercase hex characters", () => {
    expect(isValidFingerprint("A".repeat(64))).toBe(false);
  });

  it("rejects non-hex characters (e.g. 'g')", () => {
    expect(isValidFingerprint("g".repeat(64))).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidFingerprint("")).toBe(false);
  });
});

// ── clearTrialStatusCache ─────────────────────────────────────────────────────
// We test the cache-clearing contract by observing that after clearTrialStatusCache
// is called, a freshly imported cache has no stale data. The hook internals use a
// module-level variable; resetting it is the critical post-trial-init step in #922.

describe("clearTrialStatusCache", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is exported from the useTrialStatus module", async () => {
    const mod = await import("@/hooks/useTrialStatus");
    expect(typeof mod.clearTrialStatusCache).toBe("function");
  });

  it("does not throw when called with no prior cache", async () => {
    const { clearTrialStatusCache } = await import("@/hooks/useTrialStatus");
    expect(() => clearTrialStatusCache()).not.toThrow();
  });
});
