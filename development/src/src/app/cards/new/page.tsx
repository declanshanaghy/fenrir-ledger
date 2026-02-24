"use client";

/**
 * Add Card Page — /cards/new
 *
 * Renders the CardForm in "new card" mode (no initialValues).
 */

import Link from "next/link";
import { CardForm } from "@/components/cards/CardForm";
import { migrateIfNeeded, initializeDefaultHousehold } from "@/lib/storage";
import { useEffect } from "react";

export default function NewCardPage() {
  useEffect(() => {
    // Ensure storage is initialized before the form tries to save
    migrateIfNeeded();
    initializeDefaultHousehold();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav header */}
      <header className="border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            ← Back
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">🐺 Fenrir Ledger</h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Add a card</h2>
          <p className="text-muted-foreground mt-1">
            Track a new credit card in your portfolio.
          </p>
        </div>

        <CardForm />
      </main>
    </div>
  );
}
