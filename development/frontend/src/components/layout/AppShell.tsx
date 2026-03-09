"use client";

/**
 * AppShell — the persistent application frame.
 *
 * Renders the TopBar and the main content slot.
 * Issue #403: Sidebar removed entirely. Content takes full viewport width.
 *
 * Layout grid:
 *   Row 1: TopBar (full width)
 *   Row 2: main content + Footer
 */

import { useEffect, useState } from "react";

import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { SyncIndicator } from "./SyncIndicator";
import { KonamiHowl } from "./KonamiHowl";
import { ForgeMasterEgg } from "./ForgeMasterEgg";
import { HeilungModal } from "@/components/easter-eggs/HeilungModal";
import { Toaster } from "sonner";
import { Footer } from "./Footer";

import {
  GleipnirMountainRoots,
  useGleipnirFragment3,
} from "@/components/cards/GleipnirMountainRoots";
import { useRagnarok } from "@/contexts/RagnarokContext";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mounted, setMounted] = useState(false);

  const { open: rootsOpen, dismiss: dismissRoots } = useGleipnirFragment3();
  const { ragnarokActive } = useRagnarok();

  // Read persisted state after mount to avoid SSR mismatch.
  useEffect(() => {
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

  // Suppress layout until client state is known to avoid flash
  if (!mounted) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="h-14 shrink-0 border-b border-border" />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
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
      {/* Easter egg #10 — Heilung Krigsgaldr (Ctrl+Shift+L) */}
      <HeilungModal />
      {/* Easter egg #3 — The Roots of a Mountain */}
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
