/**
 * Issue #1690 — CardTile refactor: pure helper unit tests
 *
 * Tests for the three pure functions extracted from CardTile.tsx to reduce
 * its cyclomatic complexity:
 *   - getTotalDays
 *   - getRingDaysRemaining
 *   - getRingDeadlineIso
 */

import { describe, it, expect } from "vitest";
import {
  getTotalDays,
  getRingDaysRemaining,
  getRingDeadlineIso,
} from "@/components/dashboard/CardTile";
import type { Card as CreditCard } from "@/lib/types";

// ── getTotalDays ───────────────────────────────────────────────────────────────

describe("getTotalDays", () => {
  it("returns 365 when openDate is empty", () => {
    expect(getTotalDays("", "2026-01-01T00:00:00.000Z")).toBe(365);
  });

  it("returns 365 when deadlineIso is empty", () => {
    expect(getTotalDays("2025-01-01T00:00:00.000Z", "")).toBe(365);
  });

  it("returns 365 for invalid openDate", () => {
    expect(getTotalDays("not-a-date", "2026-01-01T00:00:00.000Z")).toBe(365);
  });

  it("returns 365 for invalid deadlineIso", () => {
    expect(getTotalDays("2025-01-01T00:00:00.000Z", "not-a-date")).toBe(365);
  });

  it("returns 365 when deadline is before openDate (non-positive diff)", () => {
    // deadline before open → negative diff → fallback 365
    expect(
      getTotalDays("2026-06-01T00:00:00.000Z", "2025-01-01T00:00:00.000Z")
    ).toBe(365);
  });

  it("returns 365 when open and deadline are the same day", () => {
    // diff = 0 → non-positive → 365
    expect(
      getTotalDays("2025-01-01T00:00:00.000Z", "2025-01-01T00:00:00.000Z")
    ).toBe(365);
  });

  it("calculates correct total days for a one-year span", () => {
    const result = getTotalDays(
      "2025-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z"
    );
    expect(result).toBe(365);
  });

  it("calculates correct total days for a 30-day span", () => {
    const result = getTotalDays(
      "2025-03-01T00:00:00.000Z",
      "2025-03-31T00:00:00.000Z"
    );
    expect(result).toBe(30);
  });
});

// ── getRingDaysRemaining ───────────────────────────────────────────────────────

describe("getRingDaysRemaining", () => {
  it("returns 0 for closed status regardless of feeDays/bonusDays", () => {
    expect(getRingDaysRemaining("closed", 10, 20)).toBe(0);
    expect(getRingDaysRemaining("closed", null, null)).toBe(0);
  });

  it("returns feeDays for fee_approaching status when feeDays is set", () => {
    expect(getRingDaysRemaining("fee_approaching", 30, null)).toBe(30);
    expect(getRingDaysRemaining("fee_approaching", 30, 10)).toBe(30);
  });

  it("returns 365 for fee_approaching when feeDays is null", () => {
    expect(getRingDaysRemaining("fee_approaching", null, null)).toBe(365);
  });

  it("returns bonusDays for promo_expiring status when bonusDays is set", () => {
    expect(getRingDaysRemaining("promo_expiring", null, 15)).toBe(15);
    expect(getRingDaysRemaining("promo_expiring", 45, 15)).toBe(15);
  });

  it("returns 365 for promo_expiring when bonusDays is null", () => {
    expect(getRingDaysRemaining("promo_expiring", null, null)).toBe(365);
  });

  it("prefers feeDays over bonusDays for active status", () => {
    expect(getRingDaysRemaining("active", 60, 20)).toBe(60);
  });

  it("falls back to bonusDays for active status when feeDays is null", () => {
    expect(getRingDaysRemaining("active", null, 20)).toBe(20);
  });

  it("returns 365 for active status when both are null", () => {
    expect(getRingDaysRemaining("active", null, null)).toBe(365);
  });

  it("returns feeDays for graduated status (treated as generic active path)", () => {
    expect(getRingDaysRemaining("graduated", 90, null)).toBe(90);
  });

  it("returns bonusDays for bonus_open status when feeDays is null", () => {
    expect(getRingDaysRemaining("bonus_open", null, 25)).toBe(25);
  });
});

// ── getRingDeadlineIso ─────────────────────────────────────────────────────────

function makeCard(overrides: Partial<CreditCard>): CreditCard {
  return {
    id: "test-id",
    cardName: "Test Card",
    issuerId: "chase",
    openDate: "2025-01-01T00:00:00.000Z",
    creditLimit: 10000,
    annualFee: 0,
    annualFeeDate: "",
    status: "active",
    signUpBonus: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  } as CreditCard;
}

describe("getRingDeadlineIso", () => {
  it("returns annualFeeDate for fee_approaching status", () => {
    const card = makeCard({
      status: "fee_approaching",
      annualFeeDate: "2026-02-01T00:00:00.000Z",
      signUpBonus: {
        met: false,
        deadline: "2026-03-01T00:00:00.000Z",
        minimumSpend: 3000,
        bonusPoints: 60000,
      },
    });
    expect(getRingDeadlineIso(card)).toBe("2026-02-01T00:00:00.000Z");
  });

  it("returns empty string for fee_approaching when annualFeeDate is missing", () => {
    const card = makeCard({
      status: "fee_approaching",
      annualFeeDate: "",
    });
    expect(getRingDeadlineIso(card)).toBe("");
  });

  it("returns signUpBonus.deadline for promo_expiring status", () => {
    const card = makeCard({
      status: "promo_expiring",
      annualFeeDate: "2026-06-01T00:00:00.000Z",
      signUpBonus: {
        met: false,
        deadline: "2026-03-01T00:00:00.000Z",
        minimumSpend: 3000,
        bonusPoints: 60000,
      },
    });
    expect(getRingDeadlineIso(card)).toBe("2026-03-01T00:00:00.000Z");
  });

  it("returns annualFeeDate for active status when present", () => {
    const card = makeCard({
      status: "active",
      annualFeeDate: "2026-06-01T00:00:00.000Z",
      signUpBonus: {
        met: false,
        deadline: "2026-04-01T00:00:00.000Z",
        minimumSpend: 3000,
        bonusPoints: 60000,
      },
    });
    expect(getRingDeadlineIso(card)).toBe("2026-06-01T00:00:00.000Z");
  });

  it("returns signUpBonus.deadline for active status when annualFeeDate is missing", () => {
    const card = makeCard({
      status: "active",
      annualFeeDate: "",
      signUpBonus: {
        met: false,
        deadline: "2026-04-01T00:00:00.000Z",
        minimumSpend: 3000,
        bonusPoints: 60000,
      },
    });
    expect(getRingDeadlineIso(card)).toBe("2026-04-01T00:00:00.000Z");
  });

  it("returns empty string when no deadlines are present", () => {
    const card = makeCard({
      status: "active",
      annualFeeDate: "",
      signUpBonus: null,
    });
    expect(getRingDeadlineIso(card)).toBe("");
  });

  it("returns empty string for closed card with no dates", () => {
    const card = makeCard({ status: "closed" });
    expect(getRingDeadlineIso(card)).toBe("");
  });
});
