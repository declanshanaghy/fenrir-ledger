"use client";

/**
 * useEntitlement -- Fenrir Ledger
 *
 * Thin wrapper over EntitlementContext. Provides a convenient hook interface
 * for checking subscription tier, feature access, and managing Stripe linking.
 *
 * Usage:
 *   const { tier, hasFeature, subscribeStripe, isLinked } = useEntitlement();
 *
 *   if (hasFeature("cloud-sync")) {
 *     // Render premium feature
 *   }
 *
 * See EntitlementContext for the full state management logic.
 */

import { useEntitlementContext } from "@/contexts/EntitlementContext";
import type { EntitlementContextValue } from "@/contexts/EntitlementContext";

export type UseEntitlementReturn = EntitlementContextValue;

/**
 * Hook for accessing entitlement state and actions.
 *
 * @returns The entitlement context value with tier, feature gating, and subscription actions.
 */
export function useEntitlement(): UseEntitlementReturn {
  return useEntitlementContext();
}
