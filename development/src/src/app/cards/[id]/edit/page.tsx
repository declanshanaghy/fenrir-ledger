"use client";

/**
 * Edit Card Page — /cards/[id]/edit
 *
 * Loads the card by ID from localStorage and renders CardForm in edit mode.
 * Redirects to / if the card is not found.
 * Reads the authenticated session to obtain householdId for all storage calls.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
  const { data: session, status } = useSession();
  const [card, setCard] = useState<Card | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    const householdId = session?.user?.householdId;
    if (!householdId) {
      // Session resolved but no householdId — redirect to root
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
  }, [params.id, router, session, status]);

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
