/**
 * Firestore entitlement store -- server-side persistence for subscription entitlements.
 *
 * Stores and retrieves entitlement records in Firestore, keyed by Google user sub
 * (authenticated) or Stripe customer ID (anonymous).
 *
 * Document paths:
 *   - `entitlements/{googleSub}` → FirestoreEntitlement (authenticated users)
 *   - `entitlements/stripe:{stripeCustomerId}` → FirestoreEntitlement (anonymous Stripe users)
 *
 * Reverse lookup (Stripe customer → Google sub):
 *   - Query `users` collection where `stripeCustomerId == customerId`
 *   - Falls back to checking the `entitlements/stripe:{customerId}` doc for anonymous users
 *
 * No TTL: subscription records are persistent (unlike trials).
 *
 * Firestore IS the authoritative billing source.
 * Stripe webhooks write here; `requireKarl` reads from here.
 *
 * @module kv/entitlement-store
 */

import {
  getEntitlement,
  setEntitlement,
  deleteEntitlement,
  findUserByStripeCustomerId,
  setUserStripeCustomerId,
} from "@/lib/firebase/firestore";
import type { FirestoreEntitlement } from "@/lib/firebase/firestore-types";
import type { StoredStripeEntitlement } from "@/lib/stripe/types";
import { log } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Type bridge
// ---------------------------------------------------------------------------

/**
 * FirestoreEntitlement and StoredStripeEntitlement have the same shape.
 * This cast is safe — both represent the same billing record.
 */
function toStoredEntitlement(
  e: FirestoreEntitlement
): StoredStripeEntitlement {
  return e as unknown as StoredStripeEntitlement;
}

function toFirestoreEntitlement(
  e: StoredStripeEntitlement
): FirestoreEntitlement {
  return e as unknown as FirestoreEntitlement;
}

// ---------------------------------------------------------------------------
// Anonymous identity helpers (public API — unchanged contract)
// ---------------------------------------------------------------------------

/**
 * Checks whether a reverse-lookup identity value points to an anonymous user.
 * Anonymous entries are represented as `stripe:{stripeCustomerId}`, while
 * authenticated entries hold the raw Google sub.
 *
 * @param reverseIndexValue - Identity string returned by getGoogleSubByStripeCustomerId
 * @returns true if the value indicates an anonymous Stripe user
 */
export function isAnonymousStripeReverseIndex(reverseIndexValue: string): boolean {
  return reverseIndexValue.startsWith("stripe:");
}

/**
 * Extracts the Stripe customer ID from an anonymous identity value.
 * The value format is `stripe:{stripeCustomerId}`.
 *
 * @param reverseIndexValue - The anonymous identity value
 * @returns The Stripe customer ID
 */
export function extractStripeCustomerIdFromReverseIndex(reverseIndexValue: string): string {
  return reverseIndexValue.slice("stripe:".length);
}

// ---------------------------------------------------------------------------
// Authenticated user entitlement operations
// ---------------------------------------------------------------------------

/**
 * Retrieves a Stripe entitlement for an authenticated Google user.
 *
 * @param googleSub - Google account immutable ID
 * @returns The stored entitlement or null if not found
 */
export async function getStripeEntitlement(
  googleSub: string,
): Promise<StoredStripeEntitlement | null> {
  log.debug("getStripeEntitlement called", { googleSub });
  try {
    const doc = await getEntitlement(googleSub);
    const result = doc ? toStoredEntitlement(doc) : null;
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
    return null;
  }
}

/**
 * Stores a Stripe entitlement record for an authenticated Google user.
 * Also updates the user document with the Stripe customer ID for reverse lookup.
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
  });
  try {
    // Write entitlement document
    await setEntitlement(googleSub, toFirestoreEntitlement(entitlement));

    // Maintain reverse index: set stripeCustomerId on user document
    await setUserStripeCustomerId(googleSub, entitlement.stripeCustomerId);

    log.debug("setStripeEntitlement returning", { googleSub, success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("setStripeEntitlement failed", { googleSub, error: message });
    throw err;
  }
}

/**
 * Deletes a Stripe entitlement record for an authenticated Google user.
 *
 * @param googleSub - Google account immutable ID
 */
export async function deleteStripeEntitlement(googleSub: string): Promise<void> {
  log.debug("deleteStripeEntitlement called", { googleSub });
  try {
    await deleteEntitlement(googleSub);
    log.debug("deleteStripeEntitlement returning", { googleSub, success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("deleteStripeEntitlement failed", { googleSub, error: message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Reverse lookup: Stripe customer → identity
// ---------------------------------------------------------------------------

/**
 * Looks up the identity for a Stripe customer ID.
 *
 * Returns one of:
 *   - The Google sub string (authenticated user — found via users.stripeCustomerId query)
 *   - `"stripe:{stripeCustomerId}"` (anonymous user — entitlements/stripe:{id} doc exists)
 *   - null (unknown customer)
 *
 * Used by webhook handlers to map incoming Stripe events to our users.
 *
 * @param stripeCustomerId - Stripe customer ID from webhook payload
 * @returns Identity string or null
 */
export async function getGoogleSubByStripeCustomerId(
  stripeCustomerId: string,
): Promise<string | null> {
  log.debug("getGoogleSubByStripeCustomerId called", { stripeCustomerId });
  try {
    // 1. Query users collection by stripeCustomerId field (authenticated path)
    const user = await findUserByStripeCustomerId(stripeCustomerId);
    if (user) {
      const googleSub = user.clerkUserId;
      log.debug("getGoogleSubByStripeCustomerId returning (authenticated)", {
        stripeCustomerId,
        found: true,
      });
      return googleSub;
    }

    // 2. Check if anonymous entitlement doc exists
    const anonDocId = `stripe:${stripeCustomerId}`;
    const anonDoc = await getEntitlement(anonDocId);
    if (anonDoc) {
      log.debug("getGoogleSubByStripeCustomerId returning (anonymous)", {
        stripeCustomerId,
        found: true,
      });
      return anonDocId;
    }

    log.debug("getGoogleSubByStripeCustomerId returning", {
      stripeCustomerId,
      found: false,
    });
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("getGoogleSubByStripeCustomerId failed", { stripeCustomerId, error: message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Anonymous Stripe user operations
// ---------------------------------------------------------------------------

/**
 * Retrieves a stored entitlement for an anonymous Stripe user
 * (keyed by `stripe:{stripeCustomerId}`).
 *
 * @param stripeCustomerId - Stripe customer ID (cus_xxx)
 * @returns The stored entitlement or null if not found
 */
export async function getAnonymousStripeEntitlement(
  stripeCustomerId: string,
): Promise<StoredStripeEntitlement | null> {
  log.debug("getAnonymousStripeEntitlement called", { stripeCustomerId });
  try {
    const doc = await getEntitlement(`stripe:${stripeCustomerId}`);
    const result = doc ? toStoredEntitlement(doc) : null;
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
    return null;
  }
}

/**
 * Stores an entitlement record for an anonymous Stripe user
 * (keyed by `stripe:{stripeCustomerId}`).
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
    await setEntitlement(`stripe:${stripeCustomerId}`, toFirestoreEntitlement(entitlement));
    log.debug("setAnonymousStripeEntitlement returning", { stripeCustomerId, success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("setAnonymousStripeEntitlement failed", { stripeCustomerId, error: message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Stripe entitlement migration (anonymous → authenticated)
// ---------------------------------------------------------------------------

/**
 * Migrates an anonymous Stripe entitlement to an authenticated (Google-keyed) entitlement.
 *
 * Steps:
 *   1. Check if `entitlements/{googleSub}` already exists (idempotent)
 *   2. Read from `entitlements/stripe:{stripeCustomerId}`
 *   3. Copy to `entitlements/{googleSub}`
 *   4. Set `stripeCustomerId` on `users/{googleSub}` for reverse lookup
 *   5. Delete `entitlements/stripe:{stripeCustomerId}`
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
    // 1. Check if Google-keyed entry already exists (idempotent)
    const existing = await getEntitlement(googleSub);
    if (existing) {
      log.debug("migrateStripeEntitlement returning", {
        migrated: true,
        reason: "already_migrated",
        tier: existing.tier,
        active: existing.active,
      });
      return {
        migrated: true,
        tier: existing.tier,
        active: existing.active,
      };
    }

    // 2. Read the anonymous entitlement
    const anonDoc = await getEntitlement(`stripe:${stripeCustomerId}`);
    if (!anonDoc) {
      log.debug("migrateStripeEntitlement returning", {
        migrated: false,
        reason: "not_found",
      });
      return { migrated: false, reason: "not_found" };
    }

    // 3. Copy to Google-keyed entry
    await setEntitlement(googleSub, anonDoc);

    // 4. Set stripeCustomerId on user document for future reverse lookups
    await setUserStripeCustomerId(googleSub, stripeCustomerId);

    // 5. Delete the anonymous doc
    await deleteEntitlement(`stripe:${stripeCustomerId}`);

    log.debug("migrateStripeEntitlement returning", {
      migrated: true,
      stripeCustomerId,
      googleSub,
      tier: anonDoc.tier,
      active: anonDoc.active,
    });

    return {
      migrated: true,
      tier: anonDoc.tier,
      active: anonDoc.active,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("migrateStripeEntitlement failed", { stripeCustomerId, googleSub, error: message });
    throw err;
  }
}
