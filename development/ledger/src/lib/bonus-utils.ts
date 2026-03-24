/**
 * Shared bonus aggregation utilities.
 *
 * Used by TabSummary (Valhalla tab) and WolfHungerMeter to compute identical
 * reward totals from a list of cards.
 *
 * Issue #1954 — separate points/miles/cashback; eliminate duplicated logic.
 */

import type { Card } from "@/lib/types";

export interface BonusTotals {
  points: number;
  miles: number;
  cashback: number; // in dollars (not cents — see issue #1915)
}

/**
 * Aggregate sign-up bonus amounts across cards where bonus was met.
 *
 * Cashback stored as cents in Card.signUpBonus.amount is converted to dollars
 * so all three fields use the same unit as their display label implies.
 */
export function aggregateBonuses(cards: Card[]): BonusTotals {
  const totals: BonusTotals = { points: 0, miles: 0, cashback: 0 };
  for (const card of cards) {
    if (card.signUpBonus && card.signUpBonus.met) {
      const { type, amount } = card.signUpBonus;
      if (type === "cashback") {
        totals.cashback += amount / 100;
      } else {
        totals[type] += amount;
      }
    }
  }
  return totals;
}
