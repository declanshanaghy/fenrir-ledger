/**
 * Issuer Utilities — logo paths and display helpers for known card issuers.
 *
 * Each known issuer has a logo path and brand color.
 * Unknown/custom issuers fall back to text initials and no logo.
 *
 * Logos are minimal SVG representations stored in public/static/logos/issuers/.
 * They are used under nominative fair use — identifying the issuer, not
 * implying endorsement.
 */

import { KNOWN_ISSUERS } from "@/lib/constants";

// ── Types ────────────────────────────────────────────────────────────────────

/** Issuer display metadata: logo path and brand color. */
export interface IssuerMeta {
  /** Path to the SVG logo in public/static/logos/issuers/. */
  logoPath: string;
  /** Primary brand color (used for the badge on dark backgrounds). */
  brandColor: string;
}

// ── Issuer Metadata ───────────────────────────────────────────────────────────

/**
 * Maps issuer IDs to their logo and brand color metadata.
 */
const ISSUER_META: Record<string, IssuerMeta> = {
  chase: {
    logoPath: "/issuers/chase.svg",
    brandColor: "#0060A9",
  },
  bank_of_america: {
    logoPath: "/issuers/bank-of-america.svg",
    brandColor: "#E31837",
  },
  capital_one: {
    logoPath: "/issuers/capital-one.svg",
    brandColor: "#D03027",
  },
  wells_fargo: {
    logoPath: "/issuers/wells-fargo.svg",
    brandColor: "#D71E28",
  },
  amex: {
    logoPath: "/issuers/amex.svg",
    brandColor: "#006FCF",
  },
  citibank: {
    logoPath: "/issuers/citi.svg",
    brandColor: "#003B70",
  },
  discover: {
    logoPath: "/issuers/discover.svg",
    brandColor: "#FF6600",
  },
  us_bank: {
    logoPath: "/issuers/us-bank.svg",
    brandColor: "#D50032",
  },
  barclays: {
    logoPath: "/issuers/barclays.svg",
    brandColor: "#00AEEF",
  },
  hsbc: {
    logoPath: "/issuers/hsbc.svg",
    brandColor: "#DB0011",
  },
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the IssuerMeta for a known issuer, or null for unknown/custom issuers.
 *
 * @param issuerId - The issuer ID from the card data (e.g. "chase", "amex").
 * @returns IssuerMeta if the issuer has logo metadata, null otherwise.
 */
export function getIssuerMeta(issuerId: string): IssuerMeta | null {
  return ISSUER_META[issuerId] ?? null;
}

/**
 * Returns the logo path for a known issuer, or null for unknown issuers.
 *
 * @param issuerId - The issuer ID.
 * @returns Path to the SVG logo (relative to public/), or null.
 */
export function getIssuerLogoPath(issuerId: string): string | null {
  return ISSUER_META[issuerId]?.logoPath ?? null;
}

/**
 * Returns the human-readable issuer name from the issuer ID.
 * Centralised here so all components use the same lookup.
 *
 * @param issuerId - The issuer ID from KNOWN_ISSUERS.
 * @returns The display name, or the raw issuerId as fallback.
 */
export function getIssuerName(issuerId: string): string {
  const issuer = KNOWN_ISSUERS.find((i) => i.id === issuerId);
  return issuer?.name ?? issuerId;
}

/**
 * Derives 1-2 character initials from the issuer name.
 * Used as fallback when no logo is available (unknown/custom issuers).
 *
 * Multi-word names (e.g. "Capital One") produce "CO" (first letter of each word).
 * Single-word names (e.g. "Chase") produce "C" (first letter only).
 *
 * @param issuerId - The issuer ID.
 * @returns 1-2 uppercase initials.
 */
export function getIssuerInitials(issuerId: string): string {
  const name = getIssuerName(issuerId);
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return name[0]!.toUpperCase();
}

/**
 * Returns the display character for the StatusRing badge.
 * Uses initials derived from the issuer name.
 *
 * @param issuerId - The issuer ID.
 * @returns Initials string.
 */
export function getIssuerBadgeChar(issuerId: string): string {
  return getIssuerInitials(issuerId);
}
