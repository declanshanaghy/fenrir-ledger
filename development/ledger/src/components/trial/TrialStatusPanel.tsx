"use client";

/**
 * TrialStatusPanel — Dropdown panel anchored to the TrialBadge in the TopBar.
 *
 * Shows trial progress, personalized value summary, and upgrade CTA.
 * Opens via click on TrialBadge, closes via click-outside, Escape, or dismiss button.
 *
 * Sections:
 *   1. Header — "Karl Trial" + atmospheric subtitle (rotates by days remaining)
 *   2. Progress bar — visual + "Day N of 30" text
 *   3. Value summary — personalized metrics from localStorage
 *   4. CTA — Stripe subscribe button + soft dismiss
 *
 * Mobile (375px+): panel stretches full width with 8px margins.
 * Desktop: fixed 320px width, anchored right.
 *
 * @see ux/wireframes/trial/trial-status.html
 * @see plans/001-trial.md (Phase 4)
 * @see Issue #622
 *
 * @module trial/TrialStatusPanel
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useTrialMetrics } from "@/hooks/useTrialMetrics";
import { TRIAL_DURATION_DAYS } from "@/lib/trial-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Days remaining threshold for switching to "keep full access" CTA copy. */
const URGENT_CTA_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the atmospheric subtitle (Voice 2) based on days remaining.
 *
 * @param remainingDays - Number of days remaining in the trial
 * @param status - Current trial status
 * @returns Atmospheric subtitle string
 */
export function getAtmosphericSubtitle(remainingDays: number, status: string): string {
  if (status === "expired") {
    return "Today is the last day. Your data is safe.";
  }
  if (remainingDays <= 0) {
    return "Today is the last day. Your data is safe.";
  }
  if (remainingDays <= 3) {
    return `${remainingDays} day${remainingDays !== 1 ? "s" : ""} remain. Your data is safe.`;
  }
  if (remainingDays <= 9) {
    return "The hunt nears its end.";
  }
  if (remainingDays <= 19) {
    return "The pack grows stronger.";
  }
  return "The wolf runs with the pack.";
}

/**
 * Returns the CTA button text based on days remaining and trial status.
 *
 * @param remainingDays - Number of days remaining
 * @param status - Current trial status
 * @returns CTA button text
 */
export function getCtaText(remainingDays: number, status: string): string {
  if (status === "expired") {
    return "Reactivate \u2014 $3.99/month";
  }
  if (remainingDays <= URGENT_CTA_THRESHOLD) {
    return "Keep full access \u2014 $3.99/month";
  }
  return "Subscribe for $3.99/month";
}

/**
 * Returns the dismiss link text based on days remaining and trial status.
 *
 * @param remainingDays - Number of days remaining
 * @param status - Current trial status
 * @returns Dismiss link text
 */
export function getDismissText(remainingDays: number, status: string): string {
  if (status === "expired") {
    return "Maybe later";
  }
  if (remainingDays <= URGENT_CTA_THRESHOLD) {
    return "I\u2019ll decide later";
  }
  return "Not now";
}

/**
 * Returns the value section heading based on days remaining.
 *
 * @param remainingDays - Number of days remaining
 * @returns Heading text
 */
export function getValueHeading(remainingDays: number): string {
  if (remainingDays <= URGENT_CTA_THRESHOLD) {
    return "What You Built During Your Trial";
  }
  return "Your Trial So Far";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TrialStatusPanelProps {
  /** Number of days remaining in the trial. */
  remainingDays: number;
  /** Current trial status. */
  status: string;
  /** Callback when the panel should close. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TrialStatusPanel — dropdown panel showing trial progress and metrics.
 *
 * Rendered inside the TrialBadge component when the badge is clicked.
 * Manages its own focus trap and keyboard/click-outside dismissal.
 */
export function TrialStatusPanel({
  remainingDays,
  status,
  onClose,
}: TrialStatusPanelProps) {
  const router = useRouter();
  const { subscribeStripe } = useEntitlement();
  const metrics = useTrialMetrics();
  const panelRef = useRef<HTMLDivElement>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const daysElapsed = TRIAL_DURATION_DAYS - remainingDays;
  const progressPercent = Math.min(
    100,
    Math.max(0, (daysElapsed / TRIAL_DURATION_DAYS) * 100)
  );

  // -- Close on Escape key --
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // -- Close on click outside --
  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Use setTimeout to avoid catching the same click that opened the panel
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // -- Focus trap: focus first focusable element on mount --
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const firstFocusable = panel.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
    );
    firstFocusable?.focus();
  }, []);

  const handleSubscribe = useCallback(async () => {
    setIsSubscribing(true);
    try {
      await subscribeStripe();
    } catch {
      setIsSubscribing(false);
    }
  }, [subscribeStripe]);

  const handleLearnMore = useCallback(() => {
    onClose();
    router.push("/pricing");
  }, [onClose, router]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby="trial-panel-title"
      className={[
        // Desktop: fixed width, right-aligned
        "absolute top-full mt-1 right-0",
        "w-[320px]",
        // Mobile: full width with margins
        "max-[480px]:left-2 max-[480px]:right-2 max-[480px]:w-auto",
        // Shared styles
        "border border-border bg-background/95 backdrop-blur-sm",
        "rounded-sm shadow-lg flex flex-col",
      ].join(" ")}
      style={{ zIndex: 210 }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 border-b border-border">
        <h2
          id="trial-panel-title"
          className="text-[15px] font-display font-bold text-foreground tracking-wide"
        >
          Karl Trial
        </h2>
        <p
          className="text-xs italic text-muted-foreground/80 mt-1 font-body"
          aria-hidden="true"
        >
          {getAtmosphericSubtitle(remainingDays, status)}
        </p>
      </div>

      {/* ── Progress bar ───────────────────────────────────────── */}
      <div
        className="px-5 py-3 border-b border-border"
        aria-live="polite"
      >
        <div
          className="h-1.5 w-full bg-secondary rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={daysElapsed}
          aria-valuemin={0}
          aria-valuemax={TRIAL_DURATION_DAYS}
          aria-label={`Trial progress: day ${daysElapsed} of ${TRIAL_DURATION_DAYS}`}
        >
          <div
            className={[
              "h-full rounded-full transition-all duration-300",
              remainingDays <= URGENT_CTA_THRESHOLD ? "bg-amber-500" : "bg-gold",
            ].join(" ")}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-muted-foreground font-body">
            Day {daysElapsed} of {TRIAL_DURATION_DAYS}
          </span>
          <span className="text-[10px] text-muted-foreground font-body">
            {remainingDays} day{remainingDays !== 1 ? "s" : ""} remaining
          </span>
        </div>
      </div>

      {/* ── Value summary ──────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-border">
        <h3 className="text-[11px] font-mono font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-2">
          {getValueHeading(remainingDays)}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold text-foreground font-display">
              {metrics.cardCount}
            </span>
            <span className="text-[10px] text-muted-foreground font-body">
              Cards tracked
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold text-foreground font-display">
              {metrics.totalAnnualFeesFormatted}
            </span>
            <span className="text-[10px] text-muted-foreground font-body">
              Fees monitored
            </span>
          </div>
          {/* Show alerts + savings/valhalla on desktop only */}
          <div className="flex flex-col gap-0.5 max-[480px]:hidden">
            <span className="text-lg font-bold text-foreground font-display">
              {metrics.feeAlertsCount}
            </span>
            <span className="text-[10px] text-muted-foreground font-body">
              Fee alerts
            </span>
          </div>
          <div className="flex flex-col gap-0.5 max-[480px]:hidden">
            <span className="text-lg font-bold text-foreground font-display">
              {metrics.closedCardsCount > 0
                ? metrics.potentialSavingsFormatted
                : String(metrics.closedCardsCount)}
            </span>
            <span className="text-[10px] text-muted-foreground font-body">
              {metrics.closedCardsCount > 0
                ? "Potential savings"
                : "Cards in Valhalla"}
            </span>
          </div>
        </div>
      </div>

      {/* ── CTA section ────────────────────────────────────────── */}
      <div className="px-5 py-3 flex flex-col gap-2">
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
          aria-label={getCtaText(remainingDays, status)}
        >
          {isSubscribing ? "Redirecting\u2026" : getCtaText(remainingDays, status)}
        </button>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleLearnMore}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-body cursor-pointer"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            Learn more
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-body cursor-pointer"
            aria-label="Dismiss trial status panel"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            {getDismissText(remainingDays, status)}
          </button>
        </div>
      </div>
    </div>
  );
}
