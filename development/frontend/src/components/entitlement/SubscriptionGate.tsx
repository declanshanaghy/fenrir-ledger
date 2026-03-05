"use client";

/**
 * SubscriptionGate -- Fenrir Ledger
 *
 * Wrapper component that gates premium features. Supports two modes:
 *
 *   - **hard** (default): Renders children for Karl users, the Sealed Rune
 *     Modal for Thrall/expired users, and a skeleton shimmer while loading.
 *   - **soft**: Always renders children, but prepends a subscribe banner
 *     above them when the user lacks the feature entitlement.
 *
 * Stripe-only: gates all users (anonymous and authenticated) through
 * Stripe subscription checks.
 *
 * Usage:
 *   <SubscriptionGate feature="cloud-sync">
 *     <CloudSyncPanel />
 *   </SubscriptionGate>
 *
 *   <SubscriptionGate feature="cloud-sync" mode="soft">
 *     <CloudSyncPanel />
 *   </SubscriptionGate>
 *
 * @module entitlement/SubscriptionGate
 */

import { useState, useCallback, type ReactNode } from "react";
import { useEntitlement } from "@/hooks/useEntitlement";
import { SealedRuneModal } from "./SealedRuneModal";
import { PREMIUM_FEATURES, type PremiumFeature } from "@/lib/entitlement/types";
import { FEATURE_DESCRIPTIONS } from "@/lib/entitlement/feature-descriptions";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SubscriptionGateProps {
  /** Which premium feature to gate */
  feature: PremiumFeature;
  /** Content to render when the feature is unlocked */
  children: ReactNode;
  /**
   * Gating mode:
   *   - "hard" (default): hides children and shows Sealed Rune Modal when locked
   *   - "soft": always renders children, but prepends a subscribe banner when locked
   */
  mode?: "hard" | "soft";
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

/**
 * Norse-themed shimmer skeleton shown while entitlement status loads.
 * Uses the saga-shimmer animation from globals.css.
 */
function GateSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 p-6"
      aria-busy="true"
      aria-label="Loading feature access..."
    >
      <div className="skeleton h-6 w-48 rounded-sm" />
      <div className="skeleton h-4 w-full rounded-sm" />
      <div className="skeleton h-4 w-3/4 rounded-sm" />
      <div className="skeleton h-10 w-36 rounded-sm mt-2" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Soft gate banner
// ---------------------------------------------------------------------------

/**
 * Props for the soft gate banner component.
 */
interface SoftGateBannerProps {
  /** Callback to initiate Stripe checkout */
  onSubscribe: () => void;
  /** Whether a Stripe checkout is in progress */
  isSubscribing: boolean;
  /** Callback to open the Sealed Rune Modal */
  onLearnMore: () => void;
}

/**
 * Non-blocking banner shown above children in soft gate mode.
 * Displays a brief message and subscribe CTA without hiding the feature content.
 */
function SoftGateBanner({
  onSubscribe,
  isSubscribing,
}: SoftGateBannerProps) {
  return (
    <div
      className="border border-gold/30 bg-background/60 p-4 flex flex-col sm:flex-row gap-3 sm:items-center rounded-sm"
      role="region"
      aria-label="Unlock this feature"
    >
      {/* Rune icon */}
      <span
        className="text-xl text-gold/50 flex-shrink-0"
        aria-hidden="true"
      >
        &#5765;
      </span>

      {/* Message */}
      <div className="flex-1 flex flex-col gap-0.5">
        <span className="text-sm font-heading font-bold text-saga">
          Unlock this feature
        </span>
        <span className="text-xs text-saga/80 leading-snug font-body">
          Subscribe to Karl for full access -- $3.99/month.
        </span>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onSubscribe}
        disabled={isSubscribing}
        className={[
          "self-start sm:self-center inline-flex items-center px-4 py-2 text-xs font-heading font-bold tracking-wide",
          "border border-gold/50 text-gold",
          "hover:bg-gold/10 transition-colors",
          "rounded-sm whitespace-nowrap min-h-[44px]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        ].join(" ")}
      >
        {isSubscribing ? "Starting..." : "Subscribe"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Gates a premium feature. Supports hard and soft gating modes.
 *
 * Hard mode (default): Renders children for Karl users, the Sealed Rune
 * Modal for Thrall/expired users, and a loading skeleton while resolving.
 *
 * Soft mode: Always renders children, but prepends a subscribe banner
 * above them when the user lacks the feature entitlement.
 *
 * @param props - Feature slug, children, and optional mode
 */
export function SubscriptionGate({
  feature,
  children,
  mode = "hard",
}: SubscriptionGateProps) {
  const { hasFeature, isLoading, subscribeStripe } = useEntitlement();
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSubscribe = useCallback(async () => {
    setIsSubscribing(true);
    try {
      await subscribeStripe();
    } catch {
      setIsSubscribing(false);
    }
  }, [subscribeStripe]);

  const handleLearnMore = useCallback(() => {
    setModalOpen(true);
  }, []);

  // -- Soft mode ---------------------------------------------------------------
  if (mode === "soft") {
    // While loading in soft mode, render children directly (not a skeleton).
    // The banner will appear once loading resolves if the user lacks entitlement.
    if (isLoading) {
      return <>{children}</>;
    }

    // Feature is unlocked: render children without banner
    if (hasFeature(feature)) {
      return <>{children}</>;
    }

    // Feature is locked: render banner above children
    return (
      <>
        <SealedRuneModal
          feature={feature}
          open={modalOpen}
          onDismiss={() => setModalOpen(false)}
        />
        <SoftGateBanner
          onSubscribe={handleSubscribe}
          isSubscribing={isSubscribing}
          onLearnMore={handleLearnMore}
        />
        {children}
      </>
    );
  }

  // -- Hard mode (default) -----------------------------------------------------

  // Loading state: show skeleton shimmer
  if (isLoading) {
    return <GateSkeleton />;
  }

  // Feature is unlocked: render children
  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  // Feature is locked: show the feature info as an upsell card.
  const featureDef = PREMIUM_FEATURES[feature];
  const featureDesc = FEATURE_DESCRIPTIONS[feature];

  return (
    <>
      <SealedRuneModal
        feature={feature}
        open={modalOpen}
        onDismiss={() => setModalOpen(false)}
      />
      <section
        className="border border-border p-5 flex flex-col gap-3"
        aria-label={`${featureDef.name} (locked)`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg text-gold/40" aria-hidden="true">&#5765;</span>
          <h2 className="text-xs font-heading font-bold uppercase tracking-[0.08em] text-saga">
            {featureDef.name}
          </h2>
          <span className="inline-flex items-center px-2 py-0.5 border border-gold/20 text-[9px] font-mono font-bold uppercase tracking-wide text-gold/60">
            KARL
          </span>
        </div>
        <p className="text-sm text-saga/90 leading-relaxed font-body">
          {featureDesc.description}
        </p>
        <p className="text-[13px] italic text-rune/60 font-body">
          &ldquo;{featureDesc.atmospheric}&rdquo;
        </p>
        <button
          type="button"
          onClick={handleLearnMore}
          className="self-start mt-1 text-sm text-gold underline hover:text-gold-bright transition-colors font-heading min-h-[44px] inline-flex items-center"
        >
          Unlock with Karl
        </button>
      </section>
    </>
  );
}
