"use client";

/**
 * Edit Card Page — /cards/[id]/edit
 *
 * Loads the card by ID from localStorage and renders CardForm in edit mode.
 * Redirects to / if the card is not found.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CardForm } from "@/components/cards/CardForm";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  migrateIfNeeded,
  initializeDefaultHousehold,
  getCardById,
} from "@/lib/storage";
import type { Card } from "@/lib/types";

export default function EditCardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    migrateIfNeeded();
    initializeDefaultHousehold();

    const found = getCardById(params.id);
    if (!found) {
      router.replace("/");
      return;
    }

    setCard(found);
    setIsLoading(false);
  }, [params.id, router]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader backHref="/" maxWidth="max-w-2xl" />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground font-body italic">
            Consulting the runes...
          </div>
        ) : card ? (
          <>
            <div className="mb-8">
              <h1 className="font-display text-2xl text-gold tracking-wide">
                Amend the Record
              </h1>
              <p className="font-body text-muted-foreground mt-1 italic">
                {card.cardName}
              </p>
            </div>

            <CardForm initialValues={card} />
          </>
        ) : null}
      </main>
    </div>
  );
}
