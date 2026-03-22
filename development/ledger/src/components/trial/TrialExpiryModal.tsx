"use client";

/**
 * TrialExpiryModal — Day-30 trial expiry modal with value recap and upgrade CTA.
 *
 * Shown once when the trial expires (day 30+). Presents:
 *   - Value recap: cards tracked, fees monitored, potential savings
 *   - Feature comparison table (desktop only): Thrall vs Karl
 *   - "Subscribe for $3.99/month" CTA → Stripe Checkout
 *   - "Continue with free plan" button (equal visual weight, no penalty)
 *   - "Your data is safe" reassurance message
 *
 * Trigger conditions (ALL must be true):
 *   - useTrialStatus().status === "expired"
 *   - fenrir:trial-expiry-modal-shown !== "true" in localStorage
 *   - Trial status is not "converted"
 *
 * One-time: sets fenrir:trial-expiry-modal-shown after first display.
 * Accessibility: focus trap, Escape closes, backdrop click does NOT close.
 *
 * @see ux/wireframes/trial/trial-expiry.html
 * @see plans/001-trial.md (Phase 5)
 * @see Issue #623
 *
 * @module trial/TrialExpiryModal
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useTrialMetrics } from "@/hooks/useTrialMetrics";
import { useEntitlement } from "@/hooks/useEntitlement";
import { LS_TRIAL_EXPIRY_MODAL_SHOWN } from "@/lib/trial-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Feature comparison rows for the desktop modal. */
const FEATURE_COMPARISON = [
  { feature: "Add & edit cards", free: "5 max", karl: "Unlimited" },
  { feature: "Fee & bonus tracking", free: "Yes", karl: "Yes" },
  { feature: "The Howl (alerts)", free: "\u2014", karl: "Yes" },
  { feature: "Valhalla (archive)", free: "\u2014", karl: "Yes" },
  { feature: "Smart Import", free: "\u2014", karl: "Yes" },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether the expiry modal has already been shown.
 *
 * @returns true if the expiry modal flag is set in localStorage
 */
export function isExpiryModalShown(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(LS_TRIAL_EXPIRY_MODAL_SHOWN) === "true";
  } catch {
    return true; // Assume shown if localStorage is unavailable
  }
}

/**
 * Sets the expiry modal flag in localStorage.
 */
export function markExpiryModalShown(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_TRIAL_EXPIRY_MODAL_SHOWN, "true");
  } catch {
    // localStorage unavailable — silently fail
  }
}

/**
 * Determines if the expiry modal should be shown based on trial status and flags.
 *
 * @param status - Current trial status
 * @param expiryShown - Whether the modal has already been shown
 * @returns true if the modal should be displayed
 */
export function shouldShowExpiryModal(
  status: string,
  expiryShown: boolean,
): boolean {
  if (status !== "expired") return false;
  if (expiryShown) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TrialExpiryModal — renders a one-time modal when the trial expires.
 *
 * Mount this component at the app layout level. It self-manages visibility
 * based on trial status and localStorage flag.
 */
export function TrialExpiryModal() {
  const { status, isLoading } = useTrialStatus();
  const metrics = useTrialMetrics();
  const { subscribeStripe } = useEntitlement();
  const [visible, setVisible] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Determine if the modal should show
  useEffect(() => {
    if (isLoading) return;
    if (status !== "expired") return;
    if (isExpiryModalShown()) return;

    setVisible(true);
  }, [status, isLoading]);

  // Focus trap on mount — focus first button
  useEffect(() => {
    if (!visible) return;
    const panel = modalRef.current;
    if (!panel) return;
    const firstFocusable = panel.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
  }, [visible]);

  // Escape key handler — same as "Continue with free plan"
  useEffect(() => {
    if (!visible) return;
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        handleDecline();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleDecline = useCallback(() => {
    markExpiryModalShown();
    setVisible(false);
    toast("Your trial ended. Upgrade to Karl for full access ($3.99/mo)", {
      duration: 8000,
    });
  }, []);

  const handleSubscribe = useCallback(async () => {
    markExpiryModalShown();
    setIsSubscribing(true);
    try {
      await subscribeStripe();
    } catch {
      setIsSubscribing(false);
    }
  }, [subscribeStripe]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop — click does NOT close (intentional per wireframe spec) */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-labelledby="trial-expiry-title"
        aria-describedby="trial-expiry-safety"
        aria-modal="true"
        className={[
          "relative w-full max-w-[500px]",
          "w-[92vw] max-h-[90vh] overflow-y-auto",
          "border border-border bg-background",
          "rounded-sm shadow-lg",
          "flex flex-col gap-0",
        ].join(" ")}
        style={{ zIndex: 211 }}
      >
        {/* Close button — same as "Continue with free plan" */}
        <button
          type="button"
          onClick={handleDecline}
          className="absolute top-2 right-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors text-sm"
          aria-label="Close trial expiry modal"
        >
          &times;
        </button>

        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-border">
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">
            YOUR TRIAL HAS ENDED
          </span>
          <h2
            id="trial-expiry-title"
            className="text-lg sm:text-xl font-display font-bold text-foreground mt-2"
          >
            Your 30 days are complete
          </h2>
          <p className="text-[13px] sm:text-sm italic text-muted-foreground/80 font-body leading-relaxed mt-1">
            You built something worth keeping. Your data is safe and waiting.
          </p>
        </div>

        {/* Value recap */}
        <div className="px-5 sm:px-6 py-4 border-b border-border">
          <div className="text-[11px] font-heading font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-3">
            What You Built
          </div>
          <div
            className="grid grid-cols-3 gap-3"
            aria-label={`Trial value summary: ${metrics.cardCount} cards tracked, ${metrics.totalAnnualFeesFormatted} fees monitored, ${metrics.potentialSavingsFormatted} potential savings`}
          >
            <div className="text-center">
              <div className="text-lg sm:text-[22px] font-bold text-foreground font-display">
                {metrics.cardCount}
              </div>
              <div className="text-[10px] text-muted-foreground font-body mt-0.5">
                <span className="hidden sm:inline">Cards tracked</span>
                <span className="sm:hidden">Cards</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg sm:text-[22px] font-bold text-foreground font-display">
                {metrics.totalAnnualFeesFormatted}
              </div>
              <div className="text-[10px] text-muted-foreground font-body mt-0.5">
                <span className="hidden sm:inline">Fees monitored</span>
                <span className="sm:hidden">Fees</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg sm:text-[22px] font-bold text-foreground font-display">
                {metrics.potentialSavingsFormatted}
              </div>
              <div className="text-[10px] text-muted-foreground font-body mt-0.5">
                <span className="hidden sm:inline">Potential savings</span>
                <span className="sm:hidden">Saved</span>
              </div>
            </div>
          </div>
        </div>

        {/* Data safety message */}
        <div
          id="trial-expiry-safety"
          className="px-5 sm:px-6 py-3 border-b border-border flex items-start gap-2 text-[12px] text-foreground/80 font-body leading-relaxed"
        >
          <span className="text-base shrink-0 mt-0.5" aria-hidden="true">
            &#9432;
          </span>
          <span>
            Your card data is preserved. Subscribe anytime to pick up where you
            left off. Nothing has been deleted.
          </span>
        </div>

        {/* Feature comparison table — desktop only */}
        <div className="hidden sm:block px-5 sm:px-6 py-4 border-b border-border">
          <div className="text-[11px] font-heading font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-3">
            What Changes
          </div>
          <div
            className="grid gap-y-1.5 text-[12px]"
            style={{ gridTemplateColumns: "1fr auto auto" }}
            role="table"
            aria-label="Feature comparison: Free vs Karl tier"
          >
            {/* Header row */}
            <span role="columnheader" className="sr-only">
              Feature
            </span>
            <span
              role="columnheader"
              className="text-[10px] font-bold uppercase text-center text-muted-foreground"
            >
              Free
            </span>
            <span
              role="columnheader"
              className="text-[10px] font-bold uppercase text-center text-muted-foreground"
            >
              Karl
            </span>

            {/* Feature rows */}
            {FEATURE_COMPARISON.map((row) => (
              <div key={row.feature} role="row" className="contents">
                <span
                  role="cell"
                  className="font-medium text-foreground/90 font-body py-0.5"
                >
                  {row.feature}
                </span>
                <span
                  role="cell"
                  className="text-center text-muted-foreground py-0.5 px-4"
                >
                  {row.free}
                </span>
                <span
                  role="cell"
                  className="text-center text-foreground py-0.5 px-4"
                >
                  {row.karl}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-5 sm:px-6 py-4 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={isSubscribing}
            className={[
              "w-full min-h-[44px] px-4 py-3",
              "text-[14px] font-heading font-semibold tracking-wide",
              "bg-gold text-primary-foreground",
              "hover:brightness-110 transition-colors",
              "border border-gold rounded-sm",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            ].join(" ")}
            aria-label="Subscribe for three dollars and ninety nine cents per month"
          >
            {isSubscribing ? "Redirecting\u2026" : "Subscribe for $3.99/month"}
          </button>
          <button
            type="button"
            onClick={handleDecline}
            className={[
              "w-full min-h-[44px] px-4 py-2.5",
              "text-[13px] font-body",
              "text-foreground border border-border rounded-sm",
              "hover:border-foreground/30 hover:text-foreground transition-colors",
            ].join(" ")}
            aria-label="Continue with free plan"
          >
            Continue with free plan
          </button>
          <p className="text-[11px] text-center text-muted-foreground font-body mt-1">
            You can upgrade anytime from Settings.
          </p>
        </div>
      </div>
    </div>
  );
}
