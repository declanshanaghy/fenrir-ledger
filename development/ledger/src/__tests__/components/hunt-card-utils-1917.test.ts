/**
 * HuntCardTile pure-helper unit tests — issue #1917
 *
 * Validates the exported utility functions from HuntCardTile:
 *   - getHuntPercentComplete: spend ratio clamped to [0, 100]
 *   - getHuntTooltipText: human-readable tooltip string
 *
 * These are pure functions with no DOM dependency — fast unit tests.
 */

import { describe, it, expect } from "vitest";
import {
  getHuntPercentComplete,
  getHuntTooltipText,
} from "@/components/dashboard/HuntCardTile";

// ── getHuntPercentComplete ────────────────────────────────────────────────────

describe("getHuntPercentComplete (#1917)", () => {
  it("returns 0 when spendRequired is 0 (avoid division by zero)", () => {
    expect(getHuntPercentComplete(50000, 0)).toBe(0);
  });

  it("returns correct percentage for partial spend", () => {
    expect(getHuntPercentComplete(100000, 400000)).toBe(25);
  });

  it("returns 100 when spend equals requirement", () => {
    expect(getHuntPercentComplete(400000, 400000)).toBe(100);
  });

  it("clamps to 100 when spend exceeds requirement", () => {
    expect(getHuntPercentComplete(500000, 400000)).toBe(100);
  });

  it("rounds to nearest integer", () => {
    // 1/3 = 33.333... → rounds to 33
    expect(getHuntPercentComplete(1, 3)).toBe(33);
  });
});

// ── getHuntTooltipText ────────────────────────────────────────────────────────

describe("getHuntTooltipText (#1917)", () => {
  it("returns spend-only string when deadline is null", () => {
    const result = getHuntTooltipText(100000, 400000, null);
    expect(result).toBe("$1,000.00 remaining to spend");
  });

  it("shows 'X days left' for multiple days remaining", () => {
    const result = getHuntTooltipText(0, 100000, 15);
    expect(result).toContain("15 days left");
    expect(result).toContain("$1,000.00 remaining to spend");
  });

  it("shows '1 day left' when exactly 1 day remains", () => {
    const result = getHuntTooltipText(0, 100000, 1);
    expect(result).toContain("1 day left");
  });

  it("shows 'deadline today' when bonusDays is 0", () => {
    const result = getHuntTooltipText(0, 100000, 0);
    expect(result).toContain("deadline today");
  });

  it("shows '1 day past deadline' when bonusDays is -1", () => {
    const result = getHuntTooltipText(0, 100000, -1);
    expect(result).toContain("1 day past deadline");
  });

  it("shows 'X days past deadline' for further past deadlines", () => {
    const result = getHuntTooltipText(0, 100000, -30);
    expect(result).toContain("30 days past deadline");
  });

  it("shows $0.00 remaining when spend is met", () => {
    const result = getHuntTooltipText(400000, 400000, 10);
    expect(result).toContain("$0.00 remaining to spend");
  });
});
