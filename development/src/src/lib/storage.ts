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

  // Future migrations:
  // if (fromVersion < 2 && toVersion >= 2) { ... }
}

// ─── Household Operations ─────────────────────────────────────────────────────

/**
 * Reads all households from localStorage.
 *
 * @returns Array of Household objects. Empty array if none exist or on error.
 */
export function getHouseholds(): Household[] {
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
 * Writes the full households array to localStorage.
 *
 * @param households - Complete array of Household objects to persist
 */
export function saveHouseholds(households: Household[]): void {
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
 *
 * @returns The default Household object
 */
export function initializeDefaultHousehold(): Household {
  if (!isBrowser()) return DEFAULT_HOUSEHOLD;

  const households = getHouseholds();
  const existing = households.find((h) => h.id === DEFAULT_HOUSEHOLD_ID);

  if (existing) {
    return existing;
  }

  const newHousehold: Household = {
    ...DEFAULT_HOUSEHOLD,
    createdAt: new Date().toISOString(),
  };

  saveHouseholds([...households, newHousehold]);
  return newHousehold;
}

// ─── Card Operations ──────────────────────────────────────────────────────────

/**
 * Reads all cards from localStorage (all households).
 * Internal helper — use getCards(householdId) for filtered results.
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
 * Internal helper — use saveCard() or deleteCard() for individual operations.
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
 * Reads all cards across all households.
 *
 * Used by easter eggs (e.g. KonamiHowl) that need a cross-household snapshot
 * without caring about household boundaries.
 *
 * @returns All Card objects in storage, unsorted.
 */
export function getAllCardsGlobal(): Card[] {
  return getAllCards();
}

/**
 * Reads all cards for a given household, sorted by most recently updated.
 *
 * @param householdId - The household to filter by
 * @returns Array of Card objects for the household
 */
export function getCards(householdId: string): Card[] {
  const all = getAllCards();
  return all
    .filter((c) => c.householdId === householdId)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

/**
 * Reads a single card by ID.
 *
 * @param id - The card ID
 * @returns The Card object, or undefined if not found
 */
export function getCardById(id: string): Card | undefined {
  const all = getAllCards();
  return all.find((c) => c.id === id);
}

/**
 * Saves a card (insert or update).
 * Recomputes the card status before saving.
 *
 * If a card with the same ID exists, it is replaced.
 * If no card with that ID exists, the card is appended.
 *
 * @param card - The Card object to save
 */
export function saveCard(card: Card): void {
  const all = getAllCards();

  // Recompute status before saving
  const cardWithStatus: Card = {
    ...card,
    status: computeCardStatus(card),
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = all.findIndex((c) => c.id === card.id);

  if (existingIndex >= 0) {
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
 * Deletes a card by ID.
 * No-op if the card does not exist.
 *
 * @param id - The card ID to delete
 */
export function deleteCard(id: string): void {
  const all = getAllCards();
  setAllCards(all.filter((c) => c.id !== id));
}
