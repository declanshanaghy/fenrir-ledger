"use client";

/**
 * TrialBadge — TopBar badge showing trial remaining days with progressive color urgency.
 *
 * Color logic:
 *   Days 1-25:  neutral gray text ("22 days left")
 *   Days 26-29: amber/warning ("4 days left")
 *   Day 30:     red/urgent ("Expires today")
 *   Expired:    "THRALL" badge
 *
 * Click opens TrialStatusPanel (implemented in Issue #3 — placeholder for now).
 *
 * @see plans/001-trial.md (Phase 3)
 * @see ux/wireframes/trial/trial-start.html
 * @see Issue #621
 */

import { useState } from "react";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { TRIAL_DURATION_DAYS } from "@/lib/trial-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Days remaining threshold for amber/warning color. */
const AMBER_THRESHOLD = 5;

/** Days remaining threshold for red/urgent color. */
const RED_THRESHOLD = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the display text and CSS color class for the given trial state.
 *
 * @param remainingDays - Number of days remaining in the trial
 * @param status - Current trial status
 * @returns Object with label text and Tailwind color class
 */
function getBadgeStyle(remainingDays: number, status: string): { label: string; colorClass: string } {
  if (status === "expired") {
    return { label: "THRALL", colorClass: "text-muted-foreground border-muted-foreground/50" };
  }

  if (status !== "active") {
    // "none" or "converted" — no badge shown, but return a sensible default
    return { label: "", colorClass: "" };
  }

  // Day 30 (last day): red/urgent
  if (remainingDays <= RED_THRESHOLD) {
    return { label: "Expires today", colorClass: "text-red-600 border-red-600/50" };
  }

  // Days 26-29 (approaching expiry): amber/warning
  const daysElapsed = TRIAL_DURATION_DAYS - remainingDays;
  if (daysElapsed >= TRIAL_DURATION_DAYS - AMBER_THRESHOLD) {
    return { label: `${remainingDays} days left`, colorClass: "text-amber-600 border-amber-600/50" };
  }

  // Days 1-25: neutral gray
  return { label: `${remainingDays} days left`, colorClass: "text-muted-foreground border-border" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TrialBadge() {
  const { remainingDays, status, isLoading } = useTrialStatus();
  const [panelOpen, setPanelOpen] = useState(false);

  // Don't render if loading, no trial, or converted
  if (isLoading || status === "none" || status === "converted") {
    return null;
  }

  const { label, colorClass } = getBadgeStyle(remainingDays, status);

  if (!label) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPanelOpen((prev) => !prev)}
        className={[
          "text-xs font-semibold border px-2 py-0.5 whitespace-nowrap",
          "transition-colors cursor-pointer",
          "hover:bg-secondary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
          colorClass,
        ].join(" ")}
        aria-label={status === "expired" ? "Trial expired — Thrall tier" : `Trial: ${label}`}
        style={{ minHeight: 28 }}
      >
        {label}
      </button>

      {/* TrialStatusPanel placeholder — Issue #3 will implement the full panel */}
      {panelOpen && (
        <div
          role="dialog"
          aria-label="Trial status"
          className={[
            "absolute right-0 top-full mt-2",
            "w-64 border border-border bg-background/95 backdrop-blur-sm",
            "rounded-sm shadow-lg z-50 p-4",
          ].join(" ")}
        >
          <p className="text-sm text-muted-foreground font-body">
            {status === "expired"
              ? "Your trial has ended. Subscribe to Karl to unlock full features."
              : `You have ${remainingDays} day${remainingDays !== 1 ? "s" : ""} remaining in your Karl trial.`}
          </p>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close trial status panel"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}
