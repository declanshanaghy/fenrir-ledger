"use client";

/**
 * Dashboard — the main card portfolio view.
 *
 * Issue #279 — Redesign: tabbed layout replacing grid + HowlPanel side panel.
 * Issue #352 — Expand to 5 tabs: The Howl · The Hunt · Active · Valhalla · All
 * Issue #1127 — Add Trash tab (extreme right): deleted cards, restore, expunge
 * Issue #1684 — Refactor: reduced cyclomatic complexity via extracted hooks +
 *                component. See useDashboardTabs, useLokiMode, DashboardTabButton.
 *
 * Six tabs (left to right):
 *   "all"      — every card regardless of status.
 *   "valhalla" — closed/retired/graduated cards (status === "closed" or "graduated").
 *   "active"   — cards in good standing (status === "active" only).
 *                Default tab when The Howl is empty.
 *   "hunt"     — cards actively earning sign-up bonuses (bonus_open).
 *   "howl"     — cards needing attention (fee_approaching, promo_expiring, overdue).
 *                Default tab when it has cards. Cards display an urgency bar at top.
 *   "trash"    — soft-deleted cards (deletedAt set). Restore or expunge permanently.
 *                Thrall: tab visible, click triggers KarlUpsellDialog, tab stays unselected.
 *                Karl/trial: full access with Karl bling.
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

import { restoreCard, expungeCard, expungeAllCards } from "@/lib/storage";
import { CardTile } from "./CardTile";
import { EmptyState } from "./EmptyState";
import { AnimatedCardGrid } from "./AnimatedCardGrid";
import { TabHeader } from "./TabHeader";
import { TabSummary } from "./TabSummary";
import type { Card } from "@/lib/types";
import type { DashboardTab } from "@/lib/constants";
import { daysUntil } from "@/lib/card-utils";
import { cn } from "@/lib/utils";
import { useRagnarok } from "@/contexts/RagnarokContext";
import { THRALL_CARD_LIMIT } from "@/lib/trial-utils";
import {
  KarlUpsellDialog,
  KARL_UPSELL_VALHALLA,
  KARL_UPSELL_VELOCITY,
  KARL_UPSELL_HOWL,
  KARL_UPSELL_TRASH,
} from "@/components/entitlement/KarlUpsellDialog";
import { TrashView } from "@/components/dashboard/TrashView";
import { useDashboardTabs } from "@/hooks/useDashboardTabs";
import { useLokiMode } from "@/hooks/useLokiMode";
import { DashboardTabButton } from "@/components/dashboard/DashboardTabButton";

// ─── Tab classifiers ──────────────────────────────────────────────────────────

/** Statuses that belong to The Howl tab. */
const HOWL_STATUSES = new Set<string>([
  "fee_approaching",
  "promo_expiring",
  "overdue",
]);

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
  return card.status === "closed" || card.status === "graduated";
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
      ? "bg-[hsl(var(--realm-ragnarok))]" // overdue
      : days <= 30
        ? "bg-[hsl(var(--realm-muspel))]" // critical
        : "bg-[hsl(var(--realm-hati))]"; // approaching

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
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          dotColorClass,
          pulseClass,
        )}
        aria-hidden="true"
      />
      <span className="text-xs font-heading uppercase tracking-wide text-muted-foreground flex-1">
        {statusLabel}
      </span>
      <span
        className={cn(
          "text-xs font-mono font-semibold",
          days <= 30
            ? "text-[hsl(var(--realm-muspel))]"
            : "text-[hsl(var(--realm-hati))]",
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

// ─── Empty states ──────────────────────────────────────────────────────────────

/** Runic labels per tab — displayed as `ᚱ No [category] ᚱ` when tab is empty. */
const TAB_EMPTY_LABELS: Record<DashboardTab, string> = {
  all: "No cards",
  valhalla: "No retired cards",
  active: "No active cards",
  hunt: "No bounties",
  howl: "No alerts",
  trash: "The Void is Empty",
};

interface TabEmptyStateProps {
  tabId: DashboardTab;
  rune: string;
}

/**
 * TabEmptyState — unified runic empty state for all 5 dashboard tabs.
 * Displays: `ᚱ No [category] ᚱ` centered in the empty area.
 * Issue #583 — simplified from verbose per-tab empty states.
 */
function TabEmptyState({ tabId, rune }: TabEmptyStateProps) {
  const label = TAB_EMPTY_LABELS[tabId];
  return (
    <div
      className="flex items-center justify-center py-16 px-6 text-center"
      aria-label={label}
    >
      <p className="text-base font-heading text-muted-foreground tracking-wide">
        <span aria-hidden="true" style={{ fontFamily: "serif" }}>
          {rune}
        </span>{" "}
        {label}{" "}
        <span aria-hidden="true" style={{ fontFamily: "serif" }}>
          {rune}
        </span>
      </p>
    </div>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────

/** Ordered tab definitions matching wireframe left-to-right order */
const TAB_CONFIG = [
  {
    id: "all" as DashboardTab,
    label: "All",
    rune: "ᛟ",
    panelId: "panel-all",
    buttonId: "tab-all",
  },
  {
    id: "valhalla" as DashboardTab,
    label: "Valhalla",
    rune: "↑",
    panelId: "panel-valhalla",
    buttonId: "tab-valhalla",
  },
  {
    id: "active" as DashboardTab,
    label: "Active",
    rune: "ᛉ",
    panelId: "panel-active",
    buttonId: "tab-active",
  },
  {
    id: "hunt" as DashboardTab,
    label: "The Hunt",
    rune: "ᛜ",
    panelId: "panel-hunt",
    buttonId: "tab-hunt",
  },
  {
    id: "howl" as DashboardTab,
    label: "The Howl",
    rune: "ᚲ",
    panelId: "panel-howl",
    buttonId: "tab-howl",
  },
  {
    id: "trash" as DashboardTab,
    label: "Trash",
    rune: "ᛞ",
    panelId: "panel-trash",
    buttonId: "tab-trash",
  },
] as const;

// ─── Main component ───────────────────────────────────────────────────────────

interface DashboardProps {
  cards: Card[];
  /**
   * Soft-deleted cards for the Trash tab. Loaded separately from getDeletedCards().
   * If not provided, Trash tab renders an empty state.
   */
  trashedCards?: Card[];
  /**
   * The household ID for trash storage operations (restore/expunge).
   * Required for trash tab functionality. When absent, trash actions are no-ops.
   */
  householdId?: string;
  /**
   * Called after a restore or expunge so the parent can reload both active cards
   * and trashed cards from localStorage.
   */
  onCardsChange?: () => void;
  /**
   * Optional tab to activate on first render.
   * Takes priority over localStorage. Set by page.tsx from URL ?tab= param.
   */
  initialTab?: string | undefined;
}

export function Dashboard({
  cards,
  trashedCards = [],
  householdId,
  onCardsChange,
  initialTab,
}: DashboardProps) {
  const { ragnarokActive } = useRagnarok();

  // ── Card bucket splits (stable filters) ────────────────────────────────────
  const howlCards = cards.filter(isHowlCard);
  const huntCards = cards.filter(isHuntCard);
  const activeCards = cards.filter(isActiveCard);
  const valhallaCards = cards.filter(isValhallaCard);

  // ── Tab state, entitlement gates, upsell dialogs, keyboard nav ─────────────
  const {
    activeTab,
    gates,
    karlOrTrial,
    upsellOpen,
    setUpsellOpen,
    velocityUpsellOpen,
    setVelocityUpsellOpen,
    howlUpsellOpen,
    setHowlUpsellOpen,
    trashUpsellOpen,
    setTrashUpsellOpen,
    howlBadgeShake,
    setHowlBadgeShake,
    handleTabClick,
    handleTabKeyDown,
  } = useDashboardTabs({
    initialTab,
    howlCount: howlCards.length,
    tabConfigs: TAB_CONFIG,
  });

  // ── Loki Mode ──────────────────────────────────────────────────────────────
  const { lokiActive, lokiOrder, lokiLabels } = useLokiMode(cards);

  // Non-Valhalla cards only pass to EmptyState check (closed/graduated are in Valhalla)
  const nonValhallaCards = cards.filter((c) => !isValhallaCard(c));
  if (nonValhallaCards.length === 0 && valhallaCards.length === 0) {
    return <EmptyState />;
  }

  // In Loki mode: shuffle all cards, then re-split into tabs by status.
  const displayCards = lokiActive ? lokiOrder : cards;
  const displayHowlCards = displayCards.filter(isHowlCard);
  const displayHuntCards = displayCards.filter(isHuntCard);
  const allDisplayActiveCards = displayCards.filter(isActiveCard);
  // Thrall card limit: show only first 5 active cards when not Karl or trial
  const displayActiveCards = karlOrTrial
    ? allDisplayActiveCards
    : allDisplayActiveCards.slice(0, THRALL_CARD_LIMIT);
  const lockedActiveCardCount = karlOrTrial
    ? 0
    : Math.max(0, allDisplayActiveCards.length - THRALL_CARD_LIMIT);
  const displayValhallaCards = displayCards.filter(isValhallaCard);

  // Per-tab badge counts (from non-Loki buckets for consistency)
  const tabCounts: Record<DashboardTab, number> = {
    howl: howlCards.length,
    hunt: huntCards.length,
    active: activeCards.length,
    valhalla: valhallaCards.length,
    all: cards.length,
    trash: trashedCards.length,
  };

  return (
    <div>
      {/* ── Tab bar — 6 tabs ──────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Card dashboard tabs"
        className="flex border-b border-border mb-0 overflow-x-auto -webkit-overflow-scrolling-touch"
        style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
      >
        {TAB_CONFIG.map((tab, index) => (
          <DashboardTabButton
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            count={tabCounts[tab.id]}
            gates={gates}
            ragnarokActive={ragnarokActive}
            howlHasCards={howlCards.length > 0}
            howlBadgeShake={howlBadgeShake}
            onHowlAnimationEnd={() => setHowlBadgeShake(false)}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={(e) => handleTabKeyDown(e, index)}
          />
        ))}
      </div>

      {/* ── Tab panels ───────────────────────────────────────────────────────── */}

      {/* The Howl panel — only rendered for Karl users (Thrall users see upsell dialog) */}
      <div
        role="tabpanel"
        id="panel-howl"
        aria-labelledby="tab-howl"
        tabIndex={0}
        hidden={activeTab !== "howl"}
      >
        <TabHeader tabId="howl" />
        <TabSummary tabId="howl" cards={displayHowlCards} />
        <div tabIndex={-1} className="outline-none pt-5">
          {displayHowlCards.length === 0 ? (
            <TabEmptyState tabId="howl" rune="ᚲ" />
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
      </div>

      {/* The Hunt panel */}
      <div
        role="tabpanel"
        id="panel-hunt"
        aria-labelledby="tab-hunt"
        tabIndex={0}
        hidden={activeTab !== "hunt"}
      >
        <TabHeader tabId="hunt" />
        <TabSummary tabId="hunt" cards={displayHuntCards} />
        <div tabIndex={-1} className="outline-none pt-5">
          {displayHuntCards.length === 0 ? (
            <TabEmptyState tabId="hunt" rune="ᛜ" />
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
      </div>

      {/* Active panel */}
      <div
        role="tabpanel"
        id="panel-active"
        aria-labelledby="tab-active"
        tabIndex={0}
        hidden={activeTab !== "active"}
      >
        <TabHeader tabId="active" />
        <TabSummary tabId="active" cards={displayActiveCards} />
        <div tabIndex={-1} className="outline-none pt-5">
          {displayActiveCards.length === 0 ? (
            <TabEmptyState tabId="active" rune="ᛉ" />
          ) : (
            <>
              <AnimatedCardGrid
                cards={displayActiveCards}
                renderCard={(card) => (
                  <CardTile
                    card={card}
                    lokiLabel={lokiActive ? lokiLabels[card.id] : undefined}
                  />
                )}
              />
              {/* Locked cards indicator — Thrall card limit (Issue #623) */}
              {lockedActiveCardCount > 0 && (
                <button
                  type="button"
                  onClick={() => setUpsellOpen(true)}
                  className="w-full border border-dashed border-border p-4 text-center text-sm text-muted-foreground hover:border-gold/30 hover:text-foreground transition-colors cursor-pointer mt-4 mx-auto max-w-[calc(100%-2rem)]"
                  aria-label={`${lockedActiveCardCount} more cards locked. Upgrade to Karl to view all cards.`}
                >
                  <span aria-hidden="true">{"\uD83D\uDD12"} </span>
                  {lockedActiveCardCount} more card
                  {lockedActiveCardCount !== 1 ? "s" : ""} &mdash; Upgrade to
                  Karl
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Valhalla panel — closed cards */}
      <div
        role="tabpanel"
        id="panel-valhalla"
        aria-labelledby="tab-valhalla"
        tabIndex={0}
        hidden={activeTab !== "valhalla"}
      >
        <TabHeader tabId="valhalla" />
        <TabSummary tabId="valhalla" cards={displayValhallaCards} />
        <div tabIndex={-1} className="outline-none pt-5">
          {displayValhallaCards.length === 0 ? (
            <TabEmptyState tabId="valhalla" rune="↑" />
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
      </div>

      {/* All panel — every card regardless of status */}
      <div
        role="tabpanel"
        id="panel-all"
        aria-labelledby="tab-all"
        tabIndex={0}
        hidden={activeTab !== "all"}
      >
        <TabHeader tabId="all" />
        <TabSummary tabId="all" cards={displayCards} />
        <div tabIndex={-1} className="outline-none pt-5">
          {displayCards.length === 0 ? (
            <TabEmptyState tabId="all" rune="ᛟ" />
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

      {/* Trash panel — soft-deleted cards */}
      <div
        role="tabpanel"
        id="panel-trash"
        aria-labelledby="tab-trash"
        tabIndex={0}
        hidden={activeTab !== "trash"}
      >
        <div tabIndex={-1} className="outline-none pt-5">
          <TrashView
            trashedCards={trashedCards}
            onRestore={(cardId) => {
              if (householdId) restoreCard(householdId, cardId);
              onCardsChange?.();
            }}
            onExpunge={(cardId) => {
              if (householdId) expungeCard(householdId, cardId);
              onCardsChange?.();
            }}
            onEmptyTrash={() => {
              if (householdId) expungeAllCards(householdId);
              onCardsChange?.();
            }}
          />
        </div>
      </div>

      {/* Karl upsell dialog — shown when Thrall user clicks Valhalla tab */}
      <KarlUpsellDialog
        {...KARL_UPSELL_VALHALLA}
        open={upsellOpen}
        onDismiss={() => setUpsellOpen(false)}
      />

      {/* Karl upsell dialog — shown when Thrall user clicks Hunt tab */}
      <KarlUpsellDialog
        {...KARL_UPSELL_VELOCITY}
        open={velocityUpsellOpen}
        onDismiss={() => setVelocityUpsellOpen(false)}
      />

      {/* Karl upsell dialog — shown when Thrall user clicks Howl tab */}
      <KarlUpsellDialog
        {...KARL_UPSELL_HOWL}
        open={howlUpsellOpen}
        onDismiss={() => setHowlUpsellOpen(false)}
      />

      {/* Karl upsell dialog — shown when Thrall user clicks Trash tab */}
      <KarlUpsellDialog
        {...KARL_UPSELL_TRASH}
        open={trashUpsellOpen}
        onDismiss={() => setTrashUpsellOpen(false)}
      />
    </div>
  );
}
