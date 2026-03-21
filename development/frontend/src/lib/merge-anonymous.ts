/**
 * Silent Auto-Merge — Fenrir Ledger (Issue #1671)
 *
 * When a user signs in via Google OAuth, any cards created during their
 * anonymous session are silently merged into the Google-scoped household.
 *
 * Issue #1671: Anonymous cards are now stored under the fixed "anon" key
 * (ANON_HOUSEHOLD_ID) instead of a random UUID household.
 *
 * Backward compat: also migrates cards from the old random UUID key
 * (fenrir:household) for users who stored cards before the #1671 refactor.
 *
 * Dedup: if a card ID exists in both anonymous and Google households,
 * the Google version wins.
 *
 * After merge: both the fixed "anon" key and any legacy UUID key are cleared.
 * No tombstone needed — the storage is cleaned up, so re-merge on subsequent
 * sign-ins naturally finds nothing to merge.
 */

import { getAllCardsGlobal, setAllCards } from "@/lib/storage";
import { getAnonHouseholdId } from "@/lib/auth/household";
import { ANON_HOUSEHOLD_ID, STORAGE_KEY_PREFIX } from "@/lib/constants";

/**
 * Merges anonymous cards into the Google-scoped household.
 *
 * Reads from:
 *   1. Fixed "anon" key: fenrir_ledger:anon:cards (Issue #1671 model)
 *   2. Legacy UUID key: fenrir_ledger:<uuid>:cards (pre-#1671 backward compat)
 *
 * @param googleHouseholdId - The authenticated user's household ID (Google sub)
 * @returns Count of merged and skipped cards
 */
export function mergeAnonymousCards(
  googleHouseholdId: string
): { merged: number; skipped: number } {
  if (typeof window === "undefined") {
    return { merged: 0, skipped: 0 };
  }

  // Read active (non-deleted) cards from the Google household
  const googleCards = getAllCardsGlobal(googleHouseholdId);
  const googleCardIds = new Set(googleCards.map((c) => c.id));

  // Collect all anonymous cards from both storage locations
  const anonCards = getAllCardsGlobal(ANON_HOUSEHOLD_ID); // fixed "anon" key
  const legacyAnonId = getAnonHouseholdId(); // old random UUID (may be null)
  const legacyAnonCards = legacyAnonId ? getAllCardsGlobal(legacyAnonId) : [];

  // Dedup across both anon sources
  const seenAnonIds = new Set<string>();
  const allAnonCards = [...anonCards, ...legacyAnonCards].filter((card) => {
    if (seenAnonIds.has(card.id)) return false;
    seenAnonIds.add(card.id);
    return true;
  });

  // Filter: skip cards already in Google household (Google version wins)
  const newCards = [];
  let skipped = 0;

  for (const card of allAnonCards) {
    if (googleCardIds.has(card.id)) {
      skipped++;
    } else {
      // Re-scope the card to the Google household
      newCards.push({ ...card, householdId: googleHouseholdId });
    }
  }

  if (newCards.length > 0) {
    // Read the full raw card array (including soft-deleted) for the Google
    // household so we don't lose any soft-deleted records when we write back.
    const rawGoogleJson = localStorage.getItem(
      `${STORAGE_KEY_PREFIX}:${googleHouseholdId}:cards`
    );
    const rawGoogleCards = rawGoogleJson ? JSON.parse(rawGoogleJson) : [];
    setAllCards(googleHouseholdId, [...rawGoogleCards, ...newCards]);
  }

  // Clean up fixed anonymous storage
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}:${ANON_HOUSEHOLD_ID}:cards`);
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}:${ANON_HOUSEHOLD_ID}:household`);

  // Clean up legacy anonymous storage if present
  if (legacyAnonId) {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}:${legacyAnonId}:cards`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}:${legacyAnonId}:household`);
    localStorage.removeItem("fenrir:household"); // old UUID key
    localStorage.removeItem(`fenrir:merged:${legacyAnonId}`); // old tombstone
  }

  return { merged: newCards.length, skipped };
}

/**
 * @deprecated No longer needed in the #1671 model — anonymous storage is
 * cleaned up during merge, so there is nothing to re-merge on subsequent sign-ins.
 * Retained for backward compat with existing tests and mocks.
 *
 * @returns always false
 */
export function isMergeComplete(_anonHouseholdId: string): boolean {
  return false;
}
