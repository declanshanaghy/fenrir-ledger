"use client";

/**
 * StatusRing — SVG circular progress ring around issuer initials.
 *
 * Renders a countdown ring that drains as a deadline approaches.
 * The ring stroke color shifts through Norse realm colors based on
 * daysRemaining thresholds (from ux/interactions.md — Status Ring section).
 *
 * When daysRemaining <= 30, the ring pulses via the .ring--urgent CSS class
 * (muspel-pulse keyframes defined in globals.css — G4.2).
 *
 * Spec source: ux/interactions.md — Status Ring (Deadline Countdown)
 *   - SVG circle with r=18
 *   - Circumference = 2 * PI * 18
 *   - Progress = daysRemaining / totalDays (clamped to [0, 1])
 *   - Offset = circumference * (1 - progress)
 */

import type { CardStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/constants";

// ── Constants ──────────────────────────────────────────────────────────────────

/** SVG viewBox size. The circle is centered at (cx=24, cy=24) with r=18. */
const SIZE = 48;

/** Ring radius — spec: r=18 */
const RADIUS = 18;

/** Full circumference of the ring at r=18. */
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ── Realm color tokens ─────────────────────────────────────────────────────────
// Thresholds and colors from ux/interactions.md — Status Ring section.

/** Ragnarok: overdue (daysRemaining <= 0) */
const COLOR_RAGNAROK = "hsl(var(--realm-ragnarok))";

/** Muspelheim: urgent (daysRemaining <= 30) -- blood orange */
const COLOR_MUSPEL = "hsl(var(--realm-muspel))";

/** Hati: approaching (daysRemaining <= 60) -- amber */
const COLOR_HATI = "hsl(var(--realm-hati))";

/** Asgard: healthy -- teal */
const COLOR_ASGARD = "hsl(var(--realm-asgard))";

/** Stone: closed / inactive */
const COLOR_STONE = "hsl(var(--realm-stone))";

/** Alfheim: bonus open -- teal */
const COLOR_ALFHEIM = "hsl(var(--realm-alfheim))";

/** Niflheim: overdue -- deep red */
const COLOR_NIFLHEIM = "hsl(var(--realm-niflheim))";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns the stroke color for the ring based on card status and days remaining.
 *
 * For closed cards the ring uses stone gray regardless of days remaining.
 * For bonus_open cards the ring uses Alfheim teal.
 * For overdue cards the ring uses Niflheim deep red.
 * For all other statuses the color follows the realm thresholds from
 * ux/interactions.md.
 *
 * @param status        - The card's current CardStatus.
 * @param daysRemaining - Days until the relevant deadline.
 * @returns Hex color string.
 */
function getRingColor(status: CardStatus, daysRemaining: number): string {
  if (status === "closed" || status === "graduated") return COLOR_STONE;
  if (status === "bonus_open") return COLOR_ALFHEIM;
  if (status === "overdue") return COLOR_NIFLHEIM;
  if (daysRemaining <= 0) return COLOR_RAGNAROK;
  if (daysRemaining <= 30) return COLOR_MUSPEL;
  if (daysRemaining <= 60) return COLOR_HATI;
  return COLOR_ASGARD;
}

/**
 * Computes the SVG strokeDashoffset that represents the elapsed portion.
 *
 * Progress is clamped to [0, 1] so the ring never overflows or underflows.
 * When totalDays is 0 or negative the ring renders fully drained.
 *
 * @param daysRemaining - Days remaining until deadline.
 * @param totalDays     - Total span from card open to deadline.
 * @returns The strokeDashoffset value.
 */
function computeOffset(daysRemaining: number, totalDays: number): number {
  if (totalDays <= 0) return CIRCUMFERENCE;
  const progress = Math.min(Math.max(daysRemaining / totalDays, 0), 1);
  return CIRCUMFERENCE * (1 - progress);
}

// ── Component ──────────────────────────────────────────────────────────────────

interface StatusRingProps {
  /** Current card status — drives ring color. */
  status: CardStatus;
  /** Days remaining until the relevant deadline (fee or promo). */
  daysRemaining: number;
  /** Total day span: from card open date to the deadline. */
  totalDays: number;
  /**
   * Character(s) displayed inside the ring.
   * For known issuers this is an Elder Futhark rune; for unknown issuers
   * it is 1-2 character initials (fallback).
   */
  initials: string;
  /**
   * Card name for the accessible aria-label.
   * When provided the SVG gets role="img" with a descriptive label;
   * when omitted the SVG stays aria-hidden (decorative fallback).
   */
  cardName?: string;
}

/**
 * StatusRing — circular SVG progress ring with issuer initials.
 *
 * Usage:
 *   <StatusRing
 *     status={card.status}
 *     daysRemaining={feeDays}
 *     totalDays={totalDays}
 *     initials="C"
 *   />
 */
export function StatusRing({
  status,
  daysRemaining,
  totalDays,
  initials,
  cardName,
}: StatusRingProps) {
  const strokeColor = getRingColor(status, daysRemaining);
  const offset = computeOffset(daysRemaining, totalDays);
  const isUrgent = status !== "closed" && daysRemaining <= 30;

  // Build a descriptive label for screen readers when cardName is available.
  const ariaLabel = cardName
    ? status === "closed"
      ? `${cardName}: closed`
      : `${cardName}: ${STATUS_LABELS[status] ?? status}, ${daysRemaining} days remaining`
    : undefined;

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role={cardName ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={cardName ? undefined : true}
      className="shrink-0"
    >
      {/* Background track — stone ring at low opacity */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="hsl(var(--realm-stone))"
        strokeWidth={3}
        opacity={0.2}
      />

      {/*
       * Progress ring — clockwise drain as offset increases.
       * rotate(-90deg) rotates the start point to 12 o'clock.
       * strokeLinecap="round" gives a polished terminal cap.
       */}
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
          color: strokeColor,
        }}
        className={isUrgent ? "ring--urgent" : undefined}
      />

      {/* Issuer initials — centered inside the ring */}
      <text
        x={SIZE / 2}
        y={SIZE / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={strokeColor}
        fontSize={initials.length > 1 ? "11" : "13"}
        fontWeight="600"
        fontFamily="var(--font-heading), serif"
        style={{ userSelect: "none" }}
      >
        {initials.slice(0, 2).toUpperCase()}
      </text>
    </svg>
  );
}
