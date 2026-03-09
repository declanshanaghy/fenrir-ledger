/**
 * Feature Descriptions — Fenrir Ledger
 *
 * Norse-themed descriptions for each premium feature, used by the
 * Sealed Rune Modal (hard gate) and upsell banners.
 *
 * Each feature has:
 *   - description: Voice 1 (functional) — what the feature does
 *   - atmospheric: Voice 2 (Norse) — atmospheric encouragement (italic)
 *   - expiredAtmospheric: Voice 2 for expired users — welcoming, not punitive
 *
 * @module entitlement/feature-descriptions
 */

import type { PremiumFeature } from "./types";

export interface FeatureDescription {
  /** Voice 1 — plain English description of what the feature does */
  description: string;
  /** Voice 2 — Norse atmospheric encouragement (displayed italic) */
  atmospheric: string;
  /** Voice 2 — atmospheric copy for expired users (welcoming, not punitive) */
  expiredAtmospheric: string;
}

/**
 * Registry of feature descriptions for the hard gate modal and upsell banners.
 * Keyed by PremiumFeature slug.
 */
export const FEATURE_DESCRIPTIONS: Record<PremiumFeature, FeatureDescription> = {
  "cloud-sync": {
    description:
      "Sync your card data across all your devices. Never lose your ledger.",
    atmospheric: "The wolf who roams far keeps his saga close.",
    expiredAtmospheric:
      "The hall remembers your name, Karl. Return and reclaim your seat.",
  },
  "multi-household": {
    description:
      "Track cards for multiple households under a single account.",
    atmospheric: "One wolf may guard many dens.",
    expiredAtmospheric:
      "Your dens still stand. Return and tend them once more.",
  },
  "advanced-analytics": {
    description:
      "Detailed breakdowns of your fees, rewards, and card performance over time.",
    atmospheric: "The raven sees farther than the eye.",
    expiredAtmospheric:
      "The ravens still circle. They await your command.",
  },
  "data-export": {
    description: "Export your card data as CSV or JSON for use anywhere.",
    atmospheric: "Carry the runes beyond these walls.",
    expiredAtmospheric:
      "The gate was open once. It can be opened again.",
  },
  "extended-history": {
    description:
      "Access your full card history, including closed cards and past rewards.",
    atmospheric: "The saga is long. Every chapter matters.",
    expiredAtmospheric:
      "Your saga is still written. Return to read it in full.",
  },
  "cosmetic-perks": {
    description:
      "Unlock exclusive themes, card styles, and visual customizations.",
    atmospheric: "Even the wolf adorns his pelt for the feast.",
    expiredAtmospheric:
      "Your finery awaits in the hall. Return and wear it once more.",
  },
  "howl-panel": {
    description:
      "Proactive fee alerts and promo deadline warnings — the wolf watches your chains so you never miss a critical date.",
    atmospheric: "The wolf who listens hears the chain before it breaks.",
    expiredAtmospheric:
      "The wolf still watches. Return and heed his warning once more.",
  },
};
