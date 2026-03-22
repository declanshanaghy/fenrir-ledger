"use client";

/**
 * SignInNudge — Sign-in prompt for anonymous users with ≥1 card.
 *
 * Renders the full-width sign-in banner (the previous UpsellBanner from
 * components/layout/UpsellBanner.tsx) with atmospheric copy + CTA + dismiss.
 *
 * Hidden entirely for authenticated users or anonymous users with zero cards
 * (the zero-cards case is now handled by AnonEmptyState in Dashboard.tsx).
 *
 * See ADR-006 for the anonymous-first auth model.
 * Issue #156: Logged-out empty state simplification.
 * Issue #1748: Subtle link mode removed — replaced by AnonEmptyState primary CTA.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { buildSignInUrl } from "@/lib/auth/sign-in-url";

/** localStorage key for the permanent dismiss flag */
const DISMISS_KEY = "fenrir:upsell_dismissed";

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

interface SignInNudgeProps {
  /** True when the user has ≥1 card; controls full banner vs. subtle link mode. */
  hasCards: boolean;
}

export function SignInNudge({ hasCards }: SignInNudgeProps) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const bannerRef = useRef<HTMLDivElement>(null);

  // Start dismissed=true to avoid SSR flash; resolve on mount.
  const [dismissed, setDismissed] = useState(true);
  const [animatingOut, setAnimatingOut] = useState(false);

  useEffect(() => {
    setDismissed(isDismissed());
  }, []);

  const isAnonymous = status !== "authenticated" && status !== "loading";

  // Not shown to authenticated users or anonymous users with zero cards.
  // Zero-cards anon state is now handled by AnonEmptyState (issue #1748).
  if (!isAnonymous || !hasCards) return null;

  // ── Full banner mode (has cards) ───────────────────────────────────────────
  if (dismissed) return null;

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // localStorage blocked — fail silently
    }

    if (bannerRef.current) {
      const el = bannerRef.current;
      const height = el.offsetHeight;
      el.style.height = `${height}px`;
      el.style.overflow = "hidden";
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
        "border-b border-border bg-background/60 mb-4",
        animatingOut ? "overflow-hidden" : "",
      ].join(" ")}
    >
      {/* Desktop layout */}
      <div className="hidden sm:flex items-center justify-between px-4 py-2.5 gap-4">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <p className="text-sm text-muted-foreground italic font-body">
            Your chains are stored here alone.
          </p>
          <p className="text-sm text-foreground font-body">
            Sign in to back up your cards, sync across devices, and start your free 30-day trial.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => router.push(buildSignInUrl(pathname))}
            className={[
              "px-3 py-1.5 text-sm font-heading tracking-wide",
              "border border-gold/50 text-gold",
              "hover:bg-gold/10 hover:brightness-110 active:scale-[0.97] active:brightness-90",
              "transition-[transform,filter,background-color,color] duration-150 ease-out",
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
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center text-base"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="sm:hidden relative px-4 py-2.5 pr-12 flex flex-col gap-2">
        <p className="text-sm text-foreground font-body">
          Sign in to back up your cards, sync across devices, and start your free 30-day trial.
        </p>

        <button
          type="button"
          onClick={() => router.push(buildSignInUrl(pathname))}
          className={[
            "self-start px-3 py-1.5 text-sm font-heading tracking-wide",
            "border border-gold/50 text-gold",
            "hover:bg-gold/10 hover:brightness-110 active:scale-[0.97] active:brightness-90",
            "transition-[transform,filter,background-color,color] duration-150 ease-out",
            "rounded-sm",
          ].join(" ")}
          style={{ minHeight: 36 }}
        >
          Sign in to sync
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss sync banner"
          className="absolute top-1 right-2 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center text-base"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
