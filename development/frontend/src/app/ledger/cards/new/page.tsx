"use client";

/**
 * Add Card Page — /cards/new
 *
 * Anonymous-first: accessible without a signed-in session.
 * Reads householdId from AuthContext (works for both anonymous and
 * authenticated users). Passes householdId to CardForm for storage namespacing.
 *
 * Issue #1670: householdId is created LAZILY here (not in AuthContext on mount).
 * New anonymous users start with householdId="" and we call ensureHouseholdId()
 * when they navigate to this interactive page. This prevents marketing pages
 * like /chronicles from triggering household creation.
 *
 * See ADR-006 for the anonymous-first auth model.
 */

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CardForm } from "@/components/cards/CardForm";
import { migrateIfNeeded } from "@/lib/storage";

export default function NewCardPage() {
  const { householdId, status, ensureHouseholdId } = useAuth();

  useEffect(() => {
    if (status === "loading") return;
    migrateIfNeeded();
    // Lazily create the anonymous householdId when the user visits this
    // interactive page (not eagerly on every page mount). Issue #1670.
    if (!householdId) ensureHouseholdId();
  }, [householdId, status, ensureHouseholdId]);

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

      {/* Render form once householdId is resolved.
          For new anonymous users, householdId is set by ensureHouseholdId() above. */}
      {status !== "loading" && householdId && (
        <CardForm householdId={householdId} />
      )}
    </div>
  );
}
