"use client";

/**
 * LedgerBottomTabs -- mobile bottom tab bar for /ledger/* routes.
 *
 * Visible only on mobile (<= 768px). Replaces the sidebar on small viewports.
 * Fixed to bottom, full width, 56px tall + safe-area-inset-bottom.
 * z-index: 100 (same chrome layer as the slim top bar).
 *
 * Tabs:
 *   1. Dashboard  -> /ledger         icon: LayoutGrid
 *   2. Add        -> /ledger/cards/new  icon: Plus
 *   3. Valhalla   -> /ledger (dispatches tab event or navigates with ?tab=valhalla)
 *   4. Settings   -> /ledger/settings icon: Settings
 *
 * Touch targets: 56px tall x ~25% viewport width (well above 44x44px minimum).
 * Active tab: aria-current="page" + gold accent.
 *
 * See: ux/wireframes/chrome/ledger-shell.html (Scenario 7)
 * Issue: #372
 */

import { useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const isOnDashboard = pathname === "/ledger";
  const activeTab = searchParams?.get("tab");
  const valhallaTabActive = isOnDashboard && activeTab === "valhalla";

  // Dashboard is active when on /ledger without the valhalla tab param
  const dashboardActive = isOnDashboard && activeTab !== "valhalla";
  const addActive = pathname === "/ledger/cards/new";
  const settingsActive = pathname === "/ledger/settings";

  /**
   * Valhalla tab click handler -- mirrors SideNav behavior.
   * If already on dashboard: dispatch custom event to switch tab.
   * Otherwise: navigate to /ledger?tab=valhalla.
   */
  const handleValhallaClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
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
    [isOnDashboard]
  );

  const tabBase =
    "flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors min-h-[56px]";
  const tabActive = "text-gold";

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

        {/* Valhalla */}
        <li className="flex flex-1">
          <button
            type="button"
            onClick={handleValhallaClick}
            className={cn(tabBase, "w-full", valhallaTabActive && tabActive)}
            aria-current={valhallaTabActive ? "page" : undefined}
            aria-label="Open Valhalla tab"
          >
            <RuneIcon rune="↑" />
            <span className="text-[10px] font-body">Valhalla</span>
          </button>
        </li>

        {/* Settings */}
        <li className="flex flex-1">
          <Link
            href="/ledger/settings"
            className={cn(tabBase, settingsActive && tabActive)}
            aria-current={settingsActive ? "page" : undefined}
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] font-body">Settings</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
