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
 * See ADR-006 for the anonymous-first auth model.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { CardSkeletonGrid } from "@/components/dashboard/CardSkeletonGrid";
import { initializeHousehold, getCards, migrateIfNeeded } from "@/lib/storage";
import type { Card } from "@/lib/types";

export default function DashboardPage() {
  const { householdId, status } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Wait for auth state to resolve before reading localStorage
    if (status === "loading") return;
    // householdId is always set once status resolves (anonymous or authenticated)
    if (!householdId) return;

    migrateIfNeeded();
    initializeHousehold(householdId);
    const loaded = getCards(householdId);
    setCards(loaded);
    setIsLoading(false);
  }, [householdId, status]);

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        {/* Voice 2: atmospheric page heading from copywriting.md navigation labels */}
        <h1 className="font-display text-xl text-gold tracking-wide">The Ledger of Fates</h1>
        <Link
          href="/cards/new"
          className="inline-flex items-center justify-center rounded-sm text-sm font-heading tracking-wide ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-gold-bright h-9 px-4 py-2"
        >
          Add Card
        </Link>
      </div>

      {isLoading || status === "loading" ? (
        /* Skeleton shimmer grid — replaces plain loading text.
           CardSkeletonGrid renders a structural mirror of the real card grid
           with a Norse gold shimmer animation (saga-shimmer in globals.css).
           "The Norns are weaving..." caption still appears beneath the grid. */
        <CardSkeletonGrid count={6} />
      ) : (
        /* saga-reveal CSS class is no longer needed here — Framer Motion
           AnimatedCardGrid inside Dashboard handles the staggered entrance. */
        <Dashboard cards={cards} />
      )}
    </div>
  );
}
