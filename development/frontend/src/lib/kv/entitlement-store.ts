/**
 * Vercel KV entitlement store — server-side persistence for Patreon entitlements.
 *
 * Stores and retrieves entitlement records keyed by Google user sub.
 * Maintains a secondary index from Patreon user ID to Google sub for webhook lookups.
 *
 * Key format:
 *   - `entitlement:{googleSub}` -> StoredEntitlement
 *   - `patreon-user:{patreonUserId}` -> `{googleSub}`
 *
 * TTL: Entitlements expire after 30 days if not refreshed.
 *
 * @module kv/entitlement-store
 */

import { kv } from "@vercel/kv";
import type { StoredEntitlement } from "@/lib/patreon/types";
import { log } from "@/lib/logger";

/** 30 days in seconds */
const ENTITLEMENT_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Builds the primary KV key for a user's entitlement.
 *
 * @param googleSub - Google account immutable ID
 * @returns KV key string
 */
function entitlementKey(googleSub: string): string {
  return `entitlement:${googleSub}`;
}

/**
 * Builds the secondary index key for Patreon user ID -> Google sub mapping.
 *
 * @param patreonUserId - Patreon user ID
 * @returns KV key string
 */
function patreonUserKey(patreonUserId: string): string {
  return `patreon-user:${patreonUserId}`;
}

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
 * Looks up a Google sub from a Patreon user ID using the secondary index.
 * Used by webhook handlers to map incoming Patreon events to our users.
 *
 * @param patreonUserId - Patreon user ID from webhook payload
 * @returns Google sub or null if no mapping exists
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
