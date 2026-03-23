/**
 * Fenrir Ledger — localStorage Abstraction Layer
 *
 * ALL localStorage access in the app goes through this module.
 * No component or page should call window.localStorage directly.
 *
 * See ADR-003 for the localStorage decision and migration path.
 * See ADR-004 for the per-household key namespacing decision (Sprint 3.1).
 *
 * IMPORTANT: This module is browser-only. All functions guard against SSR
 * contexts by checking typeof window !== "undefined".
 *
 * Key Namespacing (Sprint 3.1+):
 *   Per-household keys prevent cross-contamination between Google accounts
 *   sharing the same browser. Every card and household key is namespaced:
 *
 *     fenrir_ledger:{householdId}:cards       → Card[] for this user
 *     fenrir_ledger:{householdId}:household   → Household for this user
 *     fenrir_ledger:schema_version            → global schema version (not per-household)
 *
 *   The old flat keys (fenrir_ledger:cards, fenrir_ledger:households) from
 *   Sprints 1–2 are abandoned. No migration is performed — there are no
 *   real users with production data to preserve.
 *
 * Two-layer architecture:
 *   Private raw helpers — return ALL records, including soft-deleted ones.
 *     getAllCards(), getHouseholdRaw(), getRawCardById()
 *   Public UI API — always filter out records where deletedAt is set.
 *     getCards(), getCardById(), getHouseholds(), getAllCardsGlobal()
 *
 * Gleipnir ingredient #4 (sinews of a bear):
 * This module persists like the sinews of a bear — silent, invisible,
 * impossible to break. No chain holds without it.
 */

import type { Card, Household } from "@/lib/types";
import { STORAGE_KEYS, STORAGE_KEY_PREFIX, SCHEMA_VERSION } from "@/lib/constants";
import { computeCardStatus } from "@/lib/card-utils";

// ─── Guards ──────────────────────────────────────────────────────────────────

/** Returns true when running in a browser context (not SSR). */
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// ─── Cloud sync notification ──────────────────────────────────────────────────

/**
 * Dispatches "fenrir:cards-changed" after a user-initiated card write.
 * useCloudSync listens for this event and schedules a debounced push to Firestore.
 *
 * NOT called from setAllCards() directly — only from user-facing write functions
 * (saveCard, deleteCard, restoreCard, expungeCard, expungeAllCards, closeCard)
 * so that the hook's internal merge writes don't trigger an infinite sync loop.
 *
 * Detail: { householdId: string }
 */
function notifyCardsChanged(householdId: string): void {
  if (!isBrowser()) return;
  window.dispatchEvent(
    new CustomEvent("fenrir:cards-changed", { detail: { householdId } })
  );
}

// ─── Per-household key builders ───────────────────────────────────────────────

/**
 * Returns the localStorage key for the cards array for a given household.
 *
 * @param householdId - The authenticated user's household ID (Google sub claim)
 * @returns localStorage key string, e.g. "fenrir_ledger:uid123:cards"
 */
function cardsKey(householdId: string): string {
  return `${STORAGE_KEY_PREFIX}:${householdId}:cards`;
}

/**
 * Returns the localStorage key for the household record for a given household.
 *
 * @param householdId - The authenticated user's household ID (Google sub claim)
 * @returns localStorage key string, e.g. "fenrir_ledger:uid123:household"
 */
function householdKey(householdId: string): string {
  return `${STORAGE_KEY_PREFIX}:${householdId}:household`;
}

// ─── Schema Migration ─────────────────────────────────────────────────────────

/**
 * Runs schema migrations if the stored version is behind the current version.
 * Called automatically on module initialization.
 *
 * Version history:
 *   0 → 1: Initial schema (Sprint 1). No data to migrate — fresh install.
 *   1 → 2: Added optional deletedAt field to Card and Household for soft-delete
 *           support. No data transformation needed — absent field === undefined
 *           by design. (No migration step required pre-launch; see team norms.)
 *
 * Note (Sprint 3.1): The schema version key remains global (not per-household)
 * because it tracks the shape of the data format, not per-user content.
 * The old flat-key data (fenrir_ledger:cards, fenrir_ledger:households) is
 * abandoned — no real users existed before auth landed.
 */
export function migrateIfNeeded(): void {
  if (!isBrowser()) return;

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION);
    const version = stored ? parseInt(stored, 10) : 0;

    if (version < SCHEMA_VERSION) {
      runMigrations(version, SCHEMA_VERSION);
      localStorage.setItem(STORAGE_KEYS.SCHEMA_VERSION, String(SCHEMA_VERSION));
    }
  } catch (err) {
    console.error("[FenrirLedger] Schema migration failed:", err);
  }
}

/**
 * Runs all migrations between fromVersion and toVersion.
 * Add a case for each new schema version.
 */
function runMigrations(fromVersion: number, toVersion: number): void {
  console.info(
    `[FenrirLedger] Migrating schema from v${fromVersion} to v${toVersion}`
  );

  // Version 0 → 1: Initial setup. Nothing to migrate.
  if (fromVersion < 1 && toVersion >= 1) {
    // Fresh install — no data to transform
  }

  // Version 1 → 2: Added deletedAt (optional) to Card and Household.
  // No data transformation needed — existing records without the field are
  // treated as non-deleted by the undefined check in the public API.
  if (fromVersion < 2 && toVersion >= 2) {
    // No-op: optional field, absence === undefined === not deleted
  }

  // Future migrations:
  // if (fromVersion < 3 && toVersion >= 3) { ... }
}

// ─── Household Operations ─────────────────────────────────────────────────────

/**
 * Reads the raw household record for a given household ID, including if soft-deleted.
 * Private raw helper — use getHousehold() for UI-facing reads.
 *
 * @param householdId - The household to read
 * @returns The Household object, or null if not found or on error
 */
function getHouseholdRaw(householdId: string): Household | null {
  if (!isBrowser()) return null;

  try {
    const raw = localStorage.getItem(householdKey(householdId));
    if (!raw) return null;
    return JSON.parse(raw) as Household;
  } catch (err) {
    console.error("[FenrirLedger] Failed to read household:", err);
    return null;
  }
}

/**
 * Returns all active (non-deleted) households visible in the current browser.
 * In the per-household key scheme, each user has exactly one household under
 * their namespaced key. This function scans all known household keys.
 *
 * In practice, each user will have at most one household in localStorage
 * (their own, keyed by their Google sub). The plural form is preserved for
 * API compatibility with any future multi-household support.
 *
 * @returns Array containing the current user's Household, or empty if none found.
 */
export function getHouseholds(): Household[] {
  // This function is retained for API compatibility.
  // With per-household key namespacing, callers should use initializeHousehold()
  // and read cards directly — not enumerate households.
  // Returns empty array in SSR context.
  return [];
}

/**
 * Writes the household record to localStorage under the per-household key.
 * Private helper — use initializeHousehold() for the public mutation operation.
 *
 * @param household - The Household object to persist
 */
function setHousehold(household: Household): void {
  if (!isBrowser()) return;

  try {
    localStorage.setItem(householdKey(household.id), JSON.stringify(household));
  } catch (err) {
    console.error("[FenrirLedger] Failed to save household:", err);
    throw new Error("Failed to save household. Storage may be full.");
  }
}

/**
 * Initializes the household for the authenticated user if it does not already exist.
 * Idempotent — safe to call on every page load.
 * Backfills updatedAt for households that predate the field.
 *
 * Unlike the Sprint 1–2 version, this function takes the householdId explicitly
 * (derived from the authenticated session) rather than using a hardcoded default.
 *
 * @param householdId - The authenticated user's household ID (Google sub claim)
 * @returns The Household object for this user
 */
export function initializeHousehold(householdId: string): Household {
  const now = new Date().toISOString();

  if (!isBrowser()) {
    // SSR fallback — return a transient household object; nothing is written
    return {
      id: householdId,
      name: "My Household",
      createdAt: now,
      updatedAt: now,
    };
  }

  const existing = getHouseholdRaw(householdId);

  if (existing) {
    // Backfill updatedAt if missing (pre-migration household records)
    if (!existing.updatedAt) {
      const backfilled: Household = {
        ...existing,
        updatedAt: existing.createdAt,
      };
      setHousehold(backfilled);
      return backfilled;
    }
    return existing;
  }

  // Create a new household for this user
  const newHousehold: Household = {
    id: householdId,
    name: "My Household",
    createdAt: now,
    updatedAt: now,
  };

  setHousehold(newHousehold);
  return newHousehold;
}

// ─── Effective household ID (post-join) ───────────────────────────────────────

/**
 * localStorage key for the user's current effective household ID.
 *
 * For solo users this equals session.user.sub (set implicitly by ensureSoloHousehold).
 * After joining a shared household the join flow writes the new household ID here
 * so that useCloudSync always reads/writes the correct namespaced key.
 *
 * Not stored in FenrirSession because it is a server-side claim, not a JWT claim.
 */
const EFFECTIVE_HOUSEHOLD_ID_KEY = "fenrir:householdId";

/**
 * Returns the stored effective household ID, falling back to the provided default
 * (typically session.user.sub which equals the solo household ID).
 *
 * @param fallback - The Google sub claim from the session token
 */
export function getEffectiveHouseholdId(fallback: string): string {
  if (!isBrowser()) return fallback;
  return localStorage.getItem(EFFECTIVE_HOUSEHOLD_ID_KEY) ?? fallback;
}

/**
 * Persists the effective household ID after a successful household join.
 * Call this immediately after the /api/household/join response succeeds.
 *
 * @param householdId - The new household ID returned by the join API
 */
export function setStoredHouseholdId(householdId: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(EFFECTIVE_HOUSEHOLD_ID_KEY, householdId);
}

/**
 * Removes the cards and household keys for a given household ID from localStorage.
 * Call with the OLD household ID after a successful join to prevent stale solo
 * data lingering under the previous key.
 *
 * @param householdId - The household ID whose keys should be removed
 */
export function clearHouseholdLocalStorage(householdId: string): void {
  if (!isBrowser()) return;
  localStorage.removeItem(cardsKey(householdId));
  localStorage.removeItem(householdKey(householdId));
}

// ─── Card Operations ──────────────────────────────────────────────────────────

/**
 * Reads ALL cards for a given household from localStorage, including soft-deleted ones.
 * Public sync helper — exposed for the cloud sync service which needs tombstones.
 * For UI-facing reads, use getCards(householdId) which filters deletedAt.
 *
 * @param householdId - The household to read cards for
 */
export function getRawAllCards(householdId: string): Card[] {
  return getAllCards(householdId);
}

/**
 * Reads ALL cards for a given household from localStorage, including soft-deleted ones.
 * Private raw helper — use getCards(householdId) for UI-facing reads.
 *
 * @param householdId - The household to read cards for
 */
function getAllCards(householdId: string): Card[] {
  if (!isBrowser()) return [];

  try {
    const raw = localStorage.getItem(cardsKey(householdId));
    if (!raw) return [];
    return JSON.parse(raw) as Card[];
  } catch (err) {
    console.error("[FenrirLedger] Failed to read cards:", err);
    return [];
  }
}

/**
 * Writes the full cards array to localStorage under the per-household key.
 * Private helper — use saveCard() or deleteCard() for individual operations.
 *
 * Dispatches "fenrir:sync" so the SyncIndicator pulses on every real write.
 *
 * @param householdId - The household to write cards for
 * @param cards - Complete array of Card objects to persist (all records,
 *   including soft-deleted ones)
 */
export function setAllCards(householdId: string, cards: Card[]): void {
  if (!isBrowser()) return;

  try {
    localStorage.setItem(cardsKey(householdId), JSON.stringify(cards));
    window.dispatchEvent(new CustomEvent("fenrir:sync", { detail: { householdId } }));
  } catch (err) {
    console.error("[FenrirLedger] Failed to save cards:", err);
    throw new Error("Failed to save cards. Storage may be full.");
  }
}

/**
 * Reads a single card by ID, including soft-deleted cards.
 * Private raw helper — use getCardById() for UI-facing reads.
 *
 * @param householdId - The household that owns the card
 * @param id - The card ID
 * @returns The Card object (deleted or not), or undefined if not found
 */
function getRawCardById(householdId: string, id: string): Card | undefined {
  return getAllCards(householdId).find((c) => c.id === id);
}

/**
 * Reads all active (non-deleted) cards across all households visible in the browser.
 *
 * Used by easter eggs (e.g. KonamiHowl) that need a cross-household snapshot
 * without caring about household boundaries.
 *
 * NOTE: With per-household key namespacing, this function can only return cards
 * for households whose keys are known. Since each user has exactly one household
 * (their Google sub), this is equivalent to getCards() for the current user.
 * The function is preserved for easter egg compatibility — callers pass the
 * current householdId explicitly.
 *
 * @param householdId - The current user's household ID
 * @returns All non-deleted Card objects for this household, unsorted.
 */
export function getAllCardsGlobal(householdId: string): Card[] {
  return getAllCards(householdId).filter((c) => !c.deletedAt);
}

/**
 * Reads all active (non-deleted) cards for a given household, sorted by most
 * recently updated. Includes closed cards so the Valhalla dashboard tab can
 * display them alongside active cards.
 *
 * Previously excluded cards with status === "closed"; that filter was removed
 * in Issue #352 to support the 5-tab dashboard (Valhalla tab shows closed cards).
 *
 * @param householdId - The household to filter by
 * @returns Array of non-deleted Card objects for the household (all statuses)
 */
export function getCards(householdId: string): Card[] {
  const all = getAllCards(householdId);
  return all
    .filter(
      (c) =>
        c.householdId === householdId &&
        !c.deletedAt
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

/**
 * Reads all Valhalla cards (closed or graduated) for a given household.
 * Excludes soft-deleted cards — a deleted card is gone forever; a closed
 * or graduated card is honored in Valhalla.
 *
 * Cards are sorted by closedAt descending (most recently closed first).
 * Falls back to updatedAt for cards that predate the closedAt field or
 * graduated cards that were never explicitly closed.
 *
 * @param householdId - The household to filter by
 * @returns Array of Valhalla Card objects for the household, sorted by closedAt/updatedAt desc
 */
export function getClosedCards(householdId: string): Card[] {
  const all = getAllCards(householdId);
  return all
    .filter(
      (c) =>
        c.householdId === householdId &&
        !c.deletedAt &&
        (c.status === "closed" || c.status === "graduated")
    )
    .sort((a, b) => {
      const aDate = a.closedAt ?? a.updatedAt;
      const bDate = b.closedAt ?? b.updatedAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
}

/**
 * Reads a single active (non-deleted) card by ID.
 * Returns undefined if the card does not exist or has been soft-deleted.
 *
 * @param householdId - The household that owns the card
 * @param id - The card ID
 * @returns The Card object, or undefined if not found or soft-deleted
 */
export function getCardById(householdId: string, id: string): Card | undefined {
  const card = getRawCardById(householdId, id);
  return card?.deletedAt ? undefined : card;
}

/**
 * Saves a card (insert or update).
 * Recomputes the card status before saving.
 * Auto-sets createdAt on insert and always refreshes updatedAt.
 *
 * If a card with the same ID exists, it is replaced.
 * If no card with that ID exists, the card is appended.
 *
 * @param card - The Card object to save (must include householdId)
 */
export function saveCard(card: Card): void {
  const all = getAllCards(card.householdId);
  const now = new Date().toISOString();
  const existingIndex = all.findIndex((c) => c.id === card.id);
  const isInsert = existingIndex < 0;

  // Recompute status before saving; auto-manage timestamps
  const cardWithStatus: Card = {
    ...card,
    status: computeCardStatus(card),
    createdAt: isInsert ? now : (card.createdAt || now),
    updatedAt: now,
  };

  if (!isInsert) {
    // Update existing
    const updated = [...all];
    updated[existingIndex] = cardWithStatus;
    setAllCards(card.householdId, updated);
  } else {
    // Insert new
    setAllCards(card.householdId, [...all, cardWithStatus]);
  }
  notifyCardsChanged(card.householdId);
}

/**
 * Soft-deletes a card by setting its deletedAt timestamp.
 * The record is retained in localStorage; it will no longer appear in any
 * UI-facing read (getCards, getCardById, getAllCardsGlobal).
 * No-op if the card does not exist or is already soft-deleted.
 *
 * @param householdId - The household that owns the card
 * @param id - The card ID to soft-delete
 */
export function deleteCard(householdId: string, id: string): void {
  const all = getAllCards(householdId);
  const index = all.findIndex((c) => c.id === id);
  if (index < 0) return;

  const card = all[index]!;
  if (card.deletedAt) return; // Already soft-deleted — no-op

  const updated = [...all];
  updated[index] = { ...card, deletedAt: new Date().toISOString() };
  setAllCards(householdId, updated);
  notifyCardsChanged(householdId);
}

// ─── Trash Operations ─────────────────────────────────────────────────────────

/**
 * Returns all soft-deleted cards for a given household, sorted by deletedAt
 * descending (most recently deleted first). These are cards with deletedAt set.
 *
 * This is the public API for the Trash tab — the inverse of getCards().
 *
 * @param householdId - The household to filter by
 * @returns Array of soft-deleted Card objects, sorted by deletedAt desc
 */
export function getDeletedCards(householdId: string): Card[] {
  const all = getAllCards(householdId);
  return all
    .filter((c) => c.householdId === householdId && !!c.deletedAt)
    .sort((a, b) => {
      const aDate = a.deletedAt ?? a.updatedAt;
      const bDate = b.deletedAt ?? b.updatedAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
}

/**
 * Restores a soft-deleted card by clearing its deletedAt timestamp.
 * The card reappears in getCards() after this call.
 * No-op if the card does not exist or is not soft-deleted.
 *
 * Caller is responsible for cloud sync if tier === "karl".
 *
 * @param householdId - The household that owns the card
 * @param cardId - The card ID to restore
 * @returns The restored Card object, or undefined if not found
 */
export function restoreCard(householdId: string, cardId: string): Card | undefined {
  const all = getAllCards(householdId);
  const index = all.findIndex((c) => c.id === cardId && c.householdId === householdId);
  if (index < 0) return undefined;

  const card = all[index]!;
  if (!card.deletedAt) return card; // Not deleted — no-op, return as-is

  const restored: Card = { ...card, deletedAt: undefined, updatedAt: new Date().toISOString() };
  const updated = [...all];
  updated[index] = restored;
  setAllCards(householdId, updated);
  notifyCardsChanged(householdId);
  return restored;
}

/**
 * Permanently removes a single soft-deleted card from localStorage.
 * The record is deleted entirely — no undo, no cloud call.
 * No-op if the card does not exist.
 *
 * @param householdId - The household that owns the card
 * @param cardId - The card ID to expunge
 */
export function expungeCard(householdId: string, cardId: string): void {
  const all = getAllCards(householdId);
  const filtered = all.filter((c) => !(c.id === cardId && c.householdId === householdId));
  if (filtered.length === all.length) return; // Card not found — no-op
  setAllCards(householdId, filtered);
  notifyCardsChanged(householdId);
}

/**
 * Permanently removes ALL soft-deleted cards for a given household from localStorage.
 * Equivalent to "Empty Trash". No undo, no cloud call.
 *
 * @param householdId - The household to expunge all deleted cards for
 */
export function expungeAllCards(householdId: string): void {
  const all = getAllCards(householdId);
  const filtered = all.filter((c) => !(c.householdId === householdId && !!c.deletedAt));
  setAllCards(householdId, filtered);
  notifyCardsChanged(householdId);
}

/**
 * Closes a card by setting its status to "closed" and recording the closedAt
 * timestamp. The card remains in localStorage and is visible in Valhalla
 * (/valhalla); it will no longer appear in the active dashboard.
 *
 * Distinct from deleteCard(): a closed card is honored (Valhalla), not erased.
 * No-op if the card does not exist, is already closed, or has been soft-deleted.
 *
 * @param householdId - The household that owns the card (used for scope check)
 * @param cardId - The card ID to close
 * @param options - Optional settings:
 *   - markBonusMet: if true, sets signUpBonus.met = true before closing
 *     (used when the user confirms minimum spend was met during close flow)
 */
export function closeCard(
  householdId: string,
  cardId: string,
  options?: { markBonusMet?: boolean }
): void {
  const all = getAllCards(householdId);
  const index = all.findIndex(
    (c) => c.id === cardId && c.householdId === householdId
  );
  if (index < 0) return;

  const card = all[index]!;
  if (card.deletedAt) return; // Soft-deleted — no-op
  if (card.status === "closed") return; // Already closed — no-op

  const now = new Date().toISOString();
  const updated = [...all];
  const closedCard: Card = {
    ...card,
    status: "closed",
    closedAt: now,
    updatedAt: now,
  };

  // Optionally mark sign-up bonus as met during close flow
  if (options?.markBonusMet && closedCard.signUpBonus) {
    closedCard.signUpBonus = { ...closedCard.signUpBonus, met: true };
  }

  updated[index] = closedCard;
  setAllCards(householdId, updated);
  notifyCardsChanged(householdId);
}
