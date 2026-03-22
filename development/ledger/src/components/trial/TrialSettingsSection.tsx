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

  // Don't render while loading or for paid subscribers (already converted)
  if (isLoading || status === "converted") {
    return null;
  }

  // Anonymous / no-trial state: show Norse-themed "not started" box
  if (status === "none") {
    return (
      <section
        className="relative border border-border p-5 flex flex-col gap-3"
        aria-label="Trial Status"
      >
        <h2 className="text-sm font-heading font-bold uppercase tracking-[0.08em] text-foreground">
          Trial Status
        </h2>
        <div className="border border-muted/20 bg-muted/5 p-3 flex flex-col gap-1.5">
          <p className="text-[13px] font-heading font-semibold text-foreground">
            Thy trial hath not yet begun, wanderer
          </p>
          <p className="text-[12px] text-muted-foreground font-body leading-relaxed">
            Sign in with your Google account to begin thy 30&#8209;day Karl Trial — free
            to start, no charge until thou subscribest.
          </p>
        </div>
        <a
          href="/ledger/sign-in"
          className={[
            "inline-flex items-center justify-center gap-2",
            "min-h-[44px] md:min-h-[40px] px-5 py-2",
            "text-base font-heading font-semibold tracking-wide",
            "bg-gold text-primary-foreground",
            "hover:brightness-110 transition-colors",
            "border border-gold rounded-sm",
            "self-start",
          ].join(" ")}
          aria-label="Sign in with Google to begin thy Karl Trial"
        >
          Sign in with Google
        </a>
      </section>
    );
  }

  const planLabel =
    status === "expired"
      ? "Karl Trial (Expired)"
      : `Karl Trial (${remainingDays} day${remainingDays !== 1 ? "s" : ""} remaining)`;

  return (
    <section
      className="relative border border-border p-5 flex flex-col gap-3 karl-bling-card"
      aria-label="Trial Status"
    >
      {/* Karl rune corners */}
      <span className="karl-rune-corner karl-rune-tl" aria-hidden="true">ᚠ</span>
      <span className="karl-rune-corner karl-rune-tr" aria-hidden="true">ᚱ</span>
      <span className="karl-rune-corner karl-rune-bl" aria-hidden="true">ᛁ</span>
      <span className="karl-rune-corner karl-rune-br" aria-hidden="true">ᚾ</span>
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

      {/* Subscribe CTA — only shown when trial has expired (hidden during active trial) */}
      {status === "expired" && (
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
            "border border-gold rounded-sm karl-bling-btn",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "self-start",
          ].join(" ")}
          aria-label="Upgrade to Karl subscription"
        >
          {isSubscribing
            ? "Redirecting\u2026"
            : "Upgrade to Karl \u2014 $3.99/month"}
        </button>
      )}
    </section>
  );
}
