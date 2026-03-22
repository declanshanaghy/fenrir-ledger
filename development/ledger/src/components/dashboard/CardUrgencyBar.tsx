"use client";

/**
 * CardUrgencyBar -- urgency indicator bar displayed above card tiles in The Howl tab.
 *
 * Shows an urgency dot + status label + days remaining (or "X days past" for overdue).
 *
 * Wireframe: dashboard-tabs.html .card-urgency-bar
 * Issue: #279
 */

import type { Card } from "@/lib/types";
import { daysUntil } from "@/lib/card-utils";
import { cn } from "@/lib/utils";

interface CardUrgencyBarProps {
  card: Card;
}

export function CardUrgencyBar({ card }: CardUrgencyBarProps) {
  const isFee = card.status === "fee_approaching" || card.status === "overdue";
  const dateStr = isFee
    ? card.annualFeeDate
    : (card.signUpBonus?.deadline ?? "");
  const daysRemaining = daysUntil(dateStr);

  // Color the urgency dot by realm token
  const dotColor =
    daysRemaining <= 0
      ? "bg-[hsl(var(--realm-ragnarok))]"        // ragnarok -- overdue
      : daysRemaining <= 30
        ? "bg-[hsl(var(--realm-muspel))]"      // muspelheim -- critical
        : "bg-[hsl(var(--realm-hati))]";       // hati -- approaching

  // Urgency label
  let urgencyLabel: string;
  if (daysRemaining <= 0) {
    urgencyLabel = `OVERDUE \u00B7 ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? "" : "s"} past`;
  } else if (isFee) {
    urgencyLabel = `FEE APPROACHING \u00B7 ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  } else {
    urgencyLabel = `PROMO EXPIRING \u00B7 ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5",
        "text-xs font-bold uppercase tracking-wide",
        "border border-b-0 border-border rounded-t-sm",
        daysRemaining <= 0
          ? "bg-[hsl(var(--realm-ragnarok))]/10 text-[hsl(var(--realm-ragnarok))]"
          : daysRemaining <= 30
            ? "bg-[hsl(var(--realm-muspel))]/10 text-[hsl(var(--realm-muspel))]"
            : "bg-[hsl(var(--realm-hati))]/10 text-[hsl(var(--realm-hati))]"
      )}
      data-testid="card-urgency-bar"
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          dotColor,
          daysRemaining <= 0 && "animate-pulse"
        )}
        aria-hidden="true"
      />
      <span>{urgencyLabel}</span>
    </div>
  );
}
