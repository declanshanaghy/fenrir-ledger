"use client";

/**
 * StripeSettings -- Fenrir Ledger
 *
 * Settings section for managing the Stripe subscription.
 * Renders three states:
 *   1. Thrall (unsubscribed): value proposition + subscribe CTA
 *   2. Karl (active): subscription details + manage button
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
import { useEntitlement } from "@/hooks/useEntitlement";

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

/** Timeout for portal redirect (ms). If exceeded, revert loading and show error toast. */
const PORTAL_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Derived subscription display state for StripeSettings. */
type SubscriptionState = "thrall" | "karl-active" | "canceling" | "canceled";

// ---------------------------------------------------------------------------
// Pure helper
// ---------------------------------------------------------------------------

/**
 * Derive a single SubscriptionState from raw entitlement values.
 * Extracted to reduce cyclomatic complexity of the hook.
 */
function deriveSubscriptionState(
  isLinked: boolean,
  platform: string | null,
  isActive: boolean,
  tier: string,
  cancelAtPeriodEnd: boolean
): SubscriptionState {
  const isStripeLinked = isLinked && platform === "stripe";
  const isKarlActive =
    isStripeLinked && isActive && tier === "karl" && !cancelAtPeriodEnd;
  if (isKarlActive) return "karl-active";
  const isCanceling =
    isStripeLinked && isActive && tier === "karl" && cancelAtPeriodEnd;
  if (isCanceling) return "canceling";
  const isCanceled = isStripeLinked && tier === "karl" && !isActive;
  if (isCanceled) return "canceled";
  return "thrall";
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseStripeSettingsReturn {
  subscriptionState: SubscriptionState;
  formattedPeriodEnd: string | null;
  isSubscribing: boolean;
  isManaging: boolean;
  isAnyLoading: boolean;
  isLoading: boolean;
  isLinked: boolean;
  handleSubscribe: () => Promise<void>;
  handleManage: () => Promise<void>;
}

/**
 * Encapsulates all state, derived values, and callbacks for StripeSettings.
 */
function useStripeSettings(): UseStripeSettingsReturn {
  const {
    tier,
    isActive,
    isLinked,
    isLoading,
    platform,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    subscribeStripe,
    openPortal,
  } = useEntitlement();

  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isManaging, setIsManaging] = useState(false);

  const subscriptionState = deriveSubscriptionState(
    isLinked,
    platform,
    isActive,
    tier,
    cancelAtPeriodEnd
  );

  const formattedPeriodEnd = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const handleSubscribe = useCallback(async () => {
    setIsSubscribing(true);
    try {
      await subscribeStripe();
      // If successful, user is redirected -- loading persists until navigation
    } catch {
      toast.error("Could not start checkout. Please try again.");
      setIsSubscribing(false);
    }
  }, [subscribeStripe]);

  const handleManage = useCallback(async () => {
    setIsManaging(true);
    const timeout = setTimeout(() => {
      setIsManaging(false);
      toast.error("Something went wrong. Try again.");
    }, PORTAL_TIMEOUT_MS);

    try {
      await openPortal();
      // Portal opens in new tab -- revert loading state after brief delay
      setTimeout(() => setIsManaging(false), 500);
    } catch {
      toast.error("Something went wrong. Try again.");
      setIsManaging(false);
    } finally {
      clearTimeout(timeout);
    }
  }, [openPortal]);

  return {
    subscriptionState,
    formattedPeriodEnd,
    isSubscribing,
    isManaging,
    isAnyLoading: isSubscribing || isManaging,
    isLoading,
    isLinked,
    handleSubscribe,
    handleManage,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Loading skeleton for the Stripe settings section.
 */
function StripeSettingsSkeleton() {
  return (
    <section
      className="relative border border-border p-5 flex flex-col gap-3 karl-bling-card"
      aria-busy="true"
      aria-label="Loading subscription settings..."
    >
      <div className="skeleton h-4 w-24 rounded-sm" />
      <div className="skeleton h-4 w-64 rounded-sm" />
      <div className="skeleton h-10 w-40 rounded-sm" />
    </section>
  );
}

/**
 * Tier badge rendered in the section header.
 */
function TierBadge({ state }: { state: SubscriptionState }) {
  if (state === "thrall") {
    return (
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center px-2.5 py-0.5 border border-border text-xs font-mono font-bold uppercase tracking-wide text-muted-foreground/70 h-5"
          data-testid="tier-badge"
          aria-label="Thrall tier free"
        >
          THRALL
        </span>
        <span className="text-xs text-foreground/80 font-body">Free tier</span>
      </div>
    );
  }
  if (state === "karl-active") {
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 border border-gold/30 text-xs font-mono font-bold uppercase tracking-wide text-gold h-5"
        aria-label="Karl tier active"
        data-testid="tier-badge"
      >
        KARL
      </span>
    );
  }
  if (state === "canceling") {
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 border border-dashed border-primary/40 text-xs font-mono font-bold uppercase tracking-wide text-primary/80 h-5"
        aria-label="Subscription canceling"
        data-testid="tier-badge"
      >
        CANCELING
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 border border-dashed border-rune/40 text-xs font-mono font-bold uppercase tracking-wide text-muted-foreground h-5"
      aria-label="Subscription canceled"
      data-testid="tier-badge"
    >
      CANCELED
    </span>
  );
}

interface SubscribeActionProps {
  isSubscribing: boolean;
  handleSubscribe: () => Promise<void>;
}

interface ManageActionProps {
  isAnyLoading: boolean;
  isManaging: boolean;
  handleManage: () => Promise<void>;
}

/**
 * Thrall (Unsubscribed) state panel.
 */
function ThrallPanel({ isSubscribing, handleSubscribe }: SubscribeActionProps) {
  return (
    <>
      <p
        className="text-sm italic text-muted-foreground font-body leading-relaxed"
        aria-hidden="true"
      >
        The wolf runs free -- but Karl&apos;s chains hold power.
      </p>

      <div className="border-t border-border" />

      <div className="flex flex-col gap-1.5" aria-label="Karl tier benefits">
        <p className="text-sm font-heading font-bold text-foreground">
          Upgrade to Karl -- $3.99/month:
        </p>
        {KARL_BENEFITS.map((benefit) => (
          <div
            key={benefit}
            className="flex items-start gap-2 text-sm text-foreground/80 font-body leading-relaxed"
          >
            <span
              className="w-4 h-4 border border-gold/30 rounded-full flex items-center justify-center text-xs text-gold flex-shrink-0 mt-0.5"
              aria-hidden="true"
            >
              +
            </span>
            <span>{benefit}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <Button
          onClick={handleSubscribe}
          disabled={isSubscribing}
          isLoading={isSubscribing}
          loadingText="Redirecting..."
          className="min-h-[44px] w-full md:w-auto font-heading font-bold bg-gold text-primary-foreground border-2 border-gold karl-bling-btn"
        >
          Subscribe
        </Button>
      </div>
    </>
  );
}

/**
 * Karl (Active Subscriber) state panel.
 */
function KarlActivePanel({
  formattedPeriodEnd,
  isAnyLoading,
  isManaging,
  handleManage,
}: { formattedPeriodEnd: string | null } & ManageActionProps) {
  return (
    <>
      <p
        className="text-sm italic text-muted-foreground font-body leading-relaxed"
        aria-hidden="true"
      >
        The wolf is bound. The chains hold true.
      </p>

      <div className="text-sm text-foreground/80 font-body leading-relaxed">
        <p>$3.99/month</p>
        {formattedPeriodEnd && (
          <p>Next billing date: {formattedPeriodEnd}</p>
        )}
      </div>

      <div className="border-t border-border" />

      <div className="flex flex-row flex-wrap gap-3">
        <Button
          onClick={handleManage}
          disabled={isAnyLoading}
          isLoading={isManaging}
          loadingText="Redirecting..."
          className="min-h-[44px] w-full sm:w-auto font-heading font-bold bg-gold text-primary-foreground border-2 border-gold karl-bling-btn"
        >
          Manage Subscription
        </Button>
      </div>
    </>
  );
}

/**
 * Canceling (grandfathered until period end) state panel.
 */
function CancelingPanel({
  formattedPeriodEnd,
  isSubscribing,
  handleSubscribe,
}: { formattedPeriodEnd: string | null } & SubscribeActionProps) {
  return (
    <>
      <p
        className="text-sm italic text-muted-foreground font-body leading-relaxed"
        aria-hidden="true"
      >
        The chain loosens -- but it holds until the moon turns.
      </p>

      <div className="flex items-center gap-2.5">
        <span className="inline-flex items-center px-2.5 py-0.5 border border-gold/30 text-[13px] font-mono font-bold uppercase tracking-wide text-gold">
          KARL
        </span>
        <span className="text-[13px] text-primary/80 font-body">Canceling</span>
      </div>

      <div className="text-sm text-foreground/80 font-body leading-relaxed flex flex-col gap-1">
        {formattedPeriodEnd ? (
          <>
            <p>
              Your subscription is set to cancel on{" "}
              <strong className="text-foreground">{formattedPeriodEnd}</strong>.
            </p>
            <p>You have full Karl access until then.</p>
          </>
        ) : (
          <p>
            Your subscription is set to cancel at the end of your billing
            period.
          </p>
        )}
      </div>

      <div className="border-t border-border" />

      <div className="flex flex-col md:flex-row gap-3">
        <Button
          onClick={handleSubscribe}
          disabled={isSubscribing}
          isLoading={isSubscribing}
          loadingText="Redirecting..."
          className="min-h-[44px] w-full md:w-auto font-heading font-bold bg-gold text-primary-foreground border-2 border-gold karl-bling-btn"
        >
          Resubscribe
        </Button>
      </div>
    </>
  );
}

/**
 * Canceled (subscription ended) state panel.
 */
function CanceledPanel({
  formattedPeriodEnd,
  isAnyLoading,
  isSubscribing,
  isManaging,
  handleSubscribe,
  handleManage,
}: { formattedPeriodEnd: string | null } & SubscribeActionProps &
  ManageActionProps) {
  return (
    <>
      <p
        className="text-sm italic text-muted-foreground font-body leading-relaxed"
        aria-hidden="true"
      >
        The chain weakens -- but it holds until the moon turns.
      </p>

      <div className="text-sm text-foreground/80 font-body leading-relaxed">
        {formattedPeriodEnd ? (
          <>
            <p>Your Karl access continues until {formattedPeriodEnd}.</p>
            <p>After that date, your account reverts to Thrall (free tier).</p>
          </>
        ) : (
          <p>
            Your Karl access will continue until the end of your billing period.
          </p>
        )}
      </div>

      <div className="border-t border-border" />

      <div className="flex flex-row flex-wrap gap-3">
        <Button
          onClick={handleSubscribe}
          disabled={isAnyLoading}
          isLoading={isSubscribing}
          loadingText="Redirecting..."
          className="min-h-[44px] w-full sm:w-auto font-heading font-bold bg-gold text-primary-foreground border-2 border-gold karl-bling-btn"
        >
          Resubscribe
        </Button>
        <Button
          variant="outline"
          onClick={handleManage}
          disabled={isAnyLoading}
          isLoading={isManaging}
          loadingText="Redirecting..."
          className="min-h-[44px] w-full sm:w-auto font-heading text-[13px]"
        >
          Manage Subscription
        </Button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Stripe subscription settings section.
 *
 * Renders the appropriate state (unsubscribed, active, canceling, canceled)
 * based on the current entitlement status.
 */
export function StripeSettings() {
  const {
    subscriptionState,
    formattedPeriodEnd,
    isSubscribing,
    isManaging,
    isAnyLoading,
    isLoading,
    isLinked,
    handleSubscribe,
    handleManage,
  } = useStripeSettings();

  if (isLoading && !isLinked) {
    return <StripeSettingsSkeleton />;
  }

  return (
    <>
      <section
        className="relative border border-border p-5 flex flex-col gap-4 karl-bling-card"
        role="region"
        aria-label="Subscription"
      >
        {/* Karl rune corners */}
        <span className="karl-rune-corner karl-rune-tl" aria-hidden="true">ᚠ</span>
        <span className="karl-rune-corner karl-rune-tr" aria-hidden="true">ᚱ</span>
        <span className="karl-rune-corner karl-rune-bl" aria-hidden="true">ᛁ</span>
        <span className="karl-rune-corner karl-rune-br" aria-hidden="true">ᚾ</span>

        {/* Section heading — flex row: title left, tier badge right */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-heading font-bold text-foreground">
            Subscription
          </h2>
          <TierBadge state={subscriptionState} />
        </div>

        {subscriptionState === "thrall" && (
          <ThrallPanel
            isSubscribing={isSubscribing}
            handleSubscribe={handleSubscribe}
          />
        )}

        {subscriptionState === "karl-active" && (
          <KarlActivePanel
            formattedPeriodEnd={formattedPeriodEnd}
            isAnyLoading={isAnyLoading}
            isManaging={isManaging}
            handleManage={handleManage}
          />
        )}

        {subscriptionState === "canceling" && (
          <CancelingPanel
            formattedPeriodEnd={formattedPeriodEnd}
            isSubscribing={isSubscribing}
            handleSubscribe={handleSubscribe}
          />
        )}

        {subscriptionState === "canceled" && (
          <CanceledPanel
            formattedPeriodEnd={formattedPeriodEnd}
            isAnyLoading={isAnyLoading}
            isSubscribing={isSubscribing}
            isManaging={isManaging}
            handleSubscribe={handleSubscribe}
            handleManage={handleManage}
          />
        )}
      </section>
    </>
  );
}
