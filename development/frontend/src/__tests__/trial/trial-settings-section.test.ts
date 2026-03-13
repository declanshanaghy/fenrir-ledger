/**
 * Unit tests for TrialSettingsSection helper functions.
 *
 * Tests the date computation logic used to display trial start/end dates.
 * Component rendering tests are deferred to Playwright E2E.
 *
 * @see components/trial/TrialSettingsSection.tsx
 * @see Issue #622
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIAL_DURATION_DAYS = 30;

// ---------------------------------------------------------------------------
// Helper functions (extracted for testing)
// ---------------------------------------------------------------------------

/**
 * Computes an approximate trial start date from remaining days.
 * Returns a formatted date string.
 */
function computeTrialStartDate(remainingDays: number, now: Date = new Date()): string {
  const daysElapsed = TRIAL_DURATION_DAYS - remainingDays;
  const startDate = new Date(now.getTime() - daysElapsed * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(startDate);
}

/**
 * Computes an approximate trial end date from remaining days.
 * Returns a formatted date string.
 */
function computeTrialEndDate(remainingDays: number, now: Date = new Date()): string {
  const endDate = new Date(now.getTime() + remainingDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(endDate);
}

/**
 * Computes trial plan label based on status and remaining days.
 */
function computePlanLabel(status: string, remainingDays: number): string {
  if (status === "expired") {
    return "Karl Trial (Expired)";
  }
  return `Karl Trial (${remainingDays} day${remainingDays !== 1 ? "s" : ""} remaining)`;
}

/**
 * Determines if the settings section should render.
 */
function shouldShowSettingsSection(status: string, isLoading: boolean): boolean {
  if (isLoading) return false;
  if (status === "none") return false;
  if (status === "converted") return false;
  return true;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TrialSettingsSection helpers", () => {
  // ── computeTrialStartDate ───────────────────────────────────────────────

  describe("computeTrialStartDate", () => {
    it("returns current date when 0 days have elapsed (30 days remaining)", () => {
      const now = new Date("2026-03-13");
      const result = computeTrialStartDate(30, now);
      // Should be March 13, 2026
      expect(result).toContain("March");
      expect(result).toContain("13");
      expect(result).toContain("2026");
    });

    it("returns correct start date when 15 days have elapsed (15 days remaining)", () => {
      const now = new Date("2026-03-13");
      const result = computeTrialStartDate(15, now);
      // Should be February 26, 2026 (15 days earlier)
      expect(result).toContain("February");
      expect(result).toContain("26");
      expect(result).toContain("2026");
    });

    it("returns correct start date when 29 days have elapsed (1 day remaining)", () => {
      const now = new Date("2026-03-13");
      const result = computeTrialStartDate(1, now);
      // Should be February 12, 2026 (29 days earlier)
      expect(result).toContain("February");
      expect(result).toContain("12");
      expect(result).toContain("2026");
    });

    it("returns correct start date crossing month boundaries backwards", () => {
      const now = new Date("2026-03-01T00:00:00Z");
      const result = computeTrialStartDate(10, now);
      // Should be February 9, 2026 (10 days earlier from March 1)
      expect(result).toContain("February");
      expect(result).toContain("9");
    });
  });

  // ── computeTrialEndDate ──────────────────────────────────────────────────

  describe("computeTrialEndDate", () => {
    it("returns date 30 days from now when 30 days remaining", () => {
      const now = new Date("2026-03-13");
      const result = computeTrialEndDate(30, now);
      // Should be April 12, 2026
      expect(result).toContain("April");
      expect(result).toContain("12");
      expect(result).toContain("2026");
    });

    it("returns date 15 days from now when 15 days remaining", () => {
      const now = new Date("2026-03-13");
      const result = computeTrialEndDate(15, now);
      // Should be March 28, 2026
      expect(result).toContain("March");
      expect(result).toContain("28");
      expect(result).toContain("2026");
    });

    it("returns date 1 day from now when 1 day remaining", () => {
      const now = new Date("2026-03-13");
      const result = computeTrialEndDate(1, now);
      // Should be March 14, 2026
      expect(result).toContain("March");
      expect(result).toContain("14");
      expect(result).toContain("2026");
    });

    it("returns correct end date crossing month boundaries forward", () => {
      const now = new Date("2026-03-20");
      const result = computeTrialEndDate(15, now);
      // Should be April 4, 2026
      expect(result).toContain("April");
      expect(result).toContain("4");
    });
  });

  // ── computePlanLabel ────────────────────────────────────────────────────

  describe("computePlanLabel", () => {
    it("returns 'Karl Trial (Expired)' when status is 'expired'", () => {
      expect(computePlanLabel("expired", 0)).toBe("Karl Trial (Expired)");
      expect(computePlanLabel("expired", 15)).toBe("Karl Trial (Expired)");
    });

    it("returns singular 'day' when 1 day remaining", () => {
      expect(computePlanLabel("active", 1)).toBe("Karl Trial (1 day remaining)");
    });

    it("returns plural 'days' when more than 1 day remaining", () => {
      expect(computePlanLabel("active", 0)).toBe("Karl Trial (0 days remaining)");
      expect(computePlanLabel("active", 2)).toBe("Karl Trial (2 days remaining)");
      expect(computePlanLabel("active", 15)).toBe("Karl Trial (15 days remaining)");
      expect(computePlanLabel("active", 30)).toBe("Karl Trial (30 days remaining)");
    });
  });

  // ── shouldShowSettingsSection ───────────────────────────────────────────

  describe("shouldShowSettingsSection", () => {
    it("returns false when isLoading is true", () => {
      expect(shouldShowSettingsSection("active", true)).toBe(false);
      expect(shouldShowSettingsSection("none", true)).toBe(false);
    });

    it("returns false when status is 'none'", () => {
      expect(shouldShowSettingsSection("none", false)).toBe(false);
    });

    it("returns false when status is 'converted'", () => {
      expect(shouldShowSettingsSection("converted", false)).toBe(false);
    });

    it("returns true when status is 'active' and not loading", () => {
      expect(shouldShowSettingsSection("active", false)).toBe(true);
    });

    it("returns true when status is 'expired' and not loading", () => {
      expect(shouldShowSettingsSection("expired", false)).toBe(true);
    });

    it("returns false when both isLoading is true AND status is invalid", () => {
      expect(shouldShowSettingsSection("none", true)).toBe(false);
    });
  });
});
