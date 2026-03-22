/**
 * Issue #1690 — Loki QA supplemental tests for CardTile pure helpers.
 *
 * These tests augment the implementation agent's suite by covering
 * fall-through paths and boundary conditions not exercised in
 * card-tile-1690.test.ts.
 */

import { describe, it, expect } from "vitest";
import {
  getTotalDays,
  getRingDaysRemaining,
  getRingDeadlineIso,
} from "@/components/dashboard/CardTile";
import type { Card as CreditCard } from "@/lib/types";

// ── Helper ─────────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<CreditCard>): CreditCard {
  return {
    id: "loki-test",
    cardName: "Loki Test Card",
    issuerId: "amex",
    openDate: "2025-01-01T00:00:00.000Z",
    creditLimit: 5000,
    annualFee: 0,
    annualFeeDate: "",
    status: "active",
    signUpBonus: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  } as CreditCard;
}

// ── getRingDaysRemaining — fall-through paths ──────────────────────────────────

describe("getRingDaysRemaining — fall-through edge cases", () => {
  it("fee_approaching with null feeDays falls through to bonusDays when set", () => {
    // feeDays=null skips the status-specific branch; generic fallback returns bonusDays
    expect(getRingDaysRemaining("fee_approaching", null, 30)).toBe(30);
  });

  it("promo_expiring with null bonusDays falls through to feeDays when set", () => {
    // bonusDays=null skips the status-specific branch; generic fallback returns feeDays
    expect(getRingDaysRemaining("promo_expiring", 45, null)).toBe(45);
  });

  it("returns 0 for feeDays=0 (fee due today) with active status", () => {
    // feeDays=0 means the fee is due today — still a valid non-null value
    expect(getRingDaysRemaining("active", 0, 20)).toBe(0);
  });

  it("returns 0 for bonusDays=0 (bonus deadline today) when feeDays is null", () => {
    expect(getRingDaysRemaining("active", null, 0)).toBe(0);
  });
});

// ── getRingDeadlineIso — fall-through paths ────────────────────────────────────

describe("getRingDeadlineIso — fall-through edge cases", () => {
  it("promo_expiring with null signUpBonus falls back to annualFeeDate", () => {
    // signUpBonus is null → promo_expiring branch skipped → annualFeeDate used
    const card = makeCard({
      status: "promo_expiring",
      annualFeeDate: "2026-05-01T00:00:00.000Z",
      signUpBonus: null,
    });
    expect(getRingDeadlineIso(card)).toBe("2026-05-01T00:00:00.000Z");
  });

  it("promo_expiring with signUpBonus but no deadline falls back to annualFeeDate", () => {
    const card = makeCard({
      status: "promo_expiring",
      annualFeeDate: "2026-05-01T00:00:00.000Z",
      signUpBonus: { met: false, deadline: "", minimumSpend: 2000, bonusPoints: 50000 },
    });
    expect(getRingDeadlineIso(card)).toBe("2026-05-01T00:00:00.000Z");
  });

  it("fee_approaching with annualFeeDate wins over signUpBonus deadline", () => {
    const card = makeCard({
      status: "fee_approaching",
      annualFeeDate: "2026-02-15T00:00:00.000Z",
      signUpBonus: { met: false, deadline: "2026-01-01T00:00:00.000Z", minimumSpend: 1000, bonusPoints: 30000 },
    });
    // First branch returns annualFeeDate for fee_approaching
    expect(getRingDeadlineIso(card)).toBe("2026-02-15T00:00:00.000Z");
  });
});

// ── getTotalDays — boundary values ─────────────────────────────────────────────

describe("getTotalDays — boundary values", () => {
  it("calculates correct total days for a 90-day span", () => {
    const result = getTotalDays(
      "2025-01-01T00:00:00.000Z",
      "2025-04-01T00:00:00.000Z"
    );
    expect(result).toBe(90);
  });

  it("calculates correct total days for a 1-day span", () => {
    const result = getTotalDays(
      "2025-06-01T00:00:00.000Z",
      "2025-06-02T00:00:00.000Z"
    );
    expect(result).toBe(1);
  });
});
