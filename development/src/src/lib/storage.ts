/**
 * Fenrir Ledger — localStorage Abstraction Layer
 *
 * ALL localStorage access in the app goes through this module.
 * No component or page should call window.localStorage directly.
 *
 * See ADR-003 for the localStorage decision and migration path.
 *
 * IMPORTANT: This module is browser-only. All functions guard against SSR
 * contexts by checking typeof window !== "undefined".
 *
 * Two-layer architecture:
 *   Private raw helpers — return ALL records, including soft-deleted ones.
 *     getAllCards(), getAllHouseholdsRaw(), getRawCardById()
 *   Public UI API — always filter out records where deletedAt is set.
 *     getCards(), getCardById(), getHouseholds(), getAllCardsGlobal()
 *
 * Gleipnir ingredient #4 (sinews of a bear):
 * This module persists like the sinews of a bear — silent, invisible,
 * impossible to break. No chain holds without it.
 */

import type { Card, Household } from "@/lib/types";
import {
  STORAGE_KEYS,
  SCHEMA_VERSION,
  DEFAULT_HOUSEHOLD,
  DEFAULT_HOUSEHOLD_ID,
} from "@/lib/constants";
import { computeCardStatus } from "@/lib/card-utils";

// ─── Guards ──────────────────────────────────────────────────────────────────

/** Returns true when running in a browser context (not SSR). */
function isBrowser(): boolean {
  return typeof window !== "undefined";
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
 * Reads ALL households from localStorage, including soft-deleted ones.
 * Private raw helper — use getHouseholds() for UI-facing reads.
 *
 * @returns Array of all Household objects. Empty array if none exist or on error.
 */
function getAllHouseholdsRaw(): Household[] {
  if (!isBrowser()) return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HOUSEHOLDS);
    if (!raw) return [];
    return JSON.parse(raw) as Household[];
  } catch (err) {
    console.error("[FenrirLedger] Failed to read households:", err);
    return [];
  }
}

/**
 * Reads active (non-deleted) households from localStorage.
 * Filters out any household with a deletedAt timestamp set.
 *
 * @returns Array of active Household objects. Empty array if none exist or on error.
 */
export function getHouseholds(): Household[] {
  return getAllHouseholdsRaw().filter((h) => !h.deletedAt);
}

/**
 * Writes the full households array to localStorage.
 * Private helper — use saveCard(), deleteCard(), or initializeDefaultHousehold()
 * for all public mutation operations.
 *
 * @param households - Complete array of Household objects to persist (all records,
 *   including soft-deleted ones)
 */
function setAllHouseholds(households: Household[]): void {
  if (!isBrowser()) return;

  try {
    localStorage.setItem(STORAGE_KEYS.HOUSEHOLDS, JSON.stringify(households));
  } catch (err) {
    console.error("[FenrirLedger] Failed to save households:", err);
    throw new Error("Failed to save households. Storage may be full.");
  }
}

/**
 * Initializes the default household if it does not already exist.
 * Idempotent — safe to call on every page load.
 * Backfills updatedAt for households that predate the field.
 *
 * @returns The default Household object
 */
export function initializeDefaultHousehold(): Household {
  if (!isBrowser()) return DEFAULT_HOUSEHOLD;

  const households = getAllHouseholdsRaw();
  const existing = households.find((h) => h.id === DEFAULT_HOUSEHOLD_ID);

  if (existing) {
    // Backfill updatedAt if missing (pre-migration household records)
    if (!existing.updatedAt) {
      const backfilled: Household = {
        ...existing,
        updatedAt: existing.createdAt,
      };
      const updated = households.map((h) =>
        h.id === DEFAULT_HOUSEHOLD_ID ? backfilled : h
      );
      setAllHouseholds(updated);
      return backfilled;
    }
    return existing;
  }

  const now = new Date().toISOString();
  const newHousehold: Household = {
    ...DEFAULT_HOUSEHOLD,
    createdAt: now,
    updatedAt: now,
  };

  setAllHouseholds([...households, newHousehold]);
  return newHousehold;
}

// ─── Card Operations ──────────────────────────────────────────────────────────

/**
 * Reads ALL cards from localStorage (all households), including soft-deleted ones.
 * Private raw helper — use getCards(householdId) or getAllCardsGlobal() for
 * UI-facing reads.
 */
function getAllCards(): Card[] {
  if (!isBrowser()) return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CARDS);
    if (!raw) return [];
    return JSON.parse(raw) as Card[];
  } catch (err) {
    console.error("[FenrirLedger] Failed to read cards:", err);
    return [];
  }
}

/**
 * Writes the full cards array to localStorage.
 * Private helper — use saveCard() or deleteCard() for individual operations.
 *
 * Dispatches "fenrir:sync" so the SyncIndicator pulses on every real write.
 */
function setAllCards(cards: Card[]): void {
  if (!isBrowser()) return;

  try {
    localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(cards));
    window.dispatchEvent(new CustomEvent("fenrir:sync"));
  } catch (err) {
    console.error("[FenrirLedger] Failed to save cards:", err);
    throw new Error("Failed to save cards. Storage may be full.");
  }
}

/**
 * Reads a single card by ID, including soft-deleted cards.
 * Private raw helper — use getCardById() for UI-facing reads.
 *
 * @param id - The card ID
 * @returns The Card object (deleted or not), or undefined if not found
 */
function getRawCardById(id: string): Card | undefined {
  return getAllCards().find((c) => c.id === id);
}

/**
 * Reads all active (non-deleted) cards across all households.
 *
 * Used by easter eggs (e.g. KonamiHowl) that need a cross-household snapshot
 * without caring about household boundaries.
 *
 * @returns All non-deleted Card objects in storage, unsorted.
 */
export function getAllCardsGlobal(): Card[] {
  return getAllCards().filter((c) => !c.deletedAt);
}

/**
 * Reads all active (non-deleted, non-closed) cards for a given household,
 * sorted by most recently updated. Excludes cards with status === "closed"
 * so they do not appear on the main dashboard.
 *
 * Closed cards are visible via getClosedCards() and the /valhalla route.
 *
 * @param householdId - The household to filter by
 * @returns Array of active, non-closed Card objects for the household
 */
export function getCards(householdId: string): Card[] {
  const all = getAllCards();
  return all
    .filter(
      (c) =>
        c.householdId === householdId &&
        !c.deletedAt &&
        c.status !== "closed"
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

/**
 * Reads all closed (status === "closed") cards for a given household.
 * Excludes soft-deleted cards — a deleted card is gone forever; a closed
 * card is honored in Valhalla.
 *
 * Cards are sorted by closedAt descending (most recently closed first).
 * Falls back to updatedAt for cards that predate the closedAt field.
 *
 * @param householdId - The household to filter by
 * @returns Array of closed Card objects for the household, sorted by closedAt desc
 */
export function getClosedCards(householdId: string): Card[] {
  const all = getAllCards();
  return all
    .filter(
      (c) =>
        c.householdId === householdId &&
        !c.deletedAt &&
        c.status === "closed"
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
 * @param id - The card ID
 * @returns The Card object, or undefined if not found or soft-deleted
 */
export function getCardById(id: string): Card | undefined {
  const card = getRawCardById(id);
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
 * @param card - The Card object to save
 */
export function saveCard(card: Card): void {
  const all = getAllCards();
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
    setAllCards(updated);
  } else {
    // Insert new
    setAllCards([...all, cardWithStatus]);
  }
}

/**
 * Soft-deletes a card by setting its deletedAt timestamp.
 * The record is retained in localStorage; it will no longer appear in any
 * UI-facing read (getCards, getCardById, getAllCardsGlobal).
 * No-op if the card does not exist or is already soft-deleted.
 *
 * @param id - The card ID to soft-delete
 */
export function deleteCard(id: string): void {
  const all = getAllCards();
  const index = all.findIndex((c) => c.id === id);
  if (index < 0) return;

  const card = all[index]!;
  if (card.deletedAt) return; // Already soft-deleted — no-op

  const updated = [...all];
  updated[index] = { ...card, deletedAt: new Date().toISOString() };
  setAllCards(updated);
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
 */
export function closeCard(householdId: string, cardId: string): void {
  const all = getAllCards();
  const index = all.findIndex(
    (c) => c.id === cardId && c.householdId === householdId
  );
  if (index < 0) return;

  const card = all[index]!;
  if (card.deletedAt) return; // Soft-deleted — no-op
  if (card.status === "closed") return; // Already closed — no-op

  const now = new Date().toISOString();
  const updated = [...all];
  updated[index] = {
    ...card,
    status: "closed",
    closedAt: now,
    updatedAt: now,
  };
  setAllCards(updated);
}
