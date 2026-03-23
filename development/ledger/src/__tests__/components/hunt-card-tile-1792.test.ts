/**
 * HuntCardTile — pure helper unit tests (issue #1792)
 *
 * Covers getHuntPercentComplete and getHuntTooltipText.
 * These are the testable pure functions extracted from HuntCardTile.tsx.
 */

import { describe, it, expect } from "vitest";
import {
  getHuntPercentComplete,
  getHuntTooltipText,
} from "@/components/dashboard/HuntCardTile";

// ── getHuntPercentComplete ────────────────────────────────────────────────────

describe("getHuntPercentComplete", () => {
  it("returns 0 when spendRequired is 0 (avoids division by zero)", () => {
    expect(getHuntPercentComplete(500, 0)).toBe(0);
    expect(getHuntPercentComplete(0, 0)).toBe(0);
  });

  it("returns 0 when nothing has been spent", () => {
    expect(getHuntPercentComplete(0, 300000)).toBe(0);
  });

  it("returns 50 for half spent", () => {
    expect(getHuntPercentComplete(150000, 300000)).toBe(50);
  });

  it("returns 100 when fully met", () => {
    expect(getHuntPercentComplete(300000, 300000)).toBe(100);
  });

  it("clamps to 100 when overspent", () => {
    expect(getHuntPercentComplete(400000, 300000)).toBe(100);
  });

  it("rounds to nearest integer (no fractional percent)", () => {
    // 1/3 of 300 = 100 → 33.33... → rounds to 33
    expect(getHuntPercentComplete(100, 300)).toBe(33);
  });

  it("returns correct percent for partial spend", () => {
    // $500 of $3000 = 16.67% → rounds to 17
    expect(getHuntPercentComplete(50000, 300000)).toBe(17);
  });
});

// ── getHuntTooltipText ────────────────────────────────────────────────────────

describe("getHuntTooltipText", () => {
  it("shows only spend part when bonusDays is null", () => {
    const text = getHuntTooltipText(0, 300000, null);
    expect(text).toBe("$3,000 remaining to spend");
  });

  it("shows $0 remaining when spend requirement is fully met", () => {
    const text = getHuntTooltipText(300000, 300000, 10);
    expect(text).toBe("$0 remaining to spend · 10 days left");
  });

  it("shows plural days when bonusDays > 1", () => {
    const text = getHuntTooltipText(0, 300000, 45);
    expect(text).toBe("$3,000 remaining to spend · 45 days left");
  });

  it("shows singular day when bonusDays === 1", () => {
    const text = getHuntTooltipText(0, 300000, 1);
    expect(text).toBe("$3,000 remaining to spend · 1 day left");
  });

  it("shows 'deadline today' when bonusDays === 0", () => {
    const text = getHuntTooltipText(0, 300000, 0);
    expect(text).toBe("$3,000 remaining to spend · deadline today");
  });

  it("shows singular past day when bonusDays === -1", () => {
    const text = getHuntTooltipText(0, 300000, -1);
    expect(text).toBe("$3,000 remaining to spend · 1 day past deadline");
  });

  it("shows plural past days when bonusDays < -1", () => {
    const text = getHuntTooltipText(0, 300000, -5);
    expect(text).toBe("$3,000 remaining to spend · 5 days past deadline");
  });

  it("calculates remaining correctly for partial spend", () => {
    // $1,500 spent of $3,000 required → $1,500 remaining
    const text = getHuntTooltipText(150000, 300000, 30);
    expect(text).toBe("$1,500 remaining to spend · 30 days left");
  });

  it("clamps remaining to 0 when overspent", () => {
    const text = getHuntTooltipText(400000, 300000, 10);
    expect(text).toBe("$0 remaining to spend · 10 days left");
  });

  it("handles zero spendRequired gracefully (shows $0 remaining)", () => {
    const text = getHuntTooltipText(0, 0, 20);
    expect(text).toBe("$0 remaining to spend · 20 days left");
  });
});
