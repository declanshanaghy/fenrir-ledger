"use client";

/**
 * DashboardTabs -- tabbed navigation for the card dashboard.
 *
 * Replaces the old HowlPanel sidebar + mobile drawer with a tab bar.
 * Two tabs:
 *   - "The Howl" -- cards needing attention (fee_approaching, promo_expiring, overdue)
 *   - "Active"   -- cards in good standing (all other non-closed statuses)
 *
 * Each card appears in exactly one tab. No duplication.
 *
 * Default tab selection:
 *   - If howlCards.length > 0, default to "howl"
 *   - If howlCards.length === 0, default to "active"
 *
 * Tab state is client-side only (useState). No URL params, no persisted preference.
 *
 * Wireframe: ux/wireframes/app/dashboard-tabs.html
 * Issue: #279
 */

import { useMemo, useState, useRef, useCallback, type KeyboardEvent } from "react";
import type { Card } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRagnarok } from "@/contexts/RagnarokContext";

// ── Constants ────────────────────────────────────────────────────────────────

/** Statuses that classify a card into The Howl tab. */
const HOWL_STATUSES = new Set(["fee_approaching", "promo_expiring", "overdue"]);

type TabId = "howl" | "active";

// ── Props ────────────────────────────────────────────────────────────────────

interface DashboardTabsProps {
  /** All cards (non-closed) from the dashboard. */
  cards: Card[];
  /** Render function for the card grid given a filtered list of cards. */
  children: (filteredCards: Card[], activeTab: TabId) => React.ReactNode;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Partitions cards into howl vs active buckets. */
function partitionCards(cards: Card[]): { howlCards: Card[]; activeCards: Card[] } {
  const howlCards: Card[] = [];
  const activeCards: Card[] = [];

  for (const card of cards) {
    if (HOWL_STATUSES.has(card.status)) {
      howlCards.push(card);
    } else {
      activeCards.push(card);
    }
  }

  return { howlCards, activeCards };
}

// ── Component ────────────────────────────────────────────────────────────────

export function DashboardTabs({ cards, children }: DashboardTabsProps) {
  const { ragnarokActive } = useRagnarok();

  const { howlCards, activeCards } = useMemo(() => partitionCards(cards), [cards]);

  // Default tab: howl when urgent cards exist, active otherwise.
  // Only computed on first render (lazy initialiser).
  const [activeTab, setActiveTab] = useState<TabId>(() =>
    howlCards.length > 0 ? "howl" : "active"
  );

  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    howl: null,
    active: null,
  });

  const setTabRef = useCallback((id: TabId) => (el: HTMLButtonElement | null) => {
    tabRefs.current[id] = el;
  }, []);

  // ARIA keyboard navigation: left/right arrow keys switch tabs
  const handleTabKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      const tabs: TabId[] = ["howl", "active"];
      const currentIndex = tabs.indexOf(activeTab);
      let nextIndex = currentIndex;

      if (e.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (e.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else {
        return; // not a handled key
      }

      e.preventDefault();
      const nextTab = tabs[nextIndex] as TabId;
      setActiveTab(nextTab);
      tabRefs.current[nextTab]?.focus();
    },
    [activeTab]
  );

  const filteredCards = activeTab === "howl" ? howlCards : activeCards;

  return (
    <div>
      {/* Tab bar */}
      <div
        className="flex border-b border-border overflow-x-auto scrollbar-hide"
        role="tablist"
        aria-label="Card dashboard tabs"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* The Howl tab */}
        <button
          ref={setTabRef("howl")}
          type="button"
          role="tab"
          id="tab-howl"
          aria-selected={activeTab === "howl"}
          aria-controls="panel-howl"
          tabIndex={activeTab === "howl" ? 0 : -1}
          onClick={() => setActiveTab("howl")}
          onKeyDown={handleTabKeyDown}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-heading uppercase tracking-wide whitespace-nowrap",
            "border-b-[3px] transition-colors min-h-[44px]",
            activeTab === "howl"
              ? ragnarokActive
                ? "border-[hsl(var(--realm-ragnarok-dark))] text-[hsl(var(--realm-ragnarok-dark))]"
                : "border-gold text-gold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          data-testid="tab-howl"
        >
          <span
            aria-hidden="true"
            className={cn(
              "text-base leading-none select-none",
              activeTab === "howl" && howlCards.length > 0 && "animate-muspel-pulse"
            )}
            style={{ fontFamily: "serif" }}
          >
            {ragnarokActive ? "ᚠ" : "ᚲ"}
          </span>
          {ragnarokActive ? "Ragnarok Approaches" : "The Howl"}
          {/* Badge */}
          <span
            className={cn(
              "inline-flex items-center justify-center text-xs font-mono font-bold rounded-sm px-1.5 min-w-[20px]",
              howlCards.length > 0
                ? ragnarokActive
                  ? "border-2 border-[hsl(var(--realm-ragnarok-dark))] text-[hsl(var(--realm-ragnarok-dark))]"
                  : "border-2 border-[hsl(var(--realm-muspel))] text-[hsl(var(--realm-muspel))]"
                : "border border-border text-muted-foreground opacity-40"
            )}
            aria-label={`${howlCards.length} card${howlCards.length === 1 ? "" : "s"} need attention`}
            data-testid="howl-badge"
          >
            {howlCards.length}
          </span>
        </button>

        {/* Active tab */}
        <button
          ref={setTabRef("active")}
          type="button"
          role="tab"
          id="tab-active"
          aria-selected={activeTab === "active"}
          aria-controls="panel-active"
          tabIndex={activeTab === "active" ? 0 : -1}
          onClick={() => setActiveTab("active")}
          onKeyDown={handleTabKeyDown}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-sm font-heading uppercase tracking-wide whitespace-nowrap",
            "border-b-[3px] transition-colors min-h-[44px]",
            activeTab === "active"
              ? "border-gold text-gold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          data-testid="tab-active"
        >
          <span
            aria-hidden="true"
            className="text-base leading-none select-none"
            style={{ fontFamily: "serif" }}
          >
            {"ᛉ"}
          </span>
          Active
          <span
            className={cn(
              "inline-flex items-center justify-center text-xs font-mono font-bold rounded-sm px-1.5 min-w-[20px]",
              activeCards.length > 0
                ? "border border-border text-foreground"
                : "border border-border text-muted-foreground opacity-40"
            )}
            aria-label={`${activeCards.length} active card${activeCards.length === 1 ? "" : "s"}`}
            data-testid="active-badge"
          >
            {activeCards.length}
          </span>
        </button>
      </div>

      {/* Tab panel */}
      <div
        role="tabpanel"
        id={activeTab === "howl" ? "panel-howl" : "panel-active"}
        aria-labelledby={activeTab === "howl" ? "tab-howl" : "tab-active"}
        className="pt-5"
        data-testid="dashboard-tab-panel"
      >
        {children(filteredCards, activeTab)}
      </div>
    </div>
  );
}

export { HOWL_STATUSES, type TabId };
