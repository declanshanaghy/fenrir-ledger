/**
 * Silent Auto-Merge — Fenrir Ledger (Story 5.1)
 *
 * When a user signs in via Google OAuth, any cards created during their
 * anonymous session are silently merged into the Google-scoped household.
 *
 * Dedup: if a card ID exists in both anonymous and Google households,
 * the Google version wins. Soft-deleted anonymous cards are skipped.
 *
 * A tombstone in localStorage prevents re-merging on subsequent sign-ins.
 */

import { getAllCardsGlobal, setAllCards } from "@/lib/storage";

/**
 * Merges non-duplicate anonymous cards into the Google-scoped household.
 *
 * @param googleHouseholdId - The authenticated user's household ID (Google sub)
 * @param anonHouseholdId - The anonymous household UUID from localStorage
 * @returns Count of merged and skipped cards
 */
export function mergeAnonymousCards(
  googleHouseholdId: string,
  anonHouseholdId: string
): { merged: number; skipped: number } {
  if (typeof window === "undefined") {
    return { merged: 0, skipped: 0 };
  }

  // Read active (non-deleted) cards from both households
  const googleCards = getAllCardsGlobal(googleHouseholdId);
  const anonCards = getAllCardsGlobal(anonHouseholdId);

  // Build a set of Google card IDs for fast dedup lookup
  const googleCardIds = new Set(googleCards.map((c) => c.id));

  // Filter anonymous cards: skip duplicates (Google version wins)
  const newCards = [];
  let skipped = 0;

  for (const card of anonCards) {
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
    // getAllCardsGlobal filters out deletedAt, so we read the raw key directly.
    const rawGoogleJson = localStorage.getItem(
      `fenrir_ledger:${googleHouseholdId}:cards`
    );
    const rawGoogleCards = rawGoogleJson ? JSON.parse(rawGoogleJson) : [];
    setAllCards(googleHouseholdId, [...rawGoogleCards, ...newCards]);
  }

  // Set tombstone to prevent re-merge on subsequent sign-ins
  localStorage.setItem(`fenrir:merged:${anonHouseholdId}`, "1");

  // Clear anonymous data
  localStorage.removeItem(`fenrir_ledger:${anonHouseholdId}:cards`);
  localStorage.removeItem(`fenrir_ledger:${anonHouseholdId}:household`);

  return { merged: newCards.length, skipped };
}

/**
 * Checks whether anonymous cards from a given household have already been merged.
 *
 * @param anonHouseholdId - The anonymous household UUID to check
 * @returns true if a merge tombstone exists for this anonymous household
 */
export function isMergeComplete(anonHouseholdId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`fenrir:merged:${anonHouseholdId}`) === "1";
}
