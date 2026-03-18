"use client";

import Link from "next/link";
import { Settings, ChevronRight } from "lucide-react";

/**
 * TopBar — full-width sticky application header.
 *
 * Left:  Fenrir logo — click to open the About modal.
 * Right: auth-state-aware user cluster.
 *
 * Anonymous state (default for all users on first load):
 *   - ᛟ rune avatar (gold circle, border-border — no gold ring yet)
 *   - No email, no dropdown caret
 *   - Clicking avatar opens the upsell prompt panel (role="dialog")
 *   - Prompt: atmospheric copy + "Sign in to Google" + "Not now"
 *
 * Signed-in state (optional, after user completes PKCE OAuth flow):
 *   - Google photo (or ᛟ rune fallback) + gold ring border
 *   - Email on desktop (≥640px)
 *   - Dropdown caret ▾
 *   - Clicking opens profile dropdown: name + email + atmospheric line + Sign Out
 *   - Sign Out returns user to /ledger (dashboard in anonymous state), NOT to /ledger/sign-in
 *
 * See ADR-006 for the anonymous-first model.
 * See ux/wireframes/topbar.html for the full wireframe spec.
 */

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { ThemeToggle, cycleTheme } from "@/components/layout/ThemeToggle";
import { getEntitlementCache, clearEntitlementCache } from "@/lib/entitlement/cache";
import { buildSignInUrl } from "@/lib/auth/sign-in-url";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** sessionStorage key -- stale auth nudge dismissed for this session only */
const STALE_NUDGE_DISMISSED_KEY = "fenrir:stale-auth-nudge-dismissed";

/**
 * Returns true if a stale entitlement cache exists in localStorage,
 * indicating the user was previously signed in with a subscription.
 */
function hasStaleEntitlementCache(): boolean {
  if (typeof window === "undefined") return false;
  return getEntitlementCache() !== null;
}

/**
 * Returns true if the stale auth nudge was dismissed in this browser tab session.
 */
function isStaleNudgeDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(STALE_NUDGE_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

// ── Avatar component ──────────────────────────────────────────────────────────

interface AvatarProps {
  /** Google CDN picture URL, or undefined for anonymous/fallback */
  picture: string | undefined;
  name: string | undefined;
  size?: number;
  /** Whether the gold ring (authenticated) border is applied */
  goldRing?: boolean;
}

/**
 * Renders the Google profile picture with a ᛟ rune fallback.
 * Uses referrerPolicy="no-referrer" — required for Google CDN avatar URLs.
 *
 * Border:
 *   - Signed-in: border-gold/40 — the wolf is named, the gold ring is earned.
 *   - Anonymous: border-border — neutral, the wolf runs unnamed.
 */
function Avatar({ picture, name, size = 32, goldRing = false }: AvatarProps) {
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
        // Google CDN requires referrerPolicy="no-referrer"; next/image does not support this prop.
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

// ── Compact sign-in nudge (stale auth) ────────────────────────────────────────

interface SignInNudgeProps {
  onDismiss: () => void;
}

/**
 * Compact sign-in nudge shown in the header when the user has a stale
 * entitlement cache (previously signed in, session expired).
 * Replaces the full-width StaleAuthNudge banner.
 *
 * Mobile (< 640px): Just "Sign In" button
 * Desktop: Norse text + "Sign In" button + X dismiss
 */
function CompactSignInNudge({ onDismiss }: SignInNudgeProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleDismiss() {
    clearEntitlementCache();
    try {
      sessionStorage.setItem(STALE_NUDGE_DISMISSED_KEY, "true");
    } catch {
      // sessionStorage blocked -- fail silently
    }
    onDismiss();
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-gold/30 bg-gold/5">
      {/* Norse text — desktop only */}
      <span className="hidden sm:block text-xs text-gold/80 italic font-body whitespace-nowrap">
        The wolf remembers your oath
      </span>

      {/* Sign In button */}
      <button
        type="button"
        onClick={() => router.push(buildSignInUrl(pathname))}
        className={[
          "px-3 py-1 text-xs font-heading tracking-wide",
          "border border-gold/50 text-gold",
          "hover:bg-gold/10 transition-colors",
          "rounded-sm whitespace-nowrap",
        ].join(" ")}
        style={{ minHeight: 32 }}
      >
        Sign in
      </button>

      {/* Dismiss X — desktop only */}
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

// ── Upsell prompt panel (anonymous state) ─────────────────────────────────────

interface UpsellPromptProps {
  /** Ref used for click-outside detection (anchored to the trigger's parent) */
  panelId: string;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Lightweight upsell prompt panel shown when the anonymous avatar is clicked.
 * role="dialog" — this is a prompt, not a navigation menu.
 * Dismissed by: "Not now" click, Escape key, click outside.
 * Does NOT set the dismiss flag for the dashboard banner — separate surfaces.
 */
function UpsellPromptPanel({ panelId, onClose, triggerRef }: UpsellPromptProps) {
  const router = useRouter();
  const pathname = usePathname();
  const signInButtonRef = useRef<HTMLButtonElement>(null);

  // Focus "Sign in to Google" button on open — per WCAG focus management.
  useEffect(() => {
    signInButtonRef.current?.focus();
  }, []);

  // Close on Escape key.
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
        "w-[260px] sm:w-[260px]",
        "border border-border bg-background/95 backdrop-blur-sm",
        "z-50 p-4 flex flex-col gap-3",
        "rounded-sm shadow-lg",
      ].join(" ")}
    >
      {/* Voice 2: atmospheric frame — Norse saga */}
      <p className="text-sm text-muted-foreground italic font-body leading-relaxed">
        The wolf runs unnamed. Your chains are stored here alone.
      </p>

      {/* Voice 1: functional value proposition — plain English */}
      <p className="text-sm text-foreground font-body leading-relaxed">
        Sign in to back up your cards and access them from any device. Your data
        is already here — signing in just keeps it safe.
      </p>

      {/* Theme toggle — rotary icon variant */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-sm text-muted-foreground font-body">Theme</span>
        <ThemeToggle variant="icon" />
      </div>

      {/* Settings link — visible to anonymous users; page handles auth gating */}
      <button
        type="button"
        onClick={() => {
          onClose();
          router.push("/ledger/settings");
        }}
        className="flex items-center gap-2 w-full px-1 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body border-t border-border"
        style={{ minHeight: 44 }}
      >
        <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
        Settings
      </button>

      {/* CTAs */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          ref={signInButtonRef}
          type="button"
          onClick={() => {
            onClose();
            router.push(buildSignInUrl(pathname));
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
          className={[
            "w-full px-4 py-2 text-base text-muted-foreground font-body",
            "hover:text-foreground transition-colors",
          ].join(" ")}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

// ── KarlBadge ─────────────────────────────────────────────────────────────────

/**
 * KARL subscriber badge — rendered in the header next to the user email.
 * Always in the DOM when authenticated; CSS cascade controls visibility:
 *   [data-tier="karl"] .karl-bling-badge { display: inline-flex; }
 *
 * Hidden for trial and thrall tiers (CSS-only, zero JS logic needed).
 * Runic accents (ᚷ Gebo) are decorative — aria-hidden.
 */
function KarlBadge() {
  return (
    <span
      className="karl-bling-badge"
      aria-label="Karl subscriber"
      role="img"
    >
      <span className="karl-badge-rune" aria-hidden="true">ᚷ</span>
      KARL
      <span className="karl-badge-rune" aria-hidden="true">ᚷ</span>
    </span>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────

export function TopBar() {
  const { data: session, status, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const avatarTriggerRef = useRef<HTMLButtonElement>(null);

  // Stale auth nudge state
  const [showStaleNudge, setShowStaleNudge] = useState(false);

  const isAuthenticated = status === "authenticated";
  const user = session?.user;

  // Check if we should show the stale auth nudge
  useEffect(() => {
    if (status === "loading") return;

    const isAnonymous = status === "anonymous";
    const hasCache = hasStaleEntitlementCache();
    const dismissed = isStaleNudgeDismissed();

    setShowStaleNudge(isAnonymous && hasCache && !dismissed);
  }, [status]);

  // Hide nudge when user authenticates
  useEffect(() => {
    if (status === "authenticated") {
      setShowStaleNudge(false);
    }
  }, [status]);

  // Close panel when clicking outside.
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
    <>
      <header className="h-14 shrink-0 border-b border-border bg-background/90 backdrop-blur-sm flex items-center justify-between px-4 z-50">

        {/* Logo — click to visit the marketing home */}
        <Link
          href="/"
          className="flex flex-col leading-tight group text-left"
          aria-label="Fenrir Ledger — home"
        >
          <span className="font-display text-gold tracking-widest uppercase text-base group-hover:text-primary hover:brightness-110 transition-colors">
            Fenrir Ledger
          </span>
          <span className="font-body text-muted-foreground text-sm italic">
            Break free. Harvest every reward.
          </span>
        </Link>

        {/* User cluster — conditionally renders stale nudge, anonymous avatar, or signed-in state */}
        <div className="relative flex items-center" ref={panelRef}>

          {/* ── Stale auth nudge (returning user with expired session) ── */}
          {!isAuthenticated && showStaleNudge && (
            <CompactSignInNudge onDismiss={() => setShowStaleNudge(false)} />
          )}

          {/* ── Anonymous state (no stale session) ── */}
          {!isAuthenticated && !showStaleNudge && (
            <button
              ref={avatarTriggerRef}
              type="button"
              onClick={() => setPanelOpen((prev) => !prev)}
              className="flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
              aria-label="Sign in to sync your data"
              aria-haspopup="true"
              aria-expanded={panelOpen}
              aria-controls="anon-upsell-panel"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <Avatar picture={undefined} name={undefined} size={32} goldRing={false} />
            </button>
          )}

          {/* ── Signed-in state ── */}
          {isAuthenticated && user && (
            <button
              ref={avatarTriggerRef}
              type="button"
              onClick={() => setPanelOpen((prev) => !prev)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-secondary/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 cursor-pointer"
              aria-label={`Open user menu, signed in as ${user.email}`}
              aria-expanded={panelOpen}
              aria-haspopup="true"
              aria-controls="user-menu"
              style={{ minHeight: 44 }}
            >
              {/* Email — desktop only */}
              <span className="text-sm text-muted-foreground font-body hidden sm:block max-w-[200px] truncate">
                {user.email}
              </span>

              {/* KARL badge — CSS-only visibility, shown only for Karl subscribers */}
              <KarlBadge />

              {/* Avatar */}
              <Avatar picture={user.picture} name={user.name} size={32} goldRing={true} />

              {/* Dropdown caret */}
              <span className="text-muted-foreground text-sm hidden sm:block" aria-hidden="true">
                ▾
              </span>
            </button>
          )}

          {/* ── Anonymous upsell prompt panel (only when no stale nudge) ── */}
          {!isAuthenticated && !showStaleNudge && panelOpen && (
            <UpsellPromptPanel
              panelId="anon-upsell-panel"
              onClose={() => setPanelOpen(false)}
              triggerRef={avatarTriggerRef}
            />
          )}

          {/* ── Signed-in profile dropdown ── */}
          {isAuthenticated && user && panelOpen && (
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
              {/* Profile header — non-interactive label, visually distinct from menu items */}
              <div
                className="px-4 py-3 bg-secondary/30 flex items-center gap-3 select-none cursor-default"
                aria-hidden="true"
              >
                <Avatar picture={user.picture} name={user.name} size={40} goldRing={true} />
                <div className="flex flex-col min-w-0">
                  <span className="text-base font-heading text-foreground truncate">
                    {user.name}
                  </span>
                  <span className="text-sm text-muted-foreground font-mono truncate">
                    {user.email}
                  </span>
                  {/* Voice 2: atmospheric line — inside dropdown only, not in the header bar */}
                  <span className="text-sm text-muted-foreground/60 italic font-body truncate">
                    The wolf is named.
                  </span>
                </div>
              </div>
              {/* Separator between profile header and menu items */}
              <div className="h-px bg-border" role="separator" aria-hidden="true" />

              {/* Theme row — click anywhere to toggle dark ↔ light */}
              <button
                type="button"
                role="menuitem"
                onClick={() => setTheme(cycleTheme(theme))}
                className="flex items-center justify-between px-4 py-3 border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer w-full text-left"
                style={{ minHeight: 44 }}
              >
                <span className="text-sm text-muted-foreground font-body">Theme</span>
                <ThemeToggle variant="dropdown-icon" />
              </button>

              {/* Settings link */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPanelOpen(false);
                  router.push("/ledger/settings");
                }}
                className={[
                  "px-4 py-3 text-base hover:bg-secondary/50 text-left transition-colors font-body flex items-center justify-between border-b border-border",
                  pathname === "/ledger/settings" ? "text-gold" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
                style={{ minHeight: 44 }}
              >
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </span>
                <ChevronRight className="h-4 w-4 opacity-50" />
              </button>

              {/* Sign Out — returns user to dashboard in anonymous state */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setPanelOpen(false);
                  signOut();
                }}
                className="px-4 py-3 text-base text-muted-foreground hover:text-foreground hover:bg-secondary/50 text-left transition-colors font-body"
                style={{ minHeight: 44 }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>

      </header>

    </>
  );
}
