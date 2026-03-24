/**
 * ValhallaCardTile — pure helper unit tests (issue #1850)
 *
 * Covers: formatBonusReward, computeTimeHeld
 * exported from ValhallaCardTile.tsx.
 */

import { describe, it, expect } from "vitest";
import {
  formatBonusReward,
  computeTimeHeld,
} from "@/components/dashboard/ValhallaCardTile";

// ── formatBonusReward ─────────────────────────────────────────────────────────

describe("formatBonusReward", () => {
  it("formats points reward correctly", () => {
    expect(formatBonusReward("points", 60000)).toBe("60,000 pts");
  });

  it("formats miles reward correctly", () => {
    expect(formatBonusReward("miles", 75000)).toBe("75,000 mi");
  });

  it("formats cashback reward as currency (dollars)", () => {
    // $500 stored as dollars
    expect(formatBonusReward("cashback", 500)).toBe("$500");
  });

  it("formats large point amounts with comma separator", () => {
    expect(formatBonusReward("points", 100000)).toBe("100,000 pts");
  });

  it("formats small point amounts (no comma needed)", () => {
    expect(formatBonusReward("points", 500)).toBe("500 pts");
  });

  it("formats zero cashback as $0", () => {
    expect(formatBonusReward("cashback", 0)).toBe("$0");
  });
});

// ── computeTimeHeld ───────────────────────────────────────────────────────────

describe("computeTimeHeld", () => {
  it("returns days between openDate and closedAt", () => {
    const days = computeTimeHeld(
      "2025-01-01T00:00:00.000Z",
      "2025-04-01T00:00:00.000Z"
    );
    expect(days).toBe(90);
  });

  it("returns 0 when closedAt equals openDate", () => {
    const days = computeTimeHeld(
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z"
    );
    expect(days).toBe(0);
  });

  it("returns positive days even when closedAt is a YYYY-MM-DD string", () => {
    const days = computeTimeHeld("2026-01-01", "2026-03-01");
    expect(days).toBe(59);
  });

  it("returns 1 for a one-day hold", () => {
    const days = computeTimeHeld("2026-01-01", "2026-01-02");
    expect(days).toBe(1);
  });

  it("handles 247-day hold from wireframe example", () => {
    const days = computeTimeHeld(
      "2025-01-14T00:00:00.000Z",
      "2025-09-18T00:00:00.000Z"
    );
    expect(days).toBe(247);
  });
});
