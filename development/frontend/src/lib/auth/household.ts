/**
 * Anonymous Household Management — Fenrir Ledger
 *
 * Issue #1671: Anonymous users no longer get a random UUID household.
 * Anonymous card storage uses a fixed key (ANON_HOUSEHOLD_ID = "anon").
 *
 * getOrCreateAnonHouseholdId() has been REMOVED — it created a premature
 * UUID household that leaked into localStorage for all visitors.
 *
 * getAnonHouseholdId() is retained for BACKWARD COMPAT ONLY:
 *   - merge-anonymous.ts reads it to migrate cards from the old UUID key
 *     for users who stored cards before the #1671 refactor.
 *   - Do NOT call this in new code. Use ANON_HOUSEHOLD_ID from constants.ts.
 *
 * householdId resolution order (post-#1671, see ADR-006):
 *   1. Authenticated → householdId = session.user.sub
 *   2. Anonymous     → householdId = null (cards stored under "anon" key)
 *
 * See ADR-006 for the anonymous-first auth model decision.
 */

/** localStorage key for the legacy anonymous householdId (pre-#1671) */
export const ANONYMOUS_HOUSEHOLD_KEY = "fenrir:household";

/**
 * Reads the legacy anonymous householdId from localStorage without creating one.
 * Returns null if no anonymous household exists.
 *
 * BACKWARD COMPAT ONLY — used by merge-anonymous.ts to migrate cards from the
 * old random UUID key for users who visited before the #1671 refactor.
 * Do NOT use in new code — anonymous users no longer get UUID households.
 *
 * @returns The stored legacy anonymous householdId, or null if absent
 */
export function getAnonHouseholdId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ANONYMOUS_HOUSEHOLD_KEY);
  } catch {
    return null;
  }
}
