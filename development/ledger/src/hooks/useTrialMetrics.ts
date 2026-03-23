"use client";

/**
 * useTrialMetrics — Fenrir Ledger
 *
 * Hook for computing personalized trial metrics from localStorage card data.
 * Used by TrialStatusPanel and Settings trial section.
 *
 * Metrics computed:
 *   - cardCount: total active (non-deleted) cards
 *   - totalAnnualFees: sum of annualFee fields across all cards (dollars)
 *   - feeAlertsCount: count of cards with fee_approaching or overdue status
 *   - closedCardsCount: count of cards with status "closed" or "graduated"
 *   - potentialSavings: sum of annualFee on closed/graduated cards (fees avoided, dollars)
 *
 * All values are computed in real-time from localStorage data via storage.ts.
 *
 * @module hooks/useTrialMetrics
 */

import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getCards } from "@/lib/storage";
import { computeCardStatus, formatCurrency } from "@/lib/card-utils";
import type { Card } from "@/lib/types";

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface TrialMetrics {
  /** Total number of active (non-deleted) cards. */
  cardCount: number;
  /** Sum of annualFee fields across all cards, in dollars. */
  totalAnnualFees: number;
  /** Formatted total annual fees as a dollar string (e.g. "$1,240"). */
  totalAnnualFeesFormatted: string;
  /** Number of cards with fee_approaching or overdue status. */
  feeAlertsCount: number;
  /** Number of cards with "closed" or "graduated" status. */
  closedCardsCount: number;
  /** Sum of annualFee on closed/graduated cards (fees avoided), in dollars. */
  potentialSavings: number;
  /** Formatted potential savings as a dollar string (e.g. "$390"). */
  potentialSavingsFormatted: string;
}

// ---------------------------------------------------------------------------
// Pure computation (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Computes trial metrics from an array of cards.
 * Pure function — no side effects, fully testable.
 *
 * @param cards - Array of Card objects
 * @returns Computed TrialMetrics
 */
export function computeTrialMetrics(cards: Card[]): TrialMetrics {
  let totalAnnualFees = 0;
  let feeAlertsCount = 0;
  let closedCardsCount = 0;
  let potentialSavings = 0;

  for (const card of cards) {
    totalAnnualFees += card.annualFee;

    const status = computeCardStatus(card);
    if (status === "fee_approaching" || status === "overdue") {
      feeAlertsCount++;
    }
    if (status === "closed" || status === "graduated") {
      closedCardsCount++;
      potentialSavings += card.annualFee;
    }
  }

  return {
    cardCount: cards.length,
    totalAnnualFees,
    totalAnnualFeesFormatted: formatCurrency(totalAnnualFees),
    feeAlertsCount,
    closedCardsCount,
    potentialSavings,
    potentialSavingsFormatted: formatCurrency(potentialSavings),
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Computes personalized trial metrics from the current user's card data.
 *
 * @returns TrialMetrics object with computed values
 */
export function useTrialMetrics(): TrialMetrics {
  const { householdId, status: authStatus } = useAuth();

  return useMemo(() => {
    if (authStatus === "loading" || !householdId) {
      return {
        cardCount: 0,
        totalAnnualFees: 0,
        totalAnnualFeesFormatted: "$0",
        feeAlertsCount: 0,
        closedCardsCount: 0,
        potentialSavings: 0,
        potentialSavingsFormatted: "$0",
      };
    }

    const cards = getCards(householdId);
    return computeTrialMetrics(cards);
  }, [householdId, authStatus]);
}
