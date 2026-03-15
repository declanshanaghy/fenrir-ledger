"use client";

/**
 * LedgerShell -- the app shell for /ledger/* routes.
 *
 * Layout:
 *   Desktop (>= 769px): LedgerTopBar (48px) + Full-width Content
 *   Mobile  (<= 768px): LedgerTopBar (48px) + Content + LedgerBottomTabs (56px fixed)
 *
 * Issue #403: Sidebar removed entirely. Content takes full viewport width.
 *
 * See: ux/wireframes/chrome/sidebar-removal-dropdown-settings.html
 * Issue: #403, #372
 */

import { Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LedgerTopBar } from "./LedgerTopBar";
import { LedgerBottomTabs } from "./LedgerBottomTabs";
import { Footer } from "./Footer";
import { SyncIndicator } from "./SyncIndicator";
import { KonamiHowl } from "./KonamiHowl";
import { ForgeMasterEgg } from "./ForgeMasterEgg";
import { HeilungModal } from "@/components/easter-eggs/HeilungModal";
import { TrialDay15Modal } from "@/components/trial/TrialDay15Modal";
import { TrialExpiryModal } from "@/components/trial/TrialExpiryModal";
import { Toaster } from "sonner";

import { useRagnarok } from "@/contexts/RagnarokContext";

interface LedgerShellProps {
  children: ReactNode;
}

export function LedgerShell({ children }: LedgerShellProps) {
  const [mounted, setMounted] = useState(false);

  const { ragnarokActive } = useRagnarok();

  useEffect(() => {
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

  // SSR placeholder to prevent layout flash
  if (!mounted) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Slim top bar placeholder */}
        <div className="h-12 shrink-0 border-b border-border" />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Slim top bar: 48px, sticky top-0 */}
      <LedgerTopBar />

      {/* Full-width content area — no sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
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

      {/* Footer: persistent application footer with easter eggs */}
      <Footer />

      {/* Shared utilities -- same as AppShell */}
      <SyncIndicator />
      <KonamiHowl />
      <ForgeMasterEgg />
      <HeilungModal />

      {/* Day-15 mid-trial nudge modal (Issue #622) */}
      <TrialDay15Modal />

      {/* Day-30 trial expiry modal (Issue #623) */}
      <TrialExpiryModal />

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
