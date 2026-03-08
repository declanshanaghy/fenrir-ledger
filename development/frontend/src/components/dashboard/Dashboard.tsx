"use client";

/**
 * Dashboard — the main card portfolio view.
 *
 * Issue #279 — Redesign: tabbed layout replacing grid + HowlPanel side panel.
 *
 * Two tabs:
 *   "howl"   — cards needing attention (fee_approaching, promo_expiring, overdue).
 *              Default tab when it has cards. Cards display an urgency bar at top.
 *   "active" — cards in good standing (all non-Howl statuses).
 *              Default tab when The Howl is empty.
 *
 * Each card appears in exactly one tab — no duplication.
 * Tab badges show live count per tab.
 * Tab selection is client-side useState only (no URL params, no persistence).
 *
 * Loki Mode (Easter Egg #3):
 *   Listens for the "fenrir:loki-mode" CustomEvent dispatched by Footer.tsx.
 *   When active:
 *     - Card grid is shuffled into a random order.
 *     - Each card's status badge shows a random Norse realm name.
 *   After 5 s the Footer dispatches { active: false } and order is restored.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CardTile } from "./CardTile";
import { EmptyState } from "./EmptyState";
import { AnimatedCardGrid } from "./AnimatedCardGrid";
import type { Card } from "@/lib/types";
import { LOKI_REALM_NAMES } from "@/components/layout/Footer";
import { daysUntil } from "@/lib/card-utils";
import { cn } from "@/lib/utils";
import { useRagnarok } from "@/contexts/RagnarokContext";

// ─── Tab types ────────────────────────────────────────────────────────────────

type DashboardTab = "howl" | "active";

/** Statuses that belong to The Howl tab. */
const HOWL_STATUSES = new Set<string>(["fee_approaching", "promo_expiring", "overdue"]);

/** Returns true if this card belongs in The Howl tab. */
function isHowlCard(card: Card): boolean {
  return HOWL_STATUSES.has(card.status);
}

// ─── Loki Mode helpers ────────────────────────────────────────────────────────

/** Shuffles a copy of an array using Fisher-Yates and returns it. */
function shuffleArray<T>(arr: T[]): T[] {
  const a: T[] = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

/** Returns a random realm name from the Loki Mode name list. */
function randomRealm(): string {
  const idx = Math.floor(Math.random() * LOKI_REALM_NAMES.length);
  return LOKI_REALM_NAMES[idx] ?? LOKI_REALM_NAMES[0];
}

// ─── Urgency bar for Howl tab cards ───────────────────────────────────────────

interface UrgencyBarProps {
  card: Card;
}

/**
 * UrgencyBar — displayed above card header inside The Howl tab.
 * Shows: urgency dot + status label + days remaining (or "N days past" for overdue).
 * Dot pulses for overdue cards; static for fee_approaching and promo_expiring.
 * Spec: ux/wireframes/app/dashboard-tabs.html — .card-urgency-bar
 */
function UrgencyBar({ card }: UrgencyBarProps) {
  const isFee = card.status === "fee_approaching" || card.status === "overdue";
  const deadlineDate = isFee
    ? card.annualFeeDate
    : (card.signUpBonus?.deadline ?? "");
  const days = daysUntil(deadlineDate);

  // Dot color follows realm token spec from HowlPanel.tsx
  const dotColorClass =
    days <= 0
      ? "bg-[hsl(var(--realm-ragnarok))]"    // overdue
      : days <= 30
      ? "bg-[hsl(var(--realm-muspel))]"      // critical
      : "bg-[hsl(var(--realm-hati))]";       // approaching

  // Pulse animation only for overdue (days <= 0)
  const pulseClass = days <= 0 ? "animate-muspel-pulse" : "";

  // Status label
  let statusLabel: string;
  if (card.status === "overdue") {
    statusLabel = "OVERDUE";
  } else if (card.status === "fee_approaching") {
    statusLabel = "FEE APPROACHING";
  } else {
    statusLabel = "PROMO EXPIRING";
  }

  // Days label
  let daysLabel: string;
  if (days <= 0) {
    daysLabel = `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} past`;
  } else if (days === 1) {
    daysLabel = "1 day";
  } else {
    daysLabel = `${days} days`;
  }

  return (
    <div
      className="flex items-center gap-2 px-3.5 py-1.5 border-b border-border"
      data-testid="urgency-bar"
    >
      <span
        className={cn("h-2 w-2 rounded-full shrink-0", dotColorClass, pulseClass)}
        aria-hidden="true"
      />
      <span className="text-xs font-heading uppercase tracking-wide text-muted-foreground flex-1">
        {statusLabel}
      </span>
      <span
        className={cn(
          "text-xs font-mono font-semibold",
          days <= 30 ? "text-[hsl(var(--realm-muspel))]" : "text-[hsl(var(--realm-hati))]"
        )}
      >
        {daysLabel}
      </span>
    </div>
  );
}

// ─── Howl card wrapper ────────────────────────────────────────────────────────

interface HowlCardProps {
  card: Card;
  lokiLabel?: string | undefined;
}

/**
 * HowlCard — renders a CardTile with an urgency bar above it.
 * Used in The Howl tab only.
 */
function HowlCard({ card, lokiLabel }: HowlCardProps) {
  return (
    <div className="flex flex-col">
      <UrgencyBar card={card} />
      <CardTile card={card} lokiLabel={lokiLabel} />
    </div>
  );
}

// ─── Tab badge ────────────────────────────────────────────────────────────────

interface TabBadgeProps {
  count: number;
  /** When true, applies the heavier "howl" border treatment from wireframe. */
  isHowl?: boolean;
}

function TabBadge({ count, isHowl }: TabBadgeProps) {
  const zeroOpacity = count === 0 ? "opacity-40" : "";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        "text-xs font-mono font-semibold",
        "border px-1.5 min-w-[20px]",
        isHowl && count > 0 ? "border-[2px] border-[hsl(var(--realm-muspel))] text-[hsl(var(--realm-muspel))]" : "border-border text-muted-foreground",
        zeroOpacity
      )}
      aria-label={`${count} card${count !== 1 ? "s" : ""}`}
    >
      {count}
    </span>
  );
}

// ─── Empty states ──────────────────────────────────────────────────────────────

function HowlEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <span
        aria-hidden="true"
        className="text-5xl text-muted-foreground/40 select-none"
        style={{ fontFamily: "serif" }}
      >
        ᚱ
      </span>
      <p className="text-base font-heading text-foreground">The wolf is silent.</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        All chains are loose. No cards need attention right now.
      </p>
    </div>
  );
}

function ActiveEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <span
        aria-hidden="true"
        className="text-5xl text-muted-foreground/40 select-none"
        style={{ fontFamily: "serif" }}
      >
        ᛉ
      </span>
      <p className="text-base font-heading text-foreground">No active cards.</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        All your cards are currently in The Howl.{" "}
        <Link href="/cards/new" className="text-gold hover:text-primary transition-colors">
          Add a card
        </Link>{" "}
        to see it here.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DashboardProps {
  cards: Card[];
}

export function Dashboard({ cards }: DashboardProps) {
  const { ragnarokActive } = useRagnarok();

  // ── Derive howl / active splits ────────────────────────────────────────────
  const howlCards = cards.filter(isHowlCard);
  const activeCards = cards.filter((c) => !isHowlCard(c));

  // ── Default tab: Howl if it has cards, else Active ─────────────────────────
  // Initialised once on mount. Mid-session tab switches are preserved.
  const [activeTab, setActiveTab] = useState<DashboardTab>(() =>
    howlCards.length > 0 ? "howl" : "active"
  );

  // Track previous howl count for the raven-shake animation on the tab badge
  const prevHowlCountRef = useRef(howlCards.length);
  const [howlBadgeShake, setHowlBadgeShake] = useState(false);
  useEffect(() => {
    const prev = prevHowlCountRef.current;
    if (howlCards.length > prev) {
      setHowlBadgeShake(true);
    }
    prevHowlCountRef.current = howlCards.length;
  }, [howlCards.length]);

  // ── Loki Mode ──────────────────────────────────────────────────────────────
  const [lokiActive, setLokiActive] = useState(false);
  const [lokiOrder, setLokiOrder] = useState<Card[]>([]);
  const [lokiLabels, setLokiLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    function handleLokiMode(e: Event) {
      const event = e as CustomEvent<{ active: boolean }>;
      const active = event.detail?.active ?? false;

      if (active) {
        const shuffled = shuffleArray(cards);
        const labels: Record<string, string> = {};
        for (const card of cards) {
          labels[card.id] = randomRealm();
        }
        setLokiOrder(shuffled);
        setLokiLabels(labels);
        setLokiActive(true);
      } else {
        setLokiActive(false);
        setLokiOrder([]);
        setLokiLabels({});
      }
    }

    window.addEventListener("fenrir:loki-mode", handleLokiMode);
    return () => window.removeEventListener("fenrir:loki-mode", handleLokiMode);
  }, [cards]);

  // ── Summary counts ─────────────────────────────────────────────────────────
  // needsAttention includes overdue as per original Dashboard spec
  const needsAttention = howlCards;

  // ── Keyboard navigation for tab bar (ARIA tabs pattern) ────────────────────
  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, tab: DashboardTab) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActiveTab(tab === "howl" ? "active" : "howl");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActiveTab(tab === "active" ? "howl" : "active");
    }
  }

  if (cards.length === 0) {
    return <EmptyState />;
  }

  // In Loki mode: shuffle all cards, then re-split into howl / active by status.
  const displayCards = lokiActive ? lokiOrder : cards;
  const displayHowlCards = displayCards.filter(isHowlCard);
  const displayActiveCards = displayCards.filter((c) => !isHowlCard(c));

  return (
    <div>
      {/* Summary header */}
      <div className="flex items-center gap-6 mb-4 text-base text-muted-foreground">
        <span>
          <span className="text-foreground font-semibold text-xl">
            {cards.length}
          </span>{" "}
          {cards.length === 1 ? "card" : "cards"}
        </span>
        {needsAttention.length > 0 && (
          <span>
            <span className="text-primary font-semibold text-xl">
              {needsAttention.length}
            </span>{" "}
            need{needsAttention.length === 1 ? "s" : ""} attention
          </span>
        )}
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Card dashboard tabs"
        className="flex border-b border-border mb-0 overflow-x-auto scrollbar-hide -webkit-overflow-scrolling-touch"
        style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
      >
        {/* The Howl tab */}
        <button
          type="button"
          role="tab"
          id="tab-howl"
          aria-selected={activeTab === "howl"}
          aria-controls="panel-howl"
          onClick={() => setActiveTab("howl")}
          onKeyDown={(e) => handleTabKeyDown(e, "howl")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-heading uppercase tracking-wide",
            "border-b-[3px] transition-colors whitespace-nowrap shrink-0",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            activeTab === "howl"
              ? ragnarokActive
                ? "border-[hsl(var(--realm-ragnarok-dark))] text-[hsl(var(--realm-ragnarok-dark))]"
                : "border-[hsl(var(--realm-muspel))] text-[hsl(var(--realm-muspel))]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {/* ᚲ Kenaz rune — pulses when Howl has cards */}
          <span
            aria-hidden="true"
            className={cn(
              "text-base leading-none select-none",
              howlCards.length > 0 && !ragnarokActive
                ? "animate-muspel-pulse text-[hsl(var(--realm-muspel))]"
                : ragnarokActive
                ? "animate-muspel-pulse text-[hsl(var(--realm-ragnarok-dark))]"
                : "",
              howlBadgeShake ? "raven-icon--warning" : ""
            )}
            onAnimationEnd={() => setHowlBadgeShake(false)}
            style={{ fontFamily: "serif" }}
          >
            ᚲ
          </span>
          {ragnarokActive ? "Ragnarök Approaches" : "The Howl"}
          <TabBadge
            count={howlCards.length}
            isHowl={true}
          />
        </button>

        {/* Active tab */}
        <button
          type="button"
          role="tab"
          id="tab-active"
          aria-selected={activeTab === "active"}
          aria-controls="panel-active"
          onClick={() => setActiveTab("active")}
          onKeyDown={(e) => handleTabKeyDown(e, "active")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-heading uppercase tracking-wide",
            "border-b-[3px] transition-colors whitespace-nowrap shrink-0",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            activeTab === "active"
              ? "border-gold text-gold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <span aria-hidden="true" style={{ fontFamily: "serif" }}>ᛉ</span>
          Active
          <TabBadge count={activeCards.length} />
        </button>
      </div>

      {/* ── Tab panels ───────────────────────────────────────────────────────── */}

      {/* The Howl panel */}
      <div
        role="tabpanel"
        id="panel-howl"
        aria-labelledby="tab-howl"
        hidden={activeTab !== "howl"}
        className="pt-5"
      >
        {displayHowlCards.length === 0 ? (
          <HowlEmptyState />
        ) : (
          <AnimatedCardGrid
            cards={displayHowlCards}
            renderCard={(card) => (
              <HowlCard
                card={card}
                lokiLabel={lokiActive ? lokiLabels[card.id] : undefined}
              />
            )}
          />
        )}
      </div>

      {/* Active panel */}
      <div
        role="tabpanel"
        id="panel-active"
        aria-labelledby="tab-active"
        hidden={activeTab !== "active"}
        className="pt-5"
      >
        {displayActiveCards.length === 0 ? (
          <ActiveEmptyState />
        ) : (
          <AnimatedCardGrid
            cards={displayActiveCards}
            renderCard={(card) => (
              <CardTile
                card={card}
                lokiLabel={lokiActive ? lokiLabels[card.id] : undefined}
              />
            )}
          />
        )}
      </div>
    </div>
  );
}
