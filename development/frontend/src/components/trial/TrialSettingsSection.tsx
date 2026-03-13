"use client";

/**
 * TrialSettingsSection — Settings page section showing trial status and metrics.
 *
 * Displays during an active trial:
 *   - Current plan ("Karl Trial (22 days remaining)")
 *   - Trial start date
 *   - Trial end date
 *   - Cards tracked count
 *   - Subscribe CTA button
 *
 * Self-hides when no trial is active (status === "none" or "converted").
 *
 * @see ux/wireframes/trial/trial-status.html (Scenario 3)
 * @see Issue #622
 *
 * @module trial/TrialSettingsSection
 */

import { useState, useCallback } from "react";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useTrialMetrics } from "@/hooks/useTrialMetrics";
import { useEntitlement } from "@/hooks/useEntitlement";
import { TRIAL_DURATION_DAYS } from "@/lib/trial-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes an approximate trial start date from remaining days.
 * Returns a formatted date string.
 *
 * @param remainingDays - Number of days remaining in the trial
 * @returns Formatted date string (e.g. "February 18, 2026")
 */
function computeTrialStartDate(remainingDays: number): string {
  const now = new Date();
  const daysElapsed = TRIAL_DURATION_DAYS - remainingDays;
  const startDate = new Date(now.getTime() - daysElapsed * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(startDate);
}

/**
 * Computes an approximate trial end date from remaining days.
 * Returns a formatted date string.
 *
 * @param remainingDays - Number of days remaining in the trial
 * @returns Formatted date string (e.g. "March 20, 2026")
 */
function computeTrialEndDate(remainingDays: number): string {
  const now = new Date();
  const endDate = new Date(now.getTime() + remainingDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(endDate);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TrialSettingsSection — self-managing settings section for trial info.
 *
 * Renders only during active trial or expired state.
 * Shows trial details alongside StripeSettings component.
 */
export function TrialSettingsSection() {
  const { remainingDays, status, isLoading } = useTrialStatus();
  const metrics = useTrialMetrics();
  const { subscribeStripe } = useEntitlement();
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSubscribe = useCallback(async () => {
    setIsSubscribing(true);
    try {
      await subscribeStripe();
    } catch {
      setIsSubscribing(false);
    }
  }, [subscribeStripe]);

  // Don't render if no trial or already converted
  if (isLoading || status === "none" || status === "converted") {
    return null;
  }

  const planLabel =
    status === "expired"
      ? "Karl Trial (Expired)"
      : `Karl Trial (${remainingDays} day${remainingDays !== 1 ? "s" : ""} remaining)`;

  return (
    <section
      className="border border-border p-5 flex flex-col gap-3"
      aria-label="Trial Status"
    >
      <h2 className="text-sm font-heading font-bold uppercase tracking-[0.08em] text-foreground">
        Trial Status
      </h2>

      {/* Info rows */}
      <div className="flex flex-col divide-y divide-border">
        <div className="flex justify-between items-center py-2 text-[13px]">
          <span className="font-medium text-foreground font-body">Current plan</span>
          <span className="text-muted-foreground font-body">{planLabel}</span>
        </div>
        {status === "active" && (
          <>
            <div className="flex justify-between items-center py-2 text-[13px]">
              <span className="font-medium text-foreground font-body">Trial started</span>
              <span className="text-muted-foreground font-body">
                {computeTrialStartDate(remainingDays)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 text-[13px]">
              <span className="font-medium text-foreground font-body">Trial ends</span>
              <span className="text-muted-foreground font-body">
                {computeTrialEndDate(remainingDays)}
              </span>
            </div>
          </>
        )}
        <div className="flex justify-between items-center py-2 text-[13px]">
          <span className="font-medium text-foreground font-body">Cards tracked</span>
          <span className="text-muted-foreground font-body">{metrics.cardCount}</span>
        </div>
        <div className="flex justify-between items-center py-2 text-[13px]">
          <span className="font-medium text-foreground font-body">Fees monitored</span>
          <span className="text-muted-foreground font-body">
            {metrics.totalAnnualFeesFormatted}
          </span>
        </div>
      </div>

      {/* Returning user message — shown when trial expired (Issue #623) */}
      {status === "expired" && (
        <div className="border border-gold/20 bg-gold/5 p-3 flex flex-col gap-1.5">
          <p className="text-[13px] font-heading font-semibold text-foreground">
            Upgrade to Karl
          </p>
          <p className="text-[12px] text-muted-foreground font-body leading-relaxed">
            Your trial ended. Subscribe to Karl to unlock all features including
            The Howl, Valhalla, and unlimited cards &mdash; $3.99/mo.
          </p>
        </div>
      )}

      {/* Subscribe CTA */}
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={isSubscribing}
        className={[
          "inline-flex items-center justify-center gap-2",
          "min-h-[44px] md:min-h-[40px] px-5 py-2",
          "text-base font-heading font-semibold tracking-wide",
          "bg-gold text-primary-foreground",
          "hover:brightness-110 transition-colors",
          "border border-gold rounded-sm",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "self-start",
        ].join(" ")}
        aria-label={
          status === "expired"
            ? "Upgrade to Karl subscription"
            : "Subscribe to Karl"
        }
      >
        {isSubscribing
          ? "Redirecting\u2026"
          : status === "expired"
            ? "Upgrade to Karl \u2014 $3.99/month"
            : "Subscribe for $3.99/month"}
      </button>
    </section>
  );
}
