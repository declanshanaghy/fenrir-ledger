/**
 * Vercel KV entitlement store -- server-side persistence for subscription entitlements.
 *
 * Stores and retrieves entitlement records keyed by Google user sub (authenticated)
 * or Stripe customer ID (anonymous).
 *
 * Key format:
 *   - `entitlement:{googleSub}` -> StoredStripeEntitlement (authenticated users)
 *   - `entitlement:stripe:{stripeCustomerId}` -> StoredStripeEntitlement (anonymous Stripe users)
 *   - `stripe-customer:{stripeCustomerId}` -> `{googleSub}` (authenticated Stripe reverse index)
 *   - `stripe-customer:{stripeCustomerId}` -> `stripe:{stripeCustomerId}` (anonymous Stripe reverse index)
 *
 * TTL: Entitlements expire after 30 days if not refreshed.
 *
 * @module kv/entitlement-store
 */

import { kv } from "@vercel/kv";
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

// ---------------------------------------------------------------------------
// Stripe entitlement operations
// ---------------------------------------------------------------------------

/**
 * Builds the primary KV key for an anonymous Stripe user's entitlement.
 *
 * @param stripeCustomerId - Stripe customer ID (cus_xxx)
 * @returns KV key string
 */
function stripeAnonymousEntitlementKey(stripeCustomerId: string): string {
  return `entitlement:stripe:${stripeCustomerId}`;
}

/**
 * Builds the secondary index key for Stripe customer ID -> identity mapping.
 *
 * For authenticated users, the value is the Google sub.
 * For anonymous users, the value is `stripe:{stripeCustomerId}`.
 *
 * @param stripeCustomerId - Stripe customer ID (cus_xxx)
 * @returns KV key string
 */
function stripeCustomerKey(stripeCustomerId: string): string {
  return `stripe-customer:${stripeCustomerId}`;
}

/**
 * Checks whether a Stripe reverse index value points to an anonymous user.
 * Anonymous entries are stored as `stripe:{stripeCustomerId}`, while
 * authenticated entries store the raw `googleSub`.
 *
 * @param reverseIndexValue - The value from the `stripe-customer:{id}` key
 * @returns true if the value indicates an anonymous Stripe user
 */
export function isAnonymousStripeReverseIndex(reverseIndexValue: string): boolean {
  return reverseIndexValue.startsWith("stripe:");
}

/**
 * Extracts the Stripe customer ID from an anonymous reverse index value.
 * The value format is `stripe:{stripeCustomerId}`.
 *
 * @param reverseIndexValue - The anonymous reverse index value
 * @returns The Stripe customer ID
 */
export function extractStripeCustomerIdFromReverseIndex(reverseIndexValue: string): string {
  return reverseIndexValue.slice("stripe:".length);
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
// Anonymous Stripe user operations
// ---------------------------------------------------------------------------

/**
 * Retrieves a stored entitlement for an anonymous Stripe user
 * (keyed by Stripe customer ID).
 *
 * @param stripeCustomerId - Stripe customer ID (cus_xxx)
 * @returns The stored Stripe entitlement or null if not found / expired
 */
export async function getAnonymousStripeEntitlement(
  stripeCustomerId: string,
): Promise<StoredStripeEntitlement | null> {
  log.debug("getAnonymousStripeEntitlement called", { stripeCustomerId });
  try {
    const result = await kv.get<StoredStripeEntitlement>(
      stripeAnonymousEntitlementKey(stripeCustomerId),
    );
    log.debug("getAnonymousStripeEntitlement returning", {
      stripeCustomerId,
      found: result !== null,
      tier: result?.tier,
      active: result?.active,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("getAnonymousStripeEntitlement failed", { stripeCustomerId, error: message });
    log.debug("getAnonymousStripeEntitlement returning", { stripeCustomerId, found: false, reason: "error" });
    return null;
  }
}

/**
 * Stores an entitlement record for an anonymous Stripe user
 * (keyed by Stripe customer ID).
 * Also maintains the reverse index with the `stripe:` prefix to indicate anonymous.
 *
 * @param stripeCustomerId - Stripe customer ID (cus_xxx)
 * @param entitlement - The Stripe entitlement record to store
 */
export async function setAnonymousStripeEntitlement(
  stripeCustomerId: string,
  entitlement: StoredStripeEntitlement,
): Promise<void> {
  log.debug("setAnonymousStripeEntitlement called", {
    stripeCustomerId,
    tier: entitlement.tier,
    active: entitlement.active,
  });
  try {
    // Store the entitlement with TTL under the anonymous key
    await kv.set(stripeAnonymousEntitlementKey(stripeCustomerId), entitlement, {
      ex: ENTITLEMENT_TTL_SECONDS,
    });

    // Maintain the reverse index: Stripe customer ID -> stripe:{stripeCustomerId}
    // The `stripe:` prefix indicates this is an anonymous user
    await kv.set(stripeCustomerKey(stripeCustomerId), `stripe:${stripeCustomerId}`, {
      ex: ENTITLEMENT_TTL_SECONDS,
    });

    log.debug("setAnonymousStripeEntitlement returning", { stripeCustomerId, success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("setAnonymousStripeEntitlement failed", { stripeCustomerId, error: message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Stripe entitlement migration (anonymous -> authenticated)
// ---------------------------------------------------------------------------

/**
 * Migrates an anonymous Stripe entitlement to an authenticated (Google-keyed) entitlement.
 *
 * Steps:
 *   1. Read from `entitlement:stripe:{stripeCustomerId}`
 *   2. Copy to `entitlement:{googleSub}`
 *   3. Update reverse index from `stripe:{stripeCustomerId}` to `{googleSub}`
 *   4. Delete the anonymous key
 *
 * Idempotent: if the Google-keyed entry already exists, returns success.
 *
 * @param stripeCustomerId - Stripe customer ID from the anonymous flow
 * @param googleSub - Google account immutable ID to migrate to
 * @returns Object indicating whether migration occurred and the entitlement details
 */
export async function migrateStripeEntitlement(
  stripeCustomerId: string,
  googleSub: string,
): Promise<{ migrated: boolean; tier?: string; active?: boolean; reason?: string }> {
  log.debug("migrateStripeEntitlement called", { stripeCustomerId, googleSub });

  try {
    // Check if Google-keyed entry already exists (idempotent)
    const existingGoogle = await kv.get<StoredStripeEntitlement>(entitlementKey(googleSub));
    if (existingGoogle) {
      log.debug("migrateStripeEntitlement returning", {
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
    const anonymousEntitlement = await kv.get<StoredStripeEntitlement>(
      stripeAnonymousEntitlementKey(stripeCustomerId),
    );

    if (!anonymousEntitlement) {
      log.debug("migrateStripeEntitlement returning", {
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
    await kv.set(stripeCustomerKey(stripeCustomerId), googleSub, {
      ex: ENTITLEMENT_TTL_SECONDS,
    });

    // Delete the anonymous key
    await kv.del(stripeAnonymousEntitlementKey(stripeCustomerId));

    log.debug("migrateStripeEntitlement returning", {
      migrated: true,
      stripeCustomerId,
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
    log.error("migrateStripeEntitlement failed", { stripeCustomerId, googleSub, error: message });
    throw err;
  }
}
