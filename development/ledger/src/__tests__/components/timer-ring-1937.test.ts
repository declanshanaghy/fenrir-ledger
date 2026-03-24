/**
 * TimerRing — QA validation tests for issue #1937
 *
 * Validates AC: Valhalla tooltip shows bonus earned + fees saved, no negative days.
 * Augments timer-ring-1850.test.ts without duplicating existing coverage.
 */

import { describe, it, expect } from "vitest";
import { getTimerTooltip } from "@/components/dashboard/TimerRing";

// ── AC: No negative day counts for Valhalla ────────────────────────────────────

describe("getTimerTooltip — valhalla no negative days (issue #1937)", () => {
  it("shows 0 days when closedAt equals openDate (same-day open+close)", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-03-01",
      "2026-06-01",
      "2026-03-01"
    );
    expect(tooltip).toMatch(/^Held 0 days/);
    expect(tooltip).not.toMatch(/-\d+ day/);
  });

  it("never shows negative days even if closedAt is one day after openDate", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-03-01",
      "2026-06-01",
      "2026-03-02"
    );
    expect(tooltip).toMatch(/^Held 1 day$/);
    expect(tooltip).not.toMatch(/-/);
  });

  it("uses singular 'day' for exactly 1 day held (valhalla)", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-01-01",
      "2026-04-01",
      "2026-01-02"
    );
    expect(tooltip).toBe("Held 1 day");
  });

  it("uses plural 'days' for 2+ days held (valhalla)", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-01-01",
      "2026-04-01",
      "2026-01-03"
    );
    expect(tooltip).toBe("Held 2 days");
  });
});

// ── AC: Bonus earned shown in tooltip ─────────────────────────────────────────

describe("getTimerTooltip — valhalla bonus earned (issue #1937)", () => {
  it("shows 'Earned <label>' segment for pts bonus", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2025-01-01",
      "2025-04-01",
      "2025-06-01",
      "75,000 pts"
    );
    expect(tooltip).toContain("Earned 75,000 pts");
  });

  it("shows 'Earned <label>' segment for miles bonus", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2025-01-01",
      "2025-04-01",
      "2025-06-01",
      "60,000 mi"
    );
    expect(tooltip).toContain("Earned 60,000 mi");
  });

  it("shows 'Earned <label>' segment for cash bonus", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2025-01-01",
      "2025-04-01",
      "2025-06-01",
      "$200"
    );
    expect(tooltip).toContain("Earned $200");
  });

  it("omits Earned segment when bonusLabel is undefined (bonus not earned)", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2025-01-01",
      "2025-04-01",
      "2025-06-01",
      undefined,
      0
    );
    expect(tooltip).not.toContain("Earned");
  });
});

// ── AC: Annual fees saved shown in tooltip ────────────────────────────────────

describe("getTimerTooltip — valhalla fees saved (issue #1937)", () => {
  it("shows 'Saved $N/yr' segment for cards with annual fee", () => {
    // annualFee stored in cents: 69500 = $695
    const tooltip = getTimerTooltip(
      "valhalla",
      "2025-01-01",
      "2025-04-01",
      "2025-06-01",
      undefined,
      69500
    );
    expect(tooltip).toContain("Saved $695/yr");
  });

  it("shows 'Saved $N/yr' segment for low annual fee (e.g. $95)", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2025-01-01",
      "2025-04-01",
      "2025-06-01",
      undefined,
      9500
    );
    expect(tooltip).toContain("Saved $95/yr");
  });

  it("omits Saved segment when annualFee is 0 (no-annual-fee card)", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2025-01-01",
      "2025-04-01",
      "2025-06-01",
      undefined,
      0
    );
    expect(tooltip).not.toContain("Saved");
    expect(tooltip).not.toContain("/yr");
  });

  it("omits Saved segment when annualFee is undefined", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2025-01-01",
      "2025-04-01",
      "2025-06-01"
    );
    expect(tooltip).not.toContain("Saved");
  });
});

// ── AC: Hunt and Howl tooltips unchanged ──────────────────────────────────────

describe("getTimerTooltip — hunt and howl unaffected by valhalla params (issue #1937)", () => {
  it("hunt tooltip ignores bonusLabel param — still shows elapsed/remaining format", () => {
    const tooltip = getTimerTooltip(
      "hunt",
      "2025-01-01",
      "2026-12-31",
      undefined,
      "60,000 pts"
    );
    expect(tooltip).toContain("elapsed");
    expect(tooltip).toContain("remaining until bonus deadline");
    expect(tooltip).not.toContain("Earned");
    expect(tooltip).not.toContain("Held");
  });

  it("hunt tooltip ignores annualFee param — still shows elapsed/remaining format", () => {
    const tooltip = getTimerTooltip(
      "hunt",
      "2025-01-01",
      "2026-12-31",
      undefined,
      undefined,
      69500
    );
    expect(tooltip).toContain("elapsed");
    expect(tooltip).toContain("remaining until bonus deadline");
    expect(tooltip).not.toContain("Saved");
    expect(tooltip).not.toContain("Held");
  });

  it("howl tooltip ignores bonusLabel param — still shows elapsed/fee-due format", () => {
    const tooltip = getTimerTooltip(
      "howl",
      "2025-01-01",
      "2026-12-31",
      undefined,
      "50,000 pts"
    );
    expect(tooltip).toContain("elapsed");
    expect(tooltip).toContain("until annual fee due");
    expect(tooltip).not.toContain("Earned");
    expect(tooltip).not.toContain("Held");
  });

  it("howl tooltip ignores annualFee param — still shows elapsed/fee-due format", () => {
    const tooltip = getTimerTooltip(
      "howl",
      "2025-01-01",
      "2026-12-31",
      undefined,
      undefined,
      69500
    );
    expect(tooltip).toContain("elapsed");
    expect(tooltip).toContain("until annual fee due");
    expect(tooltip).not.toContain("Saved");
    expect(tooltip).not.toContain("Held");
  });
});

// ── AC: Full tooltip format with both bonus and fee ───────────────────────────

describe("getTimerTooltip — valhalla full tooltip format (issue #1937)", () => {
  it("produces correct segment order: Held · Earned · Saved", () => {
    // 151 days: Jan 1 → Jun 1 = 151 days
    const tooltip = getTimerTooltip(
      "valhalla",
      "2025-01-01",
      "2025-04-01",
      "2025-06-01",
      "60,000 pts",
      69500
    );
    const parts = tooltip.split(" · ");
    expect(parts[0]).toMatch(/^Held \d+ days?/);
    expect(parts[1]).toMatch(/^Earned /);
    expect(parts[2]).toMatch(/^Saved \$\d+\/yr$/);
  });

  it("segment count is 1 when no bonus or fee", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-01-01",
      "2026-04-01",
      "2026-03-01"
    );
    expect(tooltip.split(" · ")).toHaveLength(1);
  });

  it("segment count is 2 when only bonus earned", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-01-01",
      "2026-04-01",
      "2026-03-01",
      "60,000 pts"
    );
    expect(tooltip.split(" · ")).toHaveLength(2);
  });

  it("segment count is 2 when only annual fee", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-01-01",
      "2026-04-01",
      "2026-03-01",
      undefined,
      69500
    );
    expect(tooltip.split(" · ")).toHaveLength(2);
  });

  it("segment count is 3 when both bonus and fee present", () => {
    const tooltip = getTimerTooltip(
      "valhalla",
      "2026-01-01",
      "2026-04-01",
      "2026-03-01",
      "60,000 pts",
      69500
    );
    expect(tooltip.split(" · ")).toHaveLength(3);
  });
});
