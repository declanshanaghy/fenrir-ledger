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
import { useRouter, usePathname } from "next/navigation";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useAuth } from "@/hooks/useAuth";
import { buildSignInUrl } from "@/lib/auth/sign-in-url";
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
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const isAnonymous = status === "anonymous";

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

  const handleSignIn = useCallback(() => {
    router.push(buildSignInUrl(pathname));
  }, [router, pathname]);

  // Do not render for:
  //   - Users who already have the feature (Karl tier)
  //   - Loading state
  //   - Dismissed banner
  //   - Users who are neither thrall nor anonymous (e.g. loading resolved to authenticated Karl)
  if (isLoading) return null;
  if (hasFeature(feature)) return null;
  if (tier !== "thrall" && !isAnonymous) return null;
  if (!visible) return null;

  return (
    <div
      className="border border-gold/20 bg-background/60 rounded-sm"
      role="region"
      aria-label="Upgrade your subscription"
    >
      {/* Desktop layout: single row with inline dismiss */}
      <div className="hidden md:flex items-center gap-3 px-5 py-4">
        {/* Content */}
        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
          {/* Voice 2: atmospheric */}
          <span className="text-[13px] italic text-muted-foreground font-body">
            {isAnonymous
              ? "The wolf guards those who forge the bond."
              : "The wolf hunts greater prey for those who forge the bond."}
          </span>
          {/* Voice 1: functional value prop */}
          <span className="text-sm text-muted-foreground leading-snug font-body">
            {isAnonymous
              ? "Sign in to start your free 30-day trial \u2014 cloud sync, priority alerts, and advanced analytics."
              : "Upgrade to Karl for cloud sync, priority alerts, and advanced analytics -- $3.99/month."}
          </span>
        </div>

        {/* CTA + Dismiss inline */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={isAnonymous ? handleSignIn : handleStripeUpgrade}
            disabled={!isAnonymous && isSubscribing}
            aria-busy={(!isAnonymous && isSubscribing) || undefined}
            aria-disabled={(!isAnonymous && isSubscribing) || undefined}
            className={[
              "px-3.5 py-1.5 text-sm font-heading font-bold tracking-wide",
              "border border-gold/50 text-gold",
              "hover:bg-gold/10 hover:brightness-110",
              "active:scale-[0.97] active:brightness-90",
              "transition-[transform,filter,background-color,color] duration-150 ease-out",
              "rounded-sm whitespace-nowrap min-h-[36px]",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
            ].join(" ")}
            aria-label={isAnonymous ? "Sign in with Google to start your free 30-day trial" : undefined}
          >
            {!isAnonymous && isSubscribing ? (
              <span className="inline-flex items-center gap-2">
                <span className="btn-spinner" aria-hidden="true" />
                Redirecting...
              </span>
            ) : isAnonymous ? (
              "Sign in — free trial"
            ) : (
              "Upgrade to Karl"
            )}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="Dismiss upgrade banner"
          >
            <span aria-hidden="true" className="text-base">&times;</span>
          </button>
        </div>
      </div>

      {/* Mobile layout: stacked with dismiss at top-right */}
      <div className="md:hidden relative px-4 py-4 pr-14 flex flex-col gap-3">
        {/* Voice 1: functional value prop (atmospheric hidden on mobile) */}
        <span className="text-sm text-muted-foreground leading-snug font-body">
          {isAnonymous
            ? "Sign in to start your free 30-day trial \u2014 cloud sync, priority alerts, and advanced analytics."
            : "Upgrade to Karl for cloud sync, priority alerts, and advanced analytics -- $3.99/month."}
        </span>

        {/* CTA — left-aligned, well away from the dismiss X */}
        <button
          type="button"
          onClick={isAnonymous ? handleSignIn : handleStripeUpgrade}
          disabled={!isAnonymous && isSubscribing}
          aria-busy={(!isAnonymous && isSubscribing) || undefined}
          aria-disabled={(!isAnonymous && isSubscribing) || undefined}
          className={[
            "self-start px-3.5 py-1.5 text-sm font-heading font-bold tracking-wide",
            "border border-gold/50 text-gold",
            "hover:bg-gold/10 hover:brightness-110",
            "active:scale-[0.97] active:brightness-90",
            "transition-[transform,filter,background-color,color] duration-150 ease-out",
            "rounded-sm whitespace-nowrap min-h-[36px]",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          ].join(" ")}
          aria-label={isAnonymous ? "Sign in with Google to start your free 30-day trial" : undefined}
        >
          {!isAnonymous && isSubscribing ? (
            <span className="inline-flex items-center gap-2">
              <span className="btn-spinner" aria-hidden="true" />
              Redirecting...
            </span>
          ) : isAnonymous ? (
            "Sign in — free trial"
          ) : (
            "Upgrade to Karl"
          )}
        </button>

        {/* Dismiss — absolute top-right, no overlap with CTA */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2 right-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          style={{ minWidth: 44, minHeight: 44 }}
          aria-label="Dismiss upgrade banner"
        >
          <span aria-hidden="true" className="text-base">&times;</span>
        </button>
      </div>
    </div>
  );
}
