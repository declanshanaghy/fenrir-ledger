/**
 * Unit tests for lib/trial-utils.ts — localStorage key constants and TrialStatus types.
 *
 * computeFingerprint and isValidFingerprint were removed in issue #1634 (trial
 * moved into household subcollection). Tests for those functions are deleted.
 *
 * @ref Issue #1634
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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
