"use client";

/**
 * SealedRuneModal — Fenrir Ledger
 *
 * Hard gate modal that appears when a Thrall (or expired) user attempts to
 * access a premium feature. Displays the Algiz rune, feature information,
 * and a CTA to link/renew Patreon.
 *
 * Wireframe reference: designs/ux-design/wireframes/patreon-subscription/hard-gate-modal.html
 *
 * Key design decisions (from wireframe):
 *   - Algiz rune (protection) as visual centerpiece
 *   - "THIS RUNE IS SEALED" heading in Cinzel Decorative
 *   - Feature-specific description (Voice 1) + atmospheric quote (Voice 2)
 *   - Karl tier badge + price indicator
 *   - "Pledge on Patreon" CTA (or "Renew" for expired users)
 *   - "Not now" secondary dismiss
 *   - Focus trap, Escape dismisses
 *   - z-index 200/210 (overlay/modal)
 *   - Mobile: 92vw width, stacked tier row
 *
 * @module entitlement/SealedRuneModal
 */

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEntitlement } from "@/hooks/useEntitlement";
import { PREMIUM_FEATURES } from "@/lib/entitlement/types";
import { FEATURE_DESCRIPTIONS } from "@/lib/entitlement/feature-descriptions";
import type { PremiumFeature } from "@/lib/entitlement/types";
import { isPatreon } from "@/lib/feature-flags";

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
 * providing a CTA to link or renew Patreon.
 *
 * @param props - Feature, open state, and dismiss callback
 */
export function SealedRuneModal({
  feature,
  open,
  onDismiss,
}: SealedRuneModalProps) {
  const { isLinked, isActive, tier, linkPatreon } = useEntitlement();

  const featureDef = PREMIUM_FEATURES[feature];
  const featureDesc = FEATURE_DESCRIPTIONS[feature];

  // Determine if this is an expired Karl user (linked but not active, was karl)
  // A linked thrall (never pledged) should see "Pledge" copy, not "Renew"
  const isExpired = isLinked && !isActive && tier === "karl";

  const ctaLabel = isExpired ? "Renew on Patreon" : "Pledge on Patreon";
  const ctaAriaLabel = isExpired
    ? "Open Patreon campaign page to renew membership"
    : "Open Patreon campaign page in new tab";
  const dismissLabel = isExpired
    ? "Not now"
    : "Not now \u2014 I will continue as Thrall";

  const atmosphericQuote = isExpired
    ? featureDesc.expiredAtmospheric
    : featureDesc.atmospheric;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent
        className="w-[92vw] max-w-[480px] max-h-[90vh] overflow-y-auto border-2 border-gold/40 bg-[#07070d] p-0 gap-0"
        aria-labelledby={`sealed-rune-heading-${feature}`}
        aria-describedby={`sealed-rune-desc-${feature}`}
      >
        {/* Rune glyph — Algiz (protection) */}
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

        {/* Tier info + CTA — Patreon-specific when platform is active,
            generic "coming soon" when Patreon is disabled (stripe mode). */}
        {isPatreon() ? (
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
                className="w-full min-h-[48px] text-[15px] font-heading font-bold tracking-wide bg-gold text-[#07070d] hover:bg-gold-bright border-2 border-gold"
                aria-label={ctaAriaLabel}
              >
                {ctaLabel}
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
                {dismissLabel}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Stripe mode — generic premium message */}
            <div className="px-6 md:px-8 py-4 text-center">
              <p className="text-sm text-rune/80 font-body">
                Premium feature — subscription coming soon.
              </p>
            </div>

            {/* Dismiss */}
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
  );
}
