"use client";

/**
 * AppShell — the persistent application frame.
 *
 * Renders the TopBar, dismissible UpsellBanner (dashboard only),
 * collapsible SideNav, and the main content slot.
 * Collapse state is persisted to localStorage so it survives navigation.
 *
 * Layout grid:
 *   Row 1: TopBar (full width)
 *   Row 2: UpsellBanner (full width, dashboard-only, anonymous users only)
 *   Row 3: SideNav (left) + main content + Footer (right)
 *
 * See ux/wireframes/upsell-banner.html for the banner grid placement spec.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { SideNav } from "./SideNav";
import { SyncIndicator } from "./SyncIndicator";
import { KonamiHowl } from "./KonamiHowl";
import { ForgeMasterEgg } from "./ForgeMasterEgg";
import { LcarsOverlay } from "@/components/easter-eggs/LcarsOverlay";
import { Toaster } from "sonner";
import { Footer } from "./Footer";
import { UpsellBanner } from "./UpsellBanner";
import {
  GleipnirMountainRoots,
  useGleipnirFragment3,
} from "@/components/cards/GleipnirMountainRoots";
import { useRagnarok } from "@/contexts/RagnarokContext";

const STORAGE_KEY = "fenrir:sidenav-collapsed";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { open: rootsOpen, trigger: triggerRoots, dismiss: dismissRoots } = useGleipnirFragment3();
  const { ragnarokActive } = useRagnarok();

  // Read persisted state after mount to avoid SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  // Update document title when Ragnarök Threshold Mode activates/deactivates.
  useEffect(() => {
    if (ragnarokActive) {
      document.title = "⚠ RAGNARÖK APPROACHES — Fenrir Ledger";
    } else {
      // Reset to empty so Next.js metadata can re-assert the correct title.
      document.title = "";
    }
    return () => {
      // Cleanup: don't leave the Ragnarök title lingering on unmount.
      document.title = "";
    };
  }, [ragnarokActive]);

  function handleToggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
    // Easter egg #3 — The Roots of a Mountain: first sidebar collapse
    if (next) triggerRoots();
  }

  // The upsell banner is shown on the dashboard (/) only.
  const isDashboard = pathname === "/";

  // Suppress layout until client state is known to avoid flash
  if (!mounted) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="h-14 shrink-0 border-b border-border" />
        <div className="flex flex-1 overflow-hidden">
          <div className="w-56 shrink-0 border-r border-border" />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <TopBar />

      {/* Upsell banner — dashboard only, anonymous users only.
          Sits between TopBar and the sidebar/content split.
          The banner component itself handles the isAnonymous + dismissed checks. */}
      {isDashboard && <UpsellBanner />}

      <div className="flex flex-1 overflow-hidden">
        <SideNav collapsed={collapsed} onToggle={handleToggle} />
        {/* Main content + footer in a scrollable column */}
        <div className="flex flex-col flex-1 overflow-auto">
          <main className="flex-1">{children}</main>
          {/* Footer — sits below all page content, above the viewport baseline */}
          <Footer />
        </div>
      </div>
      <SyncIndicator />
      {/* Easter egg #2 — Konami Code → The Howl (client-only, no SSR) */}
      <KonamiHowl />
      {/* Easter egg #9 — The Forgemaster's Signature (`?` key, one-time) */}
      <ForgeMasterEgg />
      {/* Easter egg #10 — LCARS Mode (Cmd+Shift+L / Ctrl+Shift+L) */}
      <LcarsOverlay />
      {/* Easter egg #3 — The Roots of a Mountain (first sidebar collapse, one-time) */}
      <GleipnirMountainRoots open={rootsOpen} onClose={dismissRoots} />
      {/* Easter egg #11 — Ragnarök Threshold Mode (≥5 urgent cards) */}
      {ragnarokActive && (
        <div
          aria-hidden="true"
          className="ragnarok-overlay"
        />
      )}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "font-body",
          style: {
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--foreground))",
          },
        }}
      />
    </div>
  );
}
