"use client";

/**
 * StaleAuthNudge -- Fenrir Ledger
 *
 * A subtle banner that nudges returning users to sign back in when their
 * session has expired but a stale entitlement cache exists in localStorage.
 *
 * Display conditions (ALL must be true):
 *   1. Auth status is "anonymous" (not "loading", not "authenticated")
 *   2. A valid entitlement cache exists in localStorage (user was previously signed in)
 *   3. The user has not dismissed this nudge in the current browser session
 *
 * Dismiss behavior:
 *   1. Clears the stale entitlement cache from localStorage
 *   2. Sets a sessionStorage flag so the nudge does not reappear during this tab session
 *   3. Collapses the banner with a smooth animation
 *
 * The nudge disappears automatically when the user signs in (status becomes
 * "authenticated"), because condition #1 is no longer met.
 *
 * Norse voice: subtle, thematic, not alarming.
 *
 * @see https://github.com/declanshanaghy/fenrir-ledger/issues/145
 */

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getEntitlementCache, clearEntitlementCache } from "@/lib/entitlement/cache";
import { buildSignInUrl } from "@/lib/auth/sign-in-url";

/** sessionStorage key -- nudge dismissed for this tab session only. */
const NUDGE_DISMISSED_KEY = "fenrir:stale-auth-nudge-dismissed";

/**
 * Returns true if the nudge was dismissed in this browser tab session.
 * Uses sessionStorage so the nudge reappears in new tabs (the user may
 * want to sign in from a different tab).
 */
function isNudgeDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(NUDGE_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Returns true if a stale entitlement cache exists in localStorage,
 * indicating the user was previously signed in with a subscription.
 */
function hasStaleEntitlementCache(): boolean {
  if (typeof window === "undefined") return false;
  return getEntitlementCache() !== null;
}

export function StaleAuthNudge(): React.ReactElement | null {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const bannerRef = useRef<HTMLDivElement>(null);

  // Start hidden to avoid SSR flash. Re-evaluate after mount.
  const [visible, setVisible] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);

  // After hydration, evaluate whether the nudge should show.
  useEffect(() => {
    if (status === "loading") return;

    const isAnonymous = status === "anonymous";
    const hasCache = hasStaleEntitlementCache();
    const dismissed = isNudgeDismissed();

    setVisible(isAnonymous && hasCache && !dismissed);
  }, [status]);

  // If auth becomes "authenticated", hide immediately.
  useEffect(() => {
    if (status === "authenticated") {
      setVisible(false);
    }
  }, [status]);

  if (!visible || animatingOut) {
    // During animation, keep the DOM element alive for the collapse effect.
    // After animation completes, animatingOut resets and we return null.
    if (animatingOut) {
      return (
        <div
          ref={bannerRef}
          role="region"
          aria-label="Sign in reminder"
          className="border-b border-gold/20 bg-gold/5 overflow-hidden"
          style={{ height: 0, opacity: 0 }}
        />
      );
    }
    return null;
  }

  function handleDismiss(): void {
    // Clear the stale cache so the nudge condition is no longer met.
    clearEntitlementCache();

    // Set session-scoped dismiss flag.
    try {
      sessionStorage.setItem(NUDGE_DISMISSED_KEY, "true");
    } catch {
      // sessionStorage blocked -- fail silently
    }

    // Collapse animation
    if (bannerRef.current) {
      const el = bannerRef.current;
      const height = el.offsetHeight;
      el.style.height = `${height}px`;
      el.style.overflow = "hidden";
      // Force reflow before starting transition
      void el.offsetHeight;
      el.style.transition = "height 300ms ease, opacity 300ms ease";
      el.style.height = "0px";
      el.style.opacity = "0";
    }

    setAnimatingOut(true);
    setTimeout(() => {
      setVisible(false);
      setAnimatingOut(false);
    }, 310);
  }

  function handleSignIn(): void {
    router.push(buildSignInUrl(pathname));
  }

  return (
    <div
      ref={bannerRef}
      role="region"
      aria-label="Sign in reminder"
      className="border-b border-gold/20 bg-gold/5"
    >
      {/* Desktop layout: horizontal, single row */}
      <div className="hidden sm:flex items-center justify-between px-4 py-2.5 gap-4">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          {/* Voice 2: atmospheric frame */}
          <p className="text-xs text-gold/70 italic font-body">
            The wolf remembers your oath.
          </p>
          {/* Voice 1: functional nudge */}
          <p className="text-xs text-foreground font-body">
            Welcome back -- sign in to restore your subscription.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSignIn}
            className={[
              "px-3 py-1.5 text-xs font-heading tracking-wide",
              "border border-gold/50 text-gold",
              "hover:bg-gold/10 transition-colors",
              "rounded-sm whitespace-nowrap",
            ].join(" ")}
            style={{ minHeight: 36 }}
          >
            Sign in
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss sign-in reminder"
            className={[
              "text-muted-foreground hover:text-foreground transition-colors",
              "flex items-center justify-center text-base",
            ].join(" ")}
            style={{ minWidth: 44, minHeight: 44 }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Mobile layout: stacked, dismiss button absolute top-right */}
      <div className="sm:hidden relative px-4 py-2.5 pr-12 flex flex-col gap-2">
        {/* Voice 1: functional nudge (atmospheric line omitted on mobile) */}
        <p className="text-xs text-foreground font-body">
          Welcome back -- sign in to restore your subscription.
        </p>

        <button
          type="button"
          onClick={handleSignIn}
          className={[
            "self-start px-3 py-1.5 text-xs font-heading tracking-wide",
            "border border-gold/50 text-gold",
            "hover:bg-gold/10 transition-colors",
            "rounded-sm",
          ].join(" ")}
          style={{ minHeight: 36 }}
        >
          Sign in
        </button>

        {/* Dismiss -- absolute top-right on mobile */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss sign-in reminder"
          className={[
            "absolute top-1 right-2",
            "text-muted-foreground hover:text-foreground transition-colors",
            "flex items-center justify-center text-base",
          ].join(" ")}
          style={{ minWidth: 44, minHeight: 44 }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
