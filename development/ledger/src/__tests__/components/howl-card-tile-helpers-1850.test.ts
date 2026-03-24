/**
 * HowlCardTile — additional helper unit tests (issue #1850 QA)
 *
 * Covers untested exports:
 *   getHowlDaysUntilSoonest, getHowlUrgencyTier, getHowlBorderClass,
 *   getHowlUrgencyTextClass, getHowlActionText, getHowlSpendPercent
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getHowlDaysUntilSoonest,
  getHowlUrgencyTier,
  getHowlBorderClass,
  getHowlUrgencyTextClass,
  getHowlActionText,
  getHowlSpendPercent,
} from "@/components/dashboard/HowlCardTile";
import type { Card } from "@/lib/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    householdId: "hh-1",
    issuerId: "chase",
    cardName: "Freedom Unlimited",
    openDate: "2025-03-01T00:00:00.000Z",
    creditLimit: 10000,   // dollars
    annualFee: 95,         // dollars
    annualFeeDate: "2026-05-01T00:00:00.000Z",
    promoPeriodMonths: 0,
    signUpBonus: null,
    amountSpent: 0,
    status: "fee_approaching",
    notes: "",
    createdAt: "2025-03-01T00:00:00.000Z",
    updatedAt: "2025-03-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── getHowlDaysUntilSoonest ───────────────────────────────────────────────────

describe("getHowlDaysUntilSoonest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns fee days when only annualFeeDate is present", () => {
    // 2026-05-01 is 39 days from 2026-03-23
    const card = makeCard({ annualFeeDate: "2026-05-01T00:00:00.000Z", annualFee: 95, signUpBonus: null });
    expect(getHowlDaysUntilSoonest(card)).toBe(39);
  });

  it("returns 0 when no fee and no bonus deadline", () => {
    const card = makeCard({ annualFee: 0, annualFeeDate: undefined, signUpBonus: null });
    expect(getHowlDaysUntilSoonest(card)).toBe(0);
  });

  it("returns bonus days when bonus is closer than fee", () => {
    // fee due 2026-05-01 (39d), bonus deadline 2026-04-01 (9d) — 9d wins
    const card = makeCard({
      annualFeeDate: "2026-05-01T00:00:00.000Z",
      annualFee: 95,
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 4000,  // dollars
        deadline: "2026-04-01T00:00:00.000Z",
        met: false,
      },
    });
    expect(getHowlDaysUntilSoonest(card)).toBe(9);
  });

  it("ignores bonus deadline when bonus is already met", () => {
    // met bonus should not compete — only fee days returned
    const card = makeCard({
      annualFeeDate: "2026-05-01T00:00:00.000Z",
      annualFee: 95,
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 4000,  // dollars
        deadline: "2026-04-01T00:00:00.000Z",
        met: true,
      },
    });
    expect(getHowlDaysUntilSoonest(card)).toBe(39);
  });
});

// ── getHowlUrgencyTier ────────────────────────────────────────────────────────

describe("getHowlUrgencyTier", () => {
  it("returns overdue when daysUntilSoonest is 0", () => {
    expect(getHowlUrgencyTier(0)).toBe("overdue");
  });

  it("returns overdue when daysUntilSoonest is negative", () => {
    expect(getHowlUrgencyTier(-5)).toBe("overdue");
  });

  it("returns red when daysUntilSoonest is 30", () => {
    expect(getHowlUrgencyTier(30)).toBe("red");
  });

  it("returns red when daysUntilSoonest is 1", () => {
    expect(getHowlUrgencyTier(1)).toBe("red");
  });

  it("returns amber when daysUntilSoonest is 31", () => {
    expect(getHowlUrgencyTier(31)).toBe("amber");
  });

  it("returns amber when daysUntilSoonest is 60 or more", () => {
    expect(getHowlUrgencyTier(60)).toBe("amber");
    expect(getHowlUrgencyTier(365)).toBe("amber");
  });
});

// ── getHowlBorderClass ────────────────────────────────────────────────────────

describe("getHowlBorderClass", () => {
  it("returns muspel border for overdue tier", () => {
    expect(getHowlBorderClass("overdue")).toContain("realm-muspel");
  });

  it("returns muspel border for red tier", () => {
    expect(getHowlBorderClass("red")).toContain("realm-muspel");
  });

  it("returns hati border for amber tier", () => {
    expect(getHowlBorderClass("amber")).toContain("realm-hati");
  });
});

// ── getHowlUrgencyTextClass ───────────────────────────────────────────────────

describe("getHowlUrgencyTextClass", () => {
  it("returns muspel text class for overdue", () => {
    expect(getHowlUrgencyTextClass("overdue")).toContain("realm-muspel");
  });

  it("returns muspel text class for red", () => {
    expect(getHowlUrgencyTextClass("red")).toContain("realm-muspel");
  });

  it("returns hati text class for amber", () => {
    expect(getHowlUrgencyTextClass("amber")).toContain("realm-hati");
  });
});

// ── getHowlActionText ─────────────────────────────────────────────────────────

describe("getHowlActionText", () => {
  it("returns overdue message for overdue status regardless of days", () => {
    const card = makeCard({ status: "overdue" });
    expect(getHowlActionText(card, 0)).toContain("past due");
  });

  it("returns very-soon message for fee_approaching when days <= 7", () => {
    const card = makeCard({ status: "fee_approaching" });
    expect(getHowlActionText(card, 5)).toContain("very soon");
  });

  it("returns approaching message for fee_approaching when days <= 30", () => {
    const card = makeCard({ status: "fee_approaching" });
    expect(getHowlActionText(card, 20)).toContain("approaching");
  });

  it("returns 60-day review message for fee_approaching when days > 30", () => {
    const card = makeCard({ status: "fee_approaching" });
    expect(getHowlActionText(card, 45)).toContain("60 days");
  });

  it("returns spend-met message for promo_expiring when requirement is met", () => {
    const card = makeCard({
      status: "promo_expiring",
      amountSpent: 4000,  // dollars
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 4000,  // dollars
        deadline: "2026-04-01T00:00:00.000Z",
        met: false,
      },
    });
    expect(getHowlActionText(card, 10)).toContain("Spend requirement met");
  });

  it("returns remaining-spend message for promo_expiring when days > 30", () => {
    const card = makeCard({
      status: "promo_expiring",
      amountSpent: 1000,  // dollars
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 4000,  // dollars
        deadline: "2026-06-01T00:00:00.000Z",
        met: false,
      },
    });
    const text = getHowlActionText(card, 45);
    // $3,000 remaining ($4,000 required - $1,000 spent)
    expect(text).toContain("$3,000");
    expect(text).toContain("sign-up bonus");
  });

  it("returns fallback for unrecognized status", () => {
    const card = makeCard({ status: "active" });
    expect(getHowlActionText(card, 10)).toContain("deadline");
  });
});

// ── getHowlSpendPercent ───────────────────────────────────────────────────────

describe("getHowlSpendPercent", () => {
  it("returns 0 when no signUpBonus", () => {
    const card = makeCard({ signUpBonus: null });
    expect(getHowlSpendPercent(card)).toBe(0);
  });

  it("returns 0 when spendRequirement is 0", () => {
    const card = makeCard({
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 0,
        deadline: "2026-04-01T00:00:00.000Z",
        met: false,
      },
    });
    expect(getHowlSpendPercent(card)).toBe(0);
  });

  it("returns 50 when half the requirement is spent", () => {
    const card = makeCard({
      amountSpent: 2000,  // dollars
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 4000,  // dollars
        deadline: "2026-04-01T00:00:00.000Z",
        met: false,
      },
    });
    expect(getHowlSpendPercent(card)).toBe(50);
  });

  it("clamps to 100 when amountSpent exceeds requirement", () => {
    const card = makeCard({
      amountSpent: 6000,  // dollars
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 4000,  // dollars
        deadline: "2026-04-01T00:00:00.000Z",
        met: false,
      },
    });
    expect(getHowlSpendPercent(card)).toBe(100);
  });
});
