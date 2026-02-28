"use client";

/**
 * Dashboard — the main card portfolio view.
 *
 * Receives cards as props from the parent page (which handles data fetching).
 * Renders the summary header, card grid, and empty state.
 *
 * Loki Mode (Easter Egg #3):
 *   Listens for the "fenrir:loki-mode" CustomEvent dispatched by Footer.tsx.
 *   When active:
 *     - Card grid is shuffled into a random order.
 *     - Each card's status badge shows a random Norse realm name.
 *   After 5 s the Footer dispatches { active: false } and order is restored.
 */

import { useEffect, useState } from "react";
import { CardTile } from "./CardTile";
import { EmptyState } from "./EmptyState";
import { AnimatedCardGrid } from "./AnimatedCardGrid";
import type { Card } from "@/lib/types";
import { LOKI_REALM_NAMES } from "@/components/layout/Footer";

interface DashboardProps {
  cards: Card[];
}

/** Shuffles a copy of an array using Fisher-Yates and returns it. */
function shuffleArray<T>(arr: T[]): T[] {
  const a: T[] = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

/** Returns a random realm name from the Loki Mode name list. */
function randomRealm(): string {
  const idx = Math.floor(Math.random() * LOKI_REALM_NAMES.length);
  return LOKI_REALM_NAMES[idx] ?? LOKI_REALM_NAMES[0];
}

export function Dashboard({ cards }: DashboardProps) {
  // Loki Mode state — active when the easter egg has been triggered.
  const [lokiActive, setLokiActive] = useState(false);
  // Shuffled card order for Loki Mode (indexes into `cards`).
  const [lokiOrder, setLokiOrder] = useState<Card[]>([]);
  // Per-card random realm labels for Loki Mode (keyed by card.id).
  const [lokiLabels, setLokiLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    function handleLokiMode(e: Event) {
      const event = e as CustomEvent<{ active: boolean }>;
      const active = event.detail?.active ?? false;

      if (active) {
        // Shuffle card order and assign random realm names.
        const shuffled = shuffleArray(cards);
        const labels: Record<string, string> = {};
        for (const card of cards) {
          labels[card.id] = randomRealm();
        }
        setLokiOrder(shuffled);
        setLokiLabels(labels);
        setLokiActive(true);
      } else {
        // Restore original order.
        setLokiActive(false);
        setLokiOrder([]);
        setLokiLabels({});
      }
    }

    window.addEventListener("fenrir:loki-mode", handleLokiMode);
    return () => window.removeEventListener("fenrir:loki-mode", handleLokiMode);
  }, [cards]);

  const needsAttention = cards.filter(
    (c) => c.status === "fee_approaching" || c.status === "promo_expiring"
  );

  if (cards.length === 0) {
    return <EmptyState />;
  }

  const displayCards = lokiActive ? lokiOrder : cards;

  return (
    <div>
      {/* Summary header */}
      <div className="flex items-center gap-6 mb-6 text-sm text-muted-foreground">
        <span>
          <span className="text-foreground font-semibold text-lg">
            {cards.length}
          </span>{" "}
          {cards.length === 1 ? "card" : "cards"}
        </span>
        {needsAttention.length > 0 && (
          <span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold text-lg">
              {needsAttention.length}
            </span>{" "}
            need{needsAttention.length === 1 ? "s" : ""} attention
          </span>
        )}
      </div>

      {/* Card grid — animated via AnimatedCardGrid (Framer Motion)
           - saga-enter stagger on load
           - Valhalla exit animation on delete                          */}
      <AnimatedCardGrid
        cards={displayCards}
        renderCard={(card) => (
          <CardTile
            card={card}
            lokiLabel={lokiActive ? lokiLabels[card.id] : undefined}
          />
        )}
      />
    </div>
  );
}
