"use client";

/**
 * LedgerShell -- the new app shell for /ledger/* routes.
 *
 * Replaces AppShell with a distinct app zone that separates
 * the ledger app from the marketing site.
 *
 * Layout:
 *   Desktop (>= 769px): LedgerTopBar (48px) + SideNav (220px) + Content
 *   Mobile  (<= 768px): LedgerTopBar (48px) + Content + LedgerBottomTabs (56px fixed)
 *
 * Key differences from AppShell:
 *   - Slim top bar (48px vs 56px)
 *   - Sidebar 220px (was 272px/w-56 collapsible)
 *   - No marketing footer inside /ledger/* routes
 *   - Mobile: bottom tab bar instead of hamburger overlay
 *   - "Back to site" contextual link in top bar
 *
 * See: ux/wireframes/chrome/ledger-shell.html
 * Issue: #372
 */

import { Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LedgerTopBar } from "./LedgerTopBar";
import { LedgerBottomTabs } from "./LedgerBottomTabs";
import { SideNav } from "./SideNav";
import { SyncIndicator } from "./SyncIndicator";
import { KonamiHowl } from "./KonamiHowl";
import { ForgeMasterEgg } from "./ForgeMasterEgg";
import { HeilungModal } from "@/components/easter-eggs/HeilungModal";
import { Toaster } from "sonner";

import {
  GleipnirMountainRoots,
  useGleipnirFragment3,
} from "@/components/cards/GleipnirMountainRoots";
import { useRagnarok } from "@/contexts/RagnarokContext";

const STORAGE_KEY = "fenrir:sidenav-collapsed";

interface LedgerShellProps {
  children: ReactNode;
}

export function LedgerShell({ children }: LedgerShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { open: rootsOpen, trigger: triggerRoots, dismiss: dismissRoots } = useGleipnirFragment3();
  const { ragnarokActive } = useRagnarok();

  // Read persisted sidebar state after mount.
  // On narrow viewports (< 768px) the sidebar is hidden entirely by CSS,
  // so collapsed state only affects desktop.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setCollapsed(true);
    } else if (stored === null && window.innerWidth < 768) {
      setCollapsed(true);
    }
    setMounted(true);
  }, []);

  // Ragnarok title override
  useEffect(() => {
    if (ragnarokActive) {
      document.title = "⚠ RAGNAROK APPROACHES — Fenrir Ledger";
    } else {
      document.title = "";
    }
    return () => {
      document.title = "";
    };
  }, [ragnarokActive]);

  function handleToggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
    if (next) triggerRoots();
  }

  // SSR placeholder to prevent layout flash
  if (!mounted) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Slim top bar placeholder */}
        <div className="h-12 shrink-0 border-b border-border" />
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar placeholder -- hidden on mobile via CSS */}
          <div className="hidden md:block w-[220px] shrink-0 border-r border-border" />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Slim top bar: 48px, sticky top-0 */}
      <LedgerTopBar />

      {/* Sidebar + Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: desktop only (hidden md:flex) */}
        <div className="hidden md:flex">
          <Suspense
            fallback={
              <div
                className={
                  collapsed
                    ? "w-14 shrink-0 border-r border-border"
                    : "w-[220px] shrink-0 border-r border-border"
                }
              />
            }
          >
            <SideNav collapsed={collapsed} onToggle={handleToggle} />
          </Suspense>
        </div>

        {/* Main content -- no footer in ledger shell */}
        <main
          id="main-content"
          className="flex-1 overflow-auto pb-14 md:pb-0"
        >
          {children}
        </main>
      </div>

      {/* Bottom tab bar: mobile only (md:hidden via component CSS) */}
      <Suspense fallback={null}>
        <LedgerBottomTabs />
      </Suspense>

      {/* Shared utilities -- same as AppShell */}
      <SyncIndicator />
      <KonamiHowl />
      <ForgeMasterEgg />
      <HeilungModal />
      <GleipnirMountainRoots open={rootsOpen} onClose={dismissRoots} />

      {/* Ragnarok overlay */}
      {ragnarokActive && (
        <div aria-hidden="true" className="ragnarok-overlay" />
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
