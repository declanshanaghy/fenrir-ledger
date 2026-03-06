"use client";

/**
 * SubscriptionGate -- Fenrir Ledger
 *
 * Wrapper component that gates premium features with a hard lock.
 * Renders children for Karl users, the Sealed Rune Modal for Thrall/expired
 * users, and a Norse-themed skeleton shimmer while loading.
 *
 * Stripe-only: gates all users (anonymous and authenticated) through
 * Stripe subscription checks.
 *
 * Usage:
 *   <SubscriptionGate feature="cloud-sync">
 *     <CloudSyncPanel />
 *   </SubscriptionGate>
 *
 * Behavior:
 *   - hasFeature(feature) === true: render children normally
 *   - hasFeature(feature) === false: render the Sealed Rune Modal
 *   - isLoading: render a skeleton/loading state (Norse-themed shimmer)
 *
 * @module entitlement/SubscriptionGate
 */

import { useState, type ReactNode } from "react";
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
// Component
// ---------------------------------------------------------------------------

/**
 * Gates a premium feature. Renders children for Karl users, the Sealed Rune
 * Modal for Thrall/expired users, and a loading skeleton while resolving.
 *
 * @param props - Feature slug and children
 */
export function SubscriptionGate({ feature, children }: SubscriptionGateProps) {
  const { hasFeature, isLoading } = useEntitlement();
  const [modalOpen, setModalOpen] = useState(false);

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
          onClick={() => setModalOpen(true)}
          className="self-start mt-1 text-sm text-gold underline hover:text-gold-bright transition-colors font-heading min-h-[44px] inline-flex items-center"
        >
          Unlock with Karl
        </button>
      </section>
      {children}
    </>
  );
}
