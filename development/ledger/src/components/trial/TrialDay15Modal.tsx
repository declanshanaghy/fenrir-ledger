"use client";

/**
 * TrialDay15Modal — One-time mid-trial nudge modal shown on day 15.
 *
 * Fires once when the trial reaches day 15 (or first login after day 15).
 * Persists dismissal in localStorage via `fenrir:trial-day15-nudge-shown`.
 *
 * Content:
 *   - "HALFWAY THERE" label
 *   - "15 days left in your trial" heading
 *   - Personalized metrics: cards tracked + total fees monitored
 *   - "Keep the wolves watching?" soft nudge (Voice 2)
 *   - "Subscribe now" CTA (same Stripe flow)
 *   - Close/dismiss button
 *
 * The modal is dismissible with no aggressive behavior. Once dismissed or
 * CTA clicked, the flag is set and the modal never appears again.
 *
 * @see ux/wireframes/trial/trial-status.html (Scenario 5)
 * @see plans/001-trial.md (Phase 6)
 * @see Issue #622
 *
 * @module trial/TrialDay15Modal
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useTrialMetrics } from "@/hooks/useTrialMetrics";
import { useEntitlement } from "@/hooks/useEntitlement";
import {
  TRIAL_DURATION_DAYS,
  LS_TRIAL_DAY15_NUDGE_SHOWN,
} from "@/lib/trial-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Day threshold for showing the nudge (day 15 = 15 days remaining). */
const NUDGE_DAY = 15;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether the day-15 nudge has already been shown.
 *
 * @returns true if the nudge flag is set in localStorage
 */
function isNudgeShown(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(LS_TRIAL_DAY15_NUDGE_SHOWN) === "true";
  } catch {
    return true; // Assume shown if localStorage is unavailable
  }
}

/**
 * Sets the day-15 nudge flag in localStorage.
 */
function markNudgeShown(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_TRIAL_DAY15_NUDGE_SHOWN, "true");
  } catch {
    // localStorage unavailable — silently fail
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TrialDay15Modal — renders a one-time nudge modal at the trial midpoint.
 *
 * Mount this component at the app layout level. It self-manages visibility
 * based on trial status and localStorage flag.
 */
export function TrialDay15Modal() {
  const { remainingDays, status, isLoading } = useTrialStatus();
  const metrics = useTrialMetrics();
  const { subscribeStripe } = useEntitlement();
  const [visible, setVisible] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Determine if the nudge should show
  useEffect(() => {
    if (isLoading || status !== "active") return;
    if (isNudgeShown()) return;

    // Show nudge on day 15 or later (remainingDays <= 15)
    const daysElapsed = TRIAL_DURATION_DAYS - remainingDays;
    if (daysElapsed >= NUDGE_DAY) {
      setVisible(true);
    }
  }, [remainingDays, status, isLoading]);

  // Focus trap on mount
  useEffect(() => {
    if (!visible) return;
    const panel = modalRef.current;
    if (!panel) return;
    const firstFocusable = panel.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
    );
    firstFocusable?.focus();
  }, [visible]);

  // Escape key handler
  useEffect(() => {
    if (!visible) return;
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        handleDismiss();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleDismiss = useCallback(() => {
    markNudgeShown();
    setVisible(false);
  }, []);

  const handleSubscribe = useCallback(async () => {
    markNudgeShown();
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
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-labelledby="trial-day15-title"
        aria-modal="true"
        className={[
          "relative w-full max-w-[380px]",
          "border border-border bg-background",
          "rounded-sm shadow-lg",
          "flex flex-col gap-0",
        ].join(" ")}
        style={{ zIndex: 221 }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2 right-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors text-sm"
          aria-label="Dismiss mid-trial nudge"
        >
          &times;
        </button>

        {/* Content */}
        <div className="px-5 pt-4 pb-4 flex flex-col gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">
            HALFWAY THERE
          </span>
          <h2
            id="trial-day15-title"
            className="text-[15px] font-display font-bold text-foreground"
          >
            15 days left in your trial
          </h2>
          <p className="text-[13px] text-foreground/90 leading-relaxed font-body">
            You&apos;ve tracked {metrics.cardCount} card{metrics.cardCount !== 1 ? "s" : ""} and{" "}
            {metrics.totalAnnualFeesFormatted} in annual fees.
            <br />
            <span className="italic text-muted-foreground/80">
              Keep the wolves watching?
            </span>
          </p>
        </div>

        {/* CTA */}
        <div className="px-5 pb-4">
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={isSubscribing}
            className={[
              "w-full min-h-[44px] px-4 py-2.5",
              "text-[13px] font-heading font-semibold tracking-wide",
              "bg-gold text-primary-foreground",
              "hover:brightness-110 transition-colors",
              "border border-gold rounded-sm",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            ].join(" ")}
            aria-label="Subscribe now"
          >
            {isSubscribing ? "Redirecting\u2026" : "Subscribe now"}
          </button>
        </div>
      </div>
    </div>
  );
}
