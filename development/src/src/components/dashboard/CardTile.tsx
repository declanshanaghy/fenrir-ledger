/**
 * CardTile — displays a single credit card as a dashboard tile.
 * Clicking navigates to the edit form for that card.
 */

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { Card as CreditCard } from "@/lib/types";
import { formatCurrency, formatDate, daysUntil } from "@/lib/card-utils";
import { KNOWN_ISSUERS } from "@/lib/constants";

interface CardTileProps {
  card: CreditCard;
}

/**
 * Returns the human-readable issuer name from the issuer ID.
 */
function getIssuerName(issuerId: string): string {
  const issuer = KNOWN_ISSUERS.find((i) => i.id === issuerId);
  return issuer?.name ?? issuerId;
}

export function CardTile({ card }: CardTileProps) {
  const hasAnnualFee = card.annualFee > 0 && card.annualFeeDate;
  const hasBonus = card.signUpBonus && !card.signUpBonus.met;
  const feeDays = hasAnnualFee ? daysUntil(card.annualFeeDate) : null;
  const bonusDays =
    hasBonus && card.signUpBonus?.deadline
      ? daysUntil(card.signUpBonus.deadline)
      : null;

  return (
    <Link href={`/cards/${card.id}/edit`} className="block group">
      <Card className="h-full border border-secondary hover:border-gold/30 transition-colors transition-shadow duration-200 group-hover:shadow-card-hover cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardDescription className="text-xs uppercase tracking-wide mb-1">
                {getIssuerName(card.issuerId)}
              </CardDescription>
              <CardTitle className="text-base font-semibold leading-tight truncate">
                {card.cardName}
              </CardTitle>
            </div>
            <StatusBadge status={card.status} className="shrink-0" />
          </div>
        </CardHeader>

        <CardContent className="space-y-2 text-sm">
          {/* Credit limit */}
          <div className="flex justify-between text-muted-foreground">
            <span>Credit limit</span>
            <span className="font-medium text-foreground">
              {card.creditLimit > 0 ? formatCurrency(card.creditLimit) : "—"}
            </span>
          </div>

          {/* Annual fee */}
          <div className="flex justify-between text-muted-foreground">
            <span>Annual fee</span>
            <span className="font-medium text-foreground">
              {card.annualFee > 0 ? formatCurrency(card.annualFee) : "None"}
            </span>
          </div>

          {/* Annual fee date */}
          {hasAnnualFee && (
            <div className="flex justify-between text-muted-foreground">
              <span>Fee due</span>
              <span
                className={`font-medium ${
                  feeDays !== null && feeDays <= 60
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground"
                }`}
              >
                {formatDate(card.annualFeeDate)}
                {feeDays !== null && feeDays >= 0 && feeDays <= 60 && (
                  <span className="ml-1 text-xs">({feeDays}d)</span>
                )}
              </span>
            </div>
          )}

          {/* Sign-up bonus deadline */}
          {hasBonus && card.signUpBonus && (
            <div className="flex justify-between text-muted-foreground">
              <span>Bonus deadline</span>
              <span
                className={`font-medium ${
                  bonusDays !== null && bonusDays <= 30
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground"
                }`}
              >
                {formatDate(card.signUpBonus.deadline)}
                {bonusDays !== null && bonusDays >= 0 && bonusDays <= 30 && (
                  <span className="ml-1 text-xs">({bonusDays}d)</span>
                )}
              </span>
            </div>
          )}

          {/* Opened date */}
          <div className="flex justify-between text-muted-foreground">
            <span>Opened</span>
            <span className="font-medium text-foreground">
              {formatDate(card.openDate)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
