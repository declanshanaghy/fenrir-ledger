"use client";

/**
 * UpsellBanner -- Fenrir Ledger
 *
 * A non-aggressive, contextual banner shown to Thrall users promoting
 * Karl tier upgrade. Works with both Patreon and Stripe platforms.
 *
 * Wireframe references:
 *   - Patreon: designs/ux-design/wireframes/patreon-subscription/upsell-banner-premium.html
 *   - Stripe: ux/wireframes/stripe-direct/upsell-banner-stripe.html
 *
 * Key differences by platform:
 *   - Patreon: CTA opens the Sealed Rune Modal. Shown to authenticated users only.
 *   - Stripe: CTA redirects to Stripe Checkout. Shown to all Thrall users (anon + auth).
 *     Anonymous users see the email modal first.
 *
 * Anatomy (Stripe mode):
 *   [Atmospheric line (Voice 2, hidden mobile)]
 *   [Value prop description (Voice 1)]
 *   [Upgrade to Karl] [x dismiss]
 *
 * @module entitlement/UpsellBanner
 */

import { useState, useCallback, useEffect } from "react";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useAuth } from "@/hooks/useAuth";
import { SealedRuneModal } from "./SealedRuneModal";
import type { PremiumFeature } from "@/lib/entitlement/types";
import { isPatreon, isStripe } from "@/lib/feature-flags";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** localStorage key for tracking Patreon banner dismissal (time-based) */
const PATREON_DISMISS_KEY = "fenrir:upsell-dismissed";

/** localStorage key for tracking Stripe banner dismissal (permanent) */
const STRIPE_DISMISS_KEY = "fenrir:stripe_upsell_dismissed";

/** Re-show interval for Patreon: 7 days in milliseconds */
const RESHOW_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

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
 * Checks whether the upsell banner should be shown based on platform and dismissal state.
 *
 * @returns true if the banner should be visible
 */
function shouldShowBanner(): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (isStripe()) {
      return localStorage.getItem(STRIPE_DISMISS_KEY) !== "true";
    }

    // Patreon: time-based dismissal
    const raw = localStorage.getItem(PATREON_DISMISS_KEY);
    if (!raw) return true;

    const dismissedAt = Number(raw);
    if (Number.isNaN(dismissedAt)) return true;

    return Date.now() - dismissedAt > RESHOW_INTERVAL_MS;
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
    if (isStripe()) {
      localStorage.setItem(STRIPE_DISMISS_KEY, "true");
    } else {
      localStorage.setItem(PATREON_DISMISS_KEY, String(Date.now()));
    }
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
 * Platform-aware:
 *   - Patreon: shows to authenticated Thrall users. CTA opens SealedRuneModal.
 *   - Stripe: shows to all Thrall users (anon + auth). CTA redirects to checkout.
 *
 * @param props - Optional feature to promote
 */
export function UpsellBanner({ feature = PROMOTED_FEATURE }: UpsellBannerProps) {
  const { tier, isLoading, hasFeature, subscribeStripe } = useEntitlement();
  const { status } = useAuth();
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const isAuthenticated = status === "authenticated";

  // Check visibility on mount (client-side only)
  useEffect(() => {
    if (isStripe()) {
      // Stripe: show to all Thrall users who have not dismissed
      if (!isLoading) {
        setVisible(shouldShowBanner());
      }
    } else if (isPatreon()) {
      // Patreon: show to authenticated Thrall users who have not dismissed
      if (isAuthenticated && !isLoading) {
        setVisible(shouldShowBanner());
      }
    }
  }, [status, isAuthenticated, isLoading]);

  const handleDismiss = useCallback(() => {
    dismissBanner();
    setVisible(false);
  }, []);

  const handlePatreonLearnMore = useCallback(() => {
    setModalOpen(true);
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
  //   - No active platform
  //   - Patreon mode: anonymous users
  //   - Users who already have the feature (Karl tier)
  //   - Loading state
  //   - Dismissed banner
  if (!isPatreon() && !isStripe()) return null;
  if (isPatreon() && status !== "authenticated") return null;
  if (isLoading) return null;
  if (hasFeature(feature)) return null;
  if (tier !== "thrall") return null;
  if (!visible) return null;

  // -- Stripe banner layout ---------------------------------------------------
  if (isStripe()) {
    return (
      <>
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
      </>
    );
  }

  // -- Patreon banner layout --------------------------------------------------
  return (
    <>
      <div
        className="relative border border-gold/20 bg-background/60 p-4 md:px-5 flex flex-col md:flex-row gap-3 md:items-start rounded-sm"
        role="complementary"
        aria-label="Premium feature promotion"
      >
        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2 right-2 w-8 h-8 min-w-[44px] min-h-[44px] flex items-center justify-center text-rune/60 hover:text-saga transition-colors"
          aria-label="Dismiss promotion"
        >
          <span aria-hidden="true" className="text-sm">&times;</span>
        </button>

        {/* Rune icon */}
        <span
          className="text-2xl text-gold/60 flex-shrink-0 w-8 text-center pt-0.5"
          aria-hidden="true"
        >
          &#5765;
        </span>

        {/* Content */}
        <div className="flex-1 flex flex-col gap-1 pr-8 md:pr-0">
          <span className="text-sm font-heading font-bold text-saga">
            Unlock the full power of the Ledger
          </span>
          <span className="text-[13px] text-saga/80 leading-snug font-body">
            Cloud sync, data export, advanced analytics, and more -- available to Karl supporters.
          </span>
          <span className="text-[13px] italic text-rune/60 leading-snug font-body">
            &ldquo;The wolf who breaks free claims every reward.&rdquo;
          </span>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handlePatreonLearnMore}
          className="self-end md:self-center text-[13px] font-heading font-bold text-gold underline hover:text-gold-bright transition-colors min-h-[44px] inline-flex items-center whitespace-nowrap"
        >
          Learn more &rarr;
        </button>
      </div>

      {/* Sealed Rune Modal -- opens when "Learn more" is clicked */}
      <SealedRuneModal
        feature={feature}
        open={modalOpen}
        onDismiss={() => setModalOpen(false)}
      />
    </>
  );
}
