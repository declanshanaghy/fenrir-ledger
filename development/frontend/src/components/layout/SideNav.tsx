"use client";

/**
 * SideNav — collapsible left sidebar navigation.
 *
 * Expanded (w-56): icon + label
 * Collapsed (w-14): icon only (native title tooltip)
 *
 * Active route is highlighted with a gold left border.
 *
 * Issue #352: The "Valhalla" sidebar link no longer navigates to /ledger/valhalla.
 * Instead, it dispatches a `fenrir:activate-tab` custom event (if already on
 * the dashboard) or navigates to /ledger?tab=valhalla (from any other route).
 * The /ledger/valhalla route is removed. Both "Cards" and "Valhalla" sidebar items
 * show the active state simultaneously when the Valhalla dashboard tab is open.
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CreditCard, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntitlement } from "@/hooks/useEntitlement";
import {
  KarlUpsellDialog,
  KARL_UPSELL_VALHALLA,
} from "@/components/entitlement/KarlUpsellDialog";

interface SideNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * RuneIcon — renders an Elder Futhark rune glyph as a nav icon.
 * Sized and styled to match the 16×16 Lucide icon footprint.
 * Aria-hidden: the label text provides the accessible name.
 */
function RuneIcon({ rune }: { rune: string }) {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 shrink-0 flex items-center justify-center text-base leading-none"
      style={{ fontFamily: "serif" }}
    >
      {rune}
    </span>
  );
}

export function SideNav({ collapsed, onToggle }: SideNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasFeature } = useEntitlement();
  const hasValhalla = hasFeature("card-archive");
  const [upsellOpen, setUpsellOpen] = useState(false);

  // Whether the Valhalla dashboard tab is currently active
  const isOnDashboard = pathname === "/ledger";
  const activeTab = searchParams?.get("tab");
  const valhallaTabActive = isOnDashboard && activeTab === "valhalla";

  /**
   * Handle Valhalla sidebar link click.
   * - If on dashboard: dispatch custom event to activate Valhalla tab in-place.
   * - Otherwise: navigate to /?tab=valhalla.
   */
  const handleValhallaClick = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();

      // Gate Valhalla for Thrall users — show upsell dialog
      if (!hasValhalla) {
        setUpsellOpen(true);
        return;
      }

      if (isOnDashboard) {
        // Dispatch event — Dashboard.tsx listens and activates the tab
        window.dispatchEvent(
          new CustomEvent("fenrir:activate-tab", { detail: { tab: "valhalla" } })
        );
        // Also update localStorage so the tab persists on next load
        try {
          localStorage.setItem("fenrir:dashboard-tab", "valhalla");
        } catch {
          // ignore
        }
      } else {
        // Navigate to dashboard with tab query param
        window.location.href = "/ledger?tab=valhalla";
      }
    },
    [isOnDashboard, hasValhalla]
  );

  return (
    <aside
      className={cn(
        "shrink-0 flex flex-col border-r border-border bg-background",
        "transition-all duration-200 ease-in-out",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Nav items */}
      <nav className="flex-1 py-3 space-y-0.5 px-1.5">

        {/* Cards — main dashboard link */}
        <Link
          href="/ledger"
          title={collapsed ? "Cards" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-sm px-2.5 py-2 text-base",
            "transition-[transform,filter,background-color,color,border-color] duration-150 ease-out",
            "active:scale-[0.98] active:brightness-90",
            pathname === "/ledger"
              ? "bg-primary/10 text-gold border-l-2 border-gold"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:brightness-110 border-l-2 border-transparent"
          )}
        >
          <CreditCard className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="font-body truncate">Cards</span>}
        </Link>

        {/* Valhalla — activates dashboard Valhalla tab (not a separate route) */}
        {/* Shows active state both when on /valhalla tab AND when sidebar Valhalla is active */}
        {/* Thrall users see a lock icon; clicking opens KarlUpsellDialog */}
        <button
          type="button"
          title={collapsed ? (hasValhalla ? "Valhalla" : "Valhalla (Karl tier)") : undefined}
          aria-label={hasValhalla ? "Open Valhalla tab" : "Valhalla \u2014 Karl tier required. Click to upgrade."}
          onClick={handleValhallaClick}
          onKeyDown={handleValhallaClick}
          className={cn(
            "flex items-center gap-3 rounded-sm px-2.5 py-2 text-base w-full text-left",
            "transition-[transform,filter,background-color,color,border-color] duration-150 ease-out",
            "active:scale-[0.98] active:brightness-90",
            valhallaTabActive && hasValhalla
              ? "bg-primary/10 text-gold border-l-2 border-gold"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:brightness-110 border-l-2 border-transparent"
          )}
        >
          <RuneIcon rune="↑" />
          {!collapsed && (
            <span className="font-body truncate flex items-center gap-1.5">
              Valhalla
              {!hasValhalla && (
                <span className="text-[10px]" aria-hidden="true">&#128274;</span>
              )}
            </span>
          )}
        </button>

        {/* Settings */}
        <Link
          href="/ledger/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-sm px-2.5 py-2 text-base",
            "transition-[transform,filter,background-color,color,border-color] duration-150 ease-out",
            "active:scale-[0.98] active:brightness-90",
            pathname === "/ledger/settings"
              ? "bg-primary/10 text-gold border-l-2 border-gold"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:brightness-110 border-l-2 border-transparent"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="font-body truncate">Settings</span>}
        </Link>

      </nav>

      {/* Collapse toggle */}
      <div className="p-1.5 border-t border-border">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center gap-3 w-full rounded-sm px-2.5 py-2 text-base min-h-[44px]",
            "text-muted-foreground hover:bg-secondary hover:text-foreground",
            "transition-[transform,filter,background-color,color] duration-150 ease-out",
            "active:scale-[0.98] active:brightness-90"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              <span className="font-body">Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* Karl upsell dialog — shown when Thrall user clicks Valhalla */}
      <KarlUpsellDialog
        {...KARL_UPSELL_VALHALLA}
        open={upsellOpen}
        onDismiss={() => setUpsellOpen(false)}
      />
    </aside>
  );
}
