"use client";

/**
 * HowlPanel — urgent deadlines sidebar.
 *
 * Shows only cards with status "fee_approaching" or "promo_expiring",
 * sorted by fewest days remaining first (most urgent at top).
 *
 * Layout behaviour:
 *   Desktop (lg+): fixed right sidebar alongside the card grid.
 *     Shown when urgentCards.length > 0; hidden otherwise.
 *   Mobile (< lg): collapsible panel toggled by a button. The button
 *     appears in the dashboard header when urgent cards exist.
 *
 * Animation:
 *   Slides in from the right using Framer Motion AnimatePresence.
 *   Raven icon performs a single shake when a new urgent card appears
 *   (urgentCards.length increases since last render).
 *
 * Spec: ux/interactions.md — "The Howl Panel" section.
 * Wireframe: ux/wireframes/howl-panel.html
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import type { Card } from "@/lib/types";
import { daysUntil, formatDate, formatCurrency } from "@/lib/card-utils";
import { IssuerLogo } from "@/components/shared/IssuerLogo";
import { cn } from "@/lib/utils";
import { useRagnarok } from "@/contexts/RagnarokContext";

// ─── Types ───────────────────────────────────────────────────────────────────

/** A single urgent card row with pre-computed days remaining. */
interface UrgentCardRow {
  card: Card;
  /** Days until the relevant deadline (fee date or bonus deadline). */
  daysRemaining: number;
  /** The relevant deadline date string for display. */
  deadlineDate: string;
  /** Whether this card's urgency is due to fee_approaching. */
  isFee: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Computes UrgentCardRow entries for a list of cards that have status
 * "fee_approaching", "promo_expiring", or "overdue". Sorted ascending by daysRemaining
 * (fewest days first = most urgent at top).
 *
 * For fee_approaching/overdue: uses annualFeeDate.
 * For promo_expiring: uses signUpBonus.deadline.
 */
function toUrgentRows(cards: Card[]): UrgentCardRow[] {
  const rows: UrgentCardRow[] = cards.map((card) => {
    const isFee = card.status === "fee_approaching" || card.status === "overdue";
    const deadlineDate = isFee
      ? card.annualFeeDate
      : (card.signUpBonus?.deadline ?? "");
    const daysRemaining = daysUntil(deadlineDate);
    return { card, daysRemaining, deadlineDate, isFee };
  });

  return rows.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface UrgentRowProps {
  row: UrgentCardRow;
}

/**
 * A single urgent card row inside the HowlPanel.
 * Shows: status dot + type label + days remaining, card name + issuer,
 * deadline date, and a "View" action link.
 */
function UrgentRow({ row }: UrgentRowProps) {
  const { card, daysRemaining, deadlineDate, isFee } = row;

  // Color the urgency dot by realm token matching interactions.md StatusRing spec
  const dotColor =
    daysRemaining <= 0
      ? "bg-[hsl(var(--realm-ragnarok))]"       // ragnarok — overdue
      : daysRemaining <= 30
        ? "bg-[hsl(var(--realm-muspel))]"     // muspelheim — critical
        : "bg-[hsl(var(--realm-hati))]";    // hati — approaching

  const typeLabel = isFee ? "Annual Fee" : "Promo Deadline";

  // Humanise days remaining
  let daysLabel: string;
  if (daysRemaining <= 0) {
    daysLabel = "Overdue";
  } else if (daysRemaining === 1) {
    daysLabel = "1 day";
  } else {
    daysLabel = `${daysRemaining} days`;
  }

  return (
    <article className="py-3 border-b border-border last:border-0">
      {/* Row 1: urgency indicator + type + days */}
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn("h-2 w-2 rounded-full shrink-0", dotColor)}
          aria-hidden="true"
        />
        <span className="text-sm text-muted-foreground uppercase tracking-wide">
          {typeLabel}
        </span>
        <span
          className={cn(
            "ml-auto text-sm font-mono font-semibold",
            daysRemaining <= 30 ? "text-[hsl(var(--realm-muspel))]" : "text-[hsl(var(--realm-hati))]"
          )}
          data-slot="count"
        >
          {daysLabel}
        </span>
      </div>

      {/* Row 2: card name + issuer (rune badge + logo) */}
      <div className="mb-1">
        <p className="text-base font-heading text-foreground leading-tight truncate">
          {card.cardName}
        </p>
        <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5">
          <IssuerLogo issuerId={card.issuerId} className="inline-flex align-middle opacity-80" showLabel />
        </p>
      </div>

      {/* Row 3: deadline date + amount */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground" data-slot="date">
          {formatDate(deadlineDate)}
        </span>
        {isFee && card.annualFee > 0 && (
          <span className="text-sm font-mono text-gold" data-slot="amount">
            {formatCurrency(card.annualFee)}
          </span>
        )}
        {!isFee && card.signUpBonus && (
          <span className="text-sm font-mono text-gold" data-slot="amount">
            {card.signUpBonus.type === "cashback"
              ? formatCurrency(card.signUpBonus.amount)
              : `${card.signUpBonus.amount.toLocaleString()} ${card.signUpBonus.type}`}
          </span>
        )}
      </div>

      {/* Row 4: View action */}
      <Link
        href={`/ledger/cards/${card.id}/edit`}
        className={cn(
          "inline-flex items-center text-sm font-heading uppercase tracking-wide",
          "text-gold hover:text-primary hover:brightness-110 transition-colors"
        )}
      >
        View
      </Link>
    </article>
  );
}

// ─── Panel Header ─────────────────────────────────────────────────────────────

interface PanelHeaderProps {
  count: number;
  /** When true, the raven icon shakes once (new urgent card appeared). */
  shake: boolean;
  /** Callback to clear the shake state after animation ends. */
  onShakeEnd: () => void;
  /** When true, Ragnarök Threshold Mode is active — intensified styling. */
  ragnarokActive: boolean;
}

/**
 * HowlPanel header: ᚲ Kenaz rune (pulses when urgent cards present),
 * "THE HOWL" label, urgent count badge.
 *
 * When ragnarokActive: header text changes to "RAGNARÖK APPROACHES",
 * rune changes to ᚠ (Fehu — wealth/fire), border pulses red.
 */
function PanelHeader({ count, shake, onShakeEnd, ragnarokActive }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-3 border-b",
        ragnarokActive
          ? "border-[hsl(var(--realm-ragnarok-dark))] animate-muspel-pulse"
          : "border-border"
      )}
    >
      {/* Rune — ᚠ Fehu (wealth/fire) in Ragnarök mode, ᚲ Kenaz (torch) normally.
          Pulses when there are urgent cards (animate-muspel-pulse in globals.css). */}
      <span
        aria-hidden="true"
        className={cn(
          "text-xl leading-none shrink-0 select-none",
          ragnarokActive
            ? "text-[hsl(var(--realm-ragnarok-dark))] animate-muspel-pulse"
            : count > 0
            ? "text-[hsl(var(--realm-muspel))] animate-muspel-pulse"
            : "text-muted-foreground",
          shake ? "raven-icon--warning" : ""
        )}
        onAnimationEnd={onShakeEnd}
        style={{ fontFamily: "serif" }}
      >
        {ragnarokActive ? "ᚠ" : "ᚲ"}
      </span>
      <h2 className="font-heading text-sm uppercase tracking-widest text-foreground flex-1">
        {ragnarokActive ? "Ragnarök Approaches" : "The Howl"}
      </h2>
      {count > 0 && (
        <span
          className={cn(
            "text-sm font-mono font-semibold px-1.5 py-0.5 rounded-sm",
            ragnarokActive
              ? "text-[hsl(var(--realm-ragnarok-dark))] bg-[hsl(var(--realm-ragnarok-dark))]/10"
              : "text-[hsl(var(--realm-muspel))] bg-[hsl(var(--realm-muspel))]/10"
          )}
          data-slot="count"
          aria-label={`${count} urgent card${count === 1 ? "" : "s"}`}
        >
          {count}
        </span>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

/**
 * Empty state shown when no urgent cards exist (panel is in "silent" mode).
 * Wireframe spec: ᚱ Raido rune (calm), "The wolf is silent. All chains are loose."
 */
function PanelEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
      {/* ᚱ Raido — journey rune; calm, all chains are loose */}
      <span
        aria-hidden="true"
        className="text-3xl text-muted-foreground/40 select-none"
        style={{ fontFamily: "serif" }}
      >
        ᚱ
      </span>
      <p className="text-sm text-muted-foreground leading-relaxed italic">
        The wolf is not howling.
        <br />
        All chains are silent.
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface HowlPanelProps {
  /** All active cards from the dashboard. Panel filters to urgent ones internally. */
  cards: Card[];
  /** Additional className for the outer aside element. */
  className?: string | undefined;
}

/**
 * HowlPanel — urgent deadlines sidebar.
 *
 * Receives all dashboard cards and filters + sorts internally.
 * Callers do not need to pre-filter; the component is self-contained.
 *
 * On desktop (lg+): always rendered as a fixed-width right sidebar.
 *   Slide-in animation fires when urgentCards.length transitions 0 → N.
 * On mobile (< lg): hidden by default; parent controls visibility via
 *   the `mobileOpen` state (toggled by a bell button in the dashboard header).
 *
 * The panel never shows a collapsed empty state in its rendered form —
 * when there are no urgent cards it shows an empty state inside the panel
 * body, not a hidden panel. This matches the wireframe spec.
 */
export function HowlPanel({ cards, className }: HowlPanelProps) {
  const { ragnarokActive } = useRagnarok();
  const urgentRows = toUrgentRows(
    cards.filter(
      (c) => c.status === "fee_approaching" || c.status === "promo_expiring" || c.status === "overdue"
    )
  );

  // Track previous urgent count to detect new arrivals (triggers raven shake).
  const prevCountRef = useRef(urgentRows.length);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const prev = prevCountRef.current;
    const current = urgentRows.length;
    if (current > prev) {
      setShake(true);
    }
    prevCountRef.current = current;
  }, [urgentRows.length]);

  function handleShakeEnd() {
    setShake(false);
  }

  return (
    <aside
      className={cn(
        "flex flex-col self-start",
        "bg-background border rounded-sm",
        ragnarokActive ? "border-[hsl(var(--realm-ragnarok-dark))]" : "border-border",
        "w-full",
        className
      )}
      aria-label="Urgent deadlines"
      data-testid="howl-panel"
    >
      <PanelHeader
        count={urgentRows.length}
        shake={shake}
        onShakeEnd={handleShakeEnd}
        ragnarokActive={ragnarokActive}
      />

      <div className="flex-1 overflow-y-auto px-4">
        {urgentRows.length === 0 ? (
          <PanelEmptyState />
        ) : (
          <div>
            {urgentRows.map((row) => (
              <UrgentRow key={row.card.id} row={row} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Animated Wrapper ─────────────────────────────────────────────────────────

interface AnimatedHowlPanelProps extends HowlPanelProps {
  /** When true on mobile, renders the panel as a visible overlay sheet. */
  mobileOpen?: boolean;
  /** Called when the mobile panel is dismissed. */
  onMobileClose?: () => void;
}

/**
 * AnimatedHowlPanel — wraps HowlPanel with Framer Motion slide-in animation.
 *
 * Desktop: renders inline in the layout grid. AnimatePresence is not used
 * here because the panel is always present (even with empty state); it only
 * appears/disappears based on `hasUrgent` for the slide-in effect.
 *
 * Mobile: conditionally renders as a bottom-anchored full-width sheet when
 * `mobileOpen` is true.
 *
 * Spec from ux/interactions.md — The Howl Panel section.
 */
export function AnimatedHowlPanel({
  cards,
  mobileOpen = false,
  onMobileClose,
  className,
}: AnimatedHowlPanelProps) {
  const urgentCount = cards.filter(
    (c) => c.status === "fee_approaching" || c.status === "promo_expiring" || c.status === "overdue"
  ).length;
  const hasUrgent = urgentCount > 0;

  return (
    <>
      {/* Desktop: inline sidebar — slides in from the right when urgent cards exist.
          Hidden on mobile (lg:flex). w-72 shrink-0 maintains the sidebar width
          in the flex row so the card grid doesn't reflow when cards go urgent. */}
      <AnimatePresence initial={false}>
        {hasUrgent && (
          <motion.div
            key="howl-panel-desktop"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="hidden lg:block w-72 shrink-0"
            style={{ zIndex: 30 }}
          >
            <HowlPanel cards={cards} className={cn(className, "mt-[52px]")} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile overlay sheet — backdrop + bottom-anchored panel.
          Both use AnimatePresence individually so they can animate independently. */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="howl-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 bg-black/60 z-30"
            onClick={onMobileClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="howl-panel-mobile"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden fixed bottom-0 left-0 right-0 z-40 max-h-[70vh] flex flex-col"
          >
            <HowlPanel cards={cards} className="h-full rounded-t-sm rounded-b-none" />
            <button
              type="button"
              onClick={onMobileClose}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground text-sm font-heading uppercase tracking-wide"
              aria-label="Close urgent panel"
            >
              Close
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
