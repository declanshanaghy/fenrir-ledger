"use client";

/**
 * Settings Page -- /settings route
 *
 * 3-tab layout: Account | Household | Settings
 *
 * - URL hash persistence: #account, #household, #settings
 * - Dynamic subtitle per active tab with aria-live="polite"
 * - Desktop: horizontal tab bar (WAI-ARIA tabs pattern)
 * - Mobile (<md): native <select> dropdown
 * - Karl bling: gold border treatment on tabs for karl/trial tiers
 *
 * Issue: #1367
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { StripeSettings } from "@/components/entitlement/StripeSettings";
import { track } from "@/lib/analytics/track";
import { TrialSettingsSection } from "@/components/trial/TrialSettingsSection";
import { HouseholdSettingsSection } from "@/components/household/HouseholdSettingsSection";
import { SyncSettingsSection } from "@/components/sync/SyncSettingsSection";
import type { DashboardTab } from "@/lib/constants";
import {
  GleipnirMountainRoots,
  useGleipnirFragment3,
} from "@/components/cards/GleipnirMountainRoots";

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type SettingsTabId = "account" | "household" | "settings";

interface SettingsTab {
  id: SettingsTabId;
  label: string;
  subtitle: string;
}

const SETTINGS_TABS: SettingsTab[] = [
  {
    id: "account",
    label: "Account",
    subtitle:
      "Manage your subscription and trial status. The wolf's chain awaits your command.",
  },
  {
    id: "household",
    label: "Household",
    subtitle: "Configure your household and cloud sync. Forge the bonds that bind.",
  },
  {
    id: "settings",
    label: "Settings",
    subtitle: "Customize your experience. Shape the ledger to your will.",
  },
];

const DEFAULT_TAB: SettingsTabId = "account";

function getInitialTab(): SettingsTabId {
  if (typeof window === "undefined") return DEFAULT_TAB;
  const hash = window.location.hash.replace("#", "") as SettingsTabId;
  return SETTINGS_TABS.some((t) => t.id === hash) ? hash : DEFAULT_TAB;
}

// ---------------------------------------------------------------------------
// Tab guide localStorage keys
// ---------------------------------------------------------------------------

/** All 5 dashboard tab IDs */
const TAB_IDS: DashboardTab[] = ["all", "valhalla", "active", "hunt", "howl"];

/** All 10 localStorage keys for dismissed tab headers and summaries */
const TAB_GUIDE_KEYS: string[] = TAB_IDS.flatMap((tabId) => [
  `fenrir:tab-header-dismissed:${tabId}`,
  `fenrir:tab-summary-dismissed:${tabId}`,
]);

/**
 * Check how many tab guide localStorage keys are currently set to "true".
 * Returns 0 if localStorage is unavailable.
 */
function countDismissedGuides(): number {
  try {
    return TAB_GUIDE_KEYS.filter(
      (key) => localStorage.getItem(key) === "true"
    ).length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// RestoreTabGuides component
// ---------------------------------------------------------------------------

/** Duration in ms to show the confirmation message after restoring guides */
const CONFIRMATION_DURATION_MS = 3000;

/**
 * RestoreTabGuides — settings section to reset all dismissed tab headers and summaries.
 *
 * Shows a "Restore the Guides" button that clears all 10 fenrir:tab-*-dismissed:*
 * localStorage keys. Button is disabled when no keys are set (nothing to restore).
 * Displays a brief confirmation message after reset.
 *
 * Issue #587 — Settings widget to reset dismissed tab headers
 */
function RestoreTabGuides() {
  const [dismissedCount, setDismissedCount] = useState<number>(0);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const { open: rootsOpen, trigger: triggerRoots, dismiss: dismissRoots } = useGleipnirFragment3();

  // Read dismissed count from localStorage on mount
  useEffect(() => {
    setDismissedCount(countDismissedGuides());
  }, []);

  // Auto-hide confirmation message after timeout
  useEffect(() => {
    if (!showConfirmation) return;
    const timer = setTimeout(() => {
      setShowConfirmation(false);
    }, CONFIRMATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showConfirmation]);

  const handleRestore = useCallback(() => {
    try {
      for (const key of TAB_GUIDE_KEYS) {
        localStorage.removeItem(key);
      }
    } catch {
      // localStorage unavailable — nothing to do
    }
    setDismissedCount(0);
    setShowConfirmation(true);
    // Fragment #3 — The Roots of a Mountain: first restore triggers the egg (no-op if already found)
    triggerRoots();
  }, [triggerRoots]);

  const hasGuidesToRestore = dismissedCount > 0;

  return (
    <section
      className="relative border border-border p-5 flex flex-col gap-3 karl-bling-card"
      aria-label="Restore Tab Guides"
    >
      {/* Karl rune corners */}
      <span className="karl-rune-corner karl-rune-tl" aria-hidden="true">ᚠ</span>
      <span className="karl-rune-corner karl-rune-tr" aria-hidden="true">ᚱ</span>
      <span className="karl-rune-corner karl-rune-bl" aria-hidden="true">ᛁ</span>
      <span className="karl-rune-corner karl-rune-br" aria-hidden="true">ᚾ</span>
      <h2 className="text-sm font-heading font-bold uppercase tracking-[0.08em] text-foreground">
        Tab Guides
      </h2>
      <p className="text-base text-foreground/90 leading-relaxed font-body">
        Dismissed tab headers and summaries can be restored here. Bring back the
        wisdom of the guides.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="button"
          onClick={handleRestore}
          disabled={!hasGuidesToRestore}
          className={`inline-flex items-center gap-2 min-h-[44px] md:min-h-[40px] px-4 py-2 text-base font-heading tracking-wide border rounded-sm transition-colors ${
            hasGuidesToRestore
              ? "border-gold/60 text-gold hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer karl-bling-btn"
              : "border-border text-muted-foreground/60 cursor-not-allowed"
          }`}
          aria-label={
            hasGuidesToRestore
              ? `Restore the Guides (${dismissedCount} dismissed)`
              : "Restore the Guides (none dismissed)"
          }
        >
          <span aria-hidden="true" className="text-base">
            &#x16C7;
          </span>
          Restore the Guides
        </button>

        {showConfirmation && (
          <p
            className="text-sm text-gold font-body"
            role="status"
            aria-live="polite"
          >
            Tab guides restored. The wisdom returns.
          </p>
        )}
      </div>

      {!hasGuidesToRestore && !showConfirmation && (
        <p className="text-[13px] italic text-muted-foreground/60 font-body">
          All guides are currently visible. Nothing to restore.
        </p>
      )}

      {/* Fragment #3 — The Roots of a Mountain */}
      <GleipnirMountainRoots open={rootsOpen} onClose={dismissRoots} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

/**
 * SettingsPage -- the /settings route.
 *
 * 3-tab layout: Account | Household | Settings
 * Refactored from 2-column card layout per issue #1367.
 */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(DEFAULT_TAB);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Hydrate tab from URL hash on mount
  useEffect(() => {
    setActiveTab(getInitialTab());
    track("settings-visit");
  }, []);

  // Listen for hash changes so that dropdown nav (router.push("#account") etc.)
  // switches the active tab when already on the settings page.
  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash.replace("#", "") as SettingsTabId;
      if (SETTINGS_TABS.some((t) => t.id === hash)) {
        setActiveTab(hash);
      }
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const activateTab = useCallback((tabId: SettingsTabId) => {
    setActiveTab(tabId);
    history.replaceState(null, "", "#" + tabId);
    track("settings-tab-switch", { tab: tabId });
  }, []);

  // Keyboard navigation: ArrowLeft/Right/Home/End
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const total = SETTINGS_TABS.length;
      let nextIndex: number | null = null;

      if (e.key === "ArrowRight") {
        nextIndex = (index + 1) % total;
      } else if (e.key === "ArrowLeft") {
        nextIndex = (index - 1 + total) % total;
      } else if (e.key === "Home") {
        nextIndex = 0;
      } else if (e.key === "End") {
        nextIndex = total - 1;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        const nextTab = SETTINGS_TABS[nextIndex];
        if (nextTab) {
          activateTab(nextTab.id);
          tabRefs.current[nextIndex]?.focus();
        }
      }
    },
    [activateTab]
  );

  const activeTabData = SETTINGS_TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="px-6 py-6 max-w-5xl">
      {/* Page heading */}
      <header className="mb-0 border-b border-border pb-4">
        <h1 className="font-display text-2xl text-gold tracking-wide mb-1">
          Settings
        </h1>
        <p
          className="text-sm text-muted-foreground mt-2 font-body italic"
          aria-live="polite"
          id="settings-subtitle"
        >
          {activeTabData.subtitle}
        </p>
      </header>

      {/* ── Desktop tab bar (hidden on mobile) ── */}
      <div
        role="tablist"
        aria-label="Settings tabs"
        className="hidden md:flex border-b border-border"
      >
        {SETTINGS_TABS.map((tab, index) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[index] = el; }}
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`settings-panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => activateTab(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`karl-bling-tab relative px-5 py-3 text-sm font-heading font-semibold tracking-wide border border-transparent border-b-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isSelected
                  ? "border-border border-b-2 border-b-background -mb-px text-foreground bg-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Mobile select (visible below md) ── */}
      <div className="md:hidden pt-4">
        <label htmlFor="settings-tab-select" className="sr-only">
          Settings section
        </label>
        <select
          id="settings-tab-select"
          aria-label="Settings section"
          value={activeTab}
          onChange={(e) => activateTab(e.target.value as SettingsTabId)}
          className="karl-bling-select w-full min-h-[44px] px-3 py-2 text-sm font-heading bg-background border border-border rounded-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {SETTINGS_TABS.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Tab panels ── */}

      {/* Account panel */}
      <div
        role="tabpanel"
        id="settings-panel-account"
        aria-labelledby="settings-tab-account"
        hidden={activeTab !== "account"}
        className="pt-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StripeSettings />
          <TrialSettingsSection />
        </div>
      </div>

      {/* Household panel */}
      <div
        role="tabpanel"
        id="settings-panel-household"
        aria-labelledby="settings-tab-household"
        hidden={activeTab !== "household"}
        className="pt-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <HouseholdSettingsSection />
          <SyncSettingsSection />
        </div>
      </div>

      {/* Settings panel */}
      <div
        role="tabpanel"
        id="settings-panel-settings"
        aria-labelledby="settings-tab-settings"
        hidden={activeTab !== "settings"}
        className="pt-6"
      >
        <RestoreTabGuides />
      </div>
    </div>
  );
}
