"use client";

/**
 * Edit Card Page — /cards/[id]/edit
 *
 * Loads the card by ID from localStorage and renders CardForm in edit mode.
 * Redirects to / if the card is not found.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CardForm } from "@/components/cards/CardForm";
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
      // Card not found — redirect to dashboard
      router.replace("/");
      return;
    }

    setCard(found);
    setIsLoading(false);
  }, [params.id, router]);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav header */}
      <header className="border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            ← Back
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">🐺 Fenrir Ledger</h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            Loading card...
          </div>
        ) : card ? (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Edit card</h2>
              <p className="text-muted-foreground mt-1">
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
