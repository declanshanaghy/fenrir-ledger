/**
 * Feature flag registry.
 *
 * Phase 1: Simple environment-variable-based flags resolved at build / server-start time.
 * Every flag has an explicit default so a missing env var never breaks the build.
 *
 * Server-side routes read `SUBSCRIPTION_PLATFORM` (no NEXT_PUBLIC_ prefix).
 * Client components read `NEXT_PUBLIC_SUBSCRIPTION_PLATFORM`.
 * The fallback chain: server env -> client env -> "patreon" (backwards-compatible default).
 *
 * @module lib/feature-flags
 * @see designs/architecture/adr-feature-flags.md
 */

/**
 * Canonical feature flag values.
 *
 * Add new flags here following the same pattern:
 *   - Read from `process.env.*` with a sensible default
 *   - Cast to a union type so consumers get exhaustive checking
 */
export const FeatureFlags = {
  /** Active subscription platform: "stripe" | "patreon" */
  SUBSCRIPTION_PLATFORM: (process.env.SUBSCRIPTION_PLATFORM ??
    process.env.NEXT_PUBLIC_SUBSCRIPTION_PLATFORM ??
    "patreon") as "stripe" | "patreon",

  // Future flags follow the same pattern:
  // ENABLE_ANNUAL_BILLING: process.env.NEXT_PUBLIC_ENABLE_ANNUAL_BILLING === "true",
  // ENABLE_CSV_EXPORT: process.env.NEXT_PUBLIC_ENABLE_CSV_EXPORT === "true",
} as const;

/** Type-safe flag name. */
export type FeatureFlagName = keyof typeof FeatureFlags;

/**
 * Check if a boolean (or boolean-ish string) flag is enabled.
 *
 * For string-valued flags like SUBSCRIPTION_PLATFORM this returns true only
 * when the value is literally `"true"`, which is intentional -- use the
 * dedicated `isStripe()` / `isPatreon()` helpers for platform checks.
 */
export function isEnabled(flag: FeatureFlagName): boolean {
  const value: unknown = FeatureFlags[flag];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return false;
}

/** Returns `true` when the active subscription platform is Stripe. */
export function isStripe(): boolean {
  return FeatureFlags.SUBSCRIPTION_PLATFORM === "stripe";
}

/** Returns `true` when the active subscription platform is Patreon (default). */
export function isPatreon(): boolean {
  return FeatureFlags.SUBSCRIPTION_PLATFORM === "patreon";
}
