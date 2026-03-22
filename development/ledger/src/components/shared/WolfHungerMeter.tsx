"use client";

/**
 * WolfHungerMeter — aggregate sign-up bonus summary.
 *
 * Shows total rewards earned (bonuses where met === true) across all
 * non-deleted cards, grouped by type: points, miles, cashback.
 * Fallback: "The wolf has not yet fed." when no bonuses are met.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getCards, getClosedCards } from "@/lib/storage";
import { ANON_HOUSEHOLD_ID } from "@/lib/constants";
import type { Card, BonusType } from "@/lib/types";

interface BonusTotals {
  points: number;
  miles: number;
  cashback: number; // in cents
}

function aggregateBonuses(cards: Card[]): BonusTotals {
  const totals: BonusTotals = { points: 0, miles: 0, cashback: 0 };
  for (const card of cards) {
    if (card.signUpBonus && card.signUpBonus.met) {
      const { type, amount } = card.signUpBonus;
      totals[type] += amount;
    }
  }
  return totals;
}

function formatBonusLine(type: BonusType, amount: number): string {
  if (type === "cashback") {
    // amount is in cents
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100) + " cashback";
  }
  const label = type === "miles" ? "miles" : "points";
  return new Intl.NumberFormat("en-US").format(amount) + " " + label;
}

export function WolfHungerMeter() {
  const { householdId, status } = useAuth();
  const [totals, setTotals] = useState<BonusTotals>({ points: 0, miles: 0, cashback: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    // Resolve effective storage ID: authenticated = sub, anonymous = "anon" (Issue #1671)
    const effectiveId = householdId ?? ANON_HOUSEHOLD_ID;

    const active = getCards(effectiveId);
    const closed = getClosedCards(effectiveId);
    const all = [...active, ...closed];
    setTotals(aggregateBonuses(all));
    setLoaded(true);
  }, [householdId, status]);

  if (!loaded) return null;

  const hasAny = totals.points > 0 || totals.miles > 0 || totals.cashback > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--egg-text-muted))]">
        Fenrir&apos;s Plunder
      </p>
      {hasAny ? (
        <div className="flex flex-col gap-1">
          {totals.points > 0 && (
            <p className="font-mono text-sm text-[hsl(var(--egg-accent))]">
              {formatBonusLine("points", totals.points)}
            </p>
          )}
          {totals.miles > 0 && (
            <p className="font-mono text-sm text-[hsl(var(--egg-accent))]">
              {formatBonusLine("miles", totals.miles)}
            </p>
          )}
          {totals.cashback > 0 && (
            <p className="font-mono text-sm text-[hsl(var(--egg-accent))]">
              {formatBonusLine("cashback", totals.cashback)}
            </p>
          )}
        </div>
      ) : (
        <p className="font-body text-sm italic text-muted-foreground/50">
          The wolf has not yet fed.
        </p>
      )}
    </div>
  );
}
