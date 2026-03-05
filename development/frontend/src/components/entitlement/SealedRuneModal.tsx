"use client";

/**
 * SealedRuneModal -- Fenrir Ledger
 *
 * Hard gate modal that appears when a Thrall (or expired) user attempts to
 * access a premium feature. Displays the Algiz rune, feature information,
 * and a CTA to link/renew Patreon or subscribe via Stripe.
 *
 * Platform-aware: renders Patreon CTA when isPatreon(), Stripe CTA when isStripe().
 *
 * Wireframe references:
 *   - Patreon: designs/ux-design/wireframes/patreon-subscription/hard-gate-modal.html
 *   - Stripe: ux/wireframes/stripe-direct/sealed-rune-stripe.html
 *
 * @module entitlement/SealedRuneModal
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlement } from "@/hooks/useEntitlement";
import { PREMIUM_FEATURES } from "@/lib/entitlement/types";
import { FEATURE_DESCRIPTIONS } from "@/lib/entitlement/feature-descriptions";
import type { PremiumFeature } from "@/lib/entitlement/types";
import { isPatreon, isStripe } from "@/lib/feature-flags";
import { AnonymousCheckoutModal } from "./AnonymousCheckoutModal";

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
 * providing a CTA to subscribe (Stripe) or link Patreon.
 *
 * @param props - Feature, open state, and dismiss callback
 */
export function SealedRuneModal({
  feature,
  open,
  onDismiss,
}: SealedRuneModalProps) {
  const { status: authStatus } = useAuth();
  const { isLinked, isActive, tier, linkPatreon, subscribeStripe } = useEntitlement();

  const isAuthenticated = authStatus === "authenticated";
  const [emailModalOpen, setEmailModalOpen] = useState(false);
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
    if (isAuthenticated) {
      setIsSubscribing(true);
      try {
        await subscribeStripe();
      } catch {
        setIsSubscribing(false);
      }
    } else {
      // Anonymous: open email modal
      setEmailModalOpen(true);
    }
  }, [isAuthenticated, subscribeStripe]);

  // -- Patreon-specific labels ------------------------------------------------

  const patreonCtaLabel = isExpired ? "Renew on Patreon" : "Pledge on Patreon";
  const patreonCtaAriaLabel = isExpired
    ? "Open Patreon campaign page to renew membership"
    : "Open Patreon campaign page in new tab";
  const patreonDismissLabel = isExpired
    ? "Not now"
    : "Not now \u2014 I will continue as Thrall";

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
        <DialogContent
          className="w-[92vw] max-w-[480px] max-h-[90vh] overflow-y-auto border-2 border-gold/40 bg-background p-0 gap-0"
          aria-labelledby={`sealed-rune-heading-${feature}`}
          aria-describedby={`sealed-rune-desc-${feature}`}
        >
          {/* Rune glyph -- Algiz (protection) */}
          <div className="text-center pt-6 pb-2" aria-hidden="true">
            <span className="text-5xl md:text-6xl leading-none text-gold select-none sealed-rune-pulse">
              &#5765;
            </span>
          </div>

          {/* Heading */}
          <DialogTitle
            id={`sealed-rune-heading-${feature}`}
            className="text-center font-display text-lg md:text-[22px] font-bold uppercase tracking-[0.12em] text-saga px-6 pb-4"
          >
            THIS RUNE IS SEALED
          </DialogTitle>

          {/* Feature content */}
          <div className="px-6 md:px-8 pb-4">
            <div className="border border-border p-4 flex flex-col gap-2">
              <span className="font-heading text-base md:text-lg font-bold text-saga">
                {featureDef.name}
              </span>
              <DialogDescription
                id={`sealed-rune-desc-${feature}`}
                className="text-sm text-saga/90 leading-relaxed font-body"
              >
                {featureDesc.description}
              </DialogDescription>
              <div className="border-t border-border my-1" />
              <p className="text-sm italic text-rune/80 leading-relaxed font-body">
                &ldquo;{atmosphericQuote}&rdquo;
              </p>
            </div>
          </div>

          {/* Locked feature indicator */}
          <div className="px-6 md:px-8 pb-3">
            <div className="border border-border p-2.5 text-xs text-center text-saga/80 font-body">
              <strong>Locked feature:</strong> {featureDef.name}
            </div>
          </div>

          {/* -- Stripe CTA --------------------------------------------------- */}
          {isStripe() && (
            <>
              {/* Functional description */}
              <div className="px-6 md:px-8 pb-2 text-center">
                <p className="text-[13px] text-saga/80 font-body leading-relaxed">
                  Unlock with a Karl subscription -- $3.99/month.
                  Cancel anytime.
                </p>
              </div>

              {/* Subscribe button */}
              <div className="px-6 md:px-8 py-2">
                <Button
                  onClick={handleStripeSubscribe}
                  disabled={isSubscribing}
                  className="w-full min-h-[48px] text-[15px] font-heading font-bold tracking-wide bg-gold text-primary-foreground hover:bg-gold-bright border-2 border-gold disabled:opacity-50"
                >
                  {isSubscribing ? "Starting checkout..." : "Subscribe for $3.99/month"}
                </Button>
              </div>

              {/* Price note */}
              <p className="text-[11px] text-center text-rune/60 font-body px-6">
                Billed monthly. Cancel anytime from your account.
              </p>

              {/* Dismiss */}
              <div className="text-center px-6 pt-2 pb-5">
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-[13px] text-rune underline cursor-pointer min-h-[44px] inline-flex items-center px-2 font-body hover:text-saga transition-colors"
                  aria-label="Dismiss and continue without premium features"
                >
                  Not now
                </button>
              </div>
            </>
          )}

          {/* -- Patreon CTA -------------------------------------------------- */}
          {isPatreon() && (
            <>
              {/* Tier info row */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 px-6 py-2">
                {isExpired ? (
                  <span
                    className="inline-flex items-center gap-1.5 border border-dashed border-rune/40 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wide text-rune/70"
                    aria-label="Membership expired"
                  >
                    <span className="w-4 h-4 flex items-center justify-center border border-rune/40 text-[9px]">
                      !
                    </span>
                    Expired
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 border border-gold/30 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wide text-gold"
                    aria-label="Karl Supporter tier"
                  >
                    <span className="w-4 h-4 flex items-center justify-center border border-gold/30 text-[9px] text-gold">
                      K
                    </span>
                    Karl Supporter
                  </span>
                )}
                <span className="text-[13px] text-rune font-body">
                  {isExpired ? "Renew at $3\u20135/mo" : "$3\u20135/mo via Patreon"}
                </span>
              </div>

              {/* Primary CTA */}
              <div className="px-6 md:px-8 py-2">
                <Button
                  onClick={linkPatreon}
                  className="w-full min-h-[48px] text-[15px] font-heading font-bold tracking-wide bg-gold text-primary-foreground hover:bg-gold-bright border-2 border-gold"
                  aria-label={patreonCtaAriaLabel}
                >
                  {patreonCtaLabel}
                </Button>
              </div>

              {/* Secondary dismiss */}
              <div className="text-center px-6 pt-2 pb-5">
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-[13px] text-rune underline cursor-pointer min-h-[44px] inline-flex items-center px-2 font-body hover:text-saga transition-colors"
                  aria-label="Dismiss and continue without premium features"
                >
                  {patreonDismissLabel}
                </button>
              </div>
            </>
          )}

          {/* -- No platform active ------------------------------------------- */}
          {!isStripe() && !isPatreon() && (
            <>
              <div className="px-6 md:px-8 py-4 text-center">
                <p className="text-sm text-rune/80 font-body">
                  Premium feature -- subscription coming soon.
                </p>
              </div>
              <div className="text-center px-6 pt-2 pb-5">
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-[13px] text-rune underline cursor-pointer min-h-[44px] inline-flex items-center px-2 font-body hover:text-saga transition-colors"
                  aria-label="Dismiss"
                >
                  Not now
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Anonymous checkout email modal (Stripe only) */}
      {isStripe() && (
        <AnonymousCheckoutModal
          open={emailModalOpen}
          onDismiss={() => setEmailModalOpen(false)}
        />
      )}
    </>
  );
}
