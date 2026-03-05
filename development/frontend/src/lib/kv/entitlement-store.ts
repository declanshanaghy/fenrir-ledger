/**
 * Vercel KV entitlement store — server-side persistence for subscription entitlements.
 *
 * Stores and retrieves entitlement records keyed by Google user sub (authenticated)
 * or Patreon user ID (anonymous).
 *
 * Key format:
 *   - `entitlement:{googleSub}` -> StoredEntitlement | StoredStripeEntitlement (authenticated users)
 *   - `entitlement:patreon:{patreonUserId}` -> StoredEntitlement (anonymous Patreon users)
 *   - `patreon-user:{patreonUserId}` -> `{googleSub}` (authenticated reverse index)
 *   - `patreon-user:{patreonUserId}` -> `patreon:{patreonUserId}` (anonymous reverse index)
 *   - `stripe-customer:{stripeCustomerId}` -> `{googleSub}` (Stripe reverse index)
 *
 * TTL: Entitlements expire after 30 days if not refreshed.
 *
 * @module kv/entitlement-store
 */

import { kv } from "@vercel/kv";
import type { StoredEntitlement } from "@/lib/patreon/types";
import type { StoredStripeEntitlement } from "@/lib/stripe/types";
import { log } from "@/lib/logger";

/** 30 days in seconds */
const ENTITLEMENT_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Builds the primary KV key for an authenticated user's entitlement.
 *
 * @param googleSub - Google account immutable ID
 * @returns KV key string
 */
function entitlementKey(googleSub: string): string {
  return `entitlement:${googleSub}`;
}

/**
 * Builds the primary KV key for an anonymous user's entitlement.
 *
 * @param patreonUserId - Patreon user ID
 * @returns KV key string
 */
function anonymousEntitlementKey(patreonUserId: string): string {
  return `entitlement:patreon:${patreonUserId}`;
}

/**
 * Builds the secondary index key for Patreon user ID -> identity mapping.
 *
 * @param patreonUserId - Patreon user ID
 * @returns KV key string
 */
function patreonUserKey(patreonUserId: string): string {
  return `patreon-user:${patreonUserId}`;
}

/**
 * Checks whether a reverse index value points to an anonymous user.
 * Anonymous entries are stored as `patreon:{patreonUserId}`, while
 * authenticated entries store the raw `googleSub`.
 *
 * @param reverseIndexValue - The value from the `patreon-user:{id}` key
 * @returns true if the value indicates an anonymous user
 */
export function isAnonymousReverseIndex(reverseIndexValue: string): boolean {
  return reverseIndexValue.startsWith("patreon:");
}

/**
 * Extracts the Patreon user ID from an anonymous reverse index value.
 * The value format is `patreon:{patreonUserId}`.
 *
 * @param reverseIndexValue - The anonymous reverse index value
 * @returns The Patreon user ID
 */
export function extractPatreonUserIdFromReverseIndex(reverseIndexValue: string): string {
  return reverseIndexValue.slice("patreon:".length);
}

// ---------------------------------------------------------------------------
// Authenticated user operations (existing)
// ---------------------------------------------------------------------------

/**
 * Retrieves a stored entitlement for a Google user.
 *
 * @param googleSub - Google account immutable ID
 * @returns The stored entitlement or null if not found / expired
 */
export async function getEntitlement(googleSub: string): Promise<StoredEntitlement | null> {
  log.debug("getEntitlement called", { googleSub });
  try {
    const result = await kv.get<StoredEntitlement>(entitlementKey(googleSub));
    log.debug("getEntitlement returning", {
      googleSub,
      found: result !== null,
      tier: result?.tier,
      active: result?.active,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("getEntitlement failed", { googleSub, error: message });
    log.debug("getEntitlement returning", { googleSub, found: false, reason: "error" });
    return null;
  }
}

/**
 * Stores an entitlement record for a Google user.
 * Also maintains the secondary index (Patreon user ID -> Google sub).
 *
 * @param googleSub - Google account immutable ID
 * @param entitlement - The entitlement record to store
 */
export async function setEntitlement(
  googleSub: string,
  entitlement: StoredEntitlement,
): Promise<void> {
  log.debug("setEntitlement called", {
    googleSub,
    tier: entitlement.tier,
    active: entitlement.active,
    patreonUserId: entitlement.patreonUserId,
  });
  try {
    // Store the entitlement with TTL
    await kv.set(entitlementKey(googleSub), entitlement, {
      ex: ENTITLEMENT_TTL_SECONDS,
    });

    // Maintain the reverse index: Patreon user ID -> Google sub
    await kv.set(patreonUserKey(entitlement.patreonUserId), googleSub, {
      ex: ENTITLEMENT_TTL_SECONDS,
    });

    log.debug("setEntitlement returning", { googleSub, success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("setEntitlement failed", { googleSub, error: message });
    throw err;
  }
}

/**
 * Deletes an entitlement record for a Google user.
 * Also removes the secondary index entry.
 *
 * @param googleSub - Google account immutable ID
 */
export async function deleteEntitlement(googleSub: string): Promise<void> {
  log.debug("deleteEntitlement called", { googleSub });
  try {
    // First, get the existing entitlement to find the Patreon user ID for cleanup
    const existing = await kv.get<StoredEntitlement>(entitlementKey(googleSub));

    // Delete the primary entitlement record
    await kv.del(entitlementKey(googleSub));

    // Delete the reverse index if we found the Patreon user ID
    if (existing?.patreonUserId) {
      await kv.del(patreonUserKey(existing.patreonUserId));
    }

    log.debug("deleteEntitlement returning", {
      googleSub,
      success: true,
      hadReverseIndex: !!existing?.patreonUserId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("deleteEntitlement failed", { googleSub, error: message });
    throw err;
  }
}

/**
 * Looks up a Google sub (or anonymous indicator) from a Patreon user ID
 * using the secondary index.
 *
 * For authenticated users, returns the Google sub string.
 * For anonymous users, returns `patreon:{patreonUserId}`.
 * Used by webhook handlers to map incoming Patreon events to our users.
 *
 * @param patreonUserId - Patreon user ID from webhook payload
 * @returns Google sub, anonymous indicator, or null if no mapping exists
 */
export async function getGoogleSubByPatreonUserId(
  patreonUserId: string,
): Promise<string | null> {
  log.debug("getGoogleSubByPatreonUserId called", { patreonUserId });
  try {
    const result = await kv.get<string>(patreonUserKey(patreonUserId));
    log.debug("getGoogleSubByPatreonUserId returning", {
      patreonUserId,
      found: result !== null,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("getGoogleSubByPatreonUserId failed", { patreonUserId, error: message });
    log.debug("getGoogleSubByPatreonUserId returning", { patreonUserId, found: false, reason: "error" });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Anonymous user operations (new)
// ---------------------------------------------------------------------------

/**
 * Retrieves a stored entitlement for an anonymous user (keyed by Patreon user ID).
 *
 * @param patreonUserId - Patreon user ID
 * @returns The stored entitlement or null if not found / expired
 */
export async function getAnonymousEntitlement(
  patreonUserId: string,
): Promise<StoredEntitlement | null> {
  log.debug("getAnonymousEntitlement called", { patreonUserId });
  try {
    const result = await kv.get<StoredEntitlement>(anonymousEntitlementKey(patreonUserId));
    log.debug("getAnonymousEntitlement returning", {
      patreonUserId,
      found: result !== null,
      tier: result?.tier,
      active: result?.active,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("getAnonymousEntitlement failed", { patreonUserId, error: message });
    log.debug("getAnonymousEntitlement returning", { patreonUserId, found: false, reason: "error" });
    return null;
  }
}

/**
 * Stores an entitlement record for an anonymous user (keyed by Patreon user ID).
 * Also maintains the reverse index with the `patreon:` prefix to indicate anonymous.
 *
 * @param patreonUserId - Patreon user ID
 * @param entitlement - The entitlement record to store
 */
export async function setAnonymousEntitlement(
  patreonUserId: string,
  entitlement: StoredEntitlement,
): Promise<void> {
  log.debug("setAnonymousEntitlement called", {
    patreonUserId,
    tier: entitlement.tier,
    active: entitlement.active,
  });
  try {
    // Store the entitlement with TTL under the anonymous key
    await kv.set(anonymousEntitlementKey(patreonUserId), entitlement, {
      ex: ENTITLEMENT_TTL_SECONDS,
    });

    // Maintain the reverse index: Patreon user ID -> patreon:{patreonUserId}
    // The `patreon:` prefix indicates this is an anonymous user
    await kv.set(patreonUserKey(patreonUserId), `patreon:${patreonUserId}`, {
      ex: ENTITLEMENT_TTL_SECONDS,
    });

    log.debug("setAnonymousEntitlement returning", { patreonUserId, success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("setAnonymousEntitlement failed", { patreonUserId, error: message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Stripe entitlement operations
// ---------------------------------------------------------------------------

/**
 * Builds the secondary index key for Stripe customer ID -> Google sub mapping.
 *
 * @param stripeCustomerId - Stripe customer ID (cus_xxx)
 * @returns KV key string
 */
function stripeCustomerKey(stripeCustomerId: string): string {
  return `stripe-customer:${stripeCustomerId}`;
}

/**
 * Retrieves a Stripe entitlement for a Google user.
 *
 * @param googleSub - Google account immutable ID
 * @returns The stored Stripe entitlement or null if not found / expired
 */
export async function getStripeEntitlement(
  googleSub: string,
): Promise<StoredStripeEntitlement | null> {
  log.debug("getStripeEntitlement called", { googleSub });
  try {
    const result = await kv.get<StoredStripeEntitlement>(entitlementKey(googleSub));
    log.debug("getStripeEntitlement returning", {
      googleSub,
      found: result !== null,
      tier: result?.tier,
      active: result?.active,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("getStripeEntitlement failed", { googleSub, error: message });
    log.debug("getStripeEntitlement returning", { googleSub, found: false, reason: "error" });
    return null;
  }
}

/**
 * Stores a Stripe entitlement record for a Google user.
 * Also maintains the secondary index (Stripe customer ID -> Google sub).
 *
 * @param googleSub - Google account immutable ID
 * @param entitlement - The Stripe entitlement record to store
 */
export async function setStripeEntitlement(
  googleSub: string,
  entitlement: StoredStripeEntitlement,
): Promise<void> {
  log.debug("setStripeEntitlement called", {
    googleSub,
    tier: entitlement.tier,
    active: entitlement.active,
    stripeCustomerId: entitlement.stripeCustomerId,
    stripeSubscriptionId: entitlement.stripeSubscriptionId,
  });
  try {
    // Store the entitlement with TTL
    await kv.set(entitlementKey(googleSub), entitlement, {
      ex: ENTITLEMENT_TTL_SECONDS,
    });

    // Maintain the reverse index: Stripe customer ID -> Google sub
    await kv.set(stripeCustomerKey(entitlement.stripeCustomerId), googleSub, {
      ex: ENTITLEMENT_TTL_SECONDS,
    });

    log.debug("setStripeEntitlement returning", { googleSub, success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("setStripeEntitlement failed", { googleSub, error: message });
    throw err;
  }
}

/**
 * Deletes a Stripe entitlement record for a Google user.
 * Also removes the Stripe customer reverse index entry.
 *
 * @param googleSub - Google account immutable ID
 */
export async function deleteStripeEntitlement(googleSub: string): Promise<void> {
  log.debug("deleteStripeEntitlement called", { googleSub });
  try {
    // First, get the existing entitlement to find the Stripe customer ID for cleanup
    const existing = await kv.get<StoredStripeEntitlement>(entitlementKey(googleSub));

    // Delete the primary entitlement record
    await kv.del(entitlementKey(googleSub));

    // Delete the reverse index if we found the Stripe customer ID
    if (existing?.stripeCustomerId) {
      await kv.del(stripeCustomerKey(existing.stripeCustomerId));
    }

    log.debug("deleteStripeEntitlement returning", {
      googleSub,
      success: true,
      hadReverseIndex: !!existing?.stripeCustomerId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("deleteStripeEntitlement failed", { googleSub, error: message });
    throw err;
  }
}

/**
 * Looks up a Google sub from a Stripe customer ID using the secondary index.
 *
 * Used by webhook handlers to map incoming Stripe events to our users.
 *
 * @param stripeCustomerId - Stripe customer ID from webhook payload
 * @returns Google sub or null if no mapping exists
 */
export async function getGoogleSubByStripeCustomerId(
  stripeCustomerId: string,
): Promise<string | null> {
  log.debug("getGoogleSubByStripeCustomerId called", { stripeCustomerId });
  try {
    const result = await kv.get<string>(stripeCustomerKey(stripeCustomerId));
    log.debug("getGoogleSubByStripeCustomerId returning", {
      stripeCustomerId,
      found: result !== null,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("getGoogleSubByStripeCustomerId failed", { stripeCustomerId, error: message });
    log.debug("getGoogleSubByStripeCustomerId returning", { stripeCustomerId, found: false, reason: "error" });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Migration (anonymous -> authenticated)
// ---------------------------------------------------------------------------

/**
 * Migrates an anonymous entitlement to an authenticated (Google-keyed) entitlement.
 *
 * Steps:
 *   1. Read from `entitlement:patreon:{patreonUserId}`
 *   2. Copy to `entitlement:{googleSub}`
 *   3. Update reverse index from `patreon:{pid}` to `{googleSub}`
 *   4. Delete the anonymous key
 *
 * Idempotent: if the Google-keyed entry already exists, returns success.
 *
 * @param patreonUserId - Patreon user ID from the anonymous flow
 * @param googleSub - Google account immutable ID to migrate to
 * @returns Object indicating whether migration occurred and the entitlement details
 */
export async function migrateEntitlement(
  patreonUserId: string,
  googleSub: string,
): Promise<{ migrated: boolean; tier?: string; active?: boolean; reason?: string }> {
  log.debug("migrateEntitlement called", { patreonUserId, googleSub });

  try {
    // Check if Google-keyed entry already exists (idempotent)
    const existingGoogle = await kv.get<StoredEntitlement>(entitlementKey(googleSub));
    if (existingGoogle) {
      log.debug("migrateEntitlement returning", {
        migrated: true,
        reason: "already_migrated",
        tier: existingGoogle.tier,
        active: existingGoogle.active,
      });
      return {
        migrated: true,
        tier: existingGoogle.tier,
        active: existingGoogle.active,
      };
    }

    // Read the anonymous entitlement
    const anonymousEntitlement = await kv.get<StoredEntitlement>(
      anonymousEntitlementKey(patreonUserId),
    );

    if (!anonymousEntitlement) {
      log.debug("migrateEntitlement returning", {
        migrated: false,
        reason: "not_found",
      });
      return { migrated: false, reason: "not_found" };
    }

    // Copy to Google-keyed entry
    await kv.set(entitlementKey(googleSub), anonymousEntitlement, {
      ex: ENTITLEMENT_TTL_SECONDS,
    });

    // Update reverse index to point to Google sub instead of anonymous
    await kv.set(patreonUserKey(patreonUserId), googleSub, {
      ex: ENTITLEMENT_TTL_SECONDS,
    });

    // Delete the anonymous key
    await kv.del(anonymousEntitlementKey(patreonUserId));

    log.debug("migrateEntitlement returning", {
      migrated: true,
      patreonUserId,
      googleSub,
      tier: anonymousEntitlement.tier,
      active: anonymousEntitlement.active,
    });

    return {
      migrated: true,
      tier: anonymousEntitlement.tier,
      active: anonymousEntitlement.active,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("migrateEntitlement failed", { patreonUserId, googleSub, error: message });
    throw err;
  }
}
