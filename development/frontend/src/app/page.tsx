"use client";

/**
 * Dashboard Page — root route (/)
 *
 * Anonymous-first: all users land here directly. No redirect to /sign-in.
 *
 * Reads householdId from AuthContext (either session.user.sub for signed-in
 * users, or the anonymous UUID from localStorage("fenrir:household")).
 * Loads all active cards from localStorage under the per-household key.
 *
 * Layout (Sprint 3.4 — HowlPanel):
 *   Desktop (lg+): two-column flex row.
 *     Left: card grid (flex-1, min-w-0)
 *     Right: HowlPanel sidebar (w-72, shrink-0) — slides in when urgent cards exist
 *   Mobile (< lg): single column. Bell button (ᚲ) in header opens HowlPanel
 *     as a fixed bottom sheet via AnimatedHowlPanel mobileOpen prop.
 *
 * See AnimatedHowlPanel in components/layout/HowlPanel.tsx for animation spec.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { CardSkeletonGrid } from "@/components/dashboard/CardSkeletonGrid";
import { AnimatedHowlPanel } from "@/components/layout/HowlPanel";
import { ImportWizard } from "@/components/sheets/ImportWizard";
import { AuthGate } from "@/components/shared/AuthGate";
import { UpsellBanner } from "@/components/entitlement/UpsellBanner";
import { initializeHousehold, getCards, saveCard, migrateIfNeeded } from "@/lib/storage";
import type { Card } from "@/lib/types";

export default function DashboardPage() {
  const { householdId, status } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  // Mobile HowlPanel bottom-sheet visibility
  const [mobileHowlOpen, setMobileHowlOpen] = useState(false);
  // Import wizard visibility
  const [importWizardOpen, setImportWizardOpen] = useState(false);

  useEffect(() => {
    // Wait for auth state to resolve before reading localStorage
    if (status === "loading") return;
    // householdId is always set once status resolves (anonymous or authenticated)
    if (!householdId) return;

    // Start loading timer - only show skeleton if loading takes > 500ms
    const skeletonTimer = setTimeout(() => {
      if (isLoading) {
        setShowSkeleton(true);
      }
    }, 500);

    migrateIfNeeded();
    initializeHousehold(householdId);
    const loaded = getCards(householdId);
    setCards(loaded);
    setIsLoading(false);
    clearTimeout(skeletonTimer);
    setShowSkeleton(false);

    // Pick up merge result from auth callback redirect
    const mergeResult = sessionStorage.getItem("fenrir:merge-result");
    if (mergeResult) {
      sessionStorage.removeItem("fenrir:merge-result");
      try {
        const { merged } = JSON.parse(mergeResult) as { merged: number };
        toast.success(`${merged} card${merged !== 1 ? "s" : ""} carried into your ledger.`);
      } catch {
        // Corrupt data — ignore silently
      }
    }
  }, [householdId, status, isLoading]);

  // Listen for custom event from EmptyState's "Import from Google Sheets" button
  useEffect(() => {
    function handleOpenWizard() {
      setImportWizardOpen(true);
    }
    window.addEventListener("fenrir:open-import-wizard", handleOpenWizard);
    return () => window.removeEventListener("fenrir:open-import-wizard", handleOpenWizard);
  }, []);

  const urgentCount = cards.filter(
    (c) => c.status === "fee_approaching" || c.status === "promo_expiring" || c.status === "overdue"
  ).length;

  const loaded = !isLoading && status !== "loading";

  function handleConfirmImport(importedCards: Omit<Card, "householdId">[]) {
    if (!householdId) return;

    for (const c of importedCards) {
      const card: Card = {
        ...c,
        householdId,
        status: "active",
      };
      saveCard(card);
    }

    const refreshed = getCards(householdId);
    setCards(refreshed);
    // Do NOT close the wizard here -- ImportWizard shows the success step
    // and auto-closes itself after 1.5s via its own useEffect.

    const count = importedCards.length;
    toast.success(`${count} card${count !== 1 ? "s" : ""} added to your ledger.`);
  }

  return (
    <div className="px-6 py-6">
      {/* Page header: title + actions */}
      <div className="flex items-center justify-between mb-6 gap-3">
        {/* Voice 2: atmospheric page heading from copywriting.md navigation labels */}
        <h1 className="font-display text-2xl text-gold tracking-wide">
          The Ledger of Fates
        </h1>

        <div className="flex items-center gap-2">
          {/* Mobile bell button — ᚲ Kenaz rune as urgency indicator.
              Shown only on mobile (lg:hidden) when urgent cards exist.
              On desktop the HowlPanel is inline; no button needed. */}
          {loaded && urgentCount > 0 && (
            <button
              type="button"
              onClick={() => setMobileHowlOpen(true)}
              aria-label={`${urgentCount} urgent card${urgentCount === 1 ? "" : "s"} — open urgent panel`}
              className="lg:hidden relative inline-flex items-center justify-center h-9 w-9 rounded-sm border border-border text-muted-foreground hover:border-gold/50 hover:text-gold transition-colors"
            >
              <span
                aria-hidden="true"
                className="text-base leading-none"
                style={{ fontFamily: "serif" }}
              >
                ᚲ
              </span>
              {/* Urgent count badge */}
              <span
                className="absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center rounded-full bg-[hsl(var(--realm-muspel))] text-xs font-mono font-bold text-white"
                aria-hidden="true"
              >
                {urgentCount}
              </span>
            </button>
          )}

          {/* Import button — shown in toolbar only when cards exist and user is signed in */}
          {loaded && cards.length > 0 && (
            <AuthGate>
              <button
                type="button"
                onClick={() => setImportWizardOpen(true)}
                className="inline-flex items-center justify-center rounded-sm text-base font-heading tracking-wide ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-9 px-4 py-2"
              >
                Import
              </button>
            </AuthGate>
          )}

          <Link
            href="/cards/new"
            className="inline-flex items-center justify-center rounded-sm text-base font-heading tracking-wide ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary hover:brightness-110 h-9 px-4 py-2"
          >
            Add Card
          </Link>
        </div>
      </div>

      {/* Upsell banner -- shown to Thrall users above the card grid.
          The UpsellBanner self-hides for Karl/dismissed users. */}
      <div className="mb-4">
        <UpsellBanner />
      </div>

      {/* Main content row: card grid + HowlPanel side-by-side on desktop */}
      <div className="flex gap-6 items-start">
        {/* Card grid — takes all available space */}
        <div className="flex-1 min-w-0">
          {!loaded ? (
            /* Only show skeleton if loading takes > 500ms to prevent flash */
            showSkeleton ? (
              /* Skeleton shimmer grid — replaces plain loading text.
                 CardSkeletonGrid renders a structural mirror of the real card grid
                 with a Norse gold shimmer animation (saga-shimmer in globals.css).
                 "The Norns are weaving..." caption still appears beneath the grid. */
              <CardSkeletonGrid count={6} />
            ) : null
          ) : (
            /* saga-reveal CSS class is no longer needed here — Framer Motion
               AnimatedCardGrid inside Dashboard handles the staggered entrance. */
            <Dashboard cards={cards} />
          )}
        </div>

        {/* HowlPanel — desktop inline sidebar + mobile bottom sheet.
            AnimatedHowlPanel handles both:
              - Desktop: AnimatePresence slide-in from right (hidden lg:flex inside)
              - Mobile: fixed bottom sheet when mobileOpen === true
            The outer div reserves the sidebar slot on lg+ so the card grid
            doesn't jump when the panel appears/disappears. */}
        {loaded && (
          <AnimatedHowlPanel
            cards={cards}
            mobileOpen={mobileHowlOpen}
            onMobileClose={() => setMobileHowlOpen(false)}
          />
        )}
      </div>

      {/* Import Wizard modal */}
      <ImportWizard
        open={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        onConfirmImport={handleConfirmImport}
        existingCards={cards}
      />
    </div>
  );
}
