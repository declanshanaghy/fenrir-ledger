/**
 * Fenrir Ledger — Application Constants
 *
 * All magic values are defined here. No magic strings or numbers elsewhere.
 */

import type { Household, Issuer } from "@/lib/types";

/** localStorage key prefix — prevents collisions with other apps on localhost */
export const STORAGE_KEY_PREFIX = "fenrir_ledger";

/** localStorage key names */
export const STORAGE_KEYS = {
  SCHEMA_VERSION: `${STORAGE_KEY_PREFIX}:schema_version`,
  HOUSEHOLDS: `${STORAGE_KEY_PREFIX}:households`,
  CARDS: `${STORAGE_KEY_PREFIX}:cards`,
} as const;

/** Current schema version. Increment when Card or Household interfaces change. */
export const SCHEMA_VERSION = 1;

/** Default household used in Sprint 1 (single-user mode) */
export const DEFAULT_HOUSEHOLD_ID = "default-household";

/** Default household object — created on first app load */
export const DEFAULT_HOUSEHOLD: Household = {
  id: DEFAULT_HOUSEHOLD_ID,
  name: "My Household",
  createdAt: new Date(0).toISOString(), // Epoch — stable across runs
  updatedAt: new Date(0).toISOString(), // Epoch — stable across runs
};

/**
 * Days before annual fee date to show "fee_approaching" status.
 * 60 days gives users enough time to decide: close, downgrade, or keep.
 */
export const FEE_APPROACHING_DAYS = 60;

/**
 * Days before sign-up bonus deadline to show "promo_expiring" status.
 * 30 days — tight enough to prompt action.
 */
export const PROMO_EXPIRING_DAYS = 30;

/** Known card issuers for the issuer dropdown */
export const KNOWN_ISSUERS: Issuer[] = [
  { id: "amex", name: "American Express" },
  { id: "bank_of_america", name: "Bank of America" },
  { id: "barclays", name: "Barclays" },
  { id: "capital_one", name: "Capital One" },
  { id: "chase", name: "Chase" },
  { id: "citibank", name: "Citibank" },
  { id: "discover", name: "Discover" },
  { id: "hsbc", name: "HSBC" },
  { id: "us_bank", name: "US Bank" },
  { id: "wells_fargo", name: "Wells Fargo" },
  { id: "other", name: "Other" },
];

/** Status display labels — plain English (Voice 1: functional) */
export const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  fee_approaching: "Fee Due Soon",
  promo_expiring: "Promo Expiring",
  closed: "Closed",
};

/** Status tooltip text — Norse realm flavor (Voice 2: atmospheric) */
export const STATUS_TOOLTIPS: Record<string, string> = {
  active: "Asgard-bound — rewards flowing, no urgent deadlines",
  fee_approaching: "Muspelheim — annual fee due soon, fire approaches",
  promo_expiring: "Hati approaches — promo deadline draws near",
  closed: "In Valhalla — rewards harvested, chain broken",
};
