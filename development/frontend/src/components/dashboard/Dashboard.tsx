"use client";

/**
 * Dashboard — the main card portfolio view.
 *
 * Issue #279 — Redesign: tabbed layout replacing grid + HowlPanel side panel.
 * Issue #352 — Expand to 5 tabs: The Howl · The Hunt · Active · Valhalla · All
 *
 * Five tabs (left to right):
 *   "howl"     — cards needing attention (fee_approaching, promo_expiring, overdue).
 *                Default tab when it has cards. Cards display an urgency bar at top.
 *   "hunt"     — cards actively earning sign-up bonuses (bonus_open).
 *   "active"   — cards in good standing (status === "active" only).
 *                Default tab when The Howl is empty.
 *   "valhalla" — closed/retired cards (status === "closed").
 *   "all"      — every card regardless of status.
 *
 * Each card appears in exactly one status tab AND in the All tab.
 * Tab badges show live count per tab.
 * Tab selection is persisted in localStorage (key: fenrir:dashboard-tab).
 * URL param ?tab=<id> overrides localStorage on mount.
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

type DashboardTab = "howl" | "hunt" | "active" | "valhalla" | "all";

const VALID_TABS = new Set<string>(["howl", "hunt", "active", "valhalla", "all"]);

/** localStorage key for tab persistence */
const TAB_STORAGE_KEY = "fenrir:dashboard-tab";

/** Statuses that belong to The Howl tab. */
const HOWL_STATUSES = new Set<string>(["fee_approaching", "promo_expiring", "overdue"]);

/** Returns true if this card belongs in The Howl tab. */
function isHowlCard(card: Card): boolean {
  return HOWL_STATUSES.has(card.status);
}

/** Returns true if this card belongs in The Hunt tab. */
function isHuntCard(card: Card): boolean {
  return card.status === "bonus_open";
}

/** Returns true if this card belongs in The Active tab. */
function isActiveCard(card: Card): boolean {
  return card.status === "active";
}

/** Returns true if this card belongs in The Valhalla tab. */
function isValhallaCard(card: Card): boolean {
  return card.status === "closed";
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
  // Disabled via @media prefers-reduced-motion in globals.css
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
 * Used in The Howl tab and the All tab (for howl-status cards).
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

function HuntEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <span
        aria-hidden="true"
        className="text-5xl text-muted-foreground/40 select-none"
        style={{ fontFamily: "serif" }}
      >
        ᛜ
      </span>
      <p className="text-base font-heading text-foreground">No bounties to claim.</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Add a card with a sign-up bonus to begin the hunt.
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

function ValhallaEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <span
        aria-hidden="true"
        className="text-5xl text-muted-foreground/40 select-none"
        style={{ fontFamily: "serif" }}
      >
        ↑
      </span>
      <p className="text-base font-heading text-foreground">Valhalla is quiet.</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        No cards have been retired yet.
      </p>
    </div>
  );
}

function AllEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <span
        aria-hidden="true"
        className="text-5xl text-muted-foreground/40 select-none"
        style={{ fontFamily: "serif" }}
      >
        ᛟ
      </span>
      <p className="text-base font-heading text-foreground">The ledger is empty.</p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Add your first card to begin.
      </p>
    </div>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────

/** Ordered tab definitions matching wireframe left-to-right order */
const TAB_CONFIG = [
  {
    id: "howl" as DashboardTab,
    label: "The Howl",
    rune: "ᚲ",
    panelId: "panel-howl",
    buttonId: "tab-howl",
  },
  {
    id: "hunt" as DashboardTab,
    label: "The Hunt",
    rune: "ᛜ",
    panelId: "panel-hunt",
    buttonId: "tab-hunt",
  },
  {
    id: "active" as DashboardTab,
    label: "Active",
    rune: "ᛉ",
    panelId: "panel-active",
    buttonId: "tab-active",
  },
  {
    id: "valhalla" as DashboardTab,
    label: "Valhalla",
    rune: "↑",
    panelId: "panel-valhalla",
    buttonId: "tab-valhalla",
  },
  {
    id: "all" as DashboardTab,
    label: "All",
    rune: "ᛟ",
    panelId: "panel-all",
    buttonId: "tab-all",
  },
] as const;

// ─── Main component ───────────────────────────────────────────────────────────

interface DashboardProps {
  cards: Card[];
  /**
   * Optional tab to activate on first render.
   * Takes priority over localStorage. Set by page.tsx from URL ?tab= param.
   */
  initialTab?: string | undefined;
}

export function Dashboard({ cards, initialTab }: DashboardProps) {
  const { ragnarokActive } = useRagnarok();

  // ── Derive 5-bucket splits ─────────────────────────────────────────────────
  const howlCards = cards.filter(isHowlCard);
  const huntCards = cards.filter(isHuntCard);
  const activeCards = cards.filter(isActiveCard);
  const valhallaCards = cards.filter(isValhallaCard);
  // "All" includes every card (including closed)

  // ── Initial tab: prop (URL param) > localStorage > default logic ───────────
  function getInitialTab(): DashboardTab {
    // 1. Prop (from URL ?tab= param) takes highest priority
    if (initialTab && VALID_TABS.has(initialTab)) {
      return initialTab as DashboardTab;
    }

    // 2. Restore from localStorage
    try {
      const stored = typeof window !== "undefined"
        ? localStorage.getItem(TAB_STORAGE_KEY)
        : null;
      if (stored && VALID_TABS.has(stored)) {
        return stored as DashboardTab;
      }
    } catch {
      // localStorage unavailable (e.g. private mode lockdown) — ignore
    }

    // 3. Default: Howl if it has cards, else Active
    return howlCards.length > 0 ? "howl" : "active";
  }

  const [activeTab, setActiveTab] = useState<DashboardTab>(getInitialTab);

  // ── Listen for external tab activation (e.g. sidebar Valhalla link) ────────
  useEffect(() => {
    function handleActivateTab(e: Event) {
      const event = e as CustomEvent<{ tab: string }>;
      const tab = event.detail?.tab;
      if (tab && VALID_TABS.has(tab)) {
        setActiveTab(tab as DashboardTab);
      }
    }
    window.addEventListener("fenrir:activate-tab", handleActivateTab);
    return () => window.removeEventListener("fenrir:activate-tab", handleActivateTab);
  }, []);

  // ── Persist tab selection to localStorage ─────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, activeTab);
    } catch {
      // Ignore write errors (e.g. storage full)
    }
  }, [activeTab]);

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
  // Arrow keys navigate between tabs (wrapping). Home/End jump to first/last.
  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, tabIndex: number) {
    const tabCount = TAB_CONFIG.length;
    let nextIndex: number | null = null;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      nextIndex = (tabIndex + 1) % tabCount;
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      nextIndex = (tabIndex - 1 + tabCount) % tabCount;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = tabCount - 1;
    }

    if (nextIndex !== null) {
      const nextTab = TAB_CONFIG[nextIndex];
      if (nextTab) {
        setActiveTab(nextTab.id);
        // Move focus to the newly activated tab button
        const el = document.getElementById(nextTab.buttonId);
        el?.focus();
      }
    }
  }

  // Non-closed cards only pass to EmptyState check (closed cards are shown in Valhalla tab)
  const nonClosedCards = cards.filter((c) => c.status !== "closed");
  if (nonClosedCards.length === 0 && valhallaCards.length === 0) {
    return <EmptyState />;
  }

  // In Loki mode: shuffle all cards, then re-split into tabs by status.
  const displayCards = lokiActive ? lokiOrder : cards;
  const displayHowlCards = displayCards.filter(isHowlCard);
  const displayHuntCards = displayCards.filter(isHuntCard);
  const displayActiveCards = displayCards.filter(isActiveCard);
  const displayValhallaCards = displayCards.filter(isValhallaCard);

  // Per-tab badge counts (from non-Loki buckets for consistency)
  const tabCounts: Record<DashboardTab, number> = {
    howl: howlCards.length,
    hunt: huntCards.length,
    active: activeCards.length,
    valhalla: valhallaCards.length,
    all: cards.length,
  };

  return (
    <div>
      {/* Summary header — total portfolio count including closed */}
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

      {/* ── Tab bar — 5 tabs ──────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Card dashboard tabs"
        className="flex border-b border-border mb-0 overflow-x-auto -webkit-overflow-scrolling-touch"
        style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
      >
        {TAB_CONFIG.map((tab, index) => {
          const isActive = activeTab === tab.id;
          const isHowlTab = tab.id === "howl";
          const count = tabCounts[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tab.buttonId}
              aria-selected={isActive}
              aria-controls={tab.panelId}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, index)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-heading uppercase tracking-wide",
                "border-b-[3px] transition-colors whitespace-nowrap shrink-0 min-h-[44px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive
                  ? isHowlTab
                    ? ragnarokActive
                      ? "border-[hsl(var(--realm-ragnarok-dark))] text-[hsl(var(--realm-ragnarok-dark))]"
                      : "border-[hsl(var(--realm-muspel))] text-[hsl(var(--realm-muspel))]"
                    : "border-gold text-gold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {/* Rune icon */}
              <span
                aria-hidden="true"
                className={cn(
                  "text-base leading-none select-none",
                  isHowlTab && howlCards.length > 0 && !ragnarokActive
                    ? "animate-muspel-pulse text-[hsl(var(--realm-muspel))]"
                    : isHowlTab && ragnarokActive
                    ? "animate-muspel-pulse text-[hsl(var(--realm-ragnarok-dark))]"
                    : "",
                  isHowlTab && howlBadgeShake ? "raven-icon--warning" : ""
                )}
                onAnimationEnd={isHowlTab ? () => setHowlBadgeShake(false) : undefined}
                style={{ fontFamily: "serif" }}
              >
                {tab.rune}
              </span>
              {isHowlTab && ragnarokActive ? "Ragnarök Approaches" : tab.label}
              <TabBadge count={count} isHowl={isHowlTab} />
            </button>
          );
        })}
      </div>

      {/* ── Tab panels ───────────────────────────────────────────────────────── */}

      {/* The Howl panel */}
      <div
        role="tabpanel"
        id="panel-howl"
        aria-labelledby="tab-howl"
        tabIndex={0}
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

      {/* The Hunt panel */}
      <div
        role="tabpanel"
        id="panel-hunt"
        aria-labelledby="tab-hunt"
        tabIndex={0}
        hidden={activeTab !== "hunt"}
        className="pt-5"
      >
        {displayHuntCards.length === 0 ? (
          <HuntEmptyState />
        ) : (
          <AnimatedCardGrid
            cards={displayHuntCards}
            renderCard={(card) => (
              <CardTile
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
        tabIndex={0}
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

      {/* Valhalla panel — closed cards */}
      <div
        role="tabpanel"
        id="panel-valhalla"
        aria-labelledby="tab-valhalla"
        tabIndex={0}
        hidden={activeTab !== "valhalla"}
        className="pt-5"
      >
        {displayValhallaCards.length === 0 ? (
          <ValhallaEmptyState />
        ) : (
          <AnimatedCardGrid
            cards={displayValhallaCards}
            renderCard={(card) => (
              <CardTile
                card={card}
                lokiLabel={lokiActive ? lokiLabels[card.id] : undefined}
              />
            )}
          />
        )}
      </div>

      {/* All panel — every card regardless of status */}
      <div
        role="tabpanel"
        id="panel-all"
        aria-labelledby="tab-all"
        tabIndex={0}
        hidden={activeTab !== "all"}
        className="pt-5"
      >
        {displayCards.length === 0 ? (
          <AllEmptyState />
        ) : (
          <AnimatedCardGrid
            cards={displayCards}
            renderCard={(card) => {
              if (isHowlCard(card)) {
                return (
                  <HowlCard
                    card={card}
                    lokiLabel={lokiActive ? lokiLabels[card.id] : undefined}
                  />
                );
              }
              return (
                <CardTile
                  card={card}
                  lokiLabel={lokiActive ? lokiLabels[card.id] : undefined}
                />
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
