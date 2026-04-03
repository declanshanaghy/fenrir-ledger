/**
 * ValhallaCardTile — pure helper unit tests (issue #1808)
 *
 * Tests the exported pure functions for the Valhalla tab contextual card details:
 * getTimeHeldMonths, formatMonthYear, getValhallaSignupBonusLabel,
 * getValhallaAnnualFeeLabel, formatTimeHeld.
 */

import { describe, it, expect } from "vitest";
import {
  getTimeHeldMonths,
  formatMonthYear,
  getValhallaSignupBonusLabel,
  getValhallaAnnualFeeLabel,
  formatTimeHeld,
} from "@/components/dashboard/ValhallaCardTile";
import type { Card } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClosedCard(opts: {
  openDate?: string;
  closedAt?: string;
  annualFee?: number;
  signUpBonusMet?: boolean;
  signUpBonusType?: "points" | "miles" | "cashback";
  signUpBonusAmount?: number;
} = {}): Card {
  return {
    id: "card-test",
    householdId: "hh-test",
    issuerId: "chase",
    cardName: "Sapphire Preferred",
    openDate: opts.openDate ?? "2023-01-01T00:00:00.000Z",
    creditLimit: 1000000,
    annualFee: opts.annualFee ?? 9500,
    annualFeeDate: "",
    promoPeriodMonths: 0,
    signUpBonus:
      opts.signUpBonusMet !== undefined
        ? {
            type: opts.signUpBonusType ?? "points",
            amount: opts.signUpBonusAmount ?? 60000,
            spendRequirement: 400000,
            deadline: "2023-05-01T00:00:00.000Z",
            met: opts.signUpBonusMet,
          }
        : null,
    amountSpent: 0,
    status: "closed",
    notes: "",
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    closedAt: opts.closedAt,
  };
}

// ── getTimeHeldMonths ─────────────────────────────────────────────────────────

describe("getTimeHeldMonths", () => {
  it("returns correct months between open and closed dates", () => {
    expect(
      getTimeHeldMonths(
        "2023-01-01T00:00:00.000Z",
        "2025-01-01T00:00:00.000Z"
      )
    ).toBe(24);
  });

  it("returns 0 for < 1 month held", () => {
    // Use noon UTC to avoid timezone day-shift (UTC midnight → previous day in US timezones)
    expect(
      getTimeHeldMonths(
        "2025-01-15T12:00:00.000Z",
        "2025-01-25T12:00:00.000Z"
      )
    ).toBe(0);
  });

  it("returns 0 for empty openDate", () => {
    expect(getTimeHeldMonths("", "2025-01-01T00:00:00.000Z")).toBe(0);
  });

  it("uses today when closedAt is undefined", () => {
    const today = new Date("2025-07-01T00:00:00.000Z");
    expect(
      getTimeHeldMonths("2024-01-01T00:00:00.000Z", undefined, today)
    ).toBe(18);
  });

  it("returns 14 months for ~14 months held", () => {
    expect(
      getTimeHeldMonths(
        "2024-01-01T00:00:00.000Z",
        "2025-03-01T00:00:00.000Z"
      )
    ).toBe(14);
  });
});

// ── formatMonthYear ───────────────────────────────────────────────────────────

describe("formatMonthYear", () => {
  it("returns 'Jan 2025' for January 2025", () => {
    expect(formatMonthYear("2025-01-15T00:00:00.000Z")).toBe("Jan 2025");
  });

  it("returns '' for empty string", () => {
    expect(formatMonthYear("")).toBe("");
  });

  it("returns '' for undefined", () => {
    expect(formatMonthYear(undefined)).toBe("");
  });

  it("returns '' for invalid date", () => {
    expect(formatMonthYear("not-a-date")).toBe("");
  });
});

// ── getValhallaSignupBonusLabel ───────────────────────────────────────────────

describe("getValhallaSignupBonusLabel", () => {
  it("returns '— (not earned)' when bonus not met", () => {
    const card = makeClosedCard({ signUpBonusMet: false, signUpBonusAmount: 60000 });
    expect(getValhallaSignupBonusLabel(card)).toBe("— (not earned)");
  });

  it("returns '— (not earned)' when no signup bonus", () => {
    const card = makeClosedCard();
    expect(getValhallaSignupBonusLabel(card)).toBe("— (not earned)");
  });

  it("returns points label when bonus met with points type", () => {
    const card = makeClosedCard({
      signUpBonusMet: true,
      signUpBonusType: "points",
      signUpBonusAmount: 60000,
    });
    expect(getValhallaSignupBonusLabel(card)).toBe("60,000 pts");
  });

  it("returns miles label when bonus met with miles type", () => {
    const card = makeClosedCard({
      signUpBonusMet: true,
      signUpBonusType: "miles",
      signUpBonusAmount: 50000,
    });
    expect(getValhallaSignupBonusLabel(card)).toBe("50,000 mi");
  });

  it("returns cashback label when bonus met with cashback type", () => {
    const card = makeClosedCard({
      signUpBonusMet: true,
      signUpBonusType: "cashback",
      signUpBonusAmount: 20000,
    });
    // $200 cashback
    expect(getValhallaSignupBonusLabel(card)).toBe("$200 cashback");
  });
});

// ── getValhallaAnnualFeeLabel ─────────────────────────────────────────────────

describe("getValhallaAnnualFeeLabel", () => {
  it("returns '$0 (no fee)' for 0", () => {
    expect(getValhallaAnnualFeeLabel(0)).toBe("$0 (no fee)");
  });

  it("returns '$95/yr' for 9500 cents", () => {
    expect(getValhallaAnnualFeeLabel(9500)).toBe("$95/yr");
  });

  it("returns '$550/yr' for 55000 cents (Amex Plat)", () => {
    expect(getValhallaAnnualFeeLabel(55000)).toBe("$550/yr");
  });
});

// ── formatTimeHeld ────────────────────────────────────────────────────────────

describe("formatTimeHeld", () => {
  it("returns '< 1 month' for 0", () => {
    expect(formatTimeHeld(0)).toBe("< 1 month");
  });

  it("returns '6 mo' for 6 months", () => {
    expect(formatTimeHeld(6)).toBe("6 mo");
  });

  it("returns '1 yr' for 12 months", () => {
    expect(formatTimeHeld(12)).toBe("1 yr");
  });

  it("returns '2 yr 3 mo' for 27 months", () => {
    expect(formatTimeHeld(27)).toBe("2 yr 3 mo");
  });

  it("returns '3 yr' for 36 months", () => {
    expect(formatTimeHeld(36)).toBe("3 yr");
  });
});
