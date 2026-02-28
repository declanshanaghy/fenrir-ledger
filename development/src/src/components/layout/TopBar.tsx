"use client";

/**
 * TopBar — full-width sticky application header.
 *
 * Left:  Fenrir logo — click to open the About modal.
 * Right: Avatar (initials from Google name) + user name + logout button.
 *
 * Sprint 3.1: wired to Auth.js v5 session via useSession().
 * The mock user is replaced with real session data.
 * The logout button calls signOut() to invalidate the JWT cookie.
 */

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { AboutModal } from "@/components/layout/AboutModal";

/**
 * Derives initials from a display name string.
 * "Declan Shanaghy" → "DS"
 * "Alice" → "A"
 * Falls back to "?" if the name is empty or unavailable.
 */
function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? "?").toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export function TopBar() {
  const { data: session } = useSession();
  const [aboutOpen, setAboutOpen] = useState(false);

  const userName = session?.user?.name ?? "";
  const initials = getInitials(userName);

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
          {/* Avatar — initials from Google display name */}
          <div className="h-8 w-8 rounded-full border border-gold/40 bg-secondary flex items-center justify-center shrink-0">
            <span className="text-xs font-mono font-semibold text-gold">
              {initials}
            </span>
          </div>

          {/* Name */}
          {userName && (
            <span className="text-sm text-foreground font-body hidden sm:block">
              {userName}
            </span>
          )}

          {/* Divider */}
          <div className="w-px h-5 bg-border hidden sm:block" />

          {/* Logout — calls Auth.js signOut() */}
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            title="Log out"
            onClick={() => signOut({ callbackUrl: "/api/auth/signin" })}
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
