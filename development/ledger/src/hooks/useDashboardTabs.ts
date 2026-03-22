"use client";

/**
 * useDashboardTabs — tab state manager for the Dashboard component.
 *
 * Extracted from Dashboard.tsx (issue #1684) to reduce cyclomatic complexity.
 * Encapsulates: entitlement gates, initial tab resolution, localStorage
 * persistence, Valhalla tracking, activate-tab event listener, upsell dialog
 * state, howl badge shake animation, and tab click/keyboard navigation.
 */

import { useState, useEffect, useRef } from "react";
import { track } from "@/lib/analytics/track";
import type { DashboardTab } from "@/lib/constants";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useIsKarlOrTrial } from "@/hooks/useIsKarlOrTrial";

const VALID_TABS = new Set<string>([
  "howl",
  "hunt",
  "active",
  "valhalla",
  "all",
  "trash",
]);

const TAB_STORAGE_KEY = "fenrir:dashboard-tab";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardGates {
  isHowlUnlocked: boolean;
  hasValhalla: boolean;
  hasVelocity: boolean;
  hasTrash: boolean;
}

export interface UseDashboardTabsOptions {
  initialTab: string | undefined;
  howlCount: number;
  /** Ordered list of { id, buttonId } for keyboard navigation. */
  tabConfigs: readonly { id: DashboardTab; buttonId: string }[];
}

export interface UseDashboardTabsResult {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  gates: DashboardGates;
  /** true when the user is a Karl subscriber or on an active trial */
  karlOrTrial: boolean;
  upsellOpen: boolean;
  setUpsellOpen: (v: boolean) => void;
  velocityUpsellOpen: boolean;
  setVelocityUpsellOpen: (v: boolean) => void;
  howlUpsellOpen: boolean;
  setHowlUpsellOpen: (v: boolean) => void;
  trashUpsellOpen: boolean;
  setTrashUpsellOpen: (v: boolean) => void;
  howlBadgeShake: boolean;
  setHowlBadgeShake: (v: boolean) => void;
  handleTabClick: (tabId: DashboardTab) => void;
  handleTabKeyDown: (
    e: React.KeyboardEvent<HTMLButtonElement>,
    tabIndex: number,
  ) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readStoredTab(): DashboardTab | null {
  try {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem(TAB_STORAGE_KEY)
        : null;
    if (stored && VALID_TABS.has(stored)) return stored as DashboardTab;
  } catch {
    // localStorage unavailable (e.g. private mode lockdown) — ignore
  }
  return null;
}

/**
 * Computes the initial tab from: prop (URL param) → localStorage → default.
 * Gated tabs fall through to default when the user lacks the required tier.
 */
export function resolveInitialTab(
  initialTab: string | undefined,
  gates: DashboardGates,
  howlCount: number,
): DashboardTab {
  if (initialTab && VALID_TABS.has(initialTab)) {
    const isGated =
      (initialTab === "valhalla" && !gates.hasValhalla) ||
      (initialTab === "hunt" && !gates.hasVelocity) ||
      (initialTab === "howl" && !gates.isHowlUnlocked) ||
      (initialTab === "trash" && !gates.hasTrash);
    if (!isGated) return initialTab as DashboardTab;
  }
  const stored = readStoredTab();
  if (stored) return stored;
  return howlCount > 0 ? "howl" : "active";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardTabs({
  initialTab,
  howlCount,
  tabConfigs,
}: UseDashboardTabsOptions): UseDashboardTabsResult {
  const { hasFeature } = useEntitlement();
  const karlOrTrial = useIsKarlOrTrial();

  const gates: DashboardGates = {
    isHowlUnlocked: hasFeature("howl-panel") || karlOrTrial,
    hasValhalla: hasFeature("card-archive") || karlOrTrial,
    hasVelocity: hasFeature("velocity-management") || karlOrTrial,
    hasTrash: karlOrTrial,
  };

  const [activeTab, setActiveTab] = useState<DashboardTab>(() =>
    resolveInitialTab(initialTab, gates, howlCount),
  );

  const [upsellOpen, setUpsellOpen] = useState(false);
  const [velocityUpsellOpen, setVelocityUpsellOpen] = useState(false);
  const [howlUpsellOpen, setHowlUpsellOpen] = useState(false);
  const [trashUpsellOpen, setTrashUpsellOpen] = useState(false);
  const [howlBadgeShake, setHowlBadgeShake] = useState(false);
  const prevHowlCountRef = useRef(howlCount);

  // Auto-open upsell if Thrall user arrived via ?tab=<gated-tab>
  useEffect(() => {
    if (initialTab === "valhalla" && !gates.hasValhalla)
      setUpsellOpen(true);
    if (initialTab === "hunt" && !gates.hasVelocity)
      setVelocityUpsellOpen(true);
    if (initialTab === "howl" && !gates.isHowlUnlocked)
      setHowlUpsellOpen(true);
    if (initialTab === "trash" && !gates.hasTrash)
      setTrashUpsellOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist tab selection to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, activeTab);
    } catch {
      // Ignore write errors (e.g. storage full)
    }
  }, [activeTab]);

  // Track Valhalla tab visit
  useEffect(() => {
    if (activeTab === "valhalla") track("valhalla-visit");
  }, [activeTab]);

  // Howl badge shake animation when new howl cards arrive
  useEffect(() => {
    if (howlCount > prevHowlCountRef.current) setHowlBadgeShake(true);
    prevHowlCountRef.current = howlCount;
  }, [howlCount]);

  // Listen for external tab activation (e.g. sidebar/bottom-tab link)
  useEffect(() => {
    function handleActivateTab(e: Event) {
      const tab = (e as CustomEvent<{ tab: string }>).detail?.tab;
      if (!tab || !VALID_TABS.has(tab)) return;
      if (tab === "valhalla" && !gates.hasValhalla) {
        setUpsellOpen(true);
        return;
      }
      if (tab === "hunt" && !gates.hasVelocity) {
        setVelocityUpsellOpen(true);
        return;
      }
      if (tab === "howl" && !gates.isHowlUnlocked) {
        setHowlUpsellOpen(true);
        return;
      }
      if (tab === "trash" && !gates.hasTrash) {
        setTrashUpsellOpen(true);
        return;
      }
      setActiveTab(tab as DashboardTab);
    }
    window.addEventListener("fenrir:activate-tab", handleActivateTab);
    return () =>
      window.removeEventListener("fenrir:activate-tab", handleActivateTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gates.hasValhalla, gates.hasVelocity, gates.isHowlUnlocked, gates.hasTrash]);

  function handleTabClick(tabId: DashboardTab) {
    if (tabId === "valhalla" && !gates.hasValhalla) {
      setUpsellOpen(true);
      return;
    }
    if (tabId === "hunt" && !gates.hasVelocity) {
      setVelocityUpsellOpen(true);
      return;
    }
    if (tabId === "howl" && !gates.isHowlUnlocked) {
      setHowlUpsellOpen(true);
      return;
    }
    if (tabId === "trash" && !gates.hasTrash) {
      setTrashUpsellOpen(true);
      return;
    }
    setActiveTab(tabId);
  }

  function handleTabKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    tabIndex: number,
  ) {
    const tabCount = tabConfigs.length;
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
      const next = tabConfigs[nextIndex];
      if (next) {
        setActiveTab(next.id);
        document.getElementById(next.buttonId)?.focus();
      }
    }
  }

  return {
    activeTab,
    setActiveTab,
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
  };
}
