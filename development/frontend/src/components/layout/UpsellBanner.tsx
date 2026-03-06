"use client";

/**
 * UpsellBanner — Cloud Sync Upsell Banner (dashboard only)
 *
 * Shown below the TopBar on the dashboard (/) only, to anonymous users
 * who have not dismissed it.
 *
 * Render condition: isAnonymous AND !dismissed
 *   isAnonymous:  status !== "authenticated"
 *   dismissed:    localStorage("fenrir:upsell_dismissed") === "true"
 *
 * Dismiss behavior:
 *   1. Set localStorage("fenrir:upsell_dismissed", "true") immediately.
 *   2. Start collapse animation: height 0 + opacity 0 over 300ms ease.
 *   3. Remove element from DOM after animation.
 *
 * "Sign in to sync" navigates to /sign-in. Does NOT set dismiss flag —
 * if the user abandons sign-in, the banner is still there on return.
 *
 * Desktop: atmospheric line (Voice 2) + description (Voice 1) + CTA + X dismiss.
 * Mobile (<640px): atmospheric line hidden, description + CTA + X dismiss.
 *
 * See ux/wireframes/upsell-banner.html for the full wireframe spec.
 * See ADR-006 for the anonymous-first auth model.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

/** localStorage key for the permanent dismiss flag */
const DISMISS_KEY = "fenrir:upsell_dismissed";

/**
 * Returns true if the dismiss flag is set in localStorage.
 * Safe to call during SSR (returns true to avoid flash — banner will be
 * evaluated on mount and hidden if already dismissed).
 */
function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

export function UpsellBanner() {
  const { status } = useAuth();
  const router = useRouter();
  const bannerRef = useRef<HTMLDivElement>(null);

  // Start with dismissed=true to avoid flash on SSR hydration.
  // After mount, re-evaluate from localStorage.
  const [dismissed, setDismissed] = useState(true);
  const [animatingOut, setAnimatingOut] = useState(false);

  // After hydration, check the actual dismiss state.
  useEffect(() => {
    setDismissed(isDismissed());
  }, []);

  const isAnonymous = status !== "authenticated" && status !== "loading";

  // Do not render if: signed in, or dismissed, or animating out, or loading
  if (!isAnonymous || dismissed) {
    return null;
  }

  function handleDismiss() {
    // Set flag before animation so it persists even if the user navigates away.
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // localStorage blocked — fail silently; banner will reappear next load
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
      setDismissed(true);
      setAnimatingOut(false);
    }, 310);
  }

  return (
    <div
      ref={bannerRef}
      role="region"
      aria-label="Sync your data"
      className={[
        "border-b border-border bg-background/60",
        // Suppress during animation (inline styles handle the collapse)
        animatingOut ? "overflow-hidden" : "",
      ].join(" ")}
    >
      {/* Desktop layout: horizontal, single row */}
      <div className="hidden sm:flex items-center justify-between px-4 py-2.5 gap-4">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          {/* Voice 2: atmospheric frame */}
          <p className="text-sm text-muted-foreground italic font-body">
            Your chains are stored here alone.
          </p>
          {/* Voice 1: functional value prop */}
          <p className="text-sm text-foreground font-body">
            Sign in to back up your cards and access them from any device.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => router.push("/sign-in")}
            className={[
              "px-3 py-1.5 text-sm font-heading tracking-wide",
              "border border-gold/50 text-gold",
              "hover:bg-gold/10 transition-colors",
              "rounded-sm whitespace-nowrap",
            ].join(" ")}
            style={{ minHeight: 36 }}
          >
            Sign in to sync
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss sync banner"
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
        {/* Atmospheric line omitted on mobile — space is scarce */}
        {/* Voice 1: functional value prop */}
        <p className="text-sm text-foreground font-body">
          Sign in to back up your cards and access them from any device.
        </p>

        <button
          type="button"
          onClick={() => router.push("/sign-in")}
          className={[
            "self-start px-3 py-1.5 text-sm font-heading tracking-wide",
            "border border-gold/50 text-gold",
            "hover:bg-gold/10 transition-colors",
            "rounded-sm",
          ].join(" ")}
          style={{ minHeight: 36 }}
        >
          Sign in to sync
        </button>

        {/* Dismiss — absolute top-right on mobile */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss sync banner"
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
