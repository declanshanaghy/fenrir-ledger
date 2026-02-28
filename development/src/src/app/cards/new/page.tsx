"use client";

/**
 * Add Card Page — /cards/new
 *
 * Renders the CardForm in "new card" mode (no initialValues).
 */

import { useEffect } from "react";
import { CardForm } from "@/components/cards/CardForm";
import { migrateIfNeeded, initializeDefaultHousehold } from "@/lib/storage";

export default function NewCardPage() {
  useEffect(() => {
    migrateIfNeeded();
    initializeDefaultHousehold();
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-6 py-6">
      <div className="mb-8">
        {/* Voice 2: atmospheric page heading from copywriting.md navigation labels */}
        <h1 className="font-display text-2xl text-gold tracking-wide">
          Forge a New Chain
        </h1>
        <p className="font-body text-muted-foreground mt-1 italic">
          Add a card to your portfolio.
        </p>
      </div>

      <CardForm />
    </div>
  );
}
