"use client";

/**
 * Edit Card Page — /ledger/cards/[id]/edit
 *
 * Anonymous-first: accessible without a signed-in session.
 * Loads the card by ID from localStorage using the resolved storage ID:
 *   - Authenticated: householdId (session.user.sub)
 *   - Anonymous: ANON_HOUSEHOLD_ID ("anon") — Issue #1671
 *
 * Redirects to /ledger only if the card is not found.
 *
 * See ADR-006 for the anonymous-first auth model.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { CardForm } from "@/components/cards/CardForm";
import {
  migrateIfNeeded,
  getCardById,
} from "@/lib/storage";
import { ANON_HOUSEHOLD_ID } from "@/lib/constants";
import type { Card } from "@/lib/types";

export default function EditCardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { householdId, status } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    migrateIfNeeded();

    // Resolve effective storage ID: authenticated = sub, anonymous = "anon"
    const effectiveId = householdId ?? ANON_HOUSEHOLD_ID;
    const found = getCardById(effectiveId, params.id);
    if (!found) {
      router.replace("/ledger");
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
            <h1 className="font-display text-3xl text-gold tracking-wide">
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
