/**
 * Entitlement Types — Fenrir Ledger
 *
 * Platform-agnostic entitlement types. The entitlement layer answers
 * "what can you access?" independently of which subscription platform
 * (Patreon, Buy Me a Coffee, etc.) backs the subscription.
 *
 * Tier naming uses Norse social hierarchy:
 *   - Thrall: Free tier (all current features, no subscription required)
 *   - Karl:   Paid supporter tier (premium features unlocked)
 *
 * @module entitlement/types
 */

// ---------------------------------------------------------------------------
// Tier model
// ---------------------------------------------------------------------------

/**
 * Subscription tier names using Norse social hierarchy.
 * Thrall = free, Karl = paid supporter.
 */
export type EntitlementTier = "thrall" | "karl";

/**
 * Subscription platform identifier. Extensible for future platforms.
 * Currently only Patreon is supported.
 */
export type EntitlementPlatform = "patreon";
// Future: | "buymeacoffee" | "stripe" | ...

// ---------------------------------------------------------------------------
// Entitlement record (client-side cache)
// ---------------------------------------------------------------------------

/**
 * Client-side entitlement record stored in localStorage.
 * This is a denormalized view of the server-side StoredEntitlement (Vercel KV).
 * It does NOT contain tokens — only the tier, status, and metadata.
 */
export interface Entitlement {
  /** Current subscription tier */
  tier: EntitlementTier;
  /** Whether the subscription is currently active */
  active: boolean;
  /** Which platform backs this subscription */
  platform: EntitlementPlatform;
  /** Platform-specific user ID (e.g., Patreon user ID) */
  userId: string;
  /** Unix timestamp (ms) when the platform account was linked */
  linkedAt: number;
  /** Unix timestamp (ms) of last server-side verification */
  checkedAt: number;
}

// ---------------------------------------------------------------------------
// Premium feature gating
// ---------------------------------------------------------------------------

/**
 * Premium features available to Karl-tier subscribers.
 * Each feature has a slug used for programmatic gating and a display name.
 */
export type PremiumFeature =
  | "cloud-sync"
  | "multi-household"
  | "advanced-analytics"
  | "data-export"
  | "extended-history"
  | "cosmetic-perks";

/**
 * Feature metadata: display name and the minimum tier required.
 * Currently all premium features require Karl tier.
 */
export interface FeatureDefinition {
  /** Human-readable feature name */
  name: string;
  /** Minimum tier required to access this feature */
  tier: EntitlementTier;
}

/**
 * Registry of all premium features and their required tiers.
 */
export const PREMIUM_FEATURES: Record<PremiumFeature, FeatureDefinition> = {
  "cloud-sync": { name: "Cloud Sync", tier: "karl" },
  "multi-household": { name: "Multi-Household", tier: "karl" },
  "advanced-analytics": { name: "Advanced Analytics", tier: "karl" },
  "data-export": { name: "Data Export", tier: "karl" },
  "extended-history": { name: "Extended History", tier: "karl" },
  "cosmetic-perks": { name: "Cosmetic Perks", tier: "karl" },
};

// ---------------------------------------------------------------------------
// Tier comparison
// ---------------------------------------------------------------------------

/**
 * Tier precedence for comparison. Higher number = more access.
 */
const TIER_RANK: Record<EntitlementTier, number> = {
  thrall: 0,
  karl: 1,
};

/**
 * Returns true if the user's tier meets or exceeds the required tier.
 *
 * @param userTier - The user's current tier
 * @param requiredTier - The minimum tier required
 * @returns true if access should be granted
 */
export function tierMeetsRequirement(
  userTier: EntitlementTier,
  requiredTier: EntitlementTier,
): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}
