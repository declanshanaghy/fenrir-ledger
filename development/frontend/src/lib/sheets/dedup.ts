import type { Card } from "@/lib/types";

export interface DuplicateMatch {
  imported: Omit<Card, "householdId">;
  existing: Card;
}

export interface DedupResult {
  duplicates: DuplicateMatch[];
  unique: Omit<Card, "householdId">[];
}

/**
 * Splits imported cards into duplicates and unique based on
 * issuerId + cardName (case-insensitive, trimmed).
 */
export function findDuplicates(
  imported: Omit<Card, "householdId">[],
  existing: Card[]
): DedupResult {
  const existingKeys = new Map<string, Card>();
  for (const card of existing) {
    const key = `${card.issuerId}::${card.cardName.trim().toLowerCase()}`;
    existingKeys.set(key, card);
  }

  const duplicates: DuplicateMatch[] = [];
  const unique: Omit<Card, "householdId">[] = [];

  for (const card of imported) {
    const key = `${card.issuerId}::${card.cardName.trim().toLowerCase()}`;
    const match = existingKeys.get(key);
    if (match) {
      duplicates.push({ imported: card, existing: match });
    } else {
      unique.push(card);
    }
  }

  return { duplicates, unique };
}
