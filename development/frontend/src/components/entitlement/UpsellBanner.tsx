"use client";

/**
 * UpsellBanner — Fenrir Ledger
 *
 * A non-aggressive, contextual banner shown to Thrall users promoting
 * Karl tier upgrade. Appears on the dashboard for signed-in users who
 * have not linked Patreon or whose membership is inactive.
 *
 * Wireframe reference: designs/ux-design/wireframes/patreon-subscription/upsell-banner-premium.html
 *
 * Key design decisions (from wireframe):
 *   - Non-aggressive: informational only, no countdown, no pulsing
 *   - Dismissible via localStorage with 7-day re-show
 *   - Maximum 1 upsell per page view
 *   - Not shown to anonymous users
 *   - "Learn more" opens the Sealed Rune Modal for the featured feature
 *   - Inline with page content, not a popup
 *
 * Anatomy:
 *   [Rune icon]  [Headline -- Voice 1]
 *                [1-line description -- Voice 1]
 *                [Atmospheric teaser -- Voice 2, italic, muted]
 *                                           [Learn more ->]
 *
 * @module entitlement/UpsellBanner
 */

import { useState, useCallback, useEffect } from "react";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useAuth } from "@/hooks/useAuth";
import { SealedRuneModal } from "./SealedRuneModal";
import type { PremiumFeature } from "@/lib/entitlement/types";
import { isPatreon } from "@/lib/feature-flags";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** localStorage key for tracking banner dismissal */
const DISMISS_KEY = "fenrir:upsell-dismissed";

/** Re-show interval: 7 days in milliseconds */
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
 * Checks whether the upsell banner should be shown based on dismissal state.
 *
 * @returns true if the banner should be visible
 */
function shouldShowBanner(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return true;

    const dismissedAt = Number(raw);
    if (Number.isNaN(dismissedAt)) return true;

    // Re-show after 7 days
    return Date.now() - dismissedAt > RESHOW_INTERVAL_MS;
  } catch {
    return true;
  }
}

/**
 * Records the current time as the dismissal timestamp.
 */
function dismissBanner(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // localStorage full or blocked — fail silently
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Upsell banner for promoting Karl tier to Thrall users.
 *
 * Only renders for authenticated Thrall users who have not dismissed
 * the banner within the last 7 days.
 *
 * @param props - Optional feature to promote
 */
export function UpsellBanner({ feature = PROMOTED_FEATURE }: UpsellBannerProps) {
  const { tier, isLoading, hasFeature } = useEntitlement();
  const { status } = useAuth();
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Check visibility on mount (client-side only)
  useEffect(() => {
    if (status === "authenticated" && !isLoading) {
      setVisible(shouldShowBanner());
    }
  }, [status, isLoading]);

  const handleDismiss = useCallback(() => {
    dismissBanner();
    setVisible(false);
  }, []);

  const handleLearnMore = useCallback(() => {
    setModalOpen(true);
  }, []);

  // Do not render for:
  //   - Stripe mode (Patreon disabled — no Patreon CTA to show)
  //   - Anonymous users
  //   - Users who already have the feature (Karl tier)
  //   - Loading state
  //   - Dismissed banner
  if (!isPatreon()) return null;
  if (status !== "authenticated") return null;
  if (isLoading) return null;
  if (hasFeature(feature)) return null;
  if (tier !== "thrall") return null;
  if (!visible) return null;

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
            Cloud sync, data export, advanced analytics, and more — available to Karl supporters.
          </span>
          <span className="text-[13px] italic text-rune/60 leading-snug font-body">
            &ldquo;The wolf who breaks free claims every reward.&rdquo;
          </span>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleLearnMore}
          className="self-end md:self-center text-[13px] font-heading font-bold text-gold underline hover:text-gold-bright transition-colors min-h-[44px] inline-flex items-center whitespace-nowrap"
        >
          Learn more &rarr;
        </button>
      </div>

      {/* Sealed Rune Modal — opens when "Learn more" is clicked */}
      <SealedRuneModal
        feature={feature}
        open={modalOpen}
        onDismiss={() => setModalOpen(false)}
      />
    </>
  );
}
