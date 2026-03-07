/**
 * Fenrir Ledger — Application Constants
 *
 * All magic values are defined here. No magic strings or numbers elsewhere.
 *
 * Sprint 3.1 change: DEFAULT_HOUSEHOLD_ID and DEFAULT_HOUSEHOLD have been removed.
 * The householdId is now always derived from the authenticated session (Google sub claim).
 * See ADR-004 for the decision.
 */

import type { CardStatus, Issuer } from "@/lib/types";
import { getRealmDescription } from "@/lib/realm-utils";

/** localStorage key prefix — prevents collisions with other apps on localhost */
export const STORAGE_KEY_PREFIX = "fenrir_ledger";

/**
 * Global localStorage key names (not per-household).
 * Per-household keys are constructed dynamically in storage.ts using
 * `${STORAGE_KEY_PREFIX}:{householdId}:cards` and
 * `${STORAGE_KEY_PREFIX}:{householdId}:household`.
 */
export const STORAGE_KEYS = {
  /** Global schema version key — not namespaced by household */
  SCHEMA_VERSION: `${STORAGE_KEY_PREFIX}:schema_version`,
} as const;

/** Current schema version. Increment when Card or Household interfaces change. */
export const SCHEMA_VERSION = 1;

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
  bonus_open: "Bonus Open",
  overdue: "Overdue",
};

/**
 * Status tooltip text — Norse realm flavor (Voice 2: atmospheric).
 * Authoritative source is realm-utils.ts getRealmDescription().
 * This record delegates to that function for consistency.
 */
export const STATUS_TOOLTIPS: Record<CardStatus, string> = {
  active: getRealmDescription("active"),
  fee_approaching: getRealmDescription("fee_approaching"),
  promo_expiring: getRealmDescription("promo_expiring"),
  closed: getRealmDescription("closed"),
  bonus_open: getRealmDescription("bonus_open"),
  overdue: getRealmDescription("overdue"),
};
