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
 * Returns the Norse realm name for a given CardStatus.
 *
 * Used as tooltip flavor text and in the Loki Mode easter egg.
 * Never used as the primary status badge label — badges stay functional
 * (Voice 1). Realm names are Voice 2: atmospheric only.
 *
 * Mapping (from product/mythology-map.md):
 *   active         → Asgard   (home of gods, abundance — rewards flowing)
 *   fee_approaching → Muspelheim (fire, destruction — fee due soon)
 *   promo_expiring  → Jötunheimr (chaos, unpredictability — deadline approaching)
 *   closed          → Valhalla   (hall of heroes — rewards harvested)
 *
 * @param status - The CardStatus to map.
 * @returns The Norse realm name string.
 */
export function getRealmLabel(status: CardStatus): string {
  switch (status) {
    case "active":
      return "Asgard";
    case "fee_approaching":
      return "Muspelheim";
    case "promo_expiring":
      return "Jötunheimr";
    case "closed":
      return "Valhalla";
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
      return "Muspelheim — annual fee due soon, fire approaches";
    case "promo_expiring":
      return "Hati approaches — promo deadline draws near";
    case "closed":
      return "In Valhalla — rewards harvested, chain broken";
  }
}
