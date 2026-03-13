/**
 * Free Trial Page — /free-trial
 *
 * Sells the 30-day free trial experience with first-person wolf voice.
 * Fenrir speaks directly to the reader throughout.
 *
 * Sections:
 *   1. Hero — "I Hunt For 30 Days. Free."
 *   2. Feature Showcase — 7 compact cards in 3-col grid
 *   3. Timeline — 3-step 30-day journey (Day 1 / Day 15 / Day 30)
 *   4. After Trial — Thrall vs Karl tier comparison
 *   5. Final CTA — "Unleash Me"
 *
 * Wireframe: ux/wireframes/marketing-site/free-trial.html
 * Issue: #636
 * export const dynamic = "force-static" — no server data fetching.
 */

import type { Metadata } from "next";
import { FreeTrialContent } from "./FreeTrialContent";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Free Trial — Fenrir Ledger | Unleash the Wolf",
  description:
    "30-day free trial of Fenrir Ledger — the wolf-guarded credit card tracker. Track fees, bonuses, and deadlines. Full Karl access, no credit card required.",
  keywords:
    "free credit card tracker trial, credit card churn tracker free trial, annual fee tracker, sign-up bonus tracker",
  openGraph: {
    title: "I Hunt For 30 Days. Free. — Fenrir Ledger",
    description:
      "Give me thirty days. I will guard every card, every fee, every deadline. No credit card. No chains.",
  },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FreeTrialPage() {
  return <FreeTrialContent />;
}
