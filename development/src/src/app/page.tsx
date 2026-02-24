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
import { initializeDefaultHousehold, getCards, migrateIfNeeded } from "@/lib/storage";
import { DEFAULT_HOUSEHOLD_ID } from "@/lib/constants";
import type { Card } from "@/lib/types";

export default function DashboardPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Run schema migration (idempotent)
    migrateIfNeeded();
    // Ensure default household exists
    initializeDefaultHousehold();
    // Load cards
    const loaded = getCards(DEFAULT_HOUSEHOLD_ID);
    setCards(loaded);
    setIsLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav header */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              🐺 Fenrir Ledger
            </h1>
            <p className="text-xs text-muted-foreground">
              Break free from fee traps. Harvest every reward.
            </p>
          </div>
          <Link
            href="/cards/new"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
          >
            + Add card
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            Loading your cards...
          </div>
        ) : (
          <Dashboard cards={cards} />
        )}
      </main>
    </div>
  );
}
