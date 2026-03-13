"use client";

/**
 * Dashboard Page — /ledger route
 *
 * Anonymous-first: all users land here directly. No redirect to /ledger/sign-in.
 *
 * Reads householdId from AuthContext (either session.user.sub for signed-in
 * users, or the anonymous UUID from localStorage("fenrir:household")).
 * Loads all active cards from localStorage under the per-household key.
 *
 * Layout (Issue #279 — tabbed redesign):
 *   Card grid is now inside a tabbed layout inside the Dashboard component.
 *
 * Layout (Issue #352 — 5-tab expansion):
 *   Dashboard now has 5 tabs: The Howl · The Hunt · Active · Valhalla · All.
 *   Closed cards are now included in the card set passed to Dashboard.
 *   Tab selection can be overridden via ?tab= URL param.
 *
 * Note: useSearchParams() requires a <Suspense> boundary in Next.js 15.
 * DashboardPageContent uses useSearchParams and is wrapped in Suspense below.
 *
 * See Dashboard.tsx for tab layout spec.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { LS_TRIAL_START_TOAST_SHOWN, computeFingerprint } from "@/lib/trial-utils";
import { clearTrialStatusCache } from "@/hooks/useTrialStatus";
import { ensureFreshToken } from "@/lib/auth/refresh-session";
import { useAuth } from "@/hooks/useAuth";
import { useEntitlement } from "@/hooks/useEntitlement";
import Link from "next/link";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { CardSkeletonGrid } from "@/components/dashboard/CardSkeletonGrid";
import { ImportWizard } from "@/components/sheets/ImportWizard";
import { AuthGate } from "@/components/shared/AuthGate";
import { KarlUpsellDialog, KARL_UPSELL_IMPORT } from "@/components/entitlement/KarlUpsellDialog";
import { UpsellBanner } from "@/components/entitlement/UpsellBanner";
import { SignInNudge } from "@/components/layout/SignInNudge";
import { initializeHousehold, getCards, saveCard, migrateIfNeeded } from "@/lib/storage";
import type { Card } from "@/lib/types";

// ─── Inner component (uses useSearchParams — must be wrapped in Suspense) ─────

function DashboardPageContent() {
  const { householdId, status } = useAuth();
  const { hasFeature } = useEntitlement();
  const canImport = hasFeature("import");
  const searchParams = useSearchParams();
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  // Import wizard visibility
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  // Import upsell dialog visibility (#559)
  const [importUpsellOpen, setImportUpsellOpen] = useState(false);

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
    // getCards() now returns ALL non-deleted cards including closed (Issue #352)
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

  /** Open import wizard if Karl, otherwise show upsell (#559). */
  const handleImportClick = useCallback(() => {
    if (canImport) {
      setImportWizardOpen(true);
    } else {
      setImportUpsellOpen(true);
    }
  }, [canImport]);

  // Listen for custom event from EmptyState's "Import from Google Sheets" button
  useEffect(() => {
    function handleOpenWizard() {
      handleImportClick();
    }
    window.addEventListener("fenrir:open-import-wizard", handleOpenWizard);
    return () => window.removeEventListener("fenrir:open-import-wizard", handleOpenWizard);
  }, [handleImportClick]);

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

    const refreshed = getCards(householdId); // includes closed cards for Valhalla tab
    setCards(refreshed);
    // Do NOT close the wizard here -- ImportWizard shows the success step
    // and auto-closes itself after 1.5s via its own useEffect.

    const count = importedCards.length;
    toast.success(`${count} card${count !== 1 ? "s" : ""} added to your ledger.`);

    // Trial start toast — fires once on first card import (Issue #621)
    const toastShown = localStorage.getItem(LS_TRIAL_START_TOAST_SHOWN);
    if (!toastShown) {
      localStorage.setItem(LS_TRIAL_START_TOAST_SHOWN, "true");

      // Initialize trial via API (idempotent)
      void (async () => {
        try {
          const token = await ensureFreshToken();
          const fingerprint = await computeFingerprint();
          if (token && fingerprint) {
            await fetch("/api/trial/init", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ fingerprint }),
            });
            clearTrialStatusCache();
          }
        } catch {
          // Trial init is best-effort — don't block import flow
        }
      })();

      toast("Your 30-day trial has begun — explore all features", {
        duration: 8000,
      });
    }
  }

  // Whether we have at least one card (drives CTA visibility rules)
  const hasCards = loaded && cards.length > 0;

  // Read ?tab= URL param to pass as initialTab to Dashboard
  const initialTab = searchParams?.get("tab") ?? undefined;

  return (
    <div className="px-6 py-6">
      {/* Page header: title + actions */}
      <div className="flex items-center justify-between mb-6 gap-3">
        {/* Voice 2: atmospheric page heading from copywriting.md navigation labels */}
        <h1 className="font-display text-2xl text-gold tracking-wide">
          The Ledger of Fates
        </h1>

        <div className="flex items-center gap-2">
          {/* Import button — visible for all signed-in users; Thrall sees upsell (#559) */}
          {hasCards && (
            <AuthGate>
              <button
                type="button"
                onClick={handleImportClick}
                className="relative inline-flex items-center justify-center rounded-sm text-base font-heading tracking-wide ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-9 px-4 py-2"
              >
                Import
                {!canImport && (
                  <span
                    className="absolute -top-1.5 -right-3 text-[7px] font-mono font-bold border border-gold/30 text-gold/60 px-0.5 leading-tight bg-background"
                    aria-hidden="true"
                  >
                    K
                  </span>
                )}
              </button>
            </AuthGate>
          )}

          {/* Add Card button in header — hidden when zero cards.
              When empty, the single CTA lives in the EmptyState component. */}
          {hasCards && (
            <Link
              href="/ledger/cards/new"
              className="inline-flex items-center justify-center rounded-sm text-base font-heading tracking-wide ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary hover:brightness-110 h-9 px-4 py-2"
            >
              Add Card
            </Link>
          )}
        </div>
      </div>

      {/* Karl upsell banner — hidden when zero cards to reduce noise on first visit.
          The UpsellBanner self-hides for Karl/dismissed users. */}
      {hasCards && (
        <div className="mb-4">
          <UpsellBanner />
        </div>
      )}

      {/* Sign-in nudge — subtle muted text when zero cards; full banner when has cards.
          Hidden entirely for authenticated users. */}
      <SignInNudge hasCards={hasCards} />

      {/* Dashboard — 5-tab card layout (Howl · Hunt · Active · Valhalla · All) */}
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
        <Dashboard cards={cards} initialTab={initialTab} />
      )}

      {/* Import Wizard modal */}
      <ImportWizard
        open={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        onConfirmImport={handleConfirmImport}
        existingCards={cards}
      />

      {/* Karl upsell dialog for import — Thrall users see this (#559) */}
      <KarlUpsellDialog
        {...KARL_UPSELL_IMPORT}
        open={importUpsellOpen}
        onDismiss={() => setImportUpsellOpen(false)}
      />
    </div>
  );
}

// ─── Page export — wraps content in Suspense for useSearchParams ───────────────

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageContent />
    </Suspense>
  );
}
