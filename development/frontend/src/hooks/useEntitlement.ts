"use client";

/**
 * useEntitlement — Fenrir Ledger
 *
 * Thin wrapper over EntitlementContext. Provides a convenient hook interface
 * for checking subscription tier, feature access, and managing platform linking.
 *
 * Platform-agnostic: currently backed by Patreon, but the hook interface does
 * not leak platform-specific details except through the linkPatreon/unlinkPatreon
 * action names (which will be supplemented with linkBuyMeACoffee etc. as needed).
 *
 * Usage:
 *   const { tier, hasFeature, linkPatreon, isLinked } = useEntitlement();
 *
 *   if (hasFeature("cloud-sync")) {
 *     // Render premium feature
 *   }
 *
 *   if (!isLinked) {
 *     // Show "Link Patreon" button
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
 * @returns The entitlement context value with tier, feature gating, and linking actions.
 */
export function useEntitlement(): UseEntitlementReturn {
  return useEntitlementContext();
}
