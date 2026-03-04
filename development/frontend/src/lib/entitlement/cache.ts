/**
 * Entitlement Cache — Fenrir Ledger
 *
 * Client-side localStorage cache for entitlement data.
 *
 * The server-side Vercel KV store is the source of truth.
 * This cache provides:
 *   1. Instant UI rendering on mount (no loading flash)
 *   2. Fallback when the server is unreachable (stale > blocked)
 *
 * Key: "fenrir:entitlement"
 * Value: JSON-serialized Entitlement record
 *
 * Staleness: An entitlement is considered stale if checkedAt is older
 * than 1 hour. Stale entitlements trigger a server re-verification.
 *
 * @module entitlement/cache
 */

import type { Entitlement } from "./types";

/** localStorage key for the entitlement cache. */
const CACHE_KEY = "fenrir:entitlement";

/** Staleness threshold: 1 hour in milliseconds. */
const STALENESS_THRESHOLD_MS = 60 * 60 * 1000;

/**
 * Reads the cached entitlement from localStorage.
 *
 * Returns null if:
 *   - Running in SSR (no window)
 *   - No cached value exists
 *   - The cached value is corrupted or unparseable
 *   - The cached value is missing required fields
 *
 * @returns The cached entitlement or null
 */
export function getEntitlementCache(): Entitlement | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;

    // Validate the shape of the parsed data
    if (!isValidEntitlement(parsed)) {
      // Corrupted or outdated cache format — clear it
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed;
  } catch {
    // JSON.parse failed — corrupted data
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // localStorage may be full or blocked — ignore
    }
    return null;
  }
}

/**
 * Writes an entitlement record to the localStorage cache.
 *
 * @param entitlement - The entitlement to cache
 */
export function setEntitlementCache(entitlement: Entitlement): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entitlement));
  } catch {
    // localStorage may be full or blocked — fail silently
    // The app continues to work; it just won't have a cache next mount.
  }
}

/**
 * Removes the entitlement cache from localStorage.
 */
export function clearEntitlementCache(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Fail silently
  }
}

/**
 * Returns true if the cached entitlement is stale (checkedAt older than 1 hour).
 *
 * A stale entitlement should trigger a server re-verification, but the stale
 * data can still be used as a fallback while the verification is in progress.
 *
 * @param entitlement - The entitlement to check
 * @returns true if the entitlement is stale and should be re-verified
 */
export function isEntitlementStale(entitlement: Entitlement): boolean {
  const age = Date.now() - entitlement.checkedAt;
  return age > STALENESS_THRESHOLD_MS;
}

// ---------------------------------------------------------------------------
// Patreon user ID cache (for anonymous -> authenticated migration)
// ---------------------------------------------------------------------------

/** localStorage key for the anonymous Patreon user ID. */
const PATREON_USER_ID_KEY = "fenrir:patreon-user-id";

/**
 * Reads the cached Patreon user ID from localStorage.
 *
 * This value is set when an anonymous user completes the Patreon OAuth flow.
 * It is used to trigger migration when the user later signs in with Google.
 *
 * @returns The Patreon user ID or null if not set
 */
export function getPatreonUserId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return localStorage.getItem(PATREON_USER_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Writes a Patreon user ID to the localStorage cache.
 *
 * @param pid - The Patreon user ID to cache
 */
export function setPatreonUserId(pid: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(PATREON_USER_ID_KEY, pid);
  } catch {
    // localStorage may be full or blocked — fail silently
  }
}

/**
 * Removes the Patreon user ID from localStorage.
 * Called after successful migration to a Google-keyed entitlement.
 */
export function clearPatreonUserId(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(PATREON_USER_ID_KEY);
  } catch {
    // Fail silently
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Type guard that validates the shape of a parsed entitlement object.
 * Ensures all required fields are present and of the correct type.
 */
function isValidEntitlement(value: unknown): value is Entitlement {
  if (!value || typeof value !== "object") return false;

  const obj = value as Record<string, unknown>;

  return (
    (obj.tier === "thrall" || obj.tier === "karl") &&
    typeof obj.active === "boolean" &&
    typeof obj.platform === "string" &&
    typeof obj.userId === "string" &&
    typeof obj.linkedAt === "number" &&
    typeof obj.checkedAt === "number"
  );
}
