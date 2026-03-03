"use client";

/**
 * PatreonGate — Fenrir Ledger
 *
 * Wrapper component that gates premium features with a hard lock.
 * Renders children for Karl users, the Sealed Rune Modal for Thrall/expired
 * users, and a Norse-themed skeleton shimmer while loading.
 *
 * Usage:
 *   <PatreonGate feature="cloud-sync">
 *     <CloudSyncPanel />
 *   </PatreonGate>
 *
 * Behavior:
 *   - hasFeature(feature) === true: render children normally
 *   - hasFeature(feature) === false: render the Sealed Rune Modal
 *   - isLoading: render a skeleton/loading state (Norse-themed shimmer)
 *
 * @module entitlement/PatreonGate
 */

import { useState, type ReactNode } from "react";
import { useEntitlement } from "@/hooks/useEntitlement";
import { SealedRuneModal } from "./SealedRuneModal";
import type { PremiumFeature } from "@/lib/entitlement/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PatreonGateProps {
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
export function PatreonGate({ feature, children }: PatreonGateProps) {
  const { hasFeature, isLoading } = useEntitlement();
  const [modalDismissed, setModalDismissed] = useState(false);

  // Loading state: show skeleton shimmer
  if (isLoading) {
    return <GateSkeleton />;
  }

  // Feature is unlocked: render children
  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  // Feature is locked: show the Sealed Rune Modal
  // When dismissed, we show nothing (the gate remains locked)
  return (
    <>
      <SealedRuneModal
        feature={feature}
        open={!modalDismissed}
        onDismiss={() => setModalDismissed(true)}
      />
      {/* When the modal is dismissed, show a locked placeholder */}
      {modalDismissed && (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <span className="text-3xl text-gold/40 mb-3" aria-hidden="true">
            &#5765;
          </span>
          <p className="text-sm text-rune font-body">
            This feature requires a Karl subscription.
          </p>
          <button
            type="button"
            onClick={() => setModalDismissed(false)}
            className="mt-3 text-sm text-gold underline hover:text-gold-bright transition-colors font-heading min-h-[44px] inline-flex items-center"
          >
            Learn more
          </button>
        </div>
      )}
    </>
  );
}
