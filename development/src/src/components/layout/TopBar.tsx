/**
 * TopBar — full-width sticky application header.
 *
 * Left:  Fenrir Ledger logo + catchphrase
 * Right: Avatar + user name + logout button
 *
 * Mock user is hardcoded; swap with auth context when auth arrives.
 */

import Link from "next/link";
import { LogOut } from "lucide-react";

const MOCK_USER = {
  name: "Declan Shanaghy",
  initials: "DS",
};

export function TopBar() {
  return (
    <header className="h-14 shrink-0 border-b border-border bg-background/90 backdrop-blur-sm flex items-center justify-between px-4 z-50">
      {/* Logo */}
      <Link href="/" className="flex flex-col leading-tight group">
        <span className="font-display text-gold tracking-widest uppercase text-sm group-hover:text-gold-bright transition-colors">
          Fenrir Ledger
        </span>
        <span className="font-body text-muted-foreground text-xs italic">
          Credit Card Tracker
        </span>
      </Link>

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
  );
}
