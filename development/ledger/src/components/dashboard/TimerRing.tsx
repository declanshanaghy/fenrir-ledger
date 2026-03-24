"use client";

/**
 * TimerRing — SVG circular progress ring showing time elapsed toward a deadline.
 *
 * Issue #1850 — add timer icon to card views across all tabs.
 *
 * Arc fills clockwise from 12 o'clock based on:
 *   ratio = (referenceDate − openDate) / (deadlineDate − openDate) clamped [0, 1]
 *
 * For Valhalla, referenceDate = closedAt, so the ring shows completed history.
 * For Hunt and Howl, referenceDate = today.
 *
 * Inner icon: simplified clock face (circle r=6 + hour and minute hands as lines).
 * Color is tab-driven: Hunt = alfheim teal, Howl = urgency thresholds, Valhalla = stone.
 *
 * Spec: ux/wireframes/cards/timer-icon-cards.html — Sections 1–4
 */

import { daysUntil, formatCurrency } from "@/lib/card-utils";

// ── Constants ──────────────────────────────────────────────────────────────────

/** SVG viewBox size — matches StatusRing SIZE=48. */
const SIZE = 48;

/** Ring radius — matches StatusRing RADIUS=18. */
const RADIUS = 18;

/** Full circumference at r=18. */
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ── Realm color tokens ─────────────────────────────────────────────────────────

const COLOR_ALFHEIM = "hsl(var(--realm-alfheim))";
const COLOR_ASGARD = "hsl(var(--realm-asgard))";
const COLOR_HATI = "hsl(var(--realm-hati))";
const COLOR_MUSPEL = "hsl(var(--realm-muspel))";
const COLOR_STONE = "hsl(var(--realm-stone))";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Which tab context the timer ring is being rendered in. */
export type TimerTab = "hunt" | "howl" | "valhalla";

// ── Exported helpers (pure — tested via Vitest) ────────────────────────────────

/**
 * Whole-day count between two ISO date strings (to − from), measured in
 * local timezone to avoid timezone-induced day shifts.
 *
 * Mirrors the local-tz logic used in daysUntil() from card-utils.ts.
 */
export function daysBetween(fromIso: string, toIso: string): number {
  function toLocalDay(iso: string): Date {
    if (iso.length === 10 && !iso.includes("T")) {
      return new Date(iso + "T00:00:00");
    }
    const d = new Date(iso);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const from = toLocalDay(fromIso);
  const to = toLocalDay(toIso);
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Fill ratio for the timer arc. Clamped to [0, 1].
 *
 * @param openDateIso      - Card open date (ISO).
 * @param deadlineDateIso  - Target deadline (ISO).
 * @param referenceDateIso - "Now" reference: today for Hunt/Howl, closedAt for Valhalla.
 */
export function computeTimerRatio(
  openDateIso: string,
  deadlineDateIso: string,
  referenceDateIso: string,
): number {
  const elapsed = daysBetween(openDateIso, referenceDateIso);
  const total = daysBetween(openDateIso, deadlineDateIso);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, elapsed / total));
}

/**
 * Stroke color for the timer ring.
 *
 * Hunt:     always realm-alfheim (teal)
 * Valhalla: always realm-stone (muted gray)
 * Howl:     urgency thresholds — asgard > 60d, hati ≤ 60d, muspel ≤ 30d
 */
export function getTimerColor(tab: TimerTab, daysRemaining: number): string {
  if (tab === "hunt") return COLOR_ALFHEIM;
  if (tab === "valhalla") return COLOR_STONE;
  // howl urgency thresholds
  if (daysRemaining <= 30) return COLOR_MUSPEL;
  if (daysRemaining <= 60) return COLOR_HATI;
  return COLOR_ASGARD;
}

/**
 * Human-readable tooltip text for the timer ring.
 *
 * Hunt:     "X days elapsed · Y days remaining until bonus deadline"
 * Howl:     "X days elapsed · Y days until annual fee due"
 * Valhalla: "Held X days[· Earned Y pts][· Saved $Z/yr]"
 *
 * @param bonusLabel  - Valhalla only: earned bonus label e.g. "60,000 pts". Omit if not earned.
 * @param annualFee   - Valhalla only: annual fee saved by closing e.g. 695. Omit or 0 for no fee.
 */
export function getTimerTooltip(
  tab: TimerTab,
  openDateIso: string,
  deadlineDateIso: string,
  closedAtIso?: string,
  bonusLabel?: string,
  annualFee?: number,
): string {
  if (tab === "valhalla" && closedAtIso) {
    const daysHeld = daysBetween(openDateIso, closedAtIso);
    let tooltip = `Held ${daysHeld} day${daysHeld === 1 ? "" : "s"}`;
    if (bonusLabel) tooltip += ` · Earned ${bonusLabel}`;
    if (annualFee && annualFee > 0) tooltip += ` · Saved ${formatCurrency(annualFee)}/yr`;
    return tooltip;
  }

  const todayIso = new Date().toISOString();
  const elapsed = Math.max(0, daysBetween(openDateIso, todayIso));
  const remaining = daysUntil(deadlineDateIso);
  const plural = (n: number) => `${n} day${Math.abs(n) === 1 ? "" : "s"}`;

  if (tab === "howl") {
    return `${plural(elapsed)} elapsed · ${plural(remaining)} until annual fee due`;
  }
  // hunt
  return `${plural(elapsed)} elapsed · ${plural(remaining)} remaining until bonus deadline`;
}

// ── Component ──────────────────────────────────────────────────────────────────

interface TimerRingProps {
  /** Card open date — ISO string. */
  openDate: string;
  /** Deadline the ring fills toward — ISO string. */
  deadlineDate: string;
  /** Tab context — controls color, opacity, and tooltip format. */
  tab: TimerTab;
  /** Valhalla only: when the card was closed. Sets fill reference to closedAt. */
  closedAt?: string;
  /** Card name — used for aria-label on the SVG. Omit for decorative-only. */
  cardName?: string;
  /** Valhalla only: earned bonus label e.g. "60,000 pts". Shown in tooltip when provided. */
  bonusLabel?: string;
  /** Valhalla only: annual fee saved by closing e.g. 695. Shown in tooltip when > 0. */
  annualFee?: number;
}

/**
 * TimerRing — clockwise-filling SVG ring with clock-face icon.
 *
 * Usage:
 *   <TimerRing
 *     openDate={card.openDate}
 *     deadlineDate={card.signUpBonus.deadline}
 *     tab="hunt"
 *   />
 */
export function TimerRing({
  openDate,
  deadlineDate,
  tab,
  closedAt,
  cardName,
  bonusLabel,
  annualFee,
}: TimerRingProps) {
  // Reference date: closedAt for Valhalla, today otherwise
  const referenceIso =
    tab === "valhalla" && closedAt ? closedAt : new Date().toISOString();

  const ratio = computeTimerRatio(openDate, deadlineDate, referenceIso);
  const offset = CIRCUMFERENCE * (1 - ratio);

  const daysRemaining = daysUntil(deadlineDate);
  const strokeColor = getTimerColor(tab, daysRemaining);

  // Urgency pulse: Howl only, ≤ 30d remaining
  const isUrgent = tab === "howl" && daysRemaining <= 30;

  // Valhalla rings are muted at 50% opacity
  const ringOpacity = tab === "valhalla" ? 0.5 : 1;

  const tooltip = getTimerTooltip(tab, openDate, deadlineDate, closedAt, bonusLabel, annualFee);

  const ariaLabel = cardName
    ? `Timer: ${tooltip}`
    : undefined;

  return (
    <div
      title={tooltip}
      style={{ display: "inline-flex" }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role={cardName ? "img" : undefined}
        aria-label={ariaLabel}
        aria-hidden={cardName ? undefined : true}
        className="shrink-0"
        style={{ opacity: ringOpacity }}
      >
        {/* Background track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="hsl(var(--realm-stone))"
          strokeWidth={3}
          opacity={0.2}
        />

        {/* Progress arc — fills clockwise from 12 o'clock */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={strokeColor}
          strokeWidth={3}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center",
            transition: "stroke-dashoffset 0.4s ease-out, stroke 0.3s ease-out",
          }}
          className={isUrgent ? "ring--urgent" : undefined}
        />

        {/* Clock face — circle + hour hand (up) + minute hand (right) */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={6}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
        />
        <line
          x1={SIZE / 2}
          y1={SIZE / 2}
          x2={SIZE / 2}
          y2={SIZE / 2 - 5}
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <line
          x1={SIZE / 2}
          y1={SIZE / 2}
          x2={SIZE / 2 + 3}
          y2={SIZE / 2}
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
