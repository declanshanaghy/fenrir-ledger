/**
 * Firestore entitlement store -- server-side persistence for subscription entitlements.
 *
 * Stripe subscription state is stored in the household stripe subcollection at
 * /households/{householdId}/stripe/subscription (issue #1648).
 * Since householdId == userId for solo households, entitlements are retrieved
 * by looking up the user's household ID, then reading the stripe subcollection.
 *
 * No /entitlements/ collection. All billing state lives in the stripe subcollection.
 *
 * Reverse lookup (Stripe customer → Google sub):
 *   - Query `users` collection where `stripeCustomerId == customerId`
 *
 * Firestore IS the authoritative billing source.
 * Stripe webhooks write here; `requireKarl` reads from here.
 *
 * @module kv/entitlement-store
 */

import {
  getUser,
  findUserByStripeCustomerId,
  setUserStripeCustomerId,
  getStripeSubscription,
  setStripeSubscription,
  deleteStripeSubscription,
  updateHouseholdTier,
} from "@/lib/firebase/firestore";
import type { FirestoreStripeSubscription } from "@/lib/firebase/firestore-types";
import type { StoredStripeEntitlement } from "@/lib/stripe/types";
import { log } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Anonymous identity helpers (preserved for webhook backward-compatibility)
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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a stripe subcollection document into a StoredStripeEntitlement record.
 * Returns null if the document is absent (household has no Stripe subscription).
 */
function stripeDocToEntitlement(
  doc: FirestoreStripeSubscription | null
): StoredStripeEntitlement | null {
  if (!doc) return null;
  return {
    tier: doc.tier === "karl" ? "karl" : "thrall",
    active: doc.active,
    stripeCustomerId: doc.stripeCustomerId,
    stripeSubscriptionId: doc.stripeSubscriptionId,
    stripeStatus: doc.stripeStatus,
    cancelAtPeriodEnd: doc.cancelAtPeriodEnd,
    currentPeriodEnd: doc.currentPeriodEnd,
    linkedAt: doc.linkedAt,
    checkedAt: doc.checkedAt,
  };
}

// ---------------------------------------------------------------------------
// Authenticated user entitlement operations
// ---------------------------------------------------------------------------

/**
 * Retrieves the Stripe entitlement for an authenticated Google user by reading
 * the stripe subcollection at /households/{householdId}/stripe/subscription.
 *
 * @param googleSub - Google account immutable ID
 * @returns The stored entitlement or null if not found / not subscribed
 */
export async function getStripeEntitlement(
  googleSub: string,
): Promise<StoredStripeEntitlement | null> {
  log.debug("getStripeEntitlement called", { googleSub });
  try {
    const user = await getUser(googleSub);
    if (!user) {
      log.debug("getStripeEntitlement: user not found", { googleSub });
      return null;
    }
    const stripeDoc = await getStripeSubscription(user.householdId);
    const result = stripeDocToEntitlement(stripeDoc);
    log.debug("getStripeEntitlement returning", {
      googleSub,
      householdId: user.householdId,
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
 * Stores Stripe subscription fields in the stripe subcollection at
 * /households/{householdId}/stripe/subscription.
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
    const user = await getUser(googleSub);
    if (!user) {
      log.error("setStripeEntitlement: user not found — cannot write to stripe subcollection", { googleSub });
      throw new Error(`User ${googleSub} not found — cannot write Stripe entitlement`);
    }

    const now = new Date().toISOString();
    const stripeDoc: FirestoreStripeSubscription = {
      stripeCustomerId: entitlement.stripeCustomerId,
      stripeSubscriptionId: entitlement.stripeSubscriptionId,
      stripeStatus: entitlement.stripeStatus,
      tier: entitlement.tier === "karl" ? "karl" : "free",
      active: entitlement.active,
      cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd ?? false,
      currentPeriodEnd: entitlement.currentPeriodEnd ?? undefined,
      linkedAt: entitlement.linkedAt,
      checkedAt: now,
    };
    await setStripeSubscription(user.householdId, stripeDoc);

    // Keep the household doc's top-level tier field in sync so that Odin's Spear
    // and any direct household-doc readers reflect the correct tier without
    // having to fetch the stripe subcollection separately.
    await updateHouseholdTier(user.householdId, stripeDoc.tier);

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
 * Deletes the Stripe subscription document from the household's stripe subcollection
 * at /households/{householdId}/stripe/subscription.
 *
 * @param googleSub - Google account immutable ID
 */
export async function deleteStripeEntitlement(googleSub: string): Promise<void> {
  log.debug("deleteStripeEntitlement called", { googleSub });
  try {
    const user = await getUser(googleSub);
    if (!user) {
      log.debug("deleteStripeEntitlement: user not found — nothing to clear", { googleSub });
      return;
    }

    await deleteStripeSubscription(user.householdId);

    log.debug("deleteStripeEntitlement returning", { googleSub, success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("deleteStripeEntitlement failed", { googleSub, error: message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Reverse lookup: Stripe customer → Google sub
// ---------------------------------------------------------------------------

/**
 * Looks up the Google sub for a given Stripe customer ID.
 *
 * Queries the users collection by stripeCustomerId field.
 * Returns the Google sub string, or null if not found.
 *
 * @param stripeCustomerId - Stripe customer ID from webhook payload
 * @returns Google sub string or null
 */
export async function getGoogleSubByStripeCustomerId(
  stripeCustomerId: string,
): Promise<string | null> {
  log.debug("getGoogleSubByStripeCustomerId called", { stripeCustomerId });
  try {
    const user = await findUserByStripeCustomerId(stripeCustomerId);
    if (user) {
      log.debug("getGoogleSubByStripeCustomerId returning", {
        stripeCustomerId,
        found: true,
      });
      return user.userId;
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
// Anonymous Stripe user operations (no-op — requires authenticated sign-in)
// ---------------------------------------------------------------------------

/**
 * Anonymous Stripe subscriptions are no longer supported.
 * Users must sign in with Google before subscribing.
 * Kept for interface compatibility — always returns null.
 *
 * @deprecated Anonymous subscriptions removed in schema v2 (issue #1633)
 */
export async function getAnonymousStripeEntitlement(
  _stripeCustomerId: string,
): Promise<StoredStripeEntitlement | null> {
  return null;
}

/**
 * Anonymous Stripe subscriptions are no longer supported.
 * Users must sign in with Google before subscribing.
 * Kept for interface compatibility — no-op.
 *
 * @deprecated Anonymous subscriptions removed in schema v2 (issue #1633)
 */
export async function setAnonymousStripeEntitlement(
  _stripeCustomerId: string,
  _entitlement: StoredStripeEntitlement,
): Promise<void> {
  log.debug("setAnonymousStripeEntitlement: no-op (anonymous subscriptions removed)", {
    stripeCustomerId: _stripeCustomerId,
  });
}
