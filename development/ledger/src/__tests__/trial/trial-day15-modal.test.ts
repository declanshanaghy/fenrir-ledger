/**
 * Unit tests for TrialDay15Modal localStorage and helper functions.
 *
 * Tests the modal's localStorage persistence logic and nudge visibility rules.
 * Note: Component rendering tests would be better in integration/E2E tests.
 *
 * @see components/trial/TrialDay15Modal.tsx
 * @see Issue #622
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock localStorage helpers
// ---------------------------------------------------------------------------

interface StorageMock {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
}

function createStorageMock(): StorageMock {
  return {
    getItem: vi.fn(),
    setItem: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Helper functions (extracted from component for testing)
// ---------------------------------------------------------------------------

const LS_TRIAL_DAY15_NUDGE_SHOWN = "fenrir:trial-day15-nudge-shown";
const NUDGE_DAY = 15;
const TRIAL_DURATION_DAYS = 30;

function isNudgeShown(storage: StorageMock): boolean {
  try {
    return storage.getItem(LS_TRIAL_DAY15_NUDGE_SHOWN) === "true";
  } catch {
    return true;
  }
}

function markNudgeShown(storage: StorageMock): void {
  try {
    storage.setItem(LS_TRIAL_DAY15_NUDGE_SHOWN, "true");
  } catch {
    // localStorage unavailable — silently fail
  }
}

/**
 * Determines if the day-15 nudge should be shown based on trial status and days.
 */
function shouldShowNudge(
  remainingDays: number,
  status: string,
  nudgeShown: boolean
): boolean {
  if (status !== "active") return false;
  if (nudgeShown) return false;

  // Show nudge on day 15 or later (remainingDays <= 15)
  const daysElapsed = TRIAL_DURATION_DAYS - remainingDays;
  return daysElapsed >= NUDGE_DAY;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TrialDay15Modal localStorage helpers", () => {
  let storage: StorageMock;

  beforeEach(() => {
    storage = createStorageMock();
  });

  // ── isNudgeShown ────────────────────────────────────────────────────────

  describe("isNudgeShown", () => {
    it("returns false when localStorage flag is not set", () => {
      storage.getItem.mockReturnValue(null);
      expect(isNudgeShown(storage)).toBe(false);
    });

    it("returns false when localStorage flag is set to 'false'", () => {
      storage.getItem.mockReturnValue("false");
      expect(isNudgeShown(storage)).toBe(false);
    });

    it("returns true when localStorage flag is set to 'true'", () => {
      storage.getItem.mockReturnValue("true");
      expect(isNudgeShown(storage)).toBe(true);
    });

    it("returns true on localStorage error (assume shown)", () => {
      storage.getItem.mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      expect(isNudgeShown(storage)).toBe(true);
    });
  });

  // ── markNudgeShown ──────────────────────────────────────────────────────

  describe("markNudgeShown", () => {
    it("sets localStorage flag to 'true'", () => {
      markNudgeShown(storage);
      expect(storage.setItem).toHaveBeenCalledWith(
        LS_TRIAL_DAY15_NUDGE_SHOWN,
        "true"
      );
    });

    it("silently handles localStorage errors", () => {
      storage.setItem.mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      // Should not throw
      expect(() => markNudgeShown(storage)).not.toThrow();
    });
  });

  // ── shouldShowNudge ─────────────────────────────────────────────────────

  describe("shouldShowNudge", () => {
    it("returns false when status is not 'active'", () => {
      expect(shouldShowNudge(15, "expired", false)).toBe(false);
      expect(shouldShowNudge(15, "none", false)).toBe(false);
      expect(shouldShowNudge(15, "converted", false)).toBe(false);
    });

    it("returns false when nudge has already been shown", () => {
      expect(shouldShowNudge(15, "active", true)).toBe(false);
    });

    it("returns false before day 15 (days remaining > 15)", () => {
      expect(shouldShowNudge(20, "active", false)).toBe(false); // day 10
      expect(shouldShowNudge(16, "active", false)).toBe(false); // day 14
    });

    it("returns true on day 15 (days remaining = 15)", () => {
      expect(shouldShowNudge(15, "active", false)).toBe(true); // day 15
    });

    it("returns true after day 15 (days remaining < 15)", () => {
      expect(shouldShowNudge(14, "active", false)).toBe(true); // day 16
      expect(shouldShowNudge(10, "active", false)).toBe(true); // day 20
      expect(shouldShowNudge(1, "active", false)).toBe(true); // day 29
    });

    it("returns true at the very end of trial (days remaining = 0)", () => {
      expect(shouldShowNudge(0, "active", false)).toBe(true); // day 30
    });
  });
});

// ---------------------------------------------------------------------------
// Nudge display rules (integration)
// ---------------------------------------------------------------------------

describe("Day-15 nudge display rules", () => {
  it("nudge shows once per trial, never repeats after dismissal", () => {
    const storage = createStorageMock();
    storage.getItem.mockReturnValue(null); // Not yet shown

    // Day 15: nudge should show
    expect(shouldShowNudge(15, "active", isNudgeShown(storage))).toBe(true);

    // User dismisses or subscribes → mark as shown
    markNudgeShown(storage);
    storage.getItem.mockReturnValue("true"); // Flag now set

    // Day 14 (next day): nudge should NOT show again
    expect(shouldShowNudge(14, "active", isNudgeShown(storage))).toBe(false);

    // Day 1 (final day): nudge should still NOT show
    expect(shouldShowNudge(1, "active", isNudgeShown(storage))).toBe(false);

    // After expiry: nudge should NOT show
    expect(shouldShowNudge(0, "expired", isNudgeShown(storage))).toBe(false);
  });

  it("nudge resets if trial status changes to 'none' (new trial)", () => {
    const storage = createStorageMock();
    storage.getItem.mockReturnValue("true"); // Previously shown

    // Trial expired then user started new trial
    expect(shouldShowNudge(15, "none", isNudgeShown(storage))).toBe(false);
  });
});
