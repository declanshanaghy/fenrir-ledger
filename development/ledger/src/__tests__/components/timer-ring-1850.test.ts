/**
 * TimerRing — pure helper unit tests (issue #1850)
 *
 * Covers: daysBetween, computeTimerRatio, getTimerColor, getTimerTooltip
 * exported from TimerRing.tsx.
 */

import { describe, it, expect } from "vitest";
import {
  daysBetween,
  computeTimerRatio,
  getTimerColor,
  getTimerTooltip,
} from "@/components/dashboard/TimerRing";

// ── daysBetween ───────────────────────────────────────────────────────────────

describe("daysBetween", () => {
  it("returns 0 when from and to are the same date", () => {
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("returns positive number when to is after from", () => {
    expect(daysBetween("2026-01-01", "2026-01-11")).toBe(10);
  });

  it("returns negative number when to is before from", () => {
    expect(daysBetween("2026-01-11", "2026-01-01")).toBe(-10);
  });

  it("handles 30-day month boundaries", () => {
    expect(daysBetween("2026-01-31", "2026-03-01")).toBe(29);
  });

  it("handles ISO timestamps (not just date strings)", () => {
    expect(
      daysBetween("2026-01-01T00:00:00.000Z", "2026-01-06T00:00:00.000Z")
    ).toBe(5);
  });

  it("returns 365 for a full year span (non-leap)", () => {
    expect(daysBetween("2025-01-01", "2026-01-01")).toBe(365);
  });
});

// ── computeTimerRatio ─────────────────────────────────────────────────────────

describe("computeTimerRatio", () => {
  it("returns 0.5 when reference is halfway between open and deadline", () => {
    const ratio = computeTimerRatio("2026-01-01", "2026-03-02", "2026-02-01");
    // openDate = Jan 1, deadline = Mar 2 (60 days), reference = Feb 1 (31 days elapsed)
    // 31/60 ≈ 0.517 — but ceil-based math: daysBetween(Jan1→Feb1)=31, Jan1→Mar2=60
    expect(ratio).toBeCloseTo(31 / 60, 2);
  });

  it("returns 0 when reference equals openDate", () => {
    expect(computeTimerRatio("2026-01-01", "2026-04-01", "2026-01-01")).toBe(0);
  });

  it("returns 1 when reference equals deadlineDate", () => {
    expect(computeTimerRatio("2026-01-01", "2026-04-01", "2026-04-01")).toBe(1);
  });

  it("clamps to 1 when reference is after deadline", () => {
    expect(computeTimerRatio("2026-01-01", "2026-04-01", "2026-06-01")).toBe(1);
  });

  it("clamps to 0 when reference is before openDate", () => {
    // reference before openDate → elapsed < 0 → clamped to 0
    expect(computeTimerRatio("2026-03-01", "2026-06-01", "2026-01-01")).toBe(0);
  });

  it("returns 1 when total window is 0 or negative", () => {
    // openDate = deadline → total = 0 → fallback to 1
    expect(computeTimerRatio("2026-01-01", "2026-01-01", "2026-01-01")).toBe(1);
  });
});

// ── getTimerColor ─────────────────────────────────────────────────────────────

describe("getTimerColor", () => {
  it("returns realm-alfheim for hunt tab regardless of daysRemaining", () => {
    const color = getTimerColor("hunt", 0);
    expect(color).toBe("hsl(var(--realm-alfheim))");
  });

  it("returns realm-alfheim for hunt even with many days remaining", () => {
    expect(getTimerColor("hunt", 200)).toBe("hsl(var(--realm-alfheim))");
  });

  it("returns realm-stone for valhalla tab regardless of daysRemaining", () => {
    expect(getTimerColor("valhalla", 999)).toBe("hsl(var(--realm-stone))");
    expect(getTimerColor("valhalla", 0)).toBe("hsl(var(--realm-stone))");
  });

  it("returns realm-muspel for howl when daysRemaining <= 30", () => {
    expect(getTimerColor("howl", 30)).toBe("hsl(var(--realm-muspel))");
    expect(getTimerColor("howl", 0)).toBe("hsl(var(--realm-muspel))");
    expect(getTimerColor("howl", 1)).toBe("hsl(var(--realm-muspel))");
  });

  it("returns realm-hati for howl when daysRemaining is 31–60", () => {
    expect(getTimerColor("howl", 31)).toBe("hsl(var(--realm-hati))");
    expect(getTimerColor("howl", 60)).toBe("hsl(var(--realm-hati))");
  });

  it("returns realm-asgard for howl when daysRemaining > 60", () => {
    expect(getTimerColor("howl", 61)).toBe("hsl(var(--realm-asgard))");
    expect(getTimerColor("howl", 365)).toBe("hsl(var(--realm-asgard))");
  });
});

// ── getTimerTooltip ───────────────────────────────────────────────────────────

describe("getTimerTooltip", () => {
  it("returns valhalla held-for format with days count when tab=valhalla and closedAt provided", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-01-01",
      "2026-04-01",
      "2026-03-01"
    );
    // daysBetween Jan 1 → Mar 1 = 59 days
    expect(tooltip).toContain("59 days");
    expect(tooltip).toMatch(/^Held 59 days/);
  });

  it("uses singular 'day' when held for exactly 1 day (valhalla)", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-01-01",
      "2026-04-01",
      "2026-01-02"
    );
    expect(tooltip).toContain("1 day");
    expect(tooltip).not.toContain("1 days");
  });

  it("appends bonus label when bonusLabel provided (valhalla)", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-01-01",
      "2026-04-01",
      "2026-03-01",
      "60,000 pts"
    );
    expect(tooltip).toContain("Earned 60,000 pts");
    expect(tooltip).toMatch(/^Held 59 days · Earned 60,000 pts$/);
  });

  it("appends annual fee when annualFee > 0 (valhalla)", () => {
    // annualFee stored in cents: 69500 = $695/yr
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-01-01",
      "2026-04-01",
      "2026-03-01",
      undefined,
      69500
    );
    expect(tooltip).toContain("Saved $695/yr");
    expect(tooltip).toMatch(/^Held 59 days · Saved \$695\/yr$/);
  });

  it("appends both bonus and fee when both provided (valhalla)", () => {
    // annualFee stored in cents: 69500 = $695/yr
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-01-01",
      "2026-04-01",
      "2026-03-01",
      "60,000 pts",
      69500
    );
    expect(tooltip).toBe("Held 59 days · Earned 60,000 pts · Saved $695/yr");
  });

  it("does not append fee segment when annualFee is 0 (valhalla no-fee card)", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-01-01",
      "2026-04-01",
      "2026-03-01",
      undefined,
      0
    );
    expect(tooltip).toBe("Held 59 days");
    expect(tooltip).not.toContain("Saved");
  });

  it("does not include bonus or fee segments when neither provided (valhalla baseline)", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-01-01",
      "2026-04-01",
      "2026-03-01"
    );
    expect(tooltip).toBe("Held 59 days");
  });

  it("returns howl fee format when tab=howl (no closedAt)", () => {
    const tooltip = getTimerTooltip(
      "howl",
      "2025-01-01",
      "2026-12-31",
    );
    expect(tooltip).toContain("elapsed");
    expect(tooltip).toContain("until annual fee due");
  });

  it("returns hunt bonus format when tab=hunt (no closedAt)", () => {
    const tooltip = getTimerTooltip(
      "hunt",
      "2025-01-01",
      "2026-12-31",
    );
    expect(tooltip).toContain("elapsed");
    expect(tooltip).toContain("remaining until bonus deadline");
  });
});
