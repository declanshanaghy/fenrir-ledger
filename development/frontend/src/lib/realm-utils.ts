/**
 * Fenrir Ledger — Realm Utilities
 *
 * Maps CardStatus values to Norse realm vocabulary for display-layer use.
 * This is the authoritative source for realm labels and descriptions.
 * Types are unchanged — see types.ts for the CardStatus definition.
 *
 * Voice 1 (functional): realm labels are NOT used on primary badges.
 * Voice 2 (atmospheric): realm names appear in tooltips, detail views,
 * and the Loki Mode easter egg.
 *
 * Mythology source: product/mythology-map.md
 * Copy source: product/copywriting.md
 */

import type { CardStatus } from "@/lib/types";

/**
 * Full realm label descriptor returned by getRealmLabel().
 *
 * label      — Short realm name (e.g. "Asgard-bound")
 * sublabel   — Atmospheric one-liner, may include daysRemaining interpolation
 * rune       — Elder Futhark rune character for this realm
 * colorClass — Tailwind text color class using the Norse realm palette
 */
export interface RealmLabel {
  label: string;
  sublabel: string;
  rune: string;
  colorClass: string;
}

/**
 * Returns the full RealmLabel descriptor for a given CardStatus.
 *
 * Used in detail views, Valhalla, and Loki Mode wherever the full realm
 * vocabulary is needed. Never used as the primary status badge label —
 * badges stay functional (Voice 1). Realm names are Voice 2: atmospheric.
 *
 * Mapping (from product/mythology-map.md and ux/interactions.md):
 *   active          → Asgard-bound   (teal   ᛊ  — rewards flowing)
 *   fee_approaching → Muspelheim     (orange ᚲ  — Sköll chasing the sun)
 *   promo_expiring  → Hati approaches(amber  ᚺ  — Hati chasing the moon)
 *   closed          → In Valhalla    (stone  ᛏ  — chain broken)
 *
 * @param status       - The CardStatus to map.
 * @param daysRemaining - Optional days remaining; interpolated into sublabel
 *                        for fee_approaching and promo_expiring.
 * @returns Full RealmLabel descriptor.
 */
export function getRealmLabel(
  status: CardStatus,
  daysRemaining?: number
): RealmLabel {
  switch (status) {
    case "active":
      return {
        label: "Asgard-bound",
        sublabel: "Rewards flowing — no urgent deadlines",
        rune: "ᛊ",
        colorClass: "text-realm-asgard",
      };
    case "fee_approaching":
      return {
        label: "Muspelheim",
        sublabel: `Sköll is ${daysRemaining ?? 0} days behind the sun`,
        rune: "ᚲ",
        colorClass: "text-realm-muspel",
      };
    case "promo_expiring":
      return {
        label: "Hati approaches",
        sublabel: `Hati is ${daysRemaining ?? 0} days behind the moon`,
        rune: "ᚺ",
        colorClass: "text-realm-hati",
      };
    case "closed":
      return {
        label: "In Valhalla",
        sublabel: "Chain broken — rewards harvested",
        rune: "ᛏ",
        colorClass: "text-realm-hel",
      };
    case "bonus_open":
      return {
        label: "Alfheim",
        sublabel: "Light elves guide — bonus window open",
        rune: "ᛅ",
        colorClass: "text-realm-alfheim",
      };
    case "overdue":
      return {
        label: "Niflheim",
        sublabel: "Ice realm — fee past due",
        rune: "ᚾ",
        colorClass: "text-realm-niflheim",
      };
    case "graduated":
      return {
        label: "In Valhalla",
        sublabel: "Minimum spend met — bonus earned",
        rune: "ᛏ",
        colorClass: "text-realm-hel",
      };
  }
}

/**
 * Returns a short Norse-flavoured description for a given CardStatus.
 *
 * Used as tooltip copy on status badges (Voice 2: atmospheric).
 * These match the STATUS_TOOLTIPS in constants.ts; realm-utils.ts is the
 * authoritative source — constants.ts delegates here.
 *
 * Copy source: product/copywriting.md — Status Badges tooltip column.
 *
 * @param status - The CardStatus to describe.
 * @returns A short atmospheric tooltip string.
 */
export function getRealmDescription(status: CardStatus): string {
  switch (status) {
    case "active":
      return "Asgard-bound — rewards flowing, no urgent deadlines";
    case "fee_approaching":
      return "Muspelheim — annual fee due in N days";
    case "promo_expiring":
      return "Hati approaches — promo deadline in N days";
    case "closed":
      return "In Valhalla — rewards harvested";
    case "bonus_open":
      return "Alfheim — bonus window open, earning rewards";
    case "overdue":
      return "Niflheim — annual fee past due";
    case "graduated":
      return "Valhalla — minimum spend met, bonus earned";
  }
}
