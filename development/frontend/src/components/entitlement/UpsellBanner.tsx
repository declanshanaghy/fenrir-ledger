"use client";

/**
 * UpsellBanner -- Fenrir Ledger
 *
 * A non-aggressive, contextual banner shown to Thrall users promoting
 * Karl tier upgrade via Stripe subscription.
 *
 * Wireframe reference:
 *   - ux/wireframes/stripe-direct/upsell-banner-stripe.html
 *
 * Anatomy:
 *   [Atmospheric line (Voice 2, hidden mobile)]
 *   [Value prop description (Voice 1)]
 *   [Upgrade to Karl] [x dismiss]
 *
 * @module entitlement/UpsellBanner
 */

import { useState, useCallback, useEffect } from "react";
import { useEntitlement } from "@/hooks/useEntitlement";
import type { PremiumFeature } from "@/lib/entitlement/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** localStorage key for tracking banner dismissal (permanent) */
const DISMISS_KEY = "fenrir:stripe_upsell_dismissed";

/** Default feature to promote in the banner */
const PROMOTED_FEATURE: PremiumFeature = "cloud-sync";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UpsellBannerProps {
  /** Optional: which feature to promote. Defaults to cloud-sync. */
  feature?: PremiumFeature;
}

// ---------------------------------------------------------------------------
// Dismissal helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether the upsell banner should be shown based on dismissal state.
 *
 * @returns true if the banner should be visible
 */
function shouldShowBanner(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return localStorage.getItem(DISMISS_KEY) !== "true";
  } catch {
    return true;
  }
}

/**
 * Records the dismissal.
 */
function dismissBanner(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(DISMISS_KEY, "true");
  } catch {
    // localStorage full or blocked
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Upsell banner for promoting Karl tier to Thrall users.
 *
 * Shows to all Thrall users (anon + auth). CTA redirects to Stripe Checkout.
 *
 * @param props - Optional feature to promote
 */
export function UpsellBanner({ feature = PROMOTED_FEATURE }: UpsellBannerProps) {
  const { tier, isLoading, hasFeature, subscribeStripe } = useEntitlement();
  const [visible, setVisible] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Check visibility on mount (client-side only)
  useEffect(() => {
    if (!isLoading) {
      setVisible(shouldShowBanner());
    }
  }, [isLoading]);

  const handleDismiss = useCallback(() => {
    dismissBanner();
    setVisible(false);
  }, []);

  const handleStripeUpgrade = useCallback(async () => {
    setIsSubscribing(true);
    try {
      await subscribeStripe();
    } catch {
      setIsSubscribing(false);
    }
  }, [subscribeStripe]);

  // Do not render for:
  //   - Users who already have the feature (Karl tier)
  //   - Loading state
  //   - Dismissed banner
  if (isLoading) return null;
  if (hasFeature(feature)) return null;
  if (tier !== "thrall") return null;
  if (!visible) return null;

  return (
    <div
      className="relative border border-gold/20 bg-background/60 p-4 md:px-5 flex flex-col md:flex-row gap-3 md:items-center rounded-sm"
      role="region"
      aria-label="Upgrade your subscription"
    >
      {/* Dismiss button */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 w-8 h-8 min-w-[44px] min-h-[44px] flex items-center justify-center text-rune/60 hover:text-saga transition-colors"
        aria-label="Dismiss upgrade banner"
      >
        <span aria-hidden="true" className="text-sm">&times;</span>
      </button>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-0.5 pr-8 md:pr-0">
        {/* Voice 2: atmospheric (hidden on mobile) */}
        <span className="hidden sm:block text-[11px] italic text-rune/60 font-body">
          The wolf hunts greater prey for those who forge the bond.
        </span>
        {/* Voice 1: functional value prop */}
        <span className="text-xs text-saga/80 leading-snug font-body">
          Upgrade to Karl for cloud sync, priority alerts, and advanced analytics -- $3.99/month.
        </span>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={handleStripeUpgrade}
        disabled={isSubscribing}
        className={[
          "self-start md:self-center px-3.5 py-1.5 text-xs font-heading font-bold tracking-wide",
          "border border-gold/50 text-gold",
          "hover:bg-gold/10 transition-colors",
          "rounded-sm whitespace-nowrap min-h-[36px]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        ].join(" ")}
      >
        {isSubscribing ? "Starting..." : "Upgrade to Karl"}
      </button>
    </div>
  );
}
