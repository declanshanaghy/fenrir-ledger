"use client";

/**
 * useIsKarlOrTrial — Fenrir Ledger
 *
 * Convenience hook that wraps the existing entitlement check and trial status.
 * Returns true if the user has an active Karl subscription OR an active trial.
 *
 * Used throughout the app to gate Karl features during an active trial period.
 *
 * Usage:
 *   const isKarlOrTrial = useIsKarlOrTrial();
 *   if (isKarlOrTrial) { /* show Karl features *\/ }
 *
 * @module hooks/useIsKarlOrTrial
 */

import { useEntitlement } from "@/hooks/useEntitlement";
import { useTrialStatus } from "@/hooks/useTrialStatus";

/**
 * Returns true if the user has Karl-tier access — either via active subscription
 * or an active 30-day trial.
 *
 * @returns true if Karl features should be unlocked
 */
export function useIsKarlOrTrial(): boolean {
  const { tier, isActive } = useEntitlement();
  const { status } = useTrialStatus();

  const isKarl = tier === "karl" && isActive;
  const isTrialActive = status === "active";

  return isKarl || isTrialActive;
}
