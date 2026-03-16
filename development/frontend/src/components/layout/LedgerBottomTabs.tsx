"use client";

/**
 * LedgerBottomTabs -- mobile bottom tab bar for /ledger/* routes.
 *
 * Visible only on mobile (<= 768px). Fixed to bottom, full width,
 * 56px tall + safe-area-inset-bottom.
 * z-index: 100 (same chrome layer as the slim top bar).
 *
 * Tabs (3):
 *   1. Dashboard  -> /ledger         icon: LayoutGrid
 *   2. Add        -> /ledger/cards/new  icon: Plus
 *   3. Valhalla   -> /ledger (dispatches tab event or navigates with ?tab=valhalla)
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

/** Rune icon for Valhalla tab. Matches SideNav's RuneIcon pattern. */
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
  const valhallaTabActive = isOnDashboard && activeTab === "valhalla";
  const huntTabActive = isOnDashboard && activeTab === "hunt";

  // Dashboard is active when on /ledger without the valhalla/hunt tab param
  const dashboardActive = isOnDashboard && activeTab !== "valhalla" && activeTab !== "hunt";
  const addActive = pathname === "/ledger/cards/new";

  /**
   * Valhalla tab click handler -- mirrors SideNav behavior.
   * If already on dashboard: dispatch custom event to switch tab.
   * Otherwise: navigate to /ledger?tab=valhalla.
   * Thrall users see the upsell dialog instead.
   */
  const handleValhallaClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      // Gate Valhalla for Thrall users — show upsell dialog
      if (!hasValhalla) {
        setUpsellOpen(true);
        return;
      }

      if (isOnDashboard) {
        window.dispatchEvent(
          new CustomEvent("fenrir:activate-tab", { detail: { tab: "valhalla" } })
        );
        try {
          localStorage.setItem("fenrir:dashboard-tab", "valhalla");
        } catch {
          // ignore
        }
      } else {
        window.location.href = "/ledger?tab=valhalla";
      }
    },
    [isOnDashboard, hasValhalla]
  );

  /**
   * Hunt tab click handler -- mirrors Valhalla behavior.
   * Thrall users see the upsell dialog instead.
   */
  const handleHuntClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      // Gate Hunt for Thrall users — show upsell dialog
      if (!hasVelocity) {
        setVelocityUpsellOpen(true);
        return;
      }

      if (isOnDashboard) {
        window.dispatchEvent(
          new CustomEvent("fenrir:activate-tab", { detail: { tab: "hunt" } })
        );
        try {
          localStorage.setItem("fenrir:dashboard-tab", "hunt");
        } catch {
          // ignore
        }
      } else {
        window.location.href = "/ledger?tab=hunt";
      }
    },
    [isOnDashboard, hasVelocity]
  );

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

        {/* Valhalla — gated for Thrall users */}
        <li className="flex flex-1 sidebar-karl-feature">
          <button
            type="button"
            onClick={handleValhallaClick}
            className={cn(tabBase, "w-full", valhallaTabActive && hasValhalla && tabActive)}
            aria-current={valhallaTabActive && hasValhalla ? "page" : undefined}
            aria-label={hasValhalla ? "Open Valhalla tab" : "Valhalla \u2014 Karl tier required. Tap to upgrade."}
          >
            <div className="relative">
              <RuneIcon rune="↑" />
              {!hasValhalla && (
                <span
                  className="karl-gate-marker absolute -top-1.5 -right-3 px-0.5 leading-tight bg-background"
                  aria-hidden="true"
                >ᚠ</span>
              )}
            </div>
            <span className="text-[10px] font-body">Valhalla</span>
          </button>
        </li>

        {/* Hunt — gated for Thrall users */}
        <li className="flex flex-1 sidebar-karl-feature">
          <button
            type="button"
            onClick={handleHuntClick}
            className={cn(tabBase, "w-full", huntTabActive && hasVelocity && tabActive)}
            aria-current={huntTabActive && hasVelocity ? "page" : undefined}
            aria-label={hasVelocity ? "Open Hunt tab" : "The Hunt \u2014 Karl tier required. Tap to upgrade."}
          >
            <div className="relative">
              <RuneIcon rune="ᛜ" />
              {!hasVelocity && (
                <span
                  className="karl-gate-marker absolute -top-1.5 -right-3 px-0.5 leading-tight bg-background"
                  aria-hidden="true"
                >ᚠ</span>
              )}
            </div>
            <span className="text-[10px] font-body">Hunt</span>
          </button>
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
