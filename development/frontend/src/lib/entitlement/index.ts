/**
 * Entitlement module — Fenrir Ledger
 *
 * Re-exports all entitlement types and utilities for convenient imports.
 *
 * Usage:
 *   import { EntitlementTier, PREMIUM_FEATURES } from "@/lib/entitlement";
 *
 * @module entitlement
 */

export {
  type EntitlementTier,
  type EntitlementPlatform,
  type Entitlement,
  type PremiumFeature,
  type FeatureDefinition,
  PREMIUM_FEATURES,
  tierMeetsRequirement,
} from "./types";

export {
  getEntitlementCache,
  setEntitlementCache,
  clearEntitlementCache,
  isEntitlementStale,
} from "./cache";

export {
  type FeatureDescription,
  FEATURE_DESCRIPTIONS,
} from "./feature-descriptions";
