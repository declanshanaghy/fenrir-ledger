"use client";

/**
 * MarketingNavbar — shared navbar for all marketing pages.
 *
 * Desktop:
 *   Left:   logo (ᚠ FENRIR LEDGER)
 *   Center: nav links (Features, Prose Edda, About, Free Trial, Pricing)
 *   Right:  theme toggle + "Open the Ledger →" CTA
 *
 * Mobile (≤768px):
 *   Left:  logo
 *   Right: hamburger button → full-screen overlay menu
 *   Overlay: nav links + CTA + theme toggle
 *
 * Sticky with backdrop-blur on scroll.
 *
 * Wireframe: ux/wireframes/marketing-site/layout-shell.html
 * Theme spec: ux/wireframes/marketing-site/theme-variants.html
 *
 * Issue #1113: fixed hamburger touch target (44px), z-index (z-[200] clears
 * sticky nav stacking context from backdrop-filter), and backdrop-tap-to-close.
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import {
  NAV_LINKS,
  isNavLinkActive,
  MarketingNavLinks,
} from "@/components/marketing/MarketingNavLinks";

// ── MarketingNavbar ────────────────────────────────────────────────────────────

// Re-export for backwards compatibility with existing tests
export { isNavLinkActive } from "@/components/marketing/MarketingNavLinks";

export function MarketingNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      // Focus the close button for keyboard/screen-reader users
      closeButtonRef.current?.focus();
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Close overlay on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
        hamburgerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  return (
    <>
      {/* ── Sticky desktop/tablet nav ──────────────────────────────────────── */}
      <nav
        className={[
          "sticky top-0 z-[100] border-b border-border",
          "bg-background/90 backdrop-blur-sm",
        ].join(" ")}
        role="navigation"
        aria-label="Marketing site navigation"
      >
        {/* Skip to main content — sr-only until focused */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:px-3 focus:py-1 focus:bg-background focus:border focus:border-border focus:text-foreground focus:text-sm"
        >
          Skip to main content
        </a>
        <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between h-12">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 group"
            aria-label="Fenrir Ledger — home"
          >
            <span className="text-lg font-bold text-gold" aria-hidden="true">ᛟ</span>
            <span className="font-display text-sm font-bold tracking-widest uppercase text-gold hover:brightness-110">
              FENRIR LEDGER
            </span>
          </Link>

          {/* Desktop center nav links */}
          <div className="hidden md:flex items-center gap-6" aria-label="Marketing site navigation">
            <MarketingNavLinks />
          </div>

          {/* Desktop right: theme toggle + CTA */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle variant="inline" />
            <Link
              href="/ledger"
              className={[
                "inline-flex items-center justify-center px-5 py-1.5",
                "font-heading text-sm tracking-wide",
                "bg-primary text-primary-foreground",
                "hover:bg-primary hover:brightness-110 transition-colors",
                "rounded-sm",
              ].join(" ")}
            >
              Open the Ledger →
            </Link>
          </div>

          {/* Mobile hamburger — 44×44px touch target (WCAG 2.5.5) */}
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            className={[
              "md:hidden flex items-center justify-center",
              "border border-border rounded-sm",
              "text-foreground hover:border-primary/50 transition-colors",
            ].join(" ")}
            style={{ minWidth: 44, minHeight: 44 }}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-overlay"
          >
            <span className="text-base leading-none" aria-hidden="true">☰</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile full-screen overlay ─────────────────────────────────────── */}
      {/* z-[200] ensures overlay clears the sticky nav's backdrop-filter stacking context */}
      {mobileOpen && (
        <div
          id="mobile-nav-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className={[
            "fixed inset-0 z-[200]",
            "bg-background flex flex-col",
            "p-6",
          ].join(" ")}
          onClick={(e) => {
            // Close on backdrop tap (tapping the empty overlay area, not its children)
            if (e.target === e.currentTarget) setMobileOpen(false);
          }}
        >
          {/* Overlay header */}
          <div className="flex items-center justify-between mb-12">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2"
            >
              <span className="text-lg font-bold text-gold" aria-hidden="true">ᛟ</span>
              <span className="font-display text-sm font-bold tracking-widest uppercase text-gold">
                FENRIR LEDGER
              </span>
            </Link>
            {/* Close button — 44×44px touch target, auto-focused on overlay open */}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setMobileOpen(false)}
              className={[
                "flex items-center justify-center",
                "border border-border rounded-sm",
                "text-foreground hover:border-primary/50 transition-colors",
              ].join(" ")}
              style={{ minWidth: 44, minHeight: 44 }}
              aria-label="Close navigation menu"
            >
              <span className="text-base leading-none" aria-hidden="true">✕</span>
            </button>
          </div>

          {/* Mobile nav links — uses shared MarketingNavLinks with close callback */}
          <nav aria-label="Mobile navigation">
            {NAV_LINKS.map(({ href, label }) => {
              const active = isNavLinkActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "block py-3 border-b border-border",
                    "font-heading text-lg text-foreground",
                    active ? "font-semibold" : "",
                    "hover:text-primary transition-colors",
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile CTA + theme toggle */}
          <div className="mt-12 flex flex-col gap-4">
            <Link
              href="/ledger"
              onClick={() => setMobileOpen(false)}
              className={[
                "flex items-center justify-center px-5 py-3",
                "font-heading text-base tracking-wide text-center",
                "bg-primary text-primary-foreground",
                "hover:bg-primary hover:brightness-110 transition-colors",
                "rounded-sm",
              ].join(" ")}
            >
              Open the Ledger →
            </Link>
            <div className="flex items-center justify-center gap-3">
              <span className="text-sm text-muted-foreground font-body">Theme:</span>
              <ThemeToggle variant="inline" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
