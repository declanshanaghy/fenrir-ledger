/**
 * Unit tests for card-utils.ts — pure functions for card status computation
 * and display formatting.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isoToLocalDateString,
  localDateStringToIso,
  daysUntil,
  isClosed,
  isGraduated,
  isOverdue,
  isFeeApproaching,
  isPromoExpiring,
  isBonusOpen,
  computeCardStatus,
  formatCurrency,
  formatDate,
  formatDaysUntil,
  generateId,
  dollarsToCents,
  centsToDollars,
} from "@/lib/card-utils";
import { FEE_APPROACHING_DAYS, PROMO_EXPIRING_DAYS } from "@/lib/constants";
import { makeCard } from "@/__tests__/fixtures/cards";

/** Returns a Date object for "today + n days" at midnight local time. */
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── isoToLocalDateString ──────────────────────────────────────────────────

describe("isoToLocalDateString", () => {
  it("converts ISO string to YYYY-MM-DD", () => {
    // This tests local timezone conversion — result depends on TZ but format is correct
    const result = isoToLocalDateString("2025-06-15T00:00:00.000Z");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns "" for empty string', () => {
    expect(isoToLocalDateString("")).toBe("");
  });

  it('returns "" for invalid date', () => {
    expect(isoToLocalDateString("not-a-date")).toBe("");
  });
});

// ── localDateStringToIso ──────────────────────────────────────────────────

describe("localDateStringToIso", () => {
  it("converts YYYY-MM-DD to ISO string", () => {
    const result = localDateStringToIso("2025-06-15");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('returns "" for empty string', () => {
    expect(localDateStringToIso("")).toBe("");
  });

  it('returns "" for invalid date', () => {
    expect(localDateStringToIso("xyz")).toBe("");
  });
});

// ── daysUntil ─────────────────────────────────────────────────────────────

describe("daysUntil", () => {
  it("returns 0 for today", () => {
    const today = new Date();
    const todayIso = today.toISOString();
    expect(daysUntil(todayIso, today)).toBe(0);
  });

  it("returns positive for future dates", () => {
    const today = new Date("2025-01-01T00:00:00.000Z");
    expect(daysUntil("2025-01-11T00:00:00.000Z", today)).toBe(10);
  });

  it("returns negative for past dates", () => {
    const today = new Date("2025-01-11T00:00:00.000Z");
    expect(daysUntil("2025-01-01T00:00:00.000Z", today)).toBe(-10);
  });

  it("returns Infinity for empty string", () => {
    expect(daysUntil("")).toBe(Infinity);
  });

  it("returns Infinity for invalid date", () => {
    expect(daysUntil("not-a-date")).toBe(Infinity);
  });

  it("handles legacy YYYY-MM-DD format", () => {
    const today = new Date("2025-03-01T00:00:00");
    expect(daysUntil("2025-03-11", today)).toBe(10);
  });
});

// ── isClosed ──────────────────────────────────────────────────────────────

describe("isClosed", () => {
  it("returns true when status is closed", () => {
    expect(isClosed(makeCard({ status: "closed" }))).toBe(true);
  });

  it("returns true when closedAt is set", () => {
    expect(isClosed(makeCard({ closedAt: "2025-05-01T00:00:00.000Z" }))).toBe(true);
  });

  it("returns false for an active card", () => {
    expect(isClosed(makeCard())).toBe(false);
  });

  it("returns false when closedAt is empty string", () => {
    expect(isClosed(makeCard({ closedAt: "" }))).toBe(false);
  });
});

// ── isGraduated ───────────────────────────────────────────────────────────

describe("isGraduated", () => {
  it("returns true when signUpBonus.met is true", () => {
    expect(
      isGraduated(
        makeCard({
          signUpBonus: { type: "points", amount: 50000, spendRequirement: 400000, deadline: "", met: true },
        })
      )
    ).toBe(true);
  });

  it("returns false when signUpBonus.met is false", () => {
    expect(
      isGraduated(
        makeCard({
          signUpBonus: { type: "points", amount: 50000, spendRequirement: 400000, deadline: "", met: false },
        })
      )
    ).toBe(false);
  });

  it("returns false when signUpBonus is null", () => {
    expect(isGraduated(makeCard({ signUpBonus: null }))).toBe(false);
  });
});

// ── isOverdue ─────────────────────────────────────────────────────────────

describe("isOverdue", () => {
  const today = new Date("2025-06-15T12:00:00");

  it("returns true when annual fee date is in the past", () => {
    expect(
      isOverdue(makeCard({ annualFee: 9500, annualFeeDate: "2025-06-01T00:00:00.000Z" }), today)
    ).toBe(true);
  });

  it("returns false when annualFee is 0", () => {
    expect(
      isOverdue(makeCard({ annualFee: 0, annualFeeDate: "2025-06-01T00:00:00.000Z" }), today)
    ).toBe(false);
  });

  it("returns false when annualFeeDate is empty", () => {
    expect(isOverdue(makeCard({ annualFee: 9500, annualFeeDate: "" }), today)).toBe(false);
  });

  it("returns false when fee is today (0 days)", () => {
    expect(
      isOverdue(makeCard({ annualFee: 9500, annualFeeDate: today.toISOString() }), today)
    ).toBe(false);
  });
});

// ── isFeeApproaching ──────────────────────────────────────────────────────

describe("isFeeApproaching", () => {
  const today = new Date("2025-06-15T12:00:00");

  it("returns true when fee is within FEE_APPROACHING_DAYS", () => {
    const feeDate = new Date(today);
    feeDate.setDate(feeDate.getDate() + FEE_APPROACHING_DAYS);
    expect(
      isFeeApproaching(makeCard({ annualFee: 9500, annualFeeDate: feeDate.toISOString() }), today)
    ).toBe(true);
  });

  it("returns true when fee is today", () => {
    expect(
      isFeeApproaching(makeCard({ annualFee: 9500, annualFeeDate: today.toISOString() }), today)
    ).toBe(true);
  });

  it("returns false when fee is beyond threshold", () => {
    const feeDate = new Date(today);
    feeDate.setDate(feeDate.getDate() + FEE_APPROACHING_DAYS + 1);
    expect(
      isFeeApproaching(makeCard({ annualFee: 9500, annualFeeDate: feeDate.toISOString() }), today)
    ).toBe(false);
  });

  it("returns false when annualFee is 0", () => {
    expect(
      isFeeApproaching(makeCard({ annualFee: 0, annualFeeDate: today.toISOString() }), today)
    ).toBe(false);
  });
});

// ── isPromoExpiring ───────────────────────────────────────────────────────

describe("isPromoExpiring", () => {
  const today = new Date("2025-06-15T12:00:00");

  it("returns true when deadline is within PROMO_EXPIRING_DAYS", () => {
    const deadline = new Date(today);
    deadline.setDate(deadline.getDate() + PROMO_EXPIRING_DAYS);
    expect(
      isPromoExpiring(
        makeCard({
          signUpBonus: { type: "points", amount: 50000, spendRequirement: 400000, deadline: deadline.toISOString(), met: false },
        }),
        today
      )
    ).toBe(true);
  });

  it("returns false when bonus is already met", () => {
    expect(
      isPromoExpiring(
        makeCard({
          signUpBonus: { type: "points", amount: 50000, spendRequirement: 400000, deadline: today.toISOString(), met: true },
        }),
        today
      )
    ).toBe(false);
  });

  it("returns false when signUpBonus is null", () => {
    expect(isPromoExpiring(makeCard({ signUpBonus: null }), today)).toBe(false);
  });

  it("returns false when deadline is beyond threshold", () => {
    const deadline = new Date(today);
    deadline.setDate(deadline.getDate() + PROMO_EXPIRING_DAYS + 10);
    expect(
      isPromoExpiring(
        makeCard({
          signUpBonus: { type: "points", amount: 50000, spendRequirement: 400000, deadline: deadline.toISOString(), met: false },
        }),
        today
      )
    ).toBe(false);
  });
});

// ── isBonusOpen ───────────────────────────────────────────────────────────

describe("isBonusOpen", () => {
  const today = new Date("2025-06-15T12:00:00");

  it("returns true when deadline is far in the future", () => {
    const deadline = new Date(today);
    deadline.setDate(deadline.getDate() + PROMO_EXPIRING_DAYS + 10);
    expect(
      isBonusOpen(
        makeCard({
          signUpBonus: { type: "cashback", amount: 30000, spendRequirement: 200000, deadline: deadline.toISOString(), met: false },
        }),
        today
      )
    ).toBe(true);
  });

  it("returns false when bonus is met", () => {
    const deadline = new Date(today);
    deadline.setDate(deadline.getDate() + 90);
    expect(
      isBonusOpen(
        makeCard({
          signUpBonus: { type: "points", amount: 50000, spendRequirement: 400000, deadline: deadline.toISOString(), met: true },
        }),
        today
      )
    ).toBe(false);
  });

  it("returns false when signUpBonus is null", () => {
    expect(isBonusOpen(makeCard({ signUpBonus: null }), today)).toBe(false);
  });

  it("returns false when deadline is empty", () => {
    expect(
      isBonusOpen(
        makeCard({
          signUpBonus: { type: "points", amount: 50000, spendRequirement: 400000, deadline: "", met: false },
        }),
        today
      )
    ).toBe(false);
  });
});

// ── computeCardStatus ─────────────────────────────────────────────────────

describe("computeCardStatus", () => {
  const today = new Date("2025-06-15T12:00:00");

  it('returns "active" for a basic card with no conditions', () => {
    expect(computeCardStatus(makeCard(), today)).toBe("active");
  });

  it('returns "closed" when card status is "closed"', () => {
    expect(computeCardStatus(makeCard({ status: "closed" }), today)).toBe("closed");
  });

  it('returns "closed" when closedAt is set', () => {
    expect(
      computeCardStatus(
        makeCard({ closedAt: "2025-05-01T00:00:00.000Z" }),
        today
      )
    ).toBe("closed");
  });

  it('returns "closed" when closedAt is a non-empty string', () => {
    expect(
      computeCardStatus(makeCard({ closedAt: "2025-01-01T00:00:00.000Z" }), today)
    ).toBe("closed");
  });

  it('returns "graduated" when signUpBonus.met is true', () => {
    expect(
      computeCardStatus(
        makeCard({
          signUpBonus: {
            type: "points",
            amount: 50000,
            spendRequirement: 400000,
            deadline: "2025-12-01T00:00:00.000Z",
            met: true,
          },
        }),
        today
      )
    ).toBe("graduated");
  });

  it('returns "overdue" when annual fee date is in the past', () => {
    expect(
      computeCardStatus(
        makeCard({
          annualFee: 9500,
          annualFeeDate: "2025-06-01T00:00:00.000Z",
        }),
        today
      )
    ).toBe("overdue");
  });

  it('does not return "overdue" when annualFee is 0 even if date is past', () => {
    expect(
      computeCardStatus(
        makeCard({
          annualFee: 0,
          annualFeeDate: "2025-06-01T00:00:00.000Z",
        }),
        today
      )
    ).toBe("active");
  });

  it('returns "fee_approaching" when fee is within FEE_APPROACHING_DAYS', () => {
    const feeDate = new Date(today);
    feeDate.setDate(feeDate.getDate() + FEE_APPROACHING_DAYS);
    expect(
      computeCardStatus(
        makeCard({
          annualFee: 9500,
          annualFeeDate: feeDate.toISOString(),
        }),
        today
      )
    ).toBe("fee_approaching");
  });

  it('returns "fee_approaching" when fee is exactly today (0 days)', () => {
    expect(
      computeCardStatus(
        makeCard({
          annualFee: 9500,
          annualFeeDate: today.toISOString(),
        }),
        today
      )
    ).toBe("fee_approaching");
  });

  it('does not return "fee_approaching" when fee is beyond threshold', () => {
    const feeDate = new Date(today);
    feeDate.setDate(feeDate.getDate() + FEE_APPROACHING_DAYS + 1);
    expect(
      computeCardStatus(
        makeCard({
          annualFee: 9500,
          annualFeeDate: feeDate.toISOString(),
        }),
        today
      )
    ).toBe("active");
  });

  it('returns "promo_expiring" when bonus deadline is within PROMO_EXPIRING_DAYS', () => {
    const deadline = new Date(today);
    deadline.setDate(deadline.getDate() + PROMO_EXPIRING_DAYS);
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
        today
      )
    ).toBe("promo_expiring");
  });

  it('returns "bonus_open" when bonus deadline is far in the future', () => {
    const deadline = new Date(today);
    deadline.setDate(deadline.getDate() + PROMO_EXPIRING_DAYS + 10);
    expect(
      computeCardStatus(
        makeCard({
          signUpBonus: {
            type: "cashback",
            amount: 30000,
            spendRequirement: 200000,
            deadline: deadline.toISOString(),
            met: false,
          },
        }),
        today
      )
    ).toBe("bonus_open");
  });

  it('"overdue" takes priority over "fee_approaching"', () => {
    // annualFeeDate in the past => overdue
    expect(
      computeCardStatus(
        makeCard({
          annualFee: 9500,
          annualFeeDate: "2025-06-01T00:00:00.000Z",
        }),
        today
      )
    ).toBe("overdue");
  });

  it('"overdue" takes priority over "bonus_open"', () => {
    const deadline = new Date(today);
    deadline.setDate(deadline.getDate() + 90);
    expect(
      computeCardStatus(
        makeCard({
          annualFee: 9500,
          annualFeeDate: "2025-06-01T00:00:00.000Z",
          signUpBonus: {
            type: "points",
            amount: 50000,
            spendRequirement: 400000,
            deadline: deadline.toISOString(),
            met: false,
          },
        }),
        today
      )
    ).toBe("overdue");
  });

  it('"closed" takes priority over everything', () => {
    expect(
      computeCardStatus(
        makeCard({
          status: "closed",
          annualFee: 9500,
          annualFeeDate: "2025-06-01T00:00:00.000Z",
          signUpBonus: {
            type: "points",
            amount: 50000,
            spendRequirement: 400000,
            deadline: "2025-12-01T00:00:00.000Z",
            met: true,
          },
        }),
        today
      )
    ).toBe("closed");
  });

  it('"graduated" takes priority over "overdue" and "fee_approaching"', () => {
    expect(
      computeCardStatus(
        makeCard({
          annualFee: 9500,
          annualFeeDate: "2025-06-01T00:00:00.000Z",
          signUpBonus: {
            type: "points",
            amount: 50000,
            spendRequirement: 400000,
            deadline: "2025-12-01T00:00:00.000Z",
            met: true,
          },
        }),
        today
      )
    ).toBe("graduated");
  });

  it('returns "active" when bonus deadline is empty', () => {
    expect(
      computeCardStatus(
        makeCard({
          signUpBonus: {
            type: "points",
            amount: 50000,
            spendRequirement: 400000,
            deadline: "",
            met: false,
          },
        }),
        today
      )
    ).toBe("active");
  });
});

// ── formatCurrency ────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it('formats 0 as "$0"', () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("formats whole dollars", () => {
    expect(formatCurrency(95)).toBe("$95");
  });

  it("formats dollars with fractional cents", () => {
    expect(formatCurrency(95.5)).toBe("$95.5");
  });

  it("formats large amounts", () => {
    expect(formatCurrency(10000)).toBe("$10,000");
  });
});

// ── formatDate ────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it('returns "" for empty string', () => {
    expect(formatDate("")).toBe("");
  });

  it('returns "" for invalid date', () => {
    expect(formatDate("not-a-date")).toBe("");
  });

  it("formats ISO date string", () => {
    const result = formatDate("2025-01-15T00:00:00.000Z");
    // Locale-dependent but should contain the year and month
    expect(result).toContain("2025");
    expect(result).toMatch(/Jan/);
  });

  it("handles legacy YYYY-MM-DD format", () => {
    const result = formatDate("2025-06-15");
    expect(result).toContain("2025");
    expect(result).toMatch(/Jun/);
  });
});

// ── formatDaysUntil ───────────────────────────────────────────────────────

describe("formatDaysUntil", () => {
  it('returns "today" for 0 days', () => {
    expect(formatDaysUntil(0)).toBe("today");
  });

  it('returns "in 1 day" for 1 day', () => {
    expect(formatDaysUntil(1)).toBe("in 1 day");
  });

  it('returns "in N days" for positive days', () => {
    expect(formatDaysUntil(5)).toBe("in 5 days");
  });

  it('returns "1 day ago" for -1', () => {
    expect(formatDaysUntil(-1)).toBe("1 day ago");
  });

  it('returns "N days ago" for negative days', () => {
    expect(formatDaysUntil(-7)).toBe("7 days ago");
  });
});

// ── generateId ────────────────────────────────────────────────────────────

describe("generateId", () => {
  it("generates a string", () => {
    expect(typeof generateId()).toBe("string");
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it("matches UUID v4 format", () => {
    const id = generateId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});

// ── dollarsToCents ────────────────────────────────────────────────────────

describe("dollarsToCents", () => {
  it("converts whole dollars", () => {
    expect(dollarsToCents("95")).toBe(9500);
  });

  it("converts dollars with cents", () => {
    expect(dollarsToCents("95.50")).toBe(9550);
  });

  it("returns 0 for invalid input", () => {
    expect(dollarsToCents("abc")).toBe(0);
  });

  it("returns 0 for negative", () => {
    expect(dollarsToCents("-5")).toBe(0);
  });

  it("handles zero", () => {
    expect(dollarsToCents("0")).toBe(0);
  });

  it("rounds fractional cents", () => {
    expect(dollarsToCents("95.555")).toBe(9556);
  });
});

// ── centsToDollars ────────────────────────────────────────────────────────

describe("centsToDollars", () => {
  it('returns "" for 0', () => {
    expect(centsToDollars(0)).toBe("");
  });

  it("converts whole dollars (no trailing zeros)", () => {
    expect(centsToDollars(9500)).toBe("95");
  });

  it("converts dollars with cents", () => {
    expect(centsToDollars(9550)).toBe("95.50");
  });

  it("handles single digit cents", () => {
    expect(centsToDollars(9501)).toBe("95.01");
  });
});
