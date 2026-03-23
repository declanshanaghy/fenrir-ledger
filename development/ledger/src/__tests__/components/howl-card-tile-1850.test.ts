/**
 * HowlCardTile — pure helper unit tests (issue #1850)
 *
 * Covers: shouldShowBonusWarning, getHowlBonusRemaining
 * exported from HowlCardTile.tsx.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  shouldShowBonusWarning,
  getHowlBonusRemaining,
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
    creditLimit: 1000000,
    annualFee: 9500,
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

// ── shouldShowBonusWarning ─────────────────────────────────────────────────────

describe("shouldShowBonusWarning", () => {
  beforeEach(() => {
    // Pin "today" to 2026-03-23 so deadline math is deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when card has no signUpBonus", () => {
    const card = makeCard({ signUpBonus: null });
    expect(shouldShowBonusWarning(card)).toBe(false);
  });

  it("returns false when signUpBonus is already met", () => {
    const card = makeCard({
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 400000,
        deadline: "2026-04-10T00:00:00.000Z", // 18d away
        met: true,
      },
    });
    expect(shouldShowBonusWarning(card)).toBe(false);
  });

  it("returns true when unmet bonus deadline is within 60d", () => {
    const card = makeCard({
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 400000,
        deadline: "2026-04-10T00:00:00.000Z", // 18d from 2026-03-23
        met: false,
      },
    });
    expect(shouldShowBonusWarning(card)).toBe(true);
  });

  it("returns false when unmet bonus deadline is > 60d away", () => {
    const card = makeCard({
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 400000,
        deadline: "2026-07-01T00:00:00.000Z", // > 60d
        met: false,
      },
    });
    expect(shouldShowBonusWarning(card)).toBe(false);
  });

  it("returns false when bonus deadline has already passed", () => {
    const card = makeCard({
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 400000,
        deadline: "2026-02-01T00:00:00.000Z", // in the past
        met: false,
      },
    });
    expect(shouldShowBonusWarning(card)).toBe(false);
  });
});

// ── getHowlBonusRemaining ─────────────────────────────────────────────────────

describe("getHowlBonusRemaining", () => {
  it("returns 0 when card has no signUpBonus", () => {
    const card = makeCard({ signUpBonus: null });
    expect(getHowlBonusRemaining(card)).toBe(0);
  });

  it("returns 0 when bonus is already met", () => {
    const card = makeCard({
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 400000,
        deadline: "2026-04-01T00:00:00.000Z",
        met: true,
      },
      amountSpent: 0,
    });
    expect(getHowlBonusRemaining(card)).toBe(0);
  });

  it("returns remaining cents when bonus not met", () => {
    const card = makeCard({
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 400000,
        deadline: "2026-04-01T00:00:00.000Z",
        met: false,
      },
      amountSpent: 150000,
    });
    expect(getHowlBonusRemaining(card)).toBe(250000);
  });

  it("returns 0 when amountSpent exceeds spendRequirement (overspent)", () => {
    const card = makeCard({
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 400000,
        deadline: "2026-04-01T00:00:00.000Z",
        met: false,
      },
      amountSpent: 500000,
    });
    expect(getHowlBonusRemaining(card)).toBe(0);
  });

  it("returns full amount when amountSpent is 0 (no spending done)", () => {
    const card = makeCard({
      signUpBonus: {
        type: "points",
        amount: 60000,
        spendRequirement: 400000,
        deadline: "2026-04-01T00:00:00.000Z",
        met: false,
      },
      amountSpent: 0,
    });
    expect(getHowlBonusRemaining(card)).toBe(400000);
  });
});
