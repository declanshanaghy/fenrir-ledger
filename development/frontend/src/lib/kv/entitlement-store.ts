/**
 * Firestore entitlement store -- server-side persistence for subscription entitlements.
 *
 * Stripe subscription state is stored directly on the household document at
 * /households/{householdId}. Since householdId == userId for solo households,
 * entitlements are retrieved by looking up the user's household.
 *
 * No /entitlements/ collection. All billing state lives on the household.
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
  getHousehold,
  findUserByStripeCustomerId,
  setUserStripeCustomerId,
  getFirestore,
} from "@/lib/firebase/firestore";
import { FIRESTORE_PATHS } from "@/lib/firebase/firestore-types";
import type { StoredStripeEntitlement } from "@/lib/stripe/types";
import { ACTIVE_STRIPE_STATUSES } from "@/lib/stripe/types";
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
 * Converts household Stripe fields into a StoredStripeEntitlement record.
 * Returns null if the household has no linked Stripe subscription.
 */
function householdToEntitlement(
  household: Awaited<ReturnType<typeof getHousehold>>
): StoredStripeEntitlement | null {
  if (!household) return null;
  if (!household.stripeCustomerId || !household.stripeSubscriptionId || !household.stripeStatus) {
    return null;
  }
  const active = ACTIVE_STRIPE_STATUSES.has(household.stripeStatus);
  return {
    tier: household.tier === "karl" ? "karl" : "thrall",
    active,
    stripeCustomerId: household.stripeCustomerId,
    stripeSubscriptionId: household.stripeSubscriptionId,
    stripeStatus: household.stripeStatus,
    cancelAtPeriodEnd: household.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: household.currentPeriodEnd,
    linkedAt: household.stripeLinkedAt ?? household.createdAt,
    checkedAt: household.stripeCheckedAt ?? household.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Authenticated user entitlement operations
// ---------------------------------------------------------------------------

/**
 * Retrieves the Stripe entitlement for an authenticated Google user by reading
 * Stripe fields from their household document.
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
    const household = await getHousehold(user.householdId);
    const result = householdToEntitlement(household);
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
 * Stores Stripe subscription fields directly on the user's household document.
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
      log.error("setStripeEntitlement: user not found — cannot write to household", { googleSub });
      throw new Error(`User ${googleSub} not found — cannot write Stripe entitlement`);
    }

    const now = new Date().toISOString();
    const db = getFirestore();
    await db.doc(FIRESTORE_PATHS.household(user.householdId)).update({
      stripeCustomerId: entitlement.stripeCustomerId,
      stripeSubscriptionId: entitlement.stripeSubscriptionId,
      stripeStatus: entitlement.stripeStatus,
      tier: entitlement.tier === "karl" ? "karl" : "free",
      cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd ?? false,
      currentPeriodEnd: entitlement.currentPeriodEnd ?? null,
      stripeLinkedAt: entitlement.linkedAt,
      stripeCheckedAt: now,
      updatedAt: now,
    });

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
 * Clears Stripe subscription fields from the user's household document,
 * reverting the household to the free tier.
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

    const now = new Date().toISOString();
    const db = getFirestore();
    await db.doc(FIRESTORE_PATHS.household(user.householdId)).update({
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripeStatus: null,
      tier: "free",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      updatedAt: now,
    });

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
