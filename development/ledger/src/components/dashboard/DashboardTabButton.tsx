"use client";

/**
 * DashboardTabButton — renders a single tab button in the Dashboard tab bar.
 *
 * Extracted from Dashboard.tsx (issue #1684) to reduce the complexity of the
 * anonymous TAB_CONFIG.map() arrow function from 39 to < 15.
 *
 * Handles: entitlement gate gating, Karl upsell lock icons, Howl urgency
 * animation, Ragnarök override, ARIA labels, and tab badge rendering.
 */

import { cn } from "@/lib/utils";
import type { DashboardGates } from "@/hooks/useDashboardTabs";
import type { DashboardTab } from "@/lib/constants";

// ─── TabBadge (re-used from Dashboard.tsx inline) ─────────────────────────────

interface TabBadgeProps {
  count: number;
  isHowl?: boolean;
  isTrash?: boolean;
}

function TabBadge({ count, isHowl, isTrash }: TabBadgeProps) {
  const zeroOpacity = count === 0 ? "opacity-40" : "";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        "text-xs font-mono font-semibold",
        "border px-1.5 min-w-[20px]",
        isHowl && count > 0
          ? "border-[2px] border-[hsl(var(--realm-muspel))] text-[hsl(var(--realm-muspel))]"
          : "border-border text-muted-foreground",
        isTrash && "trash-count-badge",
        zeroOpacity,
      )}
      aria-label={`${count} deleted card${count !== 1 ? "s" : ""}`}
    >
      {count}
    </span>
  );
}

// ─── TabRuneSpan ──────────────────────────────────────────────────────────────

interface TabRuneSpanProps {
  rune: string;
  isHowlTab: boolean;
  isHowlLocked: boolean;
  howlHasCards: boolean;
  ragnarokActive: boolean;
  howlBadgeShake: boolean;
  onAnimationEnd: () => void;
}

/** Renders the rune icon with conditional Howl/Ragnarök pulse animations. */
function TabRuneSpan({
  rune,
  isHowlTab,
  isHowlLocked,
  howlHasCards,
  ragnarokActive,
  howlBadgeShake,
  onAnimationEnd,
}: TabRuneSpanProps) {
  const showHowlFx = isHowlTab && !isHowlLocked;
  const pulseClass =
    showHowlFx && howlHasCards && !ragnarokActive
      ? "animate-muspel-pulse text-[hsl(var(--realm-muspel))]"
      : showHowlFx && ragnarokActive
        ? "animate-muspel-pulse text-[hsl(var(--realm-ragnarok-dark))]"
        : "";
  const shakeClass =
    showHowlFx && howlBadgeShake ? "raven-icon--warning" : "";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-base leading-none select-none",
        pulseClass,
        shakeClass,
      )}
      onAnimationEnd={showHowlFx ? onAnimationEnd : undefined}
      style={{ fontFamily: "serif" }}
    >
      {rune}
    </span>
  );
}

// ─── TabButtonBadgeArea ───────────────────────────────────────────────────────

interface TabButtonBadgeAreaProps {
  isHowlLocked: boolean;
  isGatedValhalla: boolean;
  isGatedHunt: boolean;
  isGatedTrash: boolean;
  isTrashTab: boolean;
  isHowlTab: boolean;
  count: number;
}

/** Renders either a lock/KARL badge (Thrall) or the normal count badge. */
function TabButtonBadgeArea({
  isHowlLocked,
  isGatedValhalla,
  isGatedHunt,
  isGatedTrash,
  isTrashTab,
  isHowlTab,
  count,
}: TabButtonBadgeAreaProps) {
  if (isHowlLocked) {
    return (
      <>
        <span className="text-xs opacity-70" aria-hidden="true">
          {"\uD83D\uDD12"}
        </span>
        <span
          className="text-[9px] font-mono font-bold border border-gold/20 px-1.5 py-0.5 uppercase tracking-wide text-gold/60"
          aria-hidden="true"
        >
          KARL
        </span>
      </>
    );
  }
  if (isGatedValhalla || isGatedHunt) {
    return (
      <span className="text-[10px] ml-0.5" aria-hidden="true">
        &#128274;
      </span>
    );
  }
  if (isGatedTrash) {
    return (
      <span
        aria-hidden="true"
        className="text-[11px] opacity-65 select-none"
        style={{ fontFamily: "serif" }}
      >
        ᛜ
      </span>
    );
  }
  return <TabBadge count={count} isHowl={isHowlTab} isTrash={isTrashTab} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTabAriaLabel(
  isHowlLocked: boolean,
  isGatedValhalla: boolean,
  isGatedHunt: boolean,
  isGatedTrash: boolean,
): string | undefined {
  if (isHowlLocked) return "The Howl \u2014 Karl tier required. Click to upgrade.";
  if (isGatedValhalla) return "Valhalla \u2014 Karl tier required. Click to upgrade.";
  if (isGatedHunt) return "The Hunt \u2014 Karl tier required. Click to upgrade.";
  if (isGatedTrash) return "Trash \u2014 upgrade to Karl to access";
  return undefined;
}

function getTabButtonClassName(opts: {
  isActive: boolean;
  isHowlTab: boolean;
  isHowlLocked: boolean;
  isTrashTab: boolean;
  isGatedTrash: boolean;
  ragnarokActive: boolean;
}): string {
  const { isActive, isHowlTab, isHowlLocked, isTrashTab, isGatedTrash, ragnarokActive } = opts;
  return cn(
    "flex items-center gap-2 px-4 py-3 text-sm font-heading uppercase tracking-wide",
    "border-b-[3px] transition-colors whitespace-nowrap shrink-0 min-h-[44px]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    isTrashTab && "trash-tab ml-auto",
    isGatedTrash && "opacity-65",
    isActive
      ? isHowlTab && !isHowlLocked
        ? ragnarokActive
          ? "border-[hsl(var(--realm-ragnarok-dark))] text-[hsl(var(--realm-ragnarok-dark))]"
          : "border-[hsl(var(--realm-muspel))] text-[hsl(var(--realm-muspel))]"
        : "border-gold text-gold"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );
}

// ─── DashboardTabButton ───────────────────────────────────────────────────────

export interface DashboardTabButtonProps {
  tab: {
    id: DashboardTab;
    label: string;
    rune: string;
    panelId: string;
    buttonId: string;
  };
  isActive: boolean;
  count: number;
  gates: DashboardGates;
  ragnarokActive: boolean;
  /** true when The Howl has at least one card (drives pulse animation). */
  howlHasCards: boolean;
  howlBadgeShake: boolean;
  onHowlAnimationEnd: () => void;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

export function DashboardTabButton({
  tab,
  isActive,
  count,
  gates,
  ragnarokActive,
  howlHasCards,
  howlBadgeShake,
  onHowlAnimationEnd,
  onClick,
  onKeyDown,
}: DashboardTabButtonProps) {
  const isHowlTab = tab.id === "howl";
  const isValhallaTab = tab.id === "valhalla";
  const isHuntTab = tab.id === "hunt";
  const isTrashTab = tab.id === "trash";
  const isGatedValhalla = isValhallaTab && !gates.hasValhalla;
  const isGatedHunt = isHuntTab && !gates.hasVelocity;
  const isGatedTrash = isTrashTab && !gates.hasTrash;
  const isHowlLocked = isHowlTab && !gates.isHowlUnlocked;
  const isAnyGated = isGatedValhalla || isGatedHunt || isHowlLocked || isGatedTrash;

  return (
    <button
      type="button"
      role="tab"
      id={tab.buttonId}
      aria-selected={isActive}
      aria-controls={isAnyGated ? undefined : tab.panelId}
      aria-label={getTabAriaLabel(
        isHowlLocked,
        isGatedValhalla,
        isGatedHunt,
        isGatedTrash,
      )}
      tabIndex={isActive ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={getTabButtonClassName({
        isActive,
        isHowlTab,
        isHowlLocked,
        isTrashTab,
        isGatedTrash,
        ragnarokActive,
      })}
    >
      <TabRuneSpan
        rune={tab.rune}
        isHowlTab={isHowlTab}
        isHowlLocked={isHowlLocked}
        howlHasCards={howlHasCards}
        ragnarokActive={ragnarokActive}
        howlBadgeShake={howlBadgeShake}
        onAnimationEnd={onHowlAnimationEnd}
      />
      {isHowlTab && !isHowlLocked && ragnarokActive
        ? "Ragnarök Approaches"
        : tab.label}
      <TabButtonBadgeArea
        isHowlLocked={isHowlLocked}
        isGatedValhalla={isGatedValhalla}
        isGatedHunt={isGatedHunt}
        isGatedTrash={isGatedTrash}
        isTrashTab={isTrashTab}
        isHowlTab={isHowlTab}
        count={count}
      />
    </button>
  );
}
