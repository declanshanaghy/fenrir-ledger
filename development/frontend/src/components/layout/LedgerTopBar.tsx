"use client";

/**
 * LedgerTopBar -- slim 48px top bar for /ledger/* routes.
 *
 * Replaces the 56px TopBar used by AppShell with a more compact variant
 * that clearly separates the app zone from the marketing site.
 *
 * Desktop (>= 769px):
 *   Left:   ᛟ FENRIR LEDGER logo -> /
 *   Right:  Theme toggle (icon) + User avatar button
 *
 * Mobile (<= 768px):
 *   Left:   ᛟ FL (rune + initials)
 *   Right:  Theme toggle + Avatar
 *
 * Height: 48px (h-12). Sticky top-0 z-[100].
 * Border-bottom: border-border.
 *
 * See: ux/wireframes/chrome/ledger-shell.html
 * Issue: #372
 */

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { LayoutGrid, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle, cycleTheme } from "@/components/layout/ThemeToggle";
import { TrialBadge } from "@/components/layout/TrialBadge";
import { getEntitlementCache, clearEntitlementCache } from "@/lib/entitlement/cache";

// ── Helpers ─────────────────────────────────────────────────────────────

const STALE_NUDGE_DISMISSED_KEY = "fenrir:stale-auth-nudge-dismissed";

function hasStaleEntitlementCache(): boolean {
  if (typeof window === "undefined") return false;
  return getEntitlementCache() !== null;
}

function isStaleNudgeDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(STALE_NUDGE_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

// ── Avatar ──────────────────────────────────────────────────────────────

interface AvatarProps {
  picture: string | undefined;
  name: string | undefined;
  size?: number;
  goldRing?: boolean;
}

function Avatar({ picture, name, size = 28, goldRing = false }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showRune = !picture || imgError;

  return (
    <div
      className={[
        "rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden border",
        goldRing ? "border-gold/40" : "border-border",
      ].join(" ")}
      style={{ width: size, height: size }}
      aria-label={showRune ? "Anonymous user" : undefined}
    >
      {showRune ? (
        <span
          className="text-gold font-mono"
          style={{ fontSize: size * 0.5 }}
          aria-hidden="true"
        >
          ᛟ
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={picture}
          alt={name ? `${name}'s profile photo` : "Profile photo"}
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

// ── Upsell prompt panel (anonymous state) ───────────────────────────────

interface UpsellPromptProps {
  panelId: string;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

function UpsellPromptPanel({ panelId, onClose, triggerRef }: UpsellPromptProps) {
  const router = useRouter();
  const signInButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    signInButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, triggerRef]);

  return (
    <div
      id={panelId}
      role="dialog"
      aria-label="Sign in to sync"
      className={[
        "absolute right-0 top-full mt-1",
        "w-[260px]",
        "border border-border bg-background/95 backdrop-blur-sm",
        "z-50 p-4 flex flex-col gap-3",
        "rounded-sm shadow-lg",
      ].join(" ")}
    >
      <p className="text-sm text-muted-foreground italic font-body leading-relaxed">
        The wolf runs unnamed. Your chains are stored here alone.
      </p>
      <p className="text-sm text-foreground font-body leading-relaxed">
        Sign in to back up your cards and access them from any device.
      </p>
      <div className="flex flex-col gap-2 pt-1">
        <button
          ref={signInButtonRef}
          type="button"
          onClick={() => {
            onClose();
            router.push("/ledger/sign-in");
          }}
          className={[
            "w-full px-4 py-2.5 text-base font-heading tracking-wide",
            "bg-primary text-primary-foreground",
            "hover:bg-primary hover:brightness-110 transition-colors",
            "rounded-sm",
          ].join(" ")}
        >
          Sign in to Google
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            triggerRef.current?.focus();
          }}
          className="w-full px-4 py-2 text-base text-muted-foreground font-body hover:text-foreground transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

// ── Signed-in profile dropdown ──────────────────────────────────────────

interface ProfileDropdownProps {
  onClose: () => void;
  onSignOut: () => void;
}

function ProfileDropdown({ onClose, onSignOut }: ProfileDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const isMyCardsActive = pathname === "/ledger";
  const isSettingsActive = pathname === "/ledger/settings";

  return (
    <div
      id="user-menu"
      role="menu"
      aria-label="User menu"
      className={[
        "absolute right-0 top-full mt-2",
        "w-64 border border-border bg-background/95 backdrop-blur-sm",
        "rounded-sm shadow-lg z-50",
        "flex flex-col",
      ].join(" ")}
    >
      {/* My Cards link */}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          router.push("/ledger");
        }}
        className={[
          "px-4 py-3 text-base hover:bg-secondary/50 text-left transition-colors font-body flex items-center gap-2 border-b border-border relative",
          isMyCardsActive ? "text-gold font-semibold" : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
        style={{ minHeight: 44 }}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />
        My Cards
        {isMyCardsActive && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gold"
            aria-hidden="true"
          />
        )}
      </button>
      {/* Theme row — click anywhere to toggle dark ↔ light */}
      <button
        type="button"
        role="menuitem"
        onClick={() => setTheme(cycleTheme(theme))}
        className="flex items-center gap-2 px-4 py-3 border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer w-full text-left"
        style={{ minHeight: 44 }}
      >
        <ThemeToggle variant="dropdown-icon" />
        <span className="text-sm text-muted-foreground font-body">Theme</span>
      </button>
      {/* Settings link */}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          router.push("/ledger/settings");
        }}
        className={[
          "px-4 py-3 text-base hover:bg-secondary/50 text-left transition-colors font-body flex items-center gap-2 border-b border-border",
          isSettingsActive ? "text-gold" : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
        style={{ minHeight: 44 }}
      >
        <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
        Settings
      </button>
      {/* Sign out */}
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose();
          onSignOut();
        }}
        className="px-4 py-3 text-base text-muted-foreground hover:text-foreground hover:bg-secondary/50 text-left transition-colors font-body flex items-center gap-2"
        style={{ minHeight: 44 }}
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}

// ── Compact sign-in nudge (stale auth) ──────────────────────────────────

interface SignInNudgeProps {
  onDismiss: () => void;
}

function CompactSignInNudge({ onDismiss }: SignInNudgeProps) {
  const router = useRouter();

  function handleDismiss() {
    clearEntitlementCache();
    try {
      sessionStorage.setItem(STALE_NUDGE_DISMISSED_KEY, "true");
    } catch {
      // sessionStorage blocked
    }
    onDismiss();
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-gold/30 bg-gold/5">
      <span className="hidden sm:block text-xs text-gold/80 italic font-body whitespace-nowrap">
        The wolf remembers your oath
      </span>
      <button
        type="button"
        onClick={() => router.push("/ledger/sign-in")}
        className="px-3 py-1 text-xs font-heading tracking-wide border border-gold/50 text-gold hover:bg-gold/10 transition-colors rounded-sm whitespace-nowrap"
        style={{ minHeight: 32 }}
      >
        Sign in
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss sign-in reminder"
        className="hidden sm:flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors text-sm"
        style={{ minWidth: 28, minHeight: 28 }}
      >
        ×
      </button>
    </div>
  );
}

// ── LedgerTopBar ────────────────────────────────────────────────────────

export function LedgerTopBar() {
  const { data: session, status, signOut } = useAuth();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const avatarTriggerRef = useRef<HTMLButtonElement>(null);
  const [showStaleNudge, setShowStaleNudge] = useState(false);

  const isAuthenticated = status === "authenticated";
  const user = session?.user;

  // Stale auth nudge
  useEffect(() => {
    if (status === "loading") return;
    const isAnonymous = status === "anonymous";
    const hasCache = hasStaleEntitlementCache();
    const dismissed = isStaleNudgeDismissed();
    setShowStaleNudge(isAnonymous && hasCache && !dismissed);
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") setShowStaleNudge(false);
  }, [status]);

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    if (panelOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [panelOpen]);

  return (
    <header
      role="banner"
      className="h-12 shrink-0 border-b border-border bg-background sticky top-0 z-[100] flex items-center justify-between px-4"
    >
      {/* Skip nav link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:px-3 focus:py-1 focus:bg-background focus:border focus:border-border focus:text-foreground focus:text-sm"
      >
        Skip to main content
      </a>

      {/* LEFT: Logo link -> / */}
      <div className="flex items-center">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-left min-h-[44px] px-1"
          aria-label="Fenrir Ledger — go to home"
        >
          <span className="text-lg font-bold text-gold" aria-hidden="true">
            ᛟ
          </span>
          {/* Full wordmark: desktop only */}
          <span className="hidden md:inline font-display text-gold tracking-widest uppercase text-sm">
            FENRIR LEDGER
          </span>
          {/* Short wordmark: mobile only */}
          <span className="md:hidden font-display text-gold tracking-widest uppercase text-xs font-bold">
            FL
          </span>
        </Link>
      </div>

      {/* RIGHT: Controls cluster */}
      <div className="relative flex items-center gap-1" ref={panelRef}>

        {/* Trial badge — shows remaining days with color urgency (Issue #621) */}
        <TrialBadge />

        {/* Theme toggle (icon variant) — hidden when signed in, theme lives in dropdown */}
        {!isAuthenticated && <ThemeToggle variant="icon" />}

        {/* Stale auth nudge */}
        {!isAuthenticated && showStaleNudge && (
          <CompactSignInNudge onDismiss={() => setShowStaleNudge(false)} />
        )}

        {/* Anonymous avatar */}
        {!isAuthenticated && !showStaleNudge && (
          <button
            ref={avatarTriggerRef}
            type="button"
            onClick={() => setPanelOpen((prev) => !prev)}
            className="flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 ml-4"
            aria-label="Sign in to sync your data"
            aria-haspopup="true"
            aria-expanded={panelOpen}
            aria-controls="anon-upsell-panel"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Avatar picture={undefined} name={undefined} size={28} goldRing={false} />
          </button>
        )}

        {/* Signed-in identity cluster: name + email + avatar */}
        {isAuthenticated && user && (
          <button
            ref={avatarTriggerRef}
            type="button"
            onClick={() => setPanelOpen((prev) => !prev)}
            className="flex items-center gap-2 px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 cursor-pointer ml-4"
            aria-label={`Open user menu, signed in as ${user.email}`}
            aria-expanded={panelOpen}
            aria-haspopup="true"
            aria-controls="user-menu"
            style={{ minHeight: 44 }}
          >
            {/* Name + email — hidden on mobile, visible sm+ */}
            <div className="hidden sm:flex flex-col items-end min-w-0">
              <span className="text-sm font-heading text-foreground truncate max-w-[160px]">
                {user.name}
              </span>
              <span className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">
                {user.email}
              </span>
            </div>
            <Avatar picture={user.picture} name={user.name} size={28} goldRing />
          </button>
        )}

        {/* Anonymous upsell panel */}
        {!isAuthenticated && !showStaleNudge && panelOpen && (
          <UpsellPromptPanel
            panelId="anon-upsell-panel"
            onClose={() => setPanelOpen(false)}
            triggerRef={avatarTriggerRef}
          />
        )}

        {/* Signed-in dropdown */}
        {isAuthenticated && user && panelOpen && (
          <ProfileDropdown
            onClose={() => setPanelOpen(false)}
            onSignOut={signOut}
          />
        )}
      </div>
    </header>
  );
}
