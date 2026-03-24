/**
 * Unit tests for lib/bonus-utils.ts
 *
 * Verifies aggregateBonuses correctly separates points, miles, and cashback,
 * skips unmet bonuses, and converts cashback cents → dollars.
 *
 * Issue #1954 — shared bonus aggregation lib
 */

import { describe, it, expect } from "vitest";
import { aggregateBonuses } from "@/lib/bonus-utils";
import { makeCard } from "@/__tests__/fixtures/cards";

describe("aggregateBonuses", () => {
  it("returns zero totals when no cards provided", () => {
    expect(aggregateBonuses([])).toEqual({ points: 0, miles: 0, cashback: 0 });
  });

  it("returns zero totals when no card has a signUpBonus", () => {
    const cards = [makeCard(), makeCard()];
    expect(aggregateBonuses(cards)).toEqual({ points: 0, miles: 0, cashback: 0 });
  });

  it("skips bonuses where met is false", () => {
    const card = makeCard({
      signUpBonus: {
        type: "points",
        amount: 50000,
        met: false,
        spendRequirement: 500000,
        deadline: null,
      },
    });
    expect(aggregateBonuses([card])).toEqual({ points: 0, miles: 0, cashback: 0 });
  });

  it("accumulates points from met bonuses", () => {
    const cards = [
      makeCard({
        signUpBonus: { type: "points", amount: 60000, met: true, spendRequirement: 400000, deadline: null },
      }),
      makeCard({
        signUpBonus: { type: "points", amount: 80000, met: true, spendRequirement: 500000, deadline: null },
      }),
    ];
    expect(aggregateBonuses(cards)).toEqual({ points: 140000, miles: 0, cashback: 0 });
  });

  it("accumulates miles from met bonuses separately from points", () => {
    const cards = [
      makeCard({
        signUpBonus: { type: "points", amount: 50000, met: true, spendRequirement: 300000, deadline: null },
      }),
      makeCard({
        signUpBonus: { type: "miles", amount: 40000, met: true, spendRequirement: 300000, deadline: null },
      }),
    ];
    expect(aggregateBonuses(cards)).toEqual({ points: 50000, miles: 40000, cashback: 0 });
  });

  it("converts cashback cents to dollars", () => {
    const card = makeCard({
      signUpBonus: { type: "cashback", amount: 50000, met: true, spendRequirement: 300000, deadline: null },
    });
    // 50000 cents = $500
    expect(aggregateBonuses([card])).toEqual({ points: 0, miles: 0, cashback: 500 });
  });

  it("sums mixed types correctly, skipping unmet bonuses", () => {
    const cards = [
      makeCard({
        signUpBonus: { type: "points", amount: 75000, met: true, spendRequirement: 400000, deadline: null },
      }),
      makeCard({
        signUpBonus: { type: "miles", amount: 60000, met: true, spendRequirement: 300000, deadline: null },
      }),
      makeCard({
        signUpBonus: { type: "cashback", amount: 30000, met: true, spendRequirement: 200000, deadline: null },
      }),
      // unmet — should be ignored
      makeCard({
        signUpBonus: { type: "points", amount: 100000, met: false, spendRequirement: 500000, deadline: null },
      }),
      // no bonus
      makeCard(),
    ];
    expect(aggregateBonuses(cards)).toEqual({ points: 75000, miles: 60000, cashback: 300 });
  });

  it("handles multiple cashback cards and accumulates in dollars", () => {
    const cards = [
      makeCard({
        signUpBonus: { type: "cashback", amount: 20000, met: true, spendRequirement: 200000, deadline: null },
      }),
      makeCard({
        signUpBonus: { type: "cashback", amount: 30000, met: true, spendRequirement: 300000, deadline: null },
      }),
    ];
    // 20000 + 30000 = 50000 cents = $500
    expect(aggregateBonuses(cards)).toEqual({ points: 0, miles: 0, cashback: 500 });
  });
});
