/**
 * Issuer Utilities — Rune mappings and logo paths for known card issuers.
 *
 * Each known issuer is assigned a unique Elder Futhark rune and a logo path.
 * Unknown/custom issuers fall back to text initials and no logo.
 *
 * Rune assignments follow the mythology map — each rune's meaning connects
 * thematically to the issuer's brand identity.
 *
 * Logos are minimal SVG representations stored in public/static/logos/issuers/.
 * They are used under nominative fair use — identifying the issuer, not
 * implying endorsement.
 */

import { KNOWN_ISSUERS } from "@/lib/constants";

// ── Types ────────────────────────────────────────────────────────────────────

/** Issuer display metadata: rune, logo path, and brand color. */
export interface IssuerMeta {
  /** The Elder Futhark rune character assigned to this issuer. */
  rune: string;
  /** Rune name in Old Norse (for tooltip). */
  runeName: string;
  /** Thematic connection between rune meaning and issuer brand. */
  runeConnection: string;
  /** Path to the SVG logo in public/static/logos/issuers/. */
  logoPath: string;
  /** Primary brand color (used for the rune badge on dark backgrounds). */
  brandColor: string;
}

// ── Rune Mapping ─────────────────────────────────────────────────────────────

/**
 * Maps issuer IDs to their Elder Futhark rune and logo metadata.
 *
 * Each rune is unique — no two issuers share a rune.
 */
const ISSUER_META: Record<string, IssuerMeta> = {
  chase: {
    rune: "ᚱ",       // Raidho
    runeName: "Raidho",
    runeConnection: "Journeys, movement (sapphire travel cards)",
    logoPath: "/static/logos/issuers/chase.svg",
    brandColor: "#0060A9",
  },
  bank_of_america: {
    rune: "ᚠ",       // Fehu
    runeName: "Fehu",
    runeConnection: "Wealth, cattle (America's bank)",
    logoPath: "/static/logos/issuers/bank-of-america.svg",
    brandColor: "#E31837",
  },
  capital_one: {
    rune: "ᚦ",       // Thurisaz
    runeName: "Thurisaz",
    runeConnection: "Power, force (what's in your wallet)",
    logoPath: "/static/logos/issuers/capital-one.svg",
    brandColor: "#D03027",
  },
  wells_fargo: {
    rune: "ᚹ",       // Wunjo
    runeName: "Wunjo",
    runeConnection: "Joy, prosperity (stagecoach)",
    logoPath: "/static/logos/issuers/wells-fargo.svg",
    brandColor: "#D71E28",
  },
  amex: {
    rune: "ᛊ",       // Sowilo
    runeName: "Sowilo",
    runeConnection: "Sun, success (premium)",
    logoPath: "/static/logos/issuers/amex.svg",
    brandColor: "#006FCF",
  },
  citibank: {
    rune: "ᛁ",       // Isa
    runeName: "Isa",
    runeConnection: "Ice, focus (global reach)",
    logoPath: "/static/logos/issuers/citi.svg",
    brandColor: "#003B70",
  },
  discover: {
    rune: "ᚾ",       // Naudiz
    runeName: "Naudiz",
    runeConnection: "Need, discovery",
    logoPath: "/static/logos/issuers/discover.svg",
    brandColor: "#FF6600",
  },
  us_bank: {
    rune: "ᚢ",       // Uruz
    runeName: "Uruz",
    runeConnection: "Strength, endurance",
    logoPath: "/static/logos/issuers/us-bank.svg",
    brandColor: "#D50032",
  },
  barclays: {
    rune: "ᚷ",       // Gebo
    runeName: "Gebo",
    runeConnection: "Gift, partnership (global banking)",
    logoPath: "/static/logos/issuers/barclays.svg",
    brandColor: "#00AEEF",
  },
  hsbc: {
    rune: "ᛇ",       // Ehwaz
    runeName: "Ehwaz",
    runeConnection: "Horse, movement (worldwide presence)",
    logoPath: "/static/logos/issuers/hsbc.svg",
    brandColor: "#DB0011",
  },
};

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the IssuerMeta for a known issuer, or null for unknown/custom issuers.
 *
 * @param issuerId - The issuer ID from the card data (e.g. "chase", "amex").
 * @returns IssuerMeta if the issuer has a rune mapping, null otherwise.
 */
export function getIssuerMeta(issuerId: string): IssuerMeta | null {
  return ISSUER_META[issuerId] ?? null;
}

/**
 * Returns the Elder Futhark rune for a known issuer, or null for unknown issuers.
 * Used by StatusRing and card badge components.
 *
 * @param issuerId - The issuer ID.
 * @returns The rune character string, or null.
 */
export function getIssuerRune(issuerId: string): string | null {
  return ISSUER_META[issuerId]?.rune ?? null;
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
 * Used as fallback when no rune is available (unknown/custom issuers).
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
 * Known issuers get their rune; unknown issuers get initials.
 *
 * @param issuerId - The issuer ID.
 * @returns The rune character or initials string.
 */
export function getIssuerBadgeChar(issuerId: string): string {
  return getIssuerRune(issuerId) ?? getIssuerInitials(issuerId);
}
