"use client";

/**
 * Add Card Page — /cards/new
 *
 * Renders the CardForm in "new card" mode (no initialValues).
 */

import { useEffect } from "react";
import { CardForm } from "@/components/cards/CardForm";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { migrateIfNeeded, initializeDefaultHousehold } from "@/lib/storage";

export default function NewCardPage() {
  useEffect(() => {
    migrateIfNeeded();
    initializeDefaultHousehold();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader backHref="/" maxWidth="max-w-2xl" />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl text-gold tracking-wide">
            Add New Card
          </h1>
          <p className="font-body text-muted-foreground mt-1 italic">
            Add this card to your portfolio.
          </p>
        </div>

        <CardForm />
      </main>
    </div>
  );
}
