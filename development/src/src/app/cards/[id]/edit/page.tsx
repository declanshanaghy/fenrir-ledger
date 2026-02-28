"use client";

/**
 * Edit Card Page — /cards/[id]/edit
 *
 * Anonymous-first: accessible without a signed-in session.
 * Loads the card by ID from localStorage using the householdId from AuthContext
 * (works for both anonymous and authenticated users).
 * Redirects to / if the card is not found.
 *
 * See ADR-006 for the anonymous-first auth model.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { CardForm } from "@/components/cards/CardForm";
import {
  migrateIfNeeded,
  initializeHousehold,
  getCardById,
} from "@/lib/storage";
import type { Card } from "@/lib/types";

export default function EditCardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { householdId, status } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    if (!householdId) {
      // No householdId available — redirect to root as a safety fallback
      router.replace("/");
      return;
    }

    migrateIfNeeded();
    initializeHousehold(householdId);

    const found = getCardById(householdId, params.id);
    if (!found) {
      router.replace("/");
      return;
    }

    setCard(found);
    setIsLoading(false);
  }, [params.id, router, householdId, status]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground font-body italic">
          {/* Voice 2: atmospheric loading copy from copywriting.md */}
          Consulting the runes...
        </div>
      ) : card ? (
        <>
          <div className="mb-8">
            {/* Voice 2: atmospheric page heading from copywriting.md navigation labels */}
            <h1 className="font-display text-2xl text-gold tracking-wide">
              {card.cardName}
            </h1>
            <p className="font-body text-muted-foreground mt-1 italic">
              Card record
            </p>
          </div>

          <CardForm
            initialValues={card}
            householdId={card.householdId}
          />
        </>
      ) : null}
    </div>
  );
}
