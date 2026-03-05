"use client";

/**
 * StripeSettings -- Fenrir Ledger
 *
 * Settings section for managing the Stripe subscription.
 * Renders three states:
 *   1. Thrall (unsubscribed): value proposition + subscribe CTA
 *   2. Karl (active): subscription details + manage/cancel buttons
 *   3. Canceled: access-until date + resubscribe CTA
 *
 * This component is rendered for both anonymous and authenticated users:
 *   - Anonymous: subscribe CTA opens the email collection modal first
 *   - Authenticated: subscribe CTA redirects directly to Stripe Checkout
 *
 * Wireframe reference: ux/wireframes/stripe-direct/stripe-settings.html
 *
 * Data source: /api/stripe/membership endpoint via EntitlementContext.
 *
 * @module entitlement/StripeSettings
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlement } from "@/hooks/useEntitlement";
import { AnonymousCheckoutModal } from "./AnonymousCheckoutModal";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Karl tier benefits displayed in the unsubscribed state */
const KARL_BENEFITS = [
  "Cloud sync across all your devices",
  "Priority Howl notifications",
  "Advanced card analytics",
  "Unlock all hidden runes",
] as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Loading skeleton for the Stripe settings section.
 */
function StripeSettingsSkeleton() {
  return (
    <section
      className="border border-border p-5 flex flex-col gap-3"
      aria-busy="true"
      aria-label="Loading subscription settings..."
    >
      <div className="skeleton h-4 w-24 rounded-sm" />
      <div className="skeleton h-4 w-64 rounded-sm" />
      <div className="skeleton h-10 w-40 rounded-sm" />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Stripe subscription settings section.
 *
 * Renders the appropriate state (unsubscribed, active, canceled)
 * based on the current entitlement status.
 */
export function StripeSettings() {
  const { status: authStatus } = useAuth();
  const {
    tier,
    isActive,
    isLinked,
    isLoading,
    platform,
    currentPeriodEnd,
    subscribeStripe,
    openPortal,
  } = useEntitlement();

  const isAuthenticated = authStatus === "authenticated";
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Determine state
  const isKarlActive = isLinked && isActive && tier === "karl" && platform === "stripe";
  const isCanceled = isLinked && tier === "karl" && !isActive && platform === "stripe";
  const isThrall = !isKarlActive && !isCanceled;

  // Format the current period end date
  const formattedPeriodEnd = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  /**
   * Handle subscribe CTA click.
   * Authenticated: redirect to Stripe Checkout directly.
   * Anonymous: open email collection modal first.
   */
  const handleSubscribe = useCallback(async () => {
    if (isAuthenticated) {
      setIsSubscribing(true);
      try {
        await subscribeStripe();
        // If successful, user is redirected
      } catch {
        toast.error("Could not start checkout. Please try again.");
        setIsSubscribing(false);
      }
    } else {
      // Anonymous: open email modal
      setEmailModalOpen(true);
    }
  }, [isAuthenticated, subscribeStripe]);

  /**
   * Handle manage subscription click -- opens Stripe Customer Portal.
   */
  const handleManage = useCallback(async () => {
    await openPortal();
  }, [openPortal]);

  /**
   * Handle cancel click -- routes to Stripe Portal cancel flow.
   */
  const handleCancel = useCallback(async () => {
    await openPortal();
  }, [openPortal]);

  // Loading state
  if (isLoading && !isLinked) {
    return <StripeSettingsSkeleton />;
  }

  return (
    <>
      <section
        className="border border-border p-5 flex flex-col gap-4 max-w-[520px]"
        role="region"
        aria-label="Subscription"
      >
        {/* Section heading */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-heading font-bold text-saga">
            Subscription
          </h2>
          {isKarlActive && (
            <span
              className="inline-flex items-center px-2.5 py-0.5 border border-gold/30 text-[10px] font-mono font-bold uppercase tracking-wide text-gold h-5"
              aria-label="Karl tier active"
            >
              KARL
            </span>
          )}
          {isCanceled && (
            <span
              className="inline-flex items-center px-2.5 py-0.5 border border-dashed border-rune/40 text-[10px] font-mono font-bold uppercase tracking-wide text-rune/60 h-5"
              aria-label="Subscription canceled"
            >
              CANCELED
            </span>
          )}
        </div>

        {/* ---- Thrall (Unsubscribed) State ---- */}
        {isThrall && (
          <>
            {/* Atmospheric subhead */}
            <p
              className="text-xs italic text-rune/60 font-body leading-relaxed"
              aria-hidden="true"
            >
              The wolf runs free -- but Karl&apos;s chains hold power.
            </p>

            {/* Current tier */}
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center px-2.5 py-0.5 border border-border text-[11px] font-mono font-bold uppercase tracking-wide text-rune/70">
                THRALL
              </span>
              <span className="text-[13px] text-saga/80 font-body">Free tier</span>
            </div>

            <div className="border-t border-border" />

            {/* Karl benefits */}
            <div className="flex flex-col gap-1.5" aria-label="Karl tier benefits">
              <p className="text-xs font-heading font-bold text-saga">
                Upgrade to Karl -- $3.99/month:
              </p>
              {KARL_BENEFITS.map((benefit) => (
                <div key={benefit} className="flex items-start gap-2 text-xs text-saga/80 font-body leading-relaxed">
                  <span
                    className="w-4 h-4 border border-gold/30 rounded-full flex items-center justify-center text-[10px] text-gold flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    +
                  </span>
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            {/* Subscribe CTA */}
            <div className="flex flex-col md:flex-row gap-3">
              <Button
                onClick={handleSubscribe}
                disabled={isSubscribing}
                className="min-h-[44px] w-full md:w-auto font-heading font-bold bg-gold text-primary-foreground hover:bg-gold-bright border-2 border-gold disabled:opacity-50"
              >
                {isSubscribing ? "Starting checkout..." : "Subscribe for $3.99/month"}
              </Button>
            </div>
          </>
        )}

        {/* ---- Karl (Active Subscriber) State ---- */}
        {isKarlActive && (
          <>
            {/* Atmospheric subhead */}
            <p
              className="text-xs italic text-rune/60 font-body leading-relaxed"
              aria-hidden="true"
            >
              The wolf is bound. The chains hold true.
            </p>

            {/* Status row */}
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center px-2.5 py-0.5 border border-gold/30 text-[11px] font-mono font-bold uppercase tracking-wide text-gold">
                KARL
              </span>
              <span className="text-[13px] text-realm-asgard font-body">Active</span>
            </div>

            {/* Subscription details */}
            <div className="text-xs text-saga/80 font-body leading-relaxed">
              <p>$3.99/month</p>
              {formattedPeriodEnd && (
                <p>Next billing date: {formattedPeriodEnd}</p>
              )}
            </div>

            <div className="border-t border-border" />

            {/* Actions */}
            <div className="flex flex-col md:flex-row gap-3">
              <Button
                onClick={handleManage}
                className="min-h-[44px] w-full md:w-auto font-heading font-bold bg-gold text-primary-foreground hover:bg-gold-bright border-2 border-gold"
              >
                Manage Subscription
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                className="min-h-[44px] w-full md:w-auto font-heading text-[13px]"
                aria-label="Cancel subscription"
              >
                Cancel
              </Button>
            </div>
          </>
        )}

        {/* ---- Canceled State ---- */}
        {isCanceled && (
          <>
            {/* Atmospheric subhead */}
            <p
              className="text-xs italic text-rune/60 font-body leading-relaxed"
              aria-hidden="true"
            >
              The chain weakens -- but it holds until the moon turns.
            </p>

            {/* Status row */}
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center px-2.5 py-0.5 border border-gold/30 text-[11px] font-mono font-bold uppercase tracking-wide text-gold">
                KARL
              </span>
              <span className="text-[13px] text-rune font-body">Canceled</span>
            </div>

            {/* Cancellation details */}
            <div className="text-xs text-saga/80 font-body leading-relaxed">
              {formattedPeriodEnd ? (
                <>
                  <p>Your Karl access continues until {formattedPeriodEnd}.</p>
                  <p>After that date, your account reverts to Thrall (free tier).</p>
                </>
              ) : (
                <p>Your Karl access will continue until the end of your billing period.</p>
              )}
            </div>

            <div className="border-t border-border" />

            {/* Actions */}
            <div className="flex flex-col md:flex-row gap-3">
              <Button
                onClick={handleSubscribe}
                disabled={isSubscribing}
                className="min-h-[44px] w-full md:w-auto font-heading font-bold bg-gold text-primary-foreground hover:bg-gold-bright border-2 border-gold disabled:opacity-50"
              >
                {isSubscribing ? "Starting checkout..." : "Resubscribe"}
              </Button>
              <Button
                variant="outline"
                onClick={handleManage}
                className="min-h-[44px] w-full md:w-auto font-heading text-[13px]"
              >
                Manage Subscription
              </Button>
            </div>
          </>
        )}
      </section>

      {/* Anonymous checkout email modal */}
      <AnonymousCheckoutModal
        open={emailModalOpen}
        onDismiss={() => setEmailModalOpen(false)}
      />
    </>
  );
}
