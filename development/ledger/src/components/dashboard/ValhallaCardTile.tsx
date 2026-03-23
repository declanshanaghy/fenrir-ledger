"use client";

/**
 * ValhallaCardTile — Valhalla-tab specific card tile for closed/graduated cards.
 *
 * Issue #1808 — Valhalla tab: show rewards reaped context instead of generic credit limit data.
 *
 * Differences from CardTile:
 *   - Removes Credit limit row.
 *   - Shows: Sign-up bonus earned, Annual fee paid, Time held, Closed date.
 *   - Left border uses --realm-stone (muted/archive tone) matching tombstone design.
 *   - Bonus earned shows success color when met; "— (not earned)" when null/unmet.
 *   - Annual fee paid shows "$0 (no fee)" when zero.
 *   - Time held shown in months from openDate to closedAt.
 *   - Closed date shown as "Mon YYYY" format.
 *
 * Wireframe: ux/wireframes/cards/valhalla-tab-cards.html
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
import { formatCurrency, formatDate } from "@/lib/card-utils";
import { getIssuerBadgeChar, getIssuerMeta } from "@/lib/issuer-utils";
import { IssuerLogo } from "@/components/shared/IssuerLogo";

// ── Pure helpers (exported for unit tests) ─────────────────────────────────────

/**
 * Returns the number of whole months a card was held, from openDate to closedAt.
 * Falls back to current date if closedAt is absent.
 * Returns 0 for invalid inputs.
 */
export function getTimeHeldMonths(
  openDate: string,
  closedAt: string | undefined,
  today?: Date
): number {
  if (!openDate) return 0;
  const open = new Date(openDate);
  if (isNaN(open.getTime())) return 0;

  const close = closedAt ? new Date(closedAt) : (today ?? new Date());
  if (isNaN(close.getTime())) return 0;

  const years = close.getFullYear() - open.getFullYear();
  const months = close.getMonth() - open.getMonth();
  const total = years * 12 + months;
  return Math.max(0, total);
}

/**
 * Formats an ISO date string as "Mon YYYY" (e.g. "Mar 2025").
 * Returns "" for empty/invalid input.
 */
export function formatMonthYear(isoDate: string | undefined): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Returns the sign-up bonus earned string for a closed card.
 * - If bonus was met: formatted amount (e.g. "60,000 pts" or "$340")
 * - If no bonus or not earned: "— (not earned)"
 */
export function getValhallaSignupBonusLabel(card: CreditCard): string {
  if (!card.signUpBonus || !card.signUpBonus.met) return "— (not earned)";

  const { type, amount } = card.signUpBonus;
  if (type === "cashback") {
    return `${formatCurrency(amount)} cashback`;
  }
  const unit = type === "miles" ? "mi" : "pts";
  return `${amount.toLocaleString()} ${unit}`;
}

/**
 * Returns the annual fee paid label for a closed card.
 * - "$0 (no fee)" when zero
 * - Formatted currency otherwise (e.g. "$95/yr")
 */
export function getValhallaAnnualFeeLabel(annualFee: number): string {
  if (annualFee <= 0) return "$0 (no fee)";
  return `${formatCurrency(annualFee)}/yr`;
}

/**
 * Returns a human-readable time held string.
 * - "< 1 month" for 0 months
 * - "X months" for < 12
 * - "X yr Y mo" for >= 12
 */
export function formatTimeHeld(months: number): string {
  if (months <= 0) return "< 1 month";
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} yr`;
  return `${years} yr ${rem} mo`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ValhallaCardTileProps {
  card: CreditCard;
  /**
   * Loki Mode override: when present, the status badge shows this realm name
   * instead of the normal functional status label.
   */
  lokiLabel?: string | undefined;
}

export function ValhallaCardTile({ card, lokiLabel }: ValhallaCardTileProps) {
  const reducedMotion = useReducedMotion() ?? false;

  const ringBadgeChar = getIssuerBadgeChar(card.issuerId);
  const issuerMeta = getIssuerMeta(card.issuerId);

  const bonusLabel = getValhallaSignupBonusLabel(card);
  const bonusEarned = !!(card.signUpBonus?.met);
  const annualFeeLabel = getValhallaAnnualFeeLabel(card.annualFee);
  const timeHeldMonths = getTimeHeldMonths(card.openDate, card.closedAt);
  const timeHeldLabel = formatTimeHeld(timeHeldMonths);
  const closedDateLabel = formatMonthYear(card.closedAt) || formatDate(card.openDate);

  return (
    <motion.div
      className="card-chain karl-bling-card"
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

      <Link href={`/ledger/cards/${card.id}/edit`} className="block group">
        <Card
          className="h-full border border-secondary cursor-pointer border-l-4 border-l-[hsl(var(--realm-stone))]"
          data-testid="valhalla-card-tile"
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <StatusRing
                  status={card.status}
                  daysRemaining={0}
                  totalDays={365}
                  initials={ringBadgeChar}
                  cardName={card.cardName}
                />
                <div className="min-w-0">
                  <CardDescription
                    className="text-sm uppercase tracking-wide mb-1"
                    title={
                      issuerMeta
                        ? `${issuerMeta.rune} ${issuerMeta.runeName} — ${issuerMeta.runeConnection}`
                        : undefined
                    }
                  >
                    <IssuerLogo
                      issuerId={card.issuerId}
                      className="inline-block align-middle opacity-90"
                    />
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
            {/* Sign-up bonus earned */}
            <div className="flex justify-between text-muted-foreground">
              <span>Bonus earned</span>
              <span
                className={
                  bonusEarned
                    ? "font-bold text-[hsl(var(--realm-asgard))]"
                    : "font-medium text-foreground"
                }
              >
                {bonusLabel}
              </span>
            </div>

            {/* Annual fee paid */}
            <div className="flex justify-between text-muted-foreground">
              <span>Annual fee</span>
              <span className="font-medium text-foreground">
                {annualFeeLabel}
              </span>
            </div>

            {/* Time held */}
            <div className="flex justify-between text-muted-foreground">
              <span>Time held</span>
              <span className="font-medium text-foreground">
                {timeHeldLabel}
              </span>
            </div>

            {/* Closed date */}
            <div className="flex justify-between text-muted-foreground">
              <span>Closed</span>
              <span className="font-medium text-foreground">
                {closedDateLabel}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
