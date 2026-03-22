"use client";

/**
 * Add Card Page — /cards/new
 *
 * Anonymous-first: accessible without a signed-in session.
 * Anonymous users store cards under the fixed "anon" key (Issue #1671).
 * Authenticated users store cards under their Google sub (householdId).
 *
 * Issue #1671: householdId is null for anonymous users. We resolve to
 * ANON_HOUSEHOLD_ID ("anon") for storage. No lazy UUID creation needed.
 *
 * See ADR-006 for the anonymous-first auth model.
 */

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { CardForm } from "@/components/cards/CardForm";
import { migrateIfNeeded } from "@/lib/storage";
import { ANON_HOUSEHOLD_ID } from "@/lib/constants";

export default function NewCardPage() {
  const { householdId, status } = useAuth();

  useEffect(() => {
    if (status === "loading") return;
    migrateIfNeeded();
  }, [status]);

  // Resolve effective storage ID: authenticated = sub, anonymous = "anon"
  const effectiveId = householdId ?? ANON_HOUSEHOLD_ID;

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

      {/* Render form once auth status resolves.
          Anonymous users use the fixed "anon" storage key (Issue #1671). */}
      {status !== "loading" && (
        <CardForm householdId={effectiveId} />
      )}
    </div>
  );
}
