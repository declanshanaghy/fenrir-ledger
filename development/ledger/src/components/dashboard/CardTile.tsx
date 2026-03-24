"use client";

/**
 * CardTile — displays a single credit card as a dashboard tile.
 * Clicking navigates to the edit form for that card.
 *
 * Animation (ux/interactions.md — Card Hover):
 *   motion.div wraps the tile and applies whileHover={{ y: -2 }} for a
 *   subtle upward lift. CSS handles box-shadow and border-color transitions
 *   via the .card-chain class (defined in globals.css).
 *
 *   prefers-reduced-motion: useReducedMotion() disables the y-lift when the
 *   user has requested reduced motion. The CSS transition is suppressed by
 *   the @media prefers-reduced-motion rule in globals.css.
 */

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import { StatusRing } from "./StatusRing";
import type { Card as CreditCard } from "@/lib/types";
import { formatCurrency, formatDate, daysUntil } from "@/lib/card-utils";
import { getIssuerBadgeChar, getIssuerName } from "@/lib/issuer-utils";
import { IssuerLogo } from "@/components/shared/IssuerLogo";

interface CardTileProps {
  card: CreditCard;
  /**
   * Loki Mode override: when present, the status badge shows this realm name
   * instead of the normal functional status label.
   * Set to `undefined` in normal operation.
   */
  lokiLabel?: string | undefined;
}

/**
 * Returns the number of days from openDate to a deadline ISO string.
 * Used as the totalDays denominator for the StatusRing progress calculation.
 * Returns 365 as a safe fallback if dates are missing or invalid.
 */
export function getTotalDays(openDate: string, deadlineIso: string): number {
  if (!openDate || !deadlineIso) return 365;
  const open = new Date(openDate);
  const deadline = new Date(deadlineIso);
  if (isNaN(open.getTime()) || isNaN(deadline.getTime())) return 365;
  const diffMs = deadline.getTime() - open.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 365;
}

/**
 * Picks the most urgent days-remaining value for the StatusRing.
 * Priority: closed → fee_approaching → promo_expiring → nearest available → 365.
 */
export function getRingDaysRemaining(
  status: CreditCard["status"],
  feeDays: number | null,
  bonusDays: number | null
): number {
  if (status === "closed") return 0;
  if (status === "fee_approaching" && feeDays !== null) return feeDays;
  if (status === "promo_expiring" && bonusDays !== null) return bonusDays;
  if (feeDays !== null) return feeDays;
  if (bonusDays !== null) return bonusDays;
  return 365;
}

/**
 * Resolves the ISO deadline string to use as the ring's reference deadline.
 * Priority: fee_approaching → promo_expiring → annualFeeDate → signUpBonus deadline → "".
 */
export function getRingDeadlineIso(card: CreditCard): string {
  if (card.status === "fee_approaching" && card.annualFeeDate)
    return card.annualFeeDate;
  if (card.status === "promo_expiring" && card.signUpBonus?.deadline)
    return card.signUpBonus.deadline;
  if (card.annualFeeDate) return card.annualFeeDate;
  if (card.signUpBonus?.deadline) return card.signUpBonus.deadline;
  return "";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface FeeDueDateRowProps {
  feeDays: number;
  annualFeeDate: string;
}

function FeeDueDateRow({ feeDays, annualFeeDate }: FeeDueDateRowProps) {
  const isUrgent = feeDays <= 60;
  const showCountdown = feeDays >= 0 && feeDays <= 60;
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>Fee due</span>
      <span
        className={`font-medium ${isUrgent ? "text-primary" : "text-foreground"}`}
      >
        {formatDate(annualFeeDate)}
        {showCountdown && (
          <span className="ml-1 text-sm">({feeDays}d)</span>
        )}
      </span>
    </div>
  );
}

interface BonusDeadlineRowProps {
  bonusDays: number;
  deadline: string;
}

function BonusDeadlineRow({ bonusDays, deadline }: BonusDeadlineRowProps) {
  const isUrgent = bonusDays <= 30;
  const showCountdown = bonusDays >= 0 && bonusDays <= 30;
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>Bonus deadline</span>
      <span
        className={`font-medium ${isUrgent ? "text-primary" : "text-foreground"}`}
      >
        {formatDate(deadline)}
        {showCountdown && (
          <span className="ml-1 text-sm">({bonusDays}d)</span>
        )}
      </span>
    </div>
  );
}

// ── CardTile ───────────────────────────────────────────────────────────────────

export function CardTile({ card, lokiLabel }: CardTileProps) {
  const reducedMotion = useReducedMotion() ?? false;

  const hasAnnualFee = card.annualFee > 0 && card.annualFeeDate;
  const hasBonus = card.signUpBonus && !card.signUpBonus.met;
  const feeDays = hasAnnualFee ? daysUntil(card.annualFeeDate) : null;
  const bonusDays =
    hasBonus && card.signUpBonus?.deadline
      ? daysUntil(card.signUpBonus.deadline)
      : null;

  const ringDeadlineIso = getRingDeadlineIso(card);
  const ringDaysRemaining = getRingDaysRemaining(card.status, feeDays, bonusDays);
  const ringTotalDays = getTotalDays(card.openDate, ringDeadlineIso);
  const ringBadgeChar = getIssuerBadgeChar(card.issuerId);

  return (
    /*
     * motion.div: provides whileHover y-lift from ux/interactions.md.
     * The .card-chain CSS class provides the gold glow + border-color
     * transition via CSS (not motion) per the spec.
     * When reducedMotion is true, whileHover prop is omitted so no
     * transform occurs. The CSS transition is independently suppressed
     * by @media (prefers-reduced-motion: reduce) in globals.css.
     */
    <motion.div
      className="card-chain karl-bling-card h-full"
      style={{ position: "relative" }}
      {...(!reducedMotion && {
        whileHover: { y: -2 },
        transition: { duration: 0.15, ease: "easeOut" },
      })}
    >
      {/* Karl-tier runic corner accents — aria-hidden, purely decorative */}
      <span aria-hidden="true" className="karl-rune-corner karl-rune-tl">ᚠ</span>
      <span aria-hidden="true" className="karl-rune-corner karl-rune-tr">ᚱ</span>
      <span aria-hidden="true" className="karl-rune-corner karl-rune-bl">ᛁ</span>
      <span aria-hidden="true" className="karl-rune-corner karl-rune-br">ᚾ</span>
      <Link href={`/ledger/cards/${card.id}/edit`} className="block group h-full">
        <Card className="h-full border border-secondary cursor-pointer" data-testid="card-tile">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {/* StatusRing: SVG countdown ring with rune (known) or initials (unknown) */}
                <StatusRing
                  status={card.status}
                  daysRemaining={ringDaysRemaining}
                  totalDays={ringTotalDays}
                  initials={ringBadgeChar}
                  cardName={card.cardName}
                />
                <div className="min-w-0">
                  <CardDescription
                    className="text-sm uppercase tracking-wide mb-1"
                    title={getIssuerName(card.issuerId)}
                  >
                    <IssuerLogo issuerId={card.issuerId} className="inline-flex align-middle opacity-90" showLabel />
                  </CardDescription>
                  <CardTitle className="text-base font-semibold leading-tight truncate">
                    {card.cardName}
                  </CardTitle>
                </div>
              </div>
              <StatusBadge
                status={card.status}
                className="shrink-0"
                lokiLabel={lokiLabel}
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-2 text-base">
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
            {hasAnnualFee && feeDays !== null && (
              <FeeDueDateRow feeDays={feeDays} annualFeeDate={card.annualFeeDate} />
            )}

            {/* Sign-up bonus deadline */}
            {hasBonus && card.signUpBonus?.deadline && bonusDays !== null && (
              <BonusDeadlineRow bonusDays={bonusDays} deadline={card.signUpBonus.deadline} />
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
    </motion.div>
  );
}
