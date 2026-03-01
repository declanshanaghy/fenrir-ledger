/**
 * Anonymous Household Management — Fenrir Ledger
 *
 * Manages the anonymous householdId for users who have not signed in.
 * For anonymous users, householdId is a UUID generated client-side and
 * persisted to localStorage under the key "fenrir:household".
 *
 * householdId resolution order (see ADR-006):
 *   1. If "fenrir:auth" session is valid → use session.user.sub
 *   2. Else → read "fenrir:household" from localStorage
 *   3. If absent → generate crypto.randomUUID(), persist it, use it
 *
 * All existing storage.ts functions use householdId and require no changes.
 * This module is the only new piece in the anonymous-first data layer.
 *
 * See ADR-006 for the anonymous-first auth model decision.
 */

/** localStorage key for the anonymous householdId */
export const ANONYMOUS_HOUSEHOLD_KEY = "fenrir:household";

/**
 * Returns the anonymous householdId from localStorage, creating and
 * persisting one if it does not yet exist.
 *
 * Safe to call on every render — idempotent.
 * Returns empty string during SSR (typeof window === "undefined").
 *
 * @returns The anonymous householdId UUID string, or "" in SSR context
 */
export function getOrCreateAnonHouseholdId(): string {
  if (typeof window === "undefined") return "";

  try {
    const existing = localStorage.getItem(ANONYMOUS_HOUSEHOLD_KEY);
    if (existing) return existing;

    const id = crypto.randomUUID();
    localStorage.setItem(ANONYMOUS_HOUSEHOLD_KEY, id);
    return id;
  } catch {
    // localStorage may be blocked in private browsing or third-party context.
    // Fall back to an in-memory UUID so the app still works — it just won't
    // persist across sessions in this edge case.
    return crypto.randomUUID();
  }
}

/**
 * Reads the current anonymous householdId from localStorage without creating one.
 * Returns null if no anonymous household exists.
 *
 * @returns The stored anonymous householdId, or null if absent
 */
export function getAnonHouseholdId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ANONYMOUS_HOUSEHOLD_KEY);
  } catch {
    return null;
  }
}
