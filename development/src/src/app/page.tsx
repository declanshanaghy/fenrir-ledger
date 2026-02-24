"use client";

/**
 * Dashboard Page — root route (/)
 *
 * Initializes the default household on first load (idempotent).
 * Loads all cards from localStorage and renders the Dashboard component.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { initializeDefaultHousehold, getCards, migrateIfNeeded } from "@/lib/storage";
import { DEFAULT_HOUSEHOLD_ID } from "@/lib/constants";
import type { Card } from "@/lib/types";

export default function DashboardPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    migrateIfNeeded();
    initializeDefaultHousehold();
    const loaded = getCards(DEFAULT_HOUSEHOLD_ID);
    setCards(loaded);
    setIsLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader maxWidth="max-w-6xl">
        <Link
          href="/cards/new"
          className="inline-flex items-center justify-center rounded-sm text-sm font-heading tracking-wide ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-gold-bright h-9 px-4 py-2"
        >
          Add Card
        </Link>
      </SiteHeader>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground font-body italic">
            The Norns are weaving...
          </div>
        ) : (
          <div className="saga-reveal">
            <Dashboard cards={cards} />
          </div>
        )}
      </main>
    </div>
  );
}
