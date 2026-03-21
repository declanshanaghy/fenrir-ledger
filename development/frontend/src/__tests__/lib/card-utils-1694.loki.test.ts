/**
 * Loki QA — Issue #1694
 * Supplementary edge-case tests for predicate helpers extracted in computeCardStatus refactor.
 * Targets boundary conditions not covered by FiremanDecko's primary test suite.
 */

import { describe, it, expect } from "vitest";
import {
  isClosed,
  isGraduated,
  isOverdue,
  isFeeApproaching,
  isPromoExpiring,
  isBonusOpen,
  computeCardStatus,
} from "@/lib/card-utils";
import type { Card } from "@/lib/types";
import { FEE_APPROACHING_DAYS, PROMO_EXPIRING_DAYS } from "@/lib/constants";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "loki-test-id",
    householdId: "hh-loki",
    issuerId: "amex",
    cardName: "Loki Test Card",
    openDate: "2025-01-01T00:00:00.000Z",
    creditLimit: 1000000,
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

const TODAY = new Date("2025-06-15T12:00:00");

// ── isClosed edge cases ───────────────────────────────────────────────────

describe("isClosed — edge cases", () => {
  it("returns false when closedAt field is absent (undefined)", () => {
    const card = makeCard();
    // Remove closedAt entirely to simulate legacy data without the field
    delete (card as Partial<Card>).closedAt;
    expect(isClosed(card)).toBe(false);
  });

  it("returns true when both status=closed AND closedAt are set", () => {
    expect(
      isClosed(makeCard({ status: "closed", closedAt: "2025-05-01T00:00:00.000Z" }))
    ).toBe(true);
  });
});

// ── isGraduated edge cases ────────────────────────────────────────────────

describe("isGraduated — edge cases", () => {
  it("returns false when signUpBonus exists but met is undefined/falsy", () => {
    const card = makeCard({
      signUpBonus: {
        type: "points",
        amount: 50000,
        spendRequirement: 400000,
        deadline: "2026-01-01T00:00:00.000Z",
        met: false,
      },
    });
    expect(isGraduated(card)).toBe(false);
  });
});

// ── isOverdue edge cases ──────────────────────────────────────────────────

describe("isOverdue — edge cases", () => {
  it("returns false when fee date is exactly today (0 days, not < 0)", () => {
    expect(
      isOverdue(makeCard({ annualFee: 9500, annualFeeDate: TODAY.toISOString() }), TODAY)
    ).toBe(false);
  });

  it("returns true when fee date was yesterday", () => {
    const yesterday = new Date(TODAY);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(
      isOverdue(makeCard({ annualFee: 9500, annualFeeDate: yesterday.toISOString() }), TODAY)
    ).toBe(true);
  });

  it("returns false when annualFee is 0 even if fee date is in the past", () => {
    expect(
      isOverdue(makeCard({ annualFee: 0, annualFeeDate: "2020-01-01T00:00:00.000Z" }), TODAY)
    ).toBe(false);
  });
});

// ── isFeeApproaching edge cases ───────────────────────────────────────────

describe("isFeeApproaching — edge cases", () => {
  it("returns true when fee is exactly at the FEE_APPROACHING_DAYS boundary", () => {
    const feeDate = new Date(TODAY);
    feeDate.setDate(feeDate.getDate() + FEE_APPROACHING_DAYS);
    expect(
      isFeeApproaching(makeCard({ annualFee: 9500, annualFeeDate: feeDate.toISOString() }), TODAY)
    ).toBe(true);
  });

  it("returns false when fee is 1 day beyond the threshold", () => {
    const feeDate = new Date(TODAY);
    feeDate.setDate(feeDate.getDate() + FEE_APPROACHING_DAYS + 1);
    expect(
      isFeeApproaching(makeCard({ annualFee: 9500, annualFeeDate: feeDate.toISOString() }), TODAY)
    ).toBe(false);
  });

  it("returns false when fee date is in the past (overdue, not approaching)", () => {
    expect(
      isFeeApproaching(
        makeCard({ annualFee: 9500, annualFeeDate: "2025-01-01T00:00:00.000Z" }),
        TODAY
      )
    ).toBe(false);
  });
});

// ── isPromoExpiring edge cases ────────────────────────────────────────────

describe("isPromoExpiring — edge cases", () => {
  it("returns false when deadline is an empty string", () => {
    expect(
      isPromoExpiring(
        makeCard({
          signUpBonus: {
            type: "points",
            amount: 50000,
            spendRequirement: 400000,
            deadline: "",
            met: false,
          },
        }),
        TODAY
      )
    ).toBe(false);
  });

  it("returns true when deadline is exactly today (0 days, inside window)", () => {
    expect(
      isPromoExpiring(
        makeCard({
          signUpBonus: {
            type: "points",
            amount: 50000,
            spendRequirement: 400000,
            deadline: TODAY.toISOString(),
            met: false,
          },
        }),
        TODAY
      )
    ).toBe(true);
  });

  it("returns true at exactly the PROMO_EXPIRING_DAYS boundary", () => {
    const deadline = new Date(TODAY);
    deadline.setDate(deadline.getDate() + PROMO_EXPIRING_DAYS);
    expect(
      isPromoExpiring(
        makeCard({
          signUpBonus: {
            type: "points",
            amount: 50000,
            spendRequirement: 400000,
            deadline: deadline.toISOString(),
            met: false,
          },
        }),
        TODAY
      )
    ).toBe(true);
  });

  it("returns false when deadline is past (expired)", () => {
    const pastDeadline = new Date(TODAY);
    pastDeadline.setDate(pastDeadline.getDate() - 1);
    expect(
      isPromoExpiring(
        makeCard({
          signUpBonus: {
            type: "points",
            amount: 50000,
            spendRequirement: 400000,
            deadline: pastDeadline.toISOString(),
            met: false,
          },
        }),
        TODAY
      )
    ).toBe(false);
  });
});

// ── isBonusOpen edge cases ────────────────────────────────────────────────

describe("isBonusOpen — edge cases", () => {
  it("returns false when deadline is exactly today (requires strictly > 0 days)", () => {
    expect(
      isBonusOpen(
        makeCard({
          signUpBonus: {
            type: "points",
            amount: 50000,
            spendRequirement: 400000,
            deadline: TODAY.toISOString(),
            met: false,
          },
        }),
        TODAY
      )
    ).toBe(false);
  });

  it("returns true when deadline is 1 day away (still in earning window)", () => {
    const tomorrow = new Date(TODAY);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(
      isBonusOpen(
        makeCard({
          signUpBonus: {
            type: "cashback",
            amount: 30000,
            spendRequirement: 200000,
            deadline: tomorrow.toISOString(),
            met: false,
          },
        }),
        TODAY
      )
    ).toBe(true);
  });

  it("returns true when deadline is within PROMO_EXPIRING_DAYS (bonus open AND expiring)", () => {
    // Both isBonusOpen and isPromoExpiring would return true; computeCardStatus
    // must resolve the conflict via priority order
    const sooner = new Date(TODAY);
    sooner.setDate(sooner.getDate() + Math.floor(PROMO_EXPIRING_DAYS / 2));
    expect(
      isBonusOpen(
        makeCard({
          signUpBonus: {
            type: "points",
            amount: 50000,
            spendRequirement: 400000,
            deadline: sooner.toISOString(),
            met: false,
          },
        }),
        TODAY
      )
    ).toBe(true);
  });
});

// ── computeCardStatus priority edge cases ────────────────────────────────

describe("computeCardStatus — priority edge cases (Loki #1694)", () => {
  it('"promo_expiring" wins over "bonus_open" when deadline is inside expiry window', () => {
    // isBonusOpen would also return true here, but promo_expiring has higher priority
    const deadline = new Date(TODAY);
    deadline.setDate(deadline.getDate() + Math.floor(PROMO_EXPIRING_DAYS / 2));
    expect(
      computeCardStatus(
        makeCard({
          signUpBonus: {
            type: "points",
            amount: 50000,
            spendRequirement: 400000,
            deadline: deadline.toISOString(),
            met: false,
          },
        }),
        TODAY
      )
    ).toBe("promo_expiring");
  });

  it('"fee_approaching" wins over "bonus_open" when both conditions are active', () => {
    const feeDate = new Date(TODAY);
    feeDate.setDate(feeDate.getDate() + FEE_APPROACHING_DAYS);
    const deadline = new Date(TODAY);
    deadline.setDate(deadline.getDate() + PROMO_EXPIRING_DAYS + 10);
    expect(
      computeCardStatus(
        makeCard({
          annualFee: 9500,
          annualFeeDate: feeDate.toISOString(),
          signUpBonus: {
            type: "points",
            amount: 50000,
            spendRequirement: 400000,
            deadline: deadline.toISOString(),
            met: false,
          },
        }),
        TODAY
      )
    ).toBe("fee_approaching");
  });

  it('"active" when bonus deadline has passed (expired, not met)', () => {
    const pastDeadline = new Date(TODAY);
    pastDeadline.setDate(pastDeadline.getDate() - 5);
    expect(
      computeCardStatus(
        makeCard({
          signUpBonus: {
            type: "points",
            amount: 50000,
            spendRequirement: 400000,
            deadline: pastDeadline.toISOString(),
            met: false,
          },
        }),
        TODAY
      )
    ).toBe("active");
  });

  it('"active" for a card with annualFee but date far in the future beyond threshold', () => {
    const feeDate = new Date(TODAY);
    feeDate.setDate(feeDate.getDate() + FEE_APPROACHING_DAYS + 60);
    expect(
      computeCardStatus(makeCard({ annualFee: 9500, annualFeeDate: feeDate.toISOString() }), TODAY)
    ).toBe("active");
  });
});
