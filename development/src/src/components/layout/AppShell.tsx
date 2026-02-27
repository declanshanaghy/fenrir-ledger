"use client";

/**
 * AppShell — the persistent application frame.
 *
 * Renders the TopBar, collapsible SideNav, and the main content slot.
 * Collapse state is persisted to localStorage so it survives navigation.
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { SideNav } from "./SideNav";
import { SyncIndicator } from "./SyncIndicator";
import { KonamiHowl } from "./KonamiHowl";
import { ForgeMasterEgg } from "./ForgeMasterEgg";

const STORAGE_KEY = "fenrir:sidenav-collapsed";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Read persisted state after mount to avoid SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  function handleToggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

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
      <div className="flex flex-1 overflow-hidden">
        <SideNav collapsed={collapsed} onToggle={handleToggle} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <SyncIndicator />
      {/* Easter egg #2 — Konami Code → The Howl (client-only, no SSR) */}
      <KonamiHowl />
      {/* Easter egg #9 — The Forgemaster's Signature (`?` key, one-time) */}
      <ForgeMasterEgg />
    </div>
  );
}
