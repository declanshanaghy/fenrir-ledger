/**
 * Fenrir Ledger — Test Fixtures
 *
 * Factory functions for creating Card objects and seeding localStorage in Playwright
 * browser contexts. All helpers are spec-derived — they reflect the data contracts
 * in src/lib/types.ts and the storage key format in src/lib/storage.ts.
 *
 * localStorage key format (from storage.ts):
 *   fenrir_ledger:{householdId}:cards      → Card[] (JSON array)
 *   fenrir_ledger:{householdId}:household  → Household (JSON object)
 *   fenrir:household                       → householdId string (active session pointer)
 *
 * Usage:
 *   import { makeCard, seedCards, clearAllStorage, ANONYMOUS_HOUSEHOLD_ID } from "./test-fixtures";
 */

import type { Page } from "@playwright/test";

// ─── Re-export Card type for test files ──────────────────────────────────────

/**
 * Card interface — mirrors src/lib/types.ts.
 * Re-exported here so test files have a single import source.
 */
export interface SignUpBonus {
  type: "points" | "miles" | "cashback";
  amount: number;
  spendRequirement: number;
  deadline: string;
  met: boolean;
}

export type CardStatus = "active" | "fee_approaching" | "promo_expiring" | "closed" | "bonus_open" | "overdue" | "graduated";

export interface Card {
  id: string;
  householdId: string;
  issuerId: string;
  cardName: string;
  openDate: string;
  creditLimit: number;
  annualFee: number;
  annualFeeDate: string;
  promoPeriodMonths: number;
  signUpBonus: SignUpBonus | null;
  status: CardStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  closedAt?: string;
}

export interface Household {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Stable householdId used across all test fixtures. */
export const ANONYMOUS_HOUSEHOLD_ID = "test-household-id";

/** localStorage key prefix — must match STORAGE_KEY_PREFIX in src/lib/constants.ts */
const STORAGE_KEY_PREFIX = "fenrir_ledger";

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns an ISO 8601 UTC timestamp N days from now. */
function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Returns an ISO 8601 UTC timestamp N days in the past. */
function daysAgo(days: number): string {
  return daysFromNow(-days);
}

/** Returns a simple UUID v4 string (not crypto.randomUUID — works in Node context). */
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Card Factories ───────────────────────────────────────────────────────────

/**
 * Creates a valid Card with sensible defaults.
 * Any field can be overridden via the overrides parameter.
 *
 * Defaults:
 *   - status: "active"
 *   - issuerId: "chase"
 *   - cardName: "Test Card"
 *   - annualFee: 9500 cents ($95)
 *   - annualFeeDate: 365 days from now (well outside fee_approaching window)
 *   - signUpBonus: null (no promo)
 *   - creditLimit: 500000 cents ($5,000)
 */
export function makeCard(overrides?: Partial<Card>): Card {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    householdId: ANONYMOUS_HOUSEHOLD_ID,
    issuerId: "chase",
    cardName: "Test Card",
    openDate: daysAgo(180),
    creditLimit: 500000,
    annualFee: 9500,
    annualFeeDate: daysFromNow(365),
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Creates a Card with annualFeeDate 30 days from now (within the 60-day
 * fee_approaching window). Status is explicitly set to "fee_approaching".
 *
 * Use for testing dashboard urgent states and Ragnarök threshold.
 */
export function makeUrgentCard(overrides?: Partial<Card>): Card {
  return makeCard({
    cardName: "Urgent Fee Card",
    annualFee: 55000, // $550
    annualFeeDate: daysFromNow(30),
    status: "fee_approaching",
    ...overrides,
  });
}

/**
 * Creates a Card with a sign-up bonus deadline 20 days from now (within the
 * 30-day promo_expiring window). Status is explicitly set to "promo_expiring".
 *
 * Use for testing promo expiry states and bonus tracking.
 */
export function makePromoCard(overrides?: Partial<Card>): Card {
  return makeCard({
    cardName: "Promo Expiring Card",
    issuerId: "amex",
    promoPeriodMonths: 3,
    signUpBonus: {
      type: "points",
      amount: 60000,
      spendRequirement: 400000, // $4,000
      deadline: daysFromNow(20),
      met: false,
    },
    status: "promo_expiring",
    ...overrides,
  });
}

/**
 * Creates a Card that has been closed (status === "closed", closedAt set).
 * This card will appear in Valhalla (/valhalla) but not on the dashboard.
 *
 * Use for testing Valhalla display and closed card handling.
 */
export function makeClosedCard(overrides?: Partial<Card>): Card {
  const closedAt = daysAgo(14);
  return makeCard({
    cardName: "Closed Card",
    issuerId: "capital_one",
    status: "closed",
    closedAt,
    updatedAt: closedAt,
    ...overrides,
  });
}

// ─── localStorage Seeders ────────────────────────────────────────────────────

/**
 * Seeds cards into localStorage for a given household.
 * Writes the cards array to `fenrir_ledger:{householdId}:cards`.
 *
 * This function uses page.evaluate() and runs in the browser context.
 * Call it AFTER page.goto() so the browser context is initialized.
 *
 * @param page - Playwright Page
 * @param householdId - The household ID (becomes part of the storage key)
 * @param cards - Array of Card objects to write
 */
export async function seedCards(
  page: Page,
  householdId: string,
  cards: Card[]
): Promise<void> {
  const storageKey = `${STORAGE_KEY_PREFIX}:${householdId}:cards`;
  await page.evaluate(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value);
    },
    { key: storageKey, value: JSON.stringify(cards) }
  );
}

/**
 * Seeds a household record into localStorage and sets the active household pointer.
 * Writes:
 *   - `fenrir_ledger:{householdId}:household` → Household JSON
 *   - `fenrir:household` → householdId string
 *
 * This function uses page.evaluate() and runs in the browser context.
 * Call it AFTER page.goto() so the browser context is initialized.
 *
 * @param page - Playwright Page
 * @param householdId - The household ID to seed and activate
 */
export async function seedHousehold(
  page: Page,
  householdId: string
): Promise<void> {
  const now = new Date().toISOString();
  const household: Household = {
    id: householdId,
    name: "Test Household",
    createdAt: now,
    updatedAt: now,
  };

  const householdStorageKey = `${STORAGE_KEY_PREFIX}:${householdId}:household`;

  await page.evaluate(
    ({
      householdKey,
      householdValue,
      activeKey,
      activeValue,
    }: {
      householdKey: string;
      householdValue: string;
      activeKey: string;
      activeValue: string;
    }) => {
      localStorage.setItem(householdKey, householdValue);
      localStorage.setItem(activeKey, activeValue);
    },
    {
      householdKey: householdStorageKey,
      householdValue: JSON.stringify(household),
      activeKey: "fenrir:household",
      activeValue: householdId,
    }
  );
}

/**
 * Clears all Fenrir Ledger keys from localStorage.
 * Removes every key that starts with "fenrir_ledger:" or "fenrir:".
 *
 * Use in test teardown or beforeEach to guarantee a clean slate.
 * Safe to call on an empty localStorage — no errors if keys are absent.
 *
 * @param page - Playwright Page
 */
export async function clearAllStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("fenrir_ledger:") || key.startsWith("fenrir:"))) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Retrieves all cards for a given household from localStorage.
 * Returns an empty array if no cards are stored.
 *
 * @param page - Playwright Page
 * @param householdId - The household ID to retrieve cards for
 * @returns Array of Card objects
 */
export async function getCards(page: Page, householdId: string): Promise<Card[]> {
  const storageKey = `${STORAGE_KEY_PREFIX}:${householdId}:cards`;
  const cards = await page.evaluate((key: string) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }, storageKey);
  return cards as Card[];
}

/**
 * Seeds an entitlement (subscription status) into localStorage for feature gate testing.
 * Writes to `fenrir:entitlement` with the given tier and activation status.
 *
 * Use for testing feature-gated UI like Valhalla (requires "karl" tier).
 *
 * @param page - Playwright Page
 * @param tier - Subscription tier ("free", "thrall", "karl")
 * @param isActive - Whether the subscription is currently active
 */
export async function seedEntitlement(
  page: Page,
  tier: "free" | "thrall" | "karl" = "karl",
  isActive: boolean = true
): Promise<void> {
  const entitlementCacheKey = "fenrir:entitlement";
  const entitlementData = {
    tier,
    isActive,
    isLinked: isActive,
    platform: "stripe",
    stripeStatus: isActive ? "active" : "inactive",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  await page.evaluate(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value);
    },
    { key: entitlementCacheKey, value: JSON.stringify(entitlementData) }
  );
}
