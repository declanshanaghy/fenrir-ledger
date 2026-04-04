"use client";

/**
 * HowlCardTile — Howl-tab specific card tile with urgency-driven decision view.
 *
 * Issue #1808 — The Howl tab: show actionable urgency context, not generic credit limit.
 * Issue #1850 — timer icon on card views across all tabs.
 *
 * Differences from CardTile + UrgencyBar combo:
 *   - Removes Credit limit row.
 *   - Shows: Annual fee + due date (urgency colored), Bonus deadline + remaining spend
 *     (with progress bar), Action needed plain-English guidance.
 *   - Urgency left border: 4px solid --realm-muspel (< 30 days) or --realm-hati (< 60 days).
 *   - Urgency badge replaces generic status badge.
 *   - SpendProgressBar reused from Hunt tab pattern.
 *   - Timer ring (time elapsed from openDate toward nearest deadline) — no spend ring.
 *
 * Urgency tiers:
 *   - Red (< 30 days):  border + text use --realm-muspel
 *   - Amber (< 60 days): border + text use --realm-hati
 *   - Overdue (days <= 0): red, pulse animation
 *
 * Wireframe: ux/wireframes/cards/howl-tab-cards.html
 * Spec: ux/wireframes/cards/timer-icon-cards.html — Section 3
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
import { TimerRing } from "./TimerRing";
import type { Card as CreditCard } from "@/lib/types";
import { formatCurrency, formatDate, daysUntil } from "@/lib/card-utils";
import { getIssuerName } from "@/lib/issuer-utils";
import { IssuerLogo } from "@/components/shared/IssuerLogo";
import { cn } from "@/lib/utils";

// ── Pure helpers (exported for unit tests) ─────────────────────────────────────

/**
 * Urgency tier for a Howl card.
 * Based on the minimum days across all relevant deadlines for this card.
 */
export type HowlUrgencyTier = "red" | "amber" | "overdue";

/**
 * Returns the days until the most urgent deadline for a Howl card.
 * Considers both annualFeeDate and signUpBonus.deadline.
 * Returns the minimum (most urgent) value.
 */
export function getHowlDaysUntilSoonest(card: CreditCard): number {
  const feeDays =
    card.annualFeeDate && card.annualFee > 0
      ? daysUntil(card.annualFeeDate)
      : Infinity;
  const bonusDays =
    card.signUpBonus && !card.signUpBonus.met && card.signUpBonus.deadline
      ? daysUntil(card.signUpBonus.deadline)
      : Infinity;
  const soonest = Math.min(feeDays, bonusDays);
  return soonest === Infinity ? 0 : soonest;
}

/**
 * Returns the urgency tier for a Howl card based on days until soonest deadline.
 * - overdue: days <= 0
 * - red: days <= 30
 * - amber: days <= 60
 */
export function getHowlUrgencyTier(daysUntilSoonest: number): HowlUrgencyTier {
  if (daysUntilSoonest <= 0) return "overdue";
  if (daysUntilSoonest <= 30) return "red";
  return "amber";
}

/**
 * Returns the CSS class for the urgency left border color.
 */
export function getHowlBorderClass(tier: HowlUrgencyTier): string {
  if (tier === "overdue" || tier === "red") {
    return "border-l-[hsl(var(--realm-muspel))]";
  }
  return "border-l-[hsl(var(--realm-hati))]";
}

/**
 * Returns the Tailwind text color class for urgency values.
 */
export function getHowlUrgencyTextClass(tier: HowlUrgencyTier): string {
  if (tier === "overdue" || tier === "red") {
    return "text-[hsl(var(--realm-muspel))]";
  }
  return "text-[hsl(var(--realm-hati))]";
}

/**
 * Generates plain-English "Action needed" guidance for a Howl card.
 * Driven by card status and nearest deadline.
 */
export function getHowlActionText(card: CreditCard, days: number): string {
  if (card.status === "overdue") {
    return "Annual fee is past due — pay now or cancel the card immediately.";
  }
  if (card.status === "fee_approaching") {
    if (days <= 7) return "Annual fee due very soon — decide to keep or cancel now.";
    if (days <= 30) return "Annual fee approaching — confirm you want to keep this card.";
    return "Annual fee due within 60 days — review card value.";
  }
  if (card.status === "promo_expiring") {
    const remaining =
      card.signUpBonus && card.signUpBonus.spendRequirement
        ? Math.max(0, card.signUpBonus.spendRequirement - (card.amountSpent ?? 0))
        : 0;
    if (remaining <= 0) {
      return "Spend requirement met — bonus will be awarded by deadline.";
    }
    if (days <= 7) return `${formatCurrency(remaining)} left to spend — deadline is very close.`;
    if (days <= 30) return `${formatCurrency(remaining)} left to spend before bonus expires.`;
    return `${formatCurrency(remaining)} remaining spend to earn the sign-up bonus.`;
  }
  return "Review this card before the deadline.";
}

/**
 * Returns the spend progress percentage for a Howl card (0–100).
 */
export function getHowlSpendPercent(card: CreditCard): number {
  const required = card.signUpBonus?.spendRequirement ?? 0;
  if (required <= 0) return 0;
  const spent = card.amountSpent ?? 0;
  return Math.min(100, Math.round((spent / required) * 100));
}

/**
 * Returns true when the bonus warning row should appear.
 *
 * Condition: card has an unmet bonus deadline that is within 60 days AND
 * the card also has an annual fee approaching.
 */
export function shouldShowBonusWarning(card: CreditCard): boolean {
  if (!card.signUpBonus || card.signUpBonus.met) return false;
  if (!card.signUpBonus.deadline) return false;
  const bonusDays = daysUntil(card.signUpBonus.deadline);
  return bonusDays >= 0 && bonusDays <= 60;
}

/**
 * Computes the remaining spend for the bonus warning row.
 * Returns 0 if spend requirement is already met or no bonus.
 */
export function getHowlBonusRemaining(card: CreditCard): number {
  if (!card.signUpBonus || card.signUpBonus.met) return 0;
  const spent = card.amountSpent ?? 0;
  const required = card.signUpBonus.spendRequirement ?? 0;
  return Math.max(0, required - spent);
}

// ── Content row sub-components ─────────────────────────────────────────────────

interface AnnualFeeRowProps {
  card: CreditCard;
  feeDays: number | null;
  feeUrgent: boolean;
  urgencyTextClass: string;
}

function AnnualFeeRow({ card, feeDays, feeUrgent, urgencyTextClass }: AnnualFeeRowProps) {
  if (card.annualFee <= 0 || !card.annualFeeDate) {
    return (
      <div className="flex justify-between text-muted-foreground">
        <span>Annual fee</span>
        <span className="font-medium text-foreground">$0 (no fee)</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>Annual fee</span>
      <span className={cn("font-medium", feeUrgent ? urgencyTextClass : "text-foreground")}>
        {formatCurrency(card.annualFee)}
        {" · "}
        {formatDate(card.annualFeeDate)}
        {feeDays !== null && feeDays >= 0 && feeDays <= 60 && (
          <span className="ml-1 text-xs">({feeDays}d)</span>
        )}
      </span>
    </div>
  );
}

interface BonusSectionProps {
  card: CreditCard;
  bonusDays: number | null;
  bonusUrgent: boolean;
  urgencyTextClass: string;
  spendPercent: number;
  spendRemaining: number;
  spendRequired: number;
  amountSpent: number;
  tier: HowlUrgencyTier;
}

function BonusSection({
  card,
  bonusDays,
  bonusUrgent,
  urgencyTextClass,
  spendPercent,
  spendRemaining,
  spendRequired,
  amountSpent,
  tier,
}: BonusSectionProps) {
  const hasBonus = card.signUpBonus && !card.signUpBonus.met && card.signUpBonus.deadline;
  if (!hasBonus || !card.signUpBonus) {
    return (
      <div className="flex justify-between text-muted-foreground">
        <span>Bonus deadline</span>
        <span className="font-medium text-foreground">— (no active bonus)</span>
      </div>
    );
  }
  return (
    <>
      <div className="flex justify-between text-muted-foreground">
        <span>Bonus deadline</span>
        <span className={cn("font-medium", bonusUrgent ? urgencyTextClass : "text-foreground")}>
          {formatDate(card.signUpBonus.deadline)}
          {bonusDays !== null && bonusDays >= 0 && bonusDays <= 30 && (
            <span className="ml-1 text-xs">({bonusDays}d)</span>
          )}
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-muted-foreground">
          <span>Remaining spend</span>
          <span className="font-medium text-foreground">
            {formatCurrency(spendRemaining)}
            {spendRequired > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({spendPercent}%)</span>
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
            aria-label={`${card.cardName}: min spend progress ${spendPercent}%`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                tier === "red" || tier === "overdue"
                  ? "bg-[hsl(var(--realm-muspel))]"
                  : "bg-[hsl(var(--realm-alfheim))]"
              )}
              style={{ width: `${spendPercent}%` }}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface UrgencyBadgeProps {
  tier: HowlUrgencyTier;
  days: number;
}

/** UrgencyBadge — replaces generic StatusBadge for Howl cards. */
function UrgencyBadge({ tier, days }: UrgencyBadgeProps) {
  const colorClass = getHowlUrgencyTextClass(tier);
  const borderClass =
    tier === "overdue" || tier === "red"
      ? "border-[hsl(var(--realm-muspel))]"
      : "border-[hsl(var(--realm-hati))]";

  let label: string;
  if (tier === "overdue") {
    label = "OVERDUE";
  } else if (days === 1) {
    label = "1 DAY";
  } else {
    label = `${days} DAYS`;
  }

  return (
    <span
      className={cn(
        "shrink-0 text-xs font-bold uppercase tracking-wide border-2 px-2 py-0.5",
        colorClass,
        borderClass
      )}
      aria-label={`${days} days until deadline`}
    >
      {label}
    </span>
  );
}

// ── HowlCardTile ───────────────────────────────────────────────────────────────

interface HowlCardTileProps {
  card: CreditCard;
  /**
   * Loki Mode override: when present, the urgency badge shows this realm name
   * instead of the urgency days label.
   */
  lokiLabel?: string | undefined;
}

export function HowlCardTile({ card, lokiLabel }: HowlCardTileProps) {
  const reducedMotion = useReducedMotion() ?? false;

  const daysUntilSoonest = getHowlDaysUntilSoonest(card);
  const tier = getHowlUrgencyTier(daysUntilSoonest);
  const urgencyTextClass = getHowlUrgencyTextClass(tier);

  // Timer ring deadline: fee_approaching/overdue → annualFeeDate, promo_expiring → bonus deadline
  const isFee = card.status === "fee_approaching" || card.status === "overdue";
  const deadlineDate = isFee
    ? card.annualFeeDate
    : (card.signUpBonus?.deadline ?? card.annualFeeDate);

  // Fee details
  const hasFee = card.annualFee > 0 && card.annualFeeDate;
  const feeDays = hasFee ? daysUntil(card.annualFeeDate) : null;
  const feeUrgent = feeDays !== null && feeDays <= 60;

  // Bonus deadline details
  const hasBonus = card.signUpBonus && !card.signUpBonus.met && card.signUpBonus.deadline;
  const bonusDays = hasBonus ? daysUntil(card.signUpBonus!.deadline) : null;
  const bonusUrgent = bonusDays !== null && bonusDays <= 30;

  // Spend progress
  const spendRequired = card.signUpBonus?.spendRequirement ?? 0;
  const amountSpent = card.amountSpent ?? 0;
  const spendPercent = getHowlSpendPercent(card);
  const spendRemaining = Math.max(0, spendRequired - amountSpent);

  // Action text
  const actionText = getHowlActionText(card, daysUntilSoonest);

  return (
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
        <Card
          className="h-full border border-secondary cursor-pointer"
          data-testid="howl-card-tile"
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {/* Timer ring only — no spend ring for Howl */}
                {deadlineDate && (
                  <TimerRing
                    openDate={card.openDate}
                    deadlineDate={deadlineDate}
                    tab="howl"
                    cardName={card.cardName}
                  />
                )}
                <div className="min-w-0">
                  <CardDescription
                    className="text-sm uppercase tracking-wide mb-1"
                    title={getIssuerName(card.issuerId)}
                  >
                    <IssuerLogo
                      issuerId={card.issuerId}
                      className="inline-flex align-middle opacity-90"
                      showLabel
                    />
                  </CardDescription>
                  <CardTitle className="text-base font-semibold leading-tight truncate">
                    {card.cardName}
                  </CardTitle>
                </div>
              </div>
              {/* Urgency badge replaces StatusBadge for Howl cards */}
              {lokiLabel ? (
                <span className="shrink-0 text-xs font-bold uppercase tracking-wide border px-2 py-0.5 text-muted-foreground border-border">
                  {lokiLabel}
                </span>
              ) : (
                <UrgencyBadge tier={tier} days={daysUntilSoonest} />
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-2 text-base">
            {/* Annual fee + due date */}
            <AnnualFeeRow
              card={card}
              feeDays={feeDays}
              feeUrgent={feeUrgent}
              urgencyTextClass={urgencyTextClass}
            />

            {/* Bonus deadline + remaining spend */}
            <BonusSection
              card={card}
              bonusDays={bonusDays}
              bonusUrgent={bonusUrgent}
              urgencyTextClass={urgencyTextClass}
              spendPercent={spendPercent}
              spendRemaining={spendRemaining}
              spendRequired={spendRequired}
              amountSpent={amountSpent}
              tier={tier}
            />

            {/* Action needed */}
            <div className="flex gap-2 pt-1 border-t border-border">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground shrink-0 mt-0.5">
                Action
              </span>
              <span className="text-xs text-foreground">
                {actionText}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}
