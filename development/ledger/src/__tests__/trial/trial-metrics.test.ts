/**
 * Unit tests for useTrialMetrics — pure computeTrialMetrics function.
 *
 * Tests the metric computation logic used by TrialStatusPanel and
 * TrialSettingsSection. All tests use the pure function directly,
 * avoiding hook/component rendering overhead.
 *
 * @see hooks/useTrialMetrics.ts
 * @see Issue #622
 */

import { describe, it, expect } from "vitest";
import { computeTrialMetrics } from "@/hooks/useTrialMetrics";
import { makeCard } from "@/__tests__/fixtures/cards";

// ── Tests ─────────────────────────────────────────────────────────────────

describe("computeTrialMetrics", () => {
  it("returns zero metrics for empty card array", () => {
    const result = computeTrialMetrics([]);

    expect(result.cardCount).toBe(0);
    expect(result.totalAnnualFees).toBe(0);
    expect(result.totalAnnualFeesFormatted).toBe("$0");
    expect(result.feeAlertsCount).toBe(0);
    expect(result.closedCardsCount).toBe(0);
    expect(result.potentialSavings).toBe(0);
    expect(result.potentialSavingsFormatted).toBe("$0");
  });

  it("counts total cards", () => {
    const cards = [makeCard({ id: "1" }), makeCard({ id: "2" }), makeCard({ id: "3" })];
    const result = computeTrialMetrics(cards);

    expect(result.cardCount).toBe(3);
  });

  it("sums annual fees across all cards", () => {
    const cards = [
      makeCard({ id: "1", annualFee: 95 }),   // $95
      makeCard({ id: "2", annualFee: 550 }),  // $550
      makeCard({ id: "3", annualFee: 0 }),    // $0
    ];
    const result = computeTrialMetrics(cards);

    expect(result.totalAnnualFees).toBe(645);
    expect(result.totalAnnualFeesFormatted).toBe("$645");
  });

  it("counts closed and graduated cards", () => {
    const cards = [
      makeCard({ id: "1", status: "active" }),
      makeCard({ id: "2", status: "closed", closedAt: "2025-06-01T00:00:00.000Z" }),
      makeCard({
        id: "3",
        status: "active",
        signUpBonus: {
          type: "points",
          amount: 60000,
          spendRequirement: 400000,
          deadline: "2025-12-01T00:00:00.000Z",
          met: true,
        },
      }),
    ];
    const result = computeTrialMetrics(cards);

    expect(result.closedCardsCount).toBe(2); // closed + graduated
  });

  it("computes potential savings from closed/graduated cards", () => {
    const cards = [
      makeCard({ id: "1", annualFee: 95, status: "active" }),
      makeCard({
        id: "2",
        annualFee: 550,
        status: "closed",
        closedAt: "2025-06-01T00:00:00.000Z",
      }),
      makeCard({
        id: "3",
        annualFee: 250,
        status: "active",
        signUpBonus: {
          type: "points",
          amount: 60000,
          spendRequirement: 4000,  // dollars
          deadline: "2025-12-01T00:00:00.000Z",
          met: true,
        },
      }),
    ];
    const result = computeTrialMetrics(cards);

    // Only closed ($550) + graduated ($250) cards count
    expect(result.potentialSavings).toBe(800);
    expect(result.potentialSavingsFormatted).toBe("$800");
  });

  it("counts fee alerts (fee_approaching and overdue cards)", () => {
    const now = new Date();
    // Create a date 30 days from now for fee_approaching
    const feeApproaching = new Date(now);
    feeApproaching.setDate(feeApproaching.getDate() + 30);
    // Create a date in the past for overdue
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 5);

    const cards = [
      makeCard({ id: "1", status: "active" }),
      makeCard({
        id: "2",
        annualFee: 95,  // dollars
        annualFeeDate: feeApproaching.toISOString(),
        status: "active",
      }),
      makeCard({
        id: "3",
        annualFee: 250,  // dollars
        annualFeeDate: pastDate.toISOString(),
        status: "active",
      }),
    ];
    const result = computeTrialMetrics(cards);

    expect(result.feeAlertsCount).toBe(2); // fee_approaching + overdue
  });

  it("handles single card with all metrics", () => {
    const cards = [
      makeCard({
        id: "1",
        annualFee: 95,  // dollars
        status: "active",
      }),
    ];
    const result = computeTrialMetrics(cards);

    expect(result.cardCount).toBe(1);
    expect(result.totalAnnualFees).toBe(95);
    expect(result.totalAnnualFeesFormatted).toBe("$95");
    expect(result.feeAlertsCount).toBe(0);
    expect(result.closedCardsCount).toBe(0);
    expect(result.potentialSavings).toBe(0);
  });
});
