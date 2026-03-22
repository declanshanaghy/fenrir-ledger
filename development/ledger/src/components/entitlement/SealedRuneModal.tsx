"use client";

/**
 * SealedRuneModal -- Fenrir Ledger
 *
 * Hard gate modal that appears when a Thrall (or expired) user attempts to
 * access a premium feature. Displays the Algiz rune, feature information,
 * and a CTA to subscribe via Stripe.
 *
 * Wireframe reference:
 *   - ux/wireframes/stripe-direct/sealed-rune-stripe.html
 *
 * @module entitlement/SealedRuneModal
 */

import { useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useAuth } from "@/hooks/useAuth";
import { buildSignInUrl } from "@/lib/auth/sign-in-url";
import { PREMIUM_FEATURES } from "@/lib/entitlement/types";
import { FEATURE_DESCRIPTIONS } from "@/lib/entitlement/feature-descriptions";
import type { PremiumFeature } from "@/lib/entitlement/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SealedRuneModalProps {
  /** Which premium feature is being gated */
  feature: PremiumFeature;
  /** Whether the modal is open */
  open: boolean;
  /** Callback when the modal is dismissed */
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Hard gate modal for premium features.
 *
 * Renders a Norse-themed dialog explaining why the feature is locked and
 * providing a CTA to subscribe via Stripe.
 *
 * @param props - Feature, open state, and dismiss callback
 */
export function SealedRuneModal({
  feature,
  open,
  onDismiss,
}: SealedRuneModalProps) {
  const { isLinked, isActive, tier, subscribeStripe } = useEntitlement();
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAnonymous = status === "anonymous";
  const [isSubscribing, setIsSubscribing] = useState(false);

  const featureDef = PREMIUM_FEATURES[feature];
  const featureDesc = FEATURE_DESCRIPTIONS[feature];

  // Determine if this is an expired Karl user
  const isExpired = isLinked && !isActive && tier === "karl";

  const atmosphericQuote = isExpired
    ? featureDesc.expiredAtmospheric
    : featureDesc.atmospheric;

  // -- Stripe subscribe handler -----------------------------------------------

  const handleStripeSubscribe = useCallback(async () => {
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

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
        <DialogContent
          className="w-[92vw] max-w-[480px] max-h-[90vh] overflow-y-auto border-2 border-gold/40 bg-background p-0 gap-0"
        >
          {/* Rune glyph -- Algiz (protection) */}
          <div className="text-center pt-6 pb-2" aria-hidden="true">
            <span className="text-5xl md:text-6xl leading-none text-gold select-none sealed-rune-pulse">
              &#5765;
            </span>
          </div>

          {/* Heading */}
          <DialogTitle
            className="text-center font-display text-xl md:text-2xl font-bold uppercase tracking-[0.12em] text-foreground px-6 pb-4"
          >
            THIS RUNE IS SEALED
          </DialogTitle>

          {/* Feature content */}
          <div className="px-6 md:px-8 pb-4">
            <div className="border border-border p-4 flex flex-col gap-2">
              <span className="font-heading text-lg md:text-xl font-bold text-foreground">
                {featureDef.name}
              </span>
              <DialogDescription
                className="text-base text-foreground/90 leading-relaxed font-body"
              >
                {featureDesc.description}
              </DialogDescription>
              <div className="border-t border-border my-1" />
              <p className="text-base italic text-muted-foreground/80 leading-relaxed font-body">
                &ldquo;{atmosphericQuote}&rdquo;
              </p>
            </div>
          </div>

          {/* Locked feature indicator */}
          <div className="px-6 md:px-8 pb-3">
            <div className="border border-border p-2.5 text-sm text-center text-muted-foreground font-body">
              <strong>Locked feature:</strong> {featureDef.name}
            </div>
          </div>

          {/* -- CTA: sign in for anon, Stripe subscribe for Thrall ---------- */}

          {isAnonymous ? (
            <>
              {/* Trial prompt for anonymous users */}
              <div className="px-6 md:px-8 pb-2 text-center">
                <p className="text-[13px] text-muted-foreground font-body leading-relaxed">
                  Sign in to start your free 30-day trial &mdash; full Karl access, no credit card required.
                </p>
              </div>
              <div className="px-6 md:px-8 py-2">
                <Button
                  onClick={handleSignIn}
                  className="w-full min-h-[48px] text-[15px] font-heading font-bold tracking-wide bg-gold text-primary-foreground hover:bg-primary hover:brightness-110 border-2 border-gold"
                  aria-label="Sign in with Google to start your free 30-day trial"
                >
                  Sign in with Google &mdash; start your free trial
                </Button>
              </div>
              <p className="text-[13px] text-center text-muted-foreground font-body px-6">
                30 days free. No credit card required.
              </p>
            </>
          ) : (
            <>
              {/* Stripe subscription CTA for signed-in Thrall users */}
              <div className="px-6 md:px-8 pb-2 text-center">
                <p className="text-[13px] text-muted-foreground font-body leading-relaxed">
                  Unlock with a Karl subscription -- $3.99/month.
                  Cancel anytime.
                </p>
              </div>
              <div className="px-6 md:px-8 py-2">
                <Button
                  onClick={handleStripeSubscribe}
                  disabled={isSubscribing}
                  isLoading={isSubscribing}
                  loadingText="Redirecting..."
                  className="w-full min-h-[48px] text-[15px] font-heading font-bold tracking-wide bg-gold text-primary-foreground hover:bg-primary hover:brightness-110 border-2 border-gold"
                >
                  Subscribe
                </Button>
              </div>
              <p className="text-[13px] text-center text-muted-foreground font-body px-6">
                Billed monthly. Cancel anytime from your account.
              </p>
            </>
          )}

          {/* Dismiss */}
          <div className="text-center px-6 pt-2 pb-5">
            <button
              type="button"
              onClick={onDismiss}
              className="text-[13px] text-muted-foreground underline cursor-pointer min-h-[44px] inline-flex items-center px-2 font-body hover:text-foreground transition-colors"
              aria-label="Dismiss and continue without premium features"
            >
              Not now
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
