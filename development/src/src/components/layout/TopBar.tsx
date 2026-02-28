"use client";

/**
 * TopBar — full-width sticky application header.
 *
 * Left:  Fenrir logo — click to open the About modal.
 * Right: Google avatar (or ᛟ rune fallback) + email + dropdown.
 *
 * Dropdown contents: full name + email + "Sign out" button.
 * Mobile: avatar-only in bar; name + email visible inside dropdown.
 * Desktop: avatar + truncated email in bar; full name + email in dropdown.
 *
 * OIDC profile from FenrirSession.user:
 *   picture → <img referrerPolicy="no-referrer"> (required for Google CDN)
 *   email   → displayed next to avatar (desktop), inside dropdown (mobile)
 *   name    → inside dropdown only
 *
 * Fallback: ᛟ rune in a gold-ringed circle if picture is absent or errors.
 *
 * Sign out clears localStorage session and redirects to /sign-in.
 */

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AboutModal } from "@/components/layout/AboutModal";

// ── Avatar component ──────────────────────────────────────────────────────────

interface AvatarProps {
  picture: string | undefined;
  name: string | undefined;
  size?: number;
}

/**
 * Renders the Google profile picture with a ᛟ rune fallback.
 * Uses referrerPolicy="no-referrer" — required for Google CDN avatar URLs.
 */
function Avatar({ picture, size = 32 }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showRune = !picture || imgError;

  return (
    <div
      className="rounded-full border border-gold/40 bg-secondary flex items-center justify-center shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {showRune ? (
        <span className="text-gold font-mono" style={{ fontSize: size * 0.5 }}>
          ᛟ
        </span>
      ) : (
        // Google CDN requires referrerPolicy="no-referrer"; next/image does not support this prop.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={picture}
          alt="Profile"
          referrerPolicy="no-referrer"
          width={size}
          height={size}
          className="rounded-full object-cover w-full h-full"
          onError={() => setImgError(true)}
        />
      )}
    </div>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────

export function TopBar() {
  const { data: session, signOut } = useAuth();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const user = session?.user;

  // Close dropdown when clicking outside.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  // Close dropdown on Escape.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    if (dropdownOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dropdownOpen]);

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
        {user && (
          <div className="relative flex items-center" ref={dropdownRef}>
            {/* Email — desktop only, truncated */}
            <span className="text-xs text-muted-foreground font-body hidden md:block mr-3 max-w-[200px] truncate">
              {user.email}
            </span>

            {/* Avatar button — opens dropdown */}
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
              aria-label={`${user.name} — open account menu`}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
            >
              <Avatar picture={user.picture} name={user.name} size={32} />
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div
                role="menu"
                aria-label="Account menu"
                className={[
                  "absolute right-0 top-full mt-2",
                  "w-64 border border-border bg-background/95 backdrop-blur-sm",
                  "rounded-sm shadow-lg z-50",
                  "flex flex-col",
                ].join(" ")}
              >
                {/* Profile header */}
                <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                  <Avatar picture={user.picture} name={user.name} size={40} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-heading text-foreground truncate">
                      {user.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono truncate">
                      {user.email}
                    </span>
                  </div>
                </div>

                {/* Sign out */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDropdownOpen(false);
                    signOut();
                  }}
                  className="px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 text-left transition-colors font-body"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}

      </header>

      {/* About modal — rendered outside the header to avoid stacking context issues */}
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}
