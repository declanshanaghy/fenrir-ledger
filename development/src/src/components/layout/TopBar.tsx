"use client";

/**
 * TopBar — full-width sticky application header.
 *
 * Left:  Fenrir logo — click to open the About modal.
 * Right: Avatar + user name + logout button.
 *
 * Mock user is hardcoded; swap with auth context when auth arrives.
 */

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { AboutModal } from "@/components/layout/AboutModal";

const MOCK_USER = {
  name: "Declan Shanaghy",
  initials: "DS",
};

export function TopBar() {
  const [aboutOpen, setAboutOpen] = useState(false);

  // Easter Egg #9 — The Forgemaster's Signature.
  // `?` (Shift+/) opens the About modal from anywhere on the page.
  // Guard: skip when focus is inside a text input so typing is never stolen.
  // No-op when the modal is already open (do not toggle it closed).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "?") return;

      // Skip if a form field has focus — same pattern as KonamiHowl.tsx.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Only open; never close via this shortcut.
      setAboutOpen((current) => {
        if (current) return current; // already open — do nothing
        e.preventDefault();
        return true;
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header className="h-14 shrink-0 border-b border-border bg-background/90 backdrop-blur-sm flex items-center justify-between px-4 z-50">

        {/* Logo — click to open About modal */}
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="flex flex-col leading-tight group text-left"
          aria-label="About Fenrir Ledger"
        >
          <span className="font-display text-gold tracking-widest uppercase text-sm group-hover:text-gold-bright transition-colors">
            Fenrir Ledger
          </span>
          <span className="font-body text-muted-foreground text-xs italic">
            Credit Card Tracker
          </span>
        </button>

        {/* User area */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="h-8 w-8 rounded-full border border-gold/40 bg-secondary flex items-center justify-center shrink-0">
            <span className="text-xs font-mono font-semibold text-gold">
              {MOCK_USER.initials}
            </span>
          </div>

          {/* Name */}
          <span className="text-sm text-foreground font-body hidden sm:block">
            {MOCK_USER.name}
          </span>

          {/* Divider */}
          <div className="w-px h-5 bg-border hidden sm:block" />

          {/* Logout — placeholder */}
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            title="Log out"
            onClick={() => {
              // Placeholder — wire to auth when ready
            }}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:block">Log out</span>
          </button>
        </div>

      </header>

      {/* About modal — rendered outside the header to avoid stacking context issues */}
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}
