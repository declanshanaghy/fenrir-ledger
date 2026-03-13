"use client";

/**
 * Settings Page -- /settings route
 *
 * Central settings hub for the Fenrir Ledger. Contains:
 *   - Subscription management (Stripe) -- left column on desktop
 *   - Settings controls (Restore Tab Guides, etc.) -- right column on desktop
 *
 * Anonymous-first: accessible without a signed-in session. The settings
 * components handle their own auth/entitlement checks internally.
 *
 * Layout: two-column on desktop (md+), single-column stacked on mobile.
 * Mobile-first: 375px minimum, stacked sections with consistent spacing.
 */

import { useCallback, useEffect, useState } from "react";
import { StripeSettings } from "@/components/entitlement/StripeSettings";
import type { DashboardTab } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Tab guide localStorage keys
// ---------------------------------------------------------------------------

/** All 5 dashboard tab IDs */
const TAB_IDS: DashboardTab[] = ["all", "valhalla", "active", "hunt", "howl"];

/** All 10 localStorage keys for dismissed tab headers and summaries */
const TAB_GUIDE_KEYS: string[] = TAB_IDS.flatMap((tabId) => [
  `fenrir:tab-header-dismissed:${tabId}`,
  `fenrir:tab-summary-dismissed:${tabId}`,
]);

/**
 * Check how many tab guide localStorage keys are currently set to "true".
 * Returns 0 if localStorage is unavailable.
 */
function countDismissedGuides(): number {
  try {
    return TAB_GUIDE_KEYS.filter(
      (key) => localStorage.getItem(key) === "true"
    ).length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Restore Tab Guides section
// ---------------------------------------------------------------------------

/** Duration in ms to show the confirmation message after restoring guides */
const CONFIRMATION_DURATION_MS = 3000;

/**
 * RestoreTabGuides — settings section to reset all dismissed tab headers and summaries.
 *
 * Shows a "Restore the Guides" button that clears all 10 fenrir:tab-*-dismissed:*
 * localStorage keys. Button is disabled when no keys are set (nothing to restore).
 * Displays a brief confirmation message after reset.
 *
 * Issue #587 — Settings widget to reset dismissed tab headers
 */
function RestoreTabGuides() {
  const [dismissedCount, setDismissedCount] = useState<number>(0);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);

  // Read dismissed count from localStorage on mount
  useEffect(() => {
    setDismissedCount(countDismissedGuides());
  }, []);

  // Auto-hide confirmation message after timeout
  useEffect(() => {
    if (!showConfirmation) return;
    const timer = setTimeout(() => {
      setShowConfirmation(false);
    }, CONFIRMATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showConfirmation]);

  const handleRestore = useCallback(() => {
    try {
      for (const key of TAB_GUIDE_KEYS) {
        localStorage.removeItem(key);
      }
    } catch {
      // localStorage unavailable — nothing to do
    }
    setDismissedCount(0);
    setShowConfirmation(true);
  }, []);

  const hasGuidesToRestore = dismissedCount > 0;

  return (
    <section
      className="border border-border p-5 flex flex-col gap-3"
      aria-label="Restore Tab Guides"
    >
      <h2 className="text-sm font-heading font-bold uppercase tracking-[0.08em] text-foreground">
        Tab Guides
      </h2>
      <p className="text-base text-foreground/90 leading-relaxed font-body">
        Dismissed tab headers and summaries can be restored here. Bring back the
        wisdom of the guides.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="button"
          onClick={handleRestore}
          disabled={!hasGuidesToRestore}
          className={`inline-flex items-center gap-2 min-h-[44px] md:min-h-[40px] px-4 py-2 text-base font-heading tracking-wide border rounded-sm transition-colors ${
            hasGuidesToRestore
              ? "border-gold/60 text-gold hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
              : "border-border text-muted-foreground/60 cursor-not-allowed"
          }`}
          aria-label={
            hasGuidesToRestore
              ? `Restore the Guides (${dismissedCount} dismissed)`
              : "Restore the Guides (none dismissed)"
          }
        >
          <span aria-hidden="true" className="text-base">
            &#x16C7;
          </span>
          Restore the Guides
        </button>

        {showConfirmation && (
          <p
            className="text-sm text-gold font-body"
            role="status"
            aria-live="polite"
          >
            Tab guides restored. The wisdom returns.
          </p>
        )}
      </div>

      {!hasGuidesToRestore && !showConfirmation && (
        <p className="text-[13px] italic text-muted-foreground/60 font-body">
          All guides are currently visible. Nothing to restore.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

/**
 * SettingsPage -- the /settings route.
 *
 * Two-column layout on desktop: subscription management on the left,
 * settings controls on the right. Collapses to single-column on mobile
 * (settings stack below the subscription card).
 */
export default function SettingsPage() {
  return (
    <div className="px-6 py-6 max-w-5xl">
      {/* Page heading */}
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="font-display text-2xl text-gold tracking-wide mb-1">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-2 font-body italic">
          Forge your preferences. Shape the ledger to your will.
        </p>
      </header>

      {/* Two-column layout: subscription left, settings right */}
      <div className="flex flex-col md:grid md:grid-cols-2 gap-6">
        {/* Left column: Subscription management */}
        <div className="flex flex-col gap-6">
          <StripeSettings />
        </div>

        {/* Right column: Settings controls */}
        <div className="flex flex-col gap-6">
          <RestoreTabGuides />
        </div>
      </div>
    </div>
  );
}
