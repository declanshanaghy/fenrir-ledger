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
 * Fixed household ID used for anonymous card storage.
 * Anonymous users have no Google sub, so cards are stored under this sentinel.
 * On sign-in, cards are re-scoped to the authenticated user's householdId.
 *
 * Storage key: fenrir_ledger:anon:cards
 *
 * See Issue #1671 for the anonymous card storage model.
 */
export const ANON_HOUSEHOLD_ID = "anon";

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
  graduated: "Graduated",
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
  graduated: getRealmDescription("graduated"),
};

// ─── Dashboard tab types ─────────────────────────────────────────────────────

/** Dashboard tab identifiers — used by TabHeader and TabSummary components */
export type DashboardTab = "howl" | "hunt" | "active" | "valhalla" | "all" | "trash";

/**
 * Tab header content — static text for each dashboard tab.
 *
 * Defines the title (with rune prefix), purpose description, and status labels
 * shown in the dismissable TabHeader component.
 *
 * Copy source: ux/wireframes/chrome/dashboard-tab-headers.html — Reference table
 */
export const TAB_HEADER_CONTENT: Record<
  DashboardTab,
  { title: string; description: string; statuses: string }
> = {
  all: {
    title: "ᛟ All Cards — The Full Ledger",
    description:
      "Every card in your portfolio, regardless of status. The complete record of every chain forged, every hunt begun, every warrior that earned its place in the hall.",
    statuses:
      "All status labels appear here: Active | Fee Due Soon | Promo Expiring | Overdue | Bonus Open | Closed | Graduated",
  },
  valhalla: {
    title: "↑ Valhalla — Hall of the Honored Dead",
    description:
      "Cards that have completed their journey. Closed cards and cards that graduated after earning their sign-up bonus rest here. Their rewards were harvested. Their chains were broken.",
    statuses: "Status labels in this tab: Closed | Graduated",
  },
  active: {
    title: "ᛉ Active Cards — Asgard\u2019s Warriors",
    description:
      "Cards in good standing with no urgent deadlines. These are your reliable earners — rewards are flowing and no fees are imminent.",
    statuses:
      "Status label in this tab: Active — card is open, no bonus window, no approaching fee",
  },
  hunt: {
    title: "ᛜ The Hunt — Pursue the Plunder",
    description:
      "Cards with open sign-up bonus windows. You are actively hunting the welcome mead — track your spending progress and hit the threshold before the deadline.",
    statuses:
      "Status label in this tab: Bonus Open — sign-up bonus spending window is active",
  },
  howl: {
    title: "ᚲ The Howl — Where Chains Tighten",
    description:
      "Cards shown here demand your attention. Annual fees are approaching, promotional rates are expiring, or deadlines have already passed. These are the chains that will tighten if ignored.",
    statuses:
      "Status labels in this tab: Fee Due Soon — annual fee due within 30 days | Promo Expiring — promotional rate ending soon | Overdue — a deadline has passed",
  },
  trash: {
    title: "ᛞ Trash — The Void",
    description:
      "Cards that have been deleted from your ledger. Restore a card to return it to active status, or expunge it permanently from this device. Trash is always local — only restored cards may sync.",
    statuses: "Cards in this tab have been soft-deleted (deletedAt is set). They are not visible anywhere else in the ledger.",
  },
};

/**
 * Rich tooltip content for status badges — follows the Two-Voice Rule.
 *
 * Each entry has:
 *   label   — bold status name (Voice 1: functional)
 *   meaning — plain English explanation (Voice 1: functional)
 *   flavor  — Norse atmospheric one-liner (Voice 2: atmospheric)
 *
 * Interaction spec: ux/wireframes/chrome/dashboard-tab-headers-interaction-spec.md § 3
 * Copy source: product/copywriting.md — Status Badges table
 */
export const TOOLTIP_CONTENT: Record<
  CardStatus,
  { label: string; meaning: string; flavor: string }
> = {
  active: {
    label: "Active",
    meaning: "Card is in good standing with no urgent deadlines.",
    flavor: "Asgard-bound — rewards flowing, no urgent deadlines",
  },
  fee_approaching: {
    label: "Fee Due Soon",
    meaning: "Annual fee is due within 60 days. Decide: keep, downgrade, or close.",
    flavor: "Muspelheim — the fee-serpent stirs",
  },
  promo_expiring: {
    label: "Promo Expiring",
    meaning: "Sign-up bonus deadline is approaching. Meet your spend requirement.",
    flavor: "Hati approaches — the moon wanes",
  },
  closed: {
    label: "Closed",
    meaning: "Card has been closed. Rewards were harvested.",
    flavor: "In Valhalla — chain broken, plunder secured",
  },
  bonus_open: {
    label: "Bonus Open",
    meaning: "Sign-up bonus window is open. Earn rewards by meeting the spend target.",
    flavor: "Alfheim — light elves guide your spending",
  },
  overdue: {
    label: "Overdue",
    meaning: "Annual fee is past due. Take action to avoid penalties.",
    flavor: "Niflheim — Gleipnir tightens",
  },
  graduated: {
    label: "Graduated",
    meaning: "Minimum spend met and bonus earned. Well played.",
    flavor: "Valhalla — the mead-hall toll is paid",
  },
};
