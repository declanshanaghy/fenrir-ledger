"use client";

/**
 * HuntCardTile — Hunt-tab specific card tile.
 *
 * Issue #1792 — Hunt tab: show min spend progress, improve summary bar and tooltips.
 *
 * Differences from CardTile:
 *   - Removes Credit limit and Annual fee rows.
 *   - Adds Min spend, Spent (with inline progress bar) rows.
 *   - Keeps Bonus deadline and Opened rows.
 *   - Progress ring reflects spent / minSpend ratio (not time-based).
 *   - Ring wrapper carries a native title tooltip: remaining spend + human-friendly
 *     time until deadline.
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
import { TimerRing } from "./TimerRing";
import type { Card as CreditCard } from "@/lib/types";
import { formatCurrency, formatDate, daysUntil } from "@/lib/card-utils";
import { getIssuerBadgeChar, getIssuerMeta } from "@/lib/issuer-utils";
import { IssuerLogo } from "@/components/shared/IssuerLogo";

// ── Pure helpers (exported for unit tests) ─────────────────────────────────────

/**
 * Calculates the percentage of min spend completed, clamped to [0, 100].
 * Returns 0 when spendRequired is 0 to avoid division-by-zero.
 */
export function getHuntPercentComplete(
  amountSpent: number,
  spendRequired: number
): number {
  if (spendRequired <= 0) return 0;
  return Math.min(100, Math.round((amountSpent / spendRequired) * 100));
}

/**
 * Builds the human-readable tooltip string for the Hunt ring.
 *
 * Format: "$X remaining to spend · X days left"
 * When the deadline has passed: "X days past deadline"
 * When the spend is met: "$0 remaining to spend · X days left"
 *
 * @param amountSpent   - Amount already spent in cents.
 * @param spendRequired - Min spend requirement in cents.
 * @param bonusDays     - Days until bonus deadline (negative = past). Null if no deadline.
 * @returns Tooltip string.
 */
export function getHuntTooltipText(
  amountSpent: number,
  spendRequired: number,
  bonusDays: number | null
): string {
  const remaining = Math.max(0, spendRequired - amountSpent);
  const spendPart = `${formatCurrency(remaining)} remaining to spend`;

  if (bonusDays === null) return spendPart;

  let timePart: string;
  if (bonusDays > 1) {
    timePart = `${bonusDays} days left`;
  } else if (bonusDays === 1) {
    timePart = "1 day left";
  } else if (bonusDays === 0) {
    timePart = "deadline today";
  } else if (bonusDays === -1) {
    timePart = "1 day past deadline";
  } else {
    timePart = `${Math.abs(bonusDays)} days past deadline`;
  }

  return `${spendPart} · ${timePart}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface HuntCardTileProps {
  card: CreditCard;
  /**
   * Loki Mode override: when present, the status badge shows this realm name
   * instead of the normal functional status label.
   */
  lokiLabel?: string | undefined;
}

export function HuntCardTile({ card, lokiLabel }: HuntCardTileProps) {
  const reducedMotion = useReducedMotion() ?? false;

  const spendRequired = card.signUpBonus?.spendRequirement ?? 0;
  const amountSpent = card.amountSpent ?? 0;
  const bonusDays =
    card.signUpBonus?.deadline ? daysUntil(card.signUpBonus.deadline) : null;

  const ringBadgeChar = getIssuerBadgeChar(card.issuerId);
  const issuerMeta = getIssuerMeta(card.issuerId);

  // Progress ring: pass amountSpent/spendRequired as the ratio numerator/denominator.
  // StatusRing computes progress = daysRemaining / totalDays — we reuse that math.
  // Color for bonus_open status is always COLOR_ALFHEIM regardless of the ratio.
  const ringDaysRemaining = amountSpent;
  const ringTotalDays = spendRequired > 0 ? spendRequired : 1;

  const percentComplete = getHuntPercentComplete(amountSpent, spendRequired);
  const tooltipText = getHuntTooltipText(amountSpent, spendRequired, bonusDays);

  const isDeadlineUrgent = bonusDays !== null && bonusDays >= 0 && bonusDays <= 30;

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
          className="h-full border border-secondary cursor-pointer"
          data-testid="hunt-card-tile"
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {/* Ring pair — spend ring (left) + timer ring (right), 4px gap */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Spend ring: filled by amountSpent / spendRequired */}
                  <div
                    title={tooltipText}
                    aria-label={`${card.cardName}: ${percentComplete}% of min spend complete. ${tooltipText}`}
                  >
                    <StatusRing
                      status={card.status}
                      daysRemaining={ringDaysRemaining}
                      totalDays={ringTotalDays}
                      initials={ringBadgeChar}
                    />
                  </div>
                  {/* Timer ring: filled by elapsed time from openDate to bonusDeadline */}
                  {card.signUpBonus?.deadline && (
                    <TimerRing
                      openDate={card.openDate}
                      deadlineDate={card.signUpBonus.deadline}
                      tab="hunt"
                      cardName={card.cardName}
                    />
                  )}
                </div>
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
            {/* Min spend requirement */}
            <div className="flex justify-between text-muted-foreground">
              <span>Min spend</span>
              <span className="font-medium text-foreground">
                {spendRequired > 0 ? formatCurrency(spendRequired) : "—"}
              </span>
            </div>

            {/* Spent amount + inline progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Spent</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(amountSpent)}
                  {spendRequired > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({percentComplete}%)
                    </span>
                  )}
                </span>
              </div>
              {spendRequired > 0 && (
                <div
                  className="h-1 w-full rounded-full overflow-hidden bg-secondary"
                  role="progressbar"
                  aria-valuenow={amountSpent}
                  aria-valuemin={0}
                  aria-valuemax={spendRequired}
                  aria-label={`Min spend progress: ${percentComplete}%`}
                >
                  <div
                    className="h-full rounded-full bg-[hsl(var(--realm-alfheim))] transition-all duration-300"
                    style={{ width: `${percentComplete}%` }}
                  />
                </div>
              )}
            </div>

            {/* Bonus deadline */}
            {card.signUpBonus?.deadline && bonusDays !== null && (
              <div className="flex justify-between text-muted-foreground">
                <span>Bonus deadline</span>
                <span
                  className={`font-medium ${isDeadlineUrgent ? "text-primary" : "text-foreground"}`}
                >
                  {formatDate(card.signUpBonus.deadline)}
                  {isDeadlineUrgent && (
                    <span className="ml-1 text-sm">({bonusDays}d)</span>
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
    </motion.div>
  );
}
