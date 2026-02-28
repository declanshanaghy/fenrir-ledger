"use client";

/**
 * Add Card Page — /cards/new
 *
 * Renders the CardForm in "new card" mode (no initialValues).
 * Reads the authenticated session to obtain householdId and passes it
 * to CardForm so newly created cards are namespaced correctly.
 */

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { CardForm } from "@/components/cards/CardForm";
import { migrateIfNeeded, initializeHousehold } from "@/lib/storage";

export default function NewCardPage() {
  const { data: session, status } = useSession();
  const householdId = session?.user?.householdId ?? "";

  useEffect(() => {
    if (status === "loading" || !householdId) return;
    migrateIfNeeded();
    initializeHousehold(householdId);
  }, [householdId, status]);

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

      {/* Only render form once session has resolved and householdId is available */}
      {householdId && <CardForm householdId={householdId} />}
    </div>
  );
}
