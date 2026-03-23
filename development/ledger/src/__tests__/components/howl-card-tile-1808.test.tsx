/**
 * HowlCardTile — pure helper unit tests (issue #1808)
 *
 * Tests the exported pure functions for the Howl tab contextual card details:
 * getHowlDaysUntilSoonest, getHowlUrgencyTier, getHowlActionText, getHowlSpendPercent.
 */

import { describe, it, expect } from "vitest";
import {
  getHowlDaysUntilSoonest,
  getHowlUrgencyTier,
  getHowlActionText,
  getHowlSpendPercent,
  getHowlBorderClass,
  getHowlUrgencyTextClass,
} from "@/components/dashboard/HowlCardTile";
import type { Card } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAR_FUTURE = "2099-12-31T00:00:00.000Z";
const NEAR_FUTURE_10D = new Date();
NEAR_FUTURE_10D.setDate(NEAR_FUTURE_10D.getDate() + 10);
const NEAR_ISO_10D = NEAR_FUTURE_10D.toISOString();

const FUTURE_45D = new Date();
FUTURE_45D.setDate(FUTURE_45D.getDate() + 45);
const NEAR_ISO_45D = FUTURE_45D.toISOString();

const PAST_DATE = "2020-01-01T00:00:00.000Z";

function makeHowlCard(opts: {
  status?: Card["status"];
  annualFee?: number;
  annualFeeDate?: string;
  bonusDeadline?: string;
  spendRequirement?: number;
  amountSpent?: number;
  bonusMet?: boolean;
} = {}): Card {
  return {
    id: "howl-test",
    householdId: "hh-test",
    issuerId: "chase",
    cardName: "Freedom Flex",
    openDate: "2024-01-01T00:00:00.000Z",
    creditLimit: 1000000,
    annualFee: opts.annualFee ?? 9500,
    annualFeeDate: opts.annualFeeDate ?? "",
    promoPeriodMonths: 0,
    signUpBonus:
      opts.bonusDeadline !== undefined
        ? {
            type: "points",
            amount: 20000,
            spendRequirement: opts.spendRequirement ?? 50000,
            deadline: opts.bonusDeadline,
            met: opts.bonusMet ?? false,
          }
        : null,
    amountSpent: opts.amountSpent ?? 0,
    status: opts.status ?? "fee_approaching",
    notes: "",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

// ── getHowlDaysUntilSoonest ───────────────────────────────────────────────────

describe("getHowlDaysUntilSoonest", () => {
  it("uses fee date when only fee is present", () => {
    const card = makeHowlCard({ annualFee: 9500, annualFeeDate: NEAR_ISO_10D });
    const days = getHowlDaysUntilSoonest(card);
    expect(days).toBeGreaterThanOrEqual(9);
    expect(days).toBeLessThanOrEqual(11);
  });

  it("uses bonus deadline when only bonus is present", () => {
    const card = makeHowlCard({ annualFee: 0, annualFeeDate: "", bonusDeadline: NEAR_ISO_45D });
    const days = getHowlDaysUntilSoonest(card);
    expect(days).toBeGreaterThanOrEqual(44);
    expect(days).toBeLessThanOrEqual(46);
  });

  it("picks the sooner of fee and bonus deadline", () => {
    const card = makeHowlCard({
      annualFee: 9500,
      annualFeeDate: NEAR_ISO_10D,    // 10 days
      bonusDeadline: NEAR_ISO_45D,    // 45 days
    });
    const days = getHowlDaysUntilSoonest(card);
    // Should pick fee (10 days) over bonus (45 days)
    expect(days).toBeLessThan(30);
  });

  it("returns negative for overdue cards", () => {
    const card = makeHowlCard({ annualFee: 9500, annualFeeDate: PAST_DATE });
    expect(getHowlDaysUntilSoonest(card)).toBeLessThan(0);
  });

  it("returns 0 when no fee or bonus deadline", () => {
    const card = makeHowlCard({ annualFee: 0, annualFeeDate: "" });
    expect(getHowlDaysUntilSoonest(card)).toBe(0);
  });
});

// ── getHowlUrgencyTier ────────────────────────────────────────────────────────

describe("getHowlUrgencyTier", () => {
  it("returns 'overdue' for days <= 0", () => {
    expect(getHowlUrgencyTier(0)).toBe("overdue");
    expect(getHowlUrgencyTier(-5)).toBe("overdue");
  });

  it("returns 'red' for 1–30 days", () => {
    expect(getHowlUrgencyTier(1)).toBe("red");
    expect(getHowlUrgencyTier(15)).toBe("red");
    expect(getHowlUrgencyTier(30)).toBe("red");
  });

  it("returns 'amber' for 31–60 days", () => {
    expect(getHowlUrgencyTier(31)).toBe("amber");
    expect(getHowlUrgencyTier(45)).toBe("amber");
    expect(getHowlUrgencyTier(60)).toBe("amber");
  });

  it("returns 'amber' for > 60 days (edge case)", () => {
    // Cards > 60 days shouldn't be in Howl, but tier fn should handle gracefully
    expect(getHowlUrgencyTier(90)).toBe("amber");
  });
});

// ── getHowlBorderClass ────────────────────────────────────────────────────────

describe("getHowlBorderClass", () => {
  it("returns muspel border for red tier", () => {
    expect(getHowlBorderClass("red")).toContain("realm-muspel");
  });

  it("returns muspel border for overdue tier", () => {
    expect(getHowlBorderClass("overdue")).toContain("realm-muspel");
  });

  it("returns hati border for amber tier", () => {
    expect(getHowlBorderClass("amber")).toContain("realm-hati");
  });
});

// ── getHowlUrgencyTextClass ───────────────────────────────────────────────────

describe("getHowlUrgencyTextClass", () => {
  it("returns muspel text for red tier", () => {
    expect(getHowlUrgencyTextClass("red")).toContain("realm-muspel");
  });

  it("returns hati text for amber tier", () => {
    expect(getHowlUrgencyTextClass("amber")).toContain("realm-hati");
  });
});

// ── getHowlActionText ─────────────────────────────────────────────────────────

describe("getHowlActionText", () => {
  it("returns overdue message for overdue cards", () => {
    const card = makeHowlCard({ status: "overdue" });
    const text = getHowlActionText(card, -5);
    expect(text).toMatch(/overdue|past due|cancel|immediately/i);
  });

  it("returns fee-approaching message for fee_approaching cards", () => {
    const card = makeHowlCard({ status: "fee_approaching" });
    const text = getHowlActionText(card, 45);
    expect(text).toMatch(/fee|keep|cancel|review/i);
  });

  it("returns urgent fee message when < 30 days", () => {
    const card = makeHowlCard({ status: "fee_approaching" });
    const text = getHowlActionText(card, 10);
    expect(text).toMatch(/soon|now|approaching/i);
  });

  it("returns remaining spend for promo_expiring with remaining spend", () => {
    const card = makeHowlCard({
      status: "promo_expiring",
      bonusDeadline: NEAR_ISO_45D,
      spendRequirement: 100000,
      amountSpent: 30000,
    });
    const text = getHowlActionText(card, 45);
    // Should mention $700 remaining (100000 - 30000 = 70000 cents = $700)
    expect(text).toMatch(/\$700/);
  });

  it("says spend requirement met when fully spent", () => {
    const card = makeHowlCard({
      status: "promo_expiring",
      bonusDeadline: NEAR_ISO_45D,
      spendRequirement: 50000,
      amountSpent: 50000,
    });
    const text = getHowlActionText(card, 45);
    expect(text).toMatch(/met|awarded/i);
  });
});

// ── getHowlSpendPercent ───────────────────────────────────────────────────────

describe("getHowlSpendPercent", () => {
  it("returns 0 when no bonus requirement", () => {
    const card = makeHowlCard({ annualFee: 9500, annualFeeDate: NEAR_ISO_10D });
    expect(getHowlSpendPercent(card)).toBe(0);
  });

  it("returns 50 when half spent", () => {
    const card = makeHowlCard({
      bonusDeadline: NEAR_ISO_45D,
      spendRequirement: 100000,
      amountSpent: 50000,
    });
    expect(getHowlSpendPercent(card)).toBe(50);
  });

  it("caps at 100 when overspent", () => {
    const card = makeHowlCard({
      bonusDeadline: NEAR_ISO_45D,
      spendRequirement: 50000,
      amountSpent: 75000,
    });
    expect(getHowlSpendPercent(card)).toBe(100);
  });

  it("returns 0 when nothing spent", () => {
    const card = makeHowlCard({
      bonusDeadline: NEAR_ISO_45D,
      spendRequirement: 100000,
      amountSpent: 0,
    });
    expect(getHowlSpendPercent(card)).toBe(0);
  });
});
