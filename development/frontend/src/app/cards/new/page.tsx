"use client";

/**
 * Add Card Page — /cards/new
 *
 * Anonymous-first: accessible without a signed-in session.
 * Reads householdId from AuthContext (works for both anonymous and
 * authenticated users). Passes householdId to CardForm for storage namespacing.
 *
 * See ADR-006 for the anonymous-first auth model.
 */

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CardForm } from "@/components/cards/CardForm";
import { migrateIfNeeded, initializeHousehold } from "@/lib/storage";

export default function NewCardPage() {
  const { householdId, status } = useAuth();

  useEffect(() => {
    if (status === "loading" || !householdId) return;
    migrateIfNeeded();
    initializeHousehold(householdId);
  }, [householdId, status]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-6">
      <div className="mb-8">
        {/* Voice 2: atmospheric page heading from copywriting.md navigation labels */}
        <h1 className="font-display text-3xl text-gold tracking-wide">
          Forge a New Chain
        </h1>
        <p className="font-body text-muted-foreground mt-1 italic">
          Add a card to your portfolio.
        </p>
      </div>

      {/* Only render form once householdId is resolved (status !== "loading") */}
      {status !== "loading" && householdId && (
        <CardForm householdId={householdId} />
      )}
    </div>
  );
}
