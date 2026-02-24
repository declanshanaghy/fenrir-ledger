/**
 * Dashboard — the main card portfolio view.
 *
 * Receives cards as props from the parent page (which handles data fetching).
 * Renders the summary header, card grid, and empty state.
 */

import { CardTile } from "./CardTile";
import { EmptyState } from "./EmptyState";
import type { Card } from "@/lib/types";

interface DashboardProps {
  cards: Card[];
}

export function Dashboard({ cards }: DashboardProps) {
  const needsAttention = cards.filter(
    (c) => c.status === "fee_approaching" || c.status === "promo_expiring"
  );

  if (cards.length === 0) {
    return <EmptyState />;
  }

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

      {/* Card grid — responsive: 1 col mobile, 2 col tablet, 3 col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <CardTile key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
