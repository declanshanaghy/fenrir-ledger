"use client";

/**
 * LedgerBottomTabs -- mobile bottom tab bar for /ledger/* routes.
 *
 * Visible only on mobile (<= 768px). Fixed to bottom, full width,
 * 56px tall + safe-area-inset-bottom.
 * z-index: 100 (same chrome layer as the slim top bar).
 *
 * Tabs (4):
 *   1. Dashboard  -> /ledger         icon: LayoutGrid
 *   2. Add        -> /ledger/cards/new  icon: Plus
 *   3. Hunt       -> /ledger (dispatches tab event or navigates with ?tab=hunt)
 *   4. Valhalla   -> /ledger (dispatches tab event or navigates with ?tab=valhalla)
 *
 * Issue #403: Settings tab removed — Settings is now accessed via profile dropdown.
 * Touch targets: 56px tall x ~33% viewport width (well above 44x44px minimum).
 * Active tab: aria-current="page" + gold accent.
 *
 * See: ux/wireframes/chrome/sidebar-removal-dropdown-settings.html
 * Issue: #403, #372
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useIsKarlOrTrial } from "@/hooks/useIsKarlOrTrial";
import {
  KarlUpsellDialog,
  KARL_UPSELL_VALHALLA,
  KARL_UPSELL_VELOCITY,
} from "@/components/entitlement/KarlUpsellDialog";

/** Rune icon for Valhalla/Hunt tabs. Matches SideNav's RuneIcon pattern. */
function RuneIcon({ rune, className }: { rune: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("h-5 w-5 shrink-0 flex items-center justify-center text-base leading-none", className)}
      style={{ fontFamily: "serif" }}
    >
      {rune}
    </span>
  );
}

/**
 * Gated tab button — renders a button for a Karl-gated tab.
 * Shows a lock rune marker when the user lacks the required entitlement.
 * Complexity: ~6 (well under 15).
 */
interface GatedTabButtonProps {
  hasFeature: boolean;
  isActive: boolean;
  rune: string;
  label: string;
  lockedLabel: string;
  tabName: string;
  tabBase: string;
  tabActive: string;
  onClick: (e: React.MouseEvent) => void;
}

function GatedTabButton({
  hasFeature,
  isActive,
  rune,
  label,
  lockedLabel,
  tabName,
  tabBase,
  tabActive,
  onClick,
}: GatedTabButtonProps) {
  const isPageActive = isActive && hasFeature;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(tabBase, "w-full", isPageActive && tabActive)}
      aria-current={isPageActive ? "page" : undefined}
      aria-label={hasFeature ? label : lockedLabel}
    >
      <div className="relative">
        <RuneIcon rune={rune} />
        {!hasFeature && (
          <span
            className="karl-gate-marker absolute -top-1.5 -right-3 px-0.5 leading-tight bg-background"
            aria-hidden="true"
          >ᚠ</span>
        )}
      </div>
      <span className="text-[10px] font-body">{tabName}</span>
    </button>
  );
}

/**
 * Custom hook for gated tab click handling.
 * Shared logic for Valhalla and Hunt tabs:
 * - Shows upsell dialog when user lacks entitlement
 * - Dispatches dashboard tab event when already on /ledger
 * - Navigates to /ledger?tab=<name> when on another route
 * Complexity per call: ~4 (well under 15).
 */
function useGatedTabClick({
  hasFeature,
  tabName,
  onUpsell,
  isOnDashboard,
}: {
  hasFeature: boolean;
  tabName: string;
  onUpsell: () => void;
  isOnDashboard: boolean;
}) {
  return useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      if (!hasFeature) {
        onUpsell();
        return;
      }

      if (isOnDashboard) {
        window.dispatchEvent(
          new CustomEvent("fenrir:activate-tab", { detail: { tab: tabName } })
        );
        try {
          localStorage.setItem("fenrir:dashboard-tab", tabName);
        } catch {
          // ignore
        }
      } else {
        window.location.href = `/ledger?tab=${tabName}`;
      }
    },
    [isOnDashboard, hasFeature, tabName, onUpsell]
  );
}

/**
 * LedgerBottomTabs — mobile bottom navigation bar.
 * Complexity: ~9 (well under 15).
 */
export function LedgerBottomTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasFeature } = useEntitlement();
  const karlOrTrial = useIsKarlOrTrial();
  const hasValhalla = hasFeature("card-archive") || karlOrTrial;
  const hasVelocity = hasFeature("velocity-management") || karlOrTrial;
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [velocityUpsellOpen, setVelocityUpsellOpen] = useState(false);

  const isOnDashboard = pathname === "/ledger";
  const activeTab = searchParams?.get("tab");
  const dashboardActive = isOnDashboard && activeTab !== "valhalla" && activeTab !== "hunt";
  const addActive = pathname === "/ledger/cards/new";

  const openValhallaUpsell = useCallback(() => setUpsellOpen(true), []);
  const openVelocityUpsell = useCallback(() => setVelocityUpsellOpen(true), []);

  const handleValhallaClick = useGatedTabClick({
    hasFeature: hasValhalla,
    tabName: "valhalla",
    onUpsell: openValhallaUpsell,
    isOnDashboard,
  });

  const handleHuntClick = useGatedTabClick({
    hasFeature: hasVelocity,
    tabName: "hunt",
    onUpsell: openVelocityUpsell,
    isOnDashboard,
  });

  const tabBase =
    "flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors min-h-[56px] border-b-2 border-transparent";
  const tabActive = "text-gold karl-bling-nav-active";

  return (
    <nav
      role="navigation"
      aria-label="App tabs"
      className="md:hidden fixed bottom-0 left-0 right-0 h-14 border-t border-border bg-background z-[100]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex h-full" role="list">
        {/* Dashboard */}
        <li className="flex flex-1">
          <Link
            href="/ledger"
            className={cn(tabBase, dashboardActive && tabActive)}
            aria-current={dashboardActive ? "page" : undefined}
          >
            <LayoutGrid className="h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] font-body">Dashboard</span>
          </Link>
        </li>

        {/* Add Card */}
        <li className="flex flex-1">
          <Link
            href="/ledger/cards/new"
            className={cn(tabBase, addActive && tabActive)}
            aria-current={addActive ? "page" : undefined}
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] font-body">Add</span>
          </Link>
        </li>

        {/* Hunt — gated for Thrall users */}
        <li className="flex flex-1 sidebar-karl-feature">
          <GatedTabButton
            hasFeature={hasVelocity}
            isActive={isOnDashboard && activeTab === "hunt"}
            rune="ᛜ"
            label="Open Hunt tab"
            lockedLabel="The Hunt \u2014 Karl tier required. Tap to upgrade."
            tabName="Hunt"
            tabBase={tabBase}
            tabActive={tabActive}
            onClick={handleHuntClick}
          />
        </li>

        {/* Valhalla — gated for Thrall users */}
        <li className="flex flex-1 sidebar-karl-feature">
          <GatedTabButton
            hasFeature={hasValhalla}
            isActive={isOnDashboard && activeTab === "valhalla"}
            rune="↑"
            label="Open Valhalla tab"
            lockedLabel="Valhalla \u2014 Karl tier required. Tap to upgrade."
            tabName="Valhalla"
            tabBase={tabBase}
            tabActive={tabActive}
            onClick={handleValhallaClick}
          />
        </li>
      </ul>

      {/* Karl upsell dialog — shown when Thrall user taps Valhalla */}
      <KarlUpsellDialog
        {...KARL_UPSELL_VALHALLA}
        open={upsellOpen}
        onDismiss={() => setUpsellOpen(false)}
      />

      {/* Karl upsell dialog — shown when Thrall user taps Hunt */}
      <KarlUpsellDialog
        {...KARL_UPSELL_VELOCITY}
        open={velocityUpsellOpen}
        onDismiss={() => setVelocityUpsellOpen(false)}
      />
    </nav>
  );
}
