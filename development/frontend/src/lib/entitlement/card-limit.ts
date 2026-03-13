/**
 * Card Limit Guard — Fenrir Ledger
 *
 * Enforces the Thrall (free) tier card limit. Karl-tier users
 * and users on an active trial have no card limit.
 *
 * @module entitlement/card-limit
 */

import { type EntitlementTier, THRALL_CARD_LIMIT } from "./types";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/**
 * Result of a card-limit check.
 *
 * - `allowed`: true when the user may add another card.
 * - `reason`: human-readable explanation when blocked (undefined when allowed).
 * - `currentCount`: how many active cards the user has.
 * - `limit`: the applicable limit (null means unlimited).
 */
export interface CardLimitResult {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  limit: number | null;
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

/**
 * Determines whether a user is allowed to add a new card.
 *
 * @param tier - The user's current entitlement tier.
 * @param activeCardCount - Number of active (non-archived) cards the user has.
 * @param isTrialActive - Whether the user's free trial is currently active.
 * @returns A {@link CardLimitResult} indicating whether the action is allowed.
 */
export function canAddCard(
  tier: EntitlementTier,
  activeCardCount: number,
  isTrialActive: boolean = false,
): CardLimitResult {
  // Karl subscribers and active-trial users have no card limit
  if (tier === "karl" || isTrialActive) {
    return {
      allowed: true,
      currentCount: activeCardCount,
      limit: null,
    };
  }

  // Thrall tier: enforce THRALL_CARD_LIMIT
  if (activeCardCount >= THRALL_CARD_LIMIT) {
    return {
      allowed: false,
      reason: `Thrall tier is limited to ${THRALL_CARD_LIMIT} active cards. Upgrade to Karl for unlimited cards.`,
      currentCount: activeCardCount,
      limit: THRALL_CARD_LIMIT,
    };
  }

  return {
    allowed: true,
    currentCount: activeCardCount,
    limit: THRALL_CARD_LIMIT,
  };
}
