/**
 * Unit tests for lib/trial-utils.ts — computeFingerprint, isValidFingerprint,
 * and clearTrialStatusCache.
 *
 * Updated for issue #1624: computeFingerprint() now returns raw deviceId (UUID v4),
 * no longer async SHA-256. isValidFingerprint() accepts both UUID v4 (new) and
 * 64-char hex (legacy).
 *
 * @ref Issue #922, #1624
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── computeFingerprint ────────────────────────────────────────────────────────

import { computeFingerprint } from "@/lib/trial-utils";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DEVICE_ID = "a3f4e891-bc12-4d9a-87c3-1f5e209b3d7a";

describe("computeFingerprint", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: vi.fn().mockReturnValue(DEVICE_ID),
        setItem: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "window", {
      value: {},
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the raw deviceId (UUID v4 format)", () => {
    const fp = computeFingerprint();
    expect(fp).toBe(DEVICE_ID);
  });

  it("is synchronous — returns a string directly (not a Promise)", () => {
    const result = computeFingerprint();
    expect(typeof result).toBe("string");
    // Must not be a Promise
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("is stable — same deviceId always yields same fingerprint", () => {
    const fp1 = computeFingerprint();
    const fp2 = computeFingerprint();
    expect(fp1).toBe(fp2);
  });

  it("does NOT include userAgent (stable across browser updates)", () => {
    const fp1 = computeFingerprint();

    Object.defineProperty(globalThis.navigator ?? globalThis, "userAgent", {
      value: "Mozilla/5.0 Chrome/999 — future browser",
      writable: true,
      configurable: true,
    });

    const fp2 = computeFingerprint();
    expect(fp1).toBe(fp2);
  });

  it("returns empty string when window is undefined (SSR)", () => {
    Object.defineProperty(globalThis, "window", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const fp = computeFingerprint();
    expect(fp).toBe("");
  });

  it("still works when called with await (backward-compat call sites)", async () => {
    // Existing call sites use `await computeFingerprint()` — must still work
    // since await on a non-Promise just returns the value.
    const fp = await computeFingerprint();
    expect(fp).toBe(DEVICE_ID);
  });
});

// ── isValidFingerprint ────────────────────────────────────────────────────────

import { isValidFingerprint } from "@/lib/trial-utils";

describe("isValidFingerprint", () => {
  // -- UUID v4 format (current) --

  it("accepts a valid UUID v4 fingerprint", () => {
    expect(isValidFingerprint("a3f4e891-bc12-4d9a-87c3-1f5e209b3d7a")).toBe(true);
  });

  it("accepts another valid UUID v4 fingerprint", () => {
    expect(isValidFingerprint("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects a UUID with uppercase hex", () => {
    expect(isValidFingerprint("A3F4E891-BC12-4D9A-87C3-1F5E209B3D7A")).toBe(false);
  });

  it("rejects a UUID with wrong version digit (version 3)", () => {
    expect(isValidFingerprint("a3f4e891-bc12-3d9a-87c3-1f5e209b3d7a")).toBe(false);
  });

  it("rejects a UUID missing dashes", () => {
    expect(isValidFingerprint("a3f4e891bc124d9a87c31f5e209b3d7a")).toBe(false);
  });

  // -- Legacy 64-char hex format (migration) --

  it("accepts a valid 64-character lowercase hex string (legacy format)", () => {
    expect(isValidFingerprint("a".repeat(64))).toBe(true);
  });

  it("accepts mixed lowercase hex digits (legacy format)", () => {
    expect(isValidFingerprint("0123456789abcdef".repeat(4))).toBe(true);
  });

  it("rejects a legacy hex string shorter than 64 chars", () => {
    expect(isValidFingerprint("a".repeat(63))).toBe(false);
  });

  it("rejects a legacy hex string longer than 64 chars", () => {
    expect(isValidFingerprint("a".repeat(65))).toBe(false);
  });

  it("rejects uppercase hex characters in legacy format", () => {
    expect(isValidFingerprint("A".repeat(64))).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidFingerprint("g".repeat(64))).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidFingerprint("")).toBe(false);
  });
});

// ── clearTrialStatusCache ─────────────────────────────────────────────────────

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
