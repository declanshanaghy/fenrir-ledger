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
import type { Card } from "@/lib/types";

// ── Test helpers ──────────────────────────────────────────────────────────

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "test-id",
    householdId: "hh-1",
    issuerId: "chase",
    cardName: "Test Card",
    openDate: "2025-01-01T00:00:00.000Z",
    creditLimit: 500000,
    annualFee: 0,
    annualFeeDate: "",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

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
      makeCard({ id: "1", annualFee: 9500 }), // $95
      makeCard({ id: "2", annualFee: 55000 }), // $550
      makeCard({ id: "3", annualFee: 0 }), // $0
    ];
    const result = computeTrialMetrics(cards);

    expect(result.totalAnnualFees).toBe(64500);
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
      makeCard({ id: "1", annualFee: 9500, status: "active" }),
      makeCard({
        id: "2",
        annualFee: 55000,
        status: "closed",
        closedAt: "2025-06-01T00:00:00.000Z",
      }),
      makeCard({
        id: "3",
        annualFee: 25000,
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

    // Only closed ($550) + graduated ($250) cards count
    expect(result.potentialSavings).toBe(80000);
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
        annualFee: 9500,
        annualFeeDate: feeApproaching.toISOString(),
        status: "active",
      }),
      makeCard({
        id: "3",
        annualFee: 25000,
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
        annualFee: 9500,
        status: "active",
      }),
    ];
    const result = computeTrialMetrics(cards);

    expect(result.cardCount).toBe(1);
    expect(result.totalAnnualFees).toBe(9500);
    expect(result.totalAnnualFeesFormatted).toBe("$95");
    expect(result.feeAlertsCount).toBe(0);
    expect(result.closedCardsCount).toBe(0);
    expect(result.potentialSavings).toBe(0);
  });
});
