"use client";

/**
 * MarketingNavbar — shared navbar for all marketing pages.
 *
 * Desktop:
 *   Left:   logo (ᚠ FENRIR LEDGER)
 *   Center: nav links (Features, Pricing, About, Blog)
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
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/chronicles", label: "Prose Edda" },
] as const;

const THEMES = [
  { value: "light", Icon: Sun, label: "Light" },
  { value: "dark", Icon: Moon, label: "Dark" },
  { value: "system", Icon: Monitor, label: "System" },
] as const;

// ── Compact theme toggle for navbar (cycling icon button) ─────────────────────

function NavThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Placeholder to avoid layout shift during SSR
    return (
      <div
        className="rounded-sm border border-border bg-secondary/30"
        style={{ minWidth: 40, minHeight: 40 }}
        aria-hidden="true"
      />
    );
  }

  const current = THEMES.find((t) => t.value === theme) ?? THEMES[2];
  const nextIndex = (THEMES.indexOf(current) + 1) % THEMES.length;
  const next = THEMES[nextIndex] ?? THEMES[0];

  return (
    <button
      type="button"
      onClick={() => setTheme(next.value)}
      className={[
        "flex items-center justify-center rounded-sm border border-border",
        "text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors",
      ].join(" ")}
      style={{ minWidth: 40, minHeight: 40 }}
      aria-label={`Theme: ${current.label}. Switch to ${next.label}.`}
      title={`Theme: ${current.label}`}
    >
      <current.Icon className="h-4 w-4" />
    </button>
  );
}

// ── MarketingNavbar ────────────────────────────────────────────────────────────

export function MarketingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
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
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  const current = mounted
    ? (THEMES.find((t) => t.value === theme) ?? THEMES[2])
    : THEMES[2];
  const nextIndex = (THEMES.indexOf(current) + 1) % THEMES.length;
  const next = THEMES[nextIndex] ?? THEMES[0];

  return (
    <>
      {/* ── Sticky desktop/tablet nav ──────────────────────────────────────── */}
      <nav
        className={[
          "sticky top-0 z-50 border-b border-border",
          "bg-background/90 backdrop-blur-sm",
        ].join(" ")}
        role="navigation"
        aria-label="Marketing site navigation"
      >
        <div className="max-w-[1100px] mx-auto px-6 flex items-center justify-between h-16">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 group"
            aria-label="Fenrir Ledger — home"
          >
            <span className="text-2xl text-primary" aria-hidden="true">ᚠ</span>
            <span className="font-display text-base font-bold tracking-widest uppercase text-foreground group-hover:text-primary transition-colors">
              Fenrir Ledger
            </span>
          </Link>

          {/* Desktop center nav links */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop right: theme toggle + CTA */}
          <div className="hidden md:flex items-center gap-4">
            <NavThemeToggle />
            <Link
              href="/ledger"
              className={[
                "inline-flex items-center justify-center px-5 py-2",
                "font-heading text-sm tracking-wide",
                "bg-primary text-primary-foreground",
                "hover:bg-primary hover:brightness-110 transition-colors",
                "rounded-sm",
              ].join(" ")}
            >
              Open the Ledger →
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className={[
              "md:hidden flex items-center justify-center",
              "border border-border rounded-sm",
              "text-foreground hover:border-primary/50 transition-colors",
            ].join(" ")}
            style={{ minWidth: 40, minHeight: 40 }}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-overlay"
          >
            <span className="text-base leading-none" aria-hidden="true">☰</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile full-screen overlay ─────────────────────────────────────── */}
      {mobileOpen && (
        <div
          id="mobile-nav-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className={[
            "fixed inset-0 z-[100]",
            "bg-background flex flex-col",
            "p-6",
          ].join(" ")}
        >
          {/* Overlay header */}
          <div className="flex items-center justify-between mb-12">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2"
            >
              <span className="text-2xl text-primary" aria-hidden="true">ᚠ</span>
              <span className="font-display text-base font-bold tracking-widest uppercase">
                Fenrir Ledger
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className={[
                "flex items-center justify-center",
                "border border-border rounded-sm",
                "text-foreground hover:border-primary/50 transition-colors",
              ].join(" ")}
              style={{ minWidth: 40, minHeight: 40 }}
              aria-label="Close navigation menu"
            >
              <span className="text-base leading-none" aria-hidden="true">✕</span>
            </button>
          </div>

          {/* Mobile nav links */}
          <nav aria-label="Mobile navigation">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={[
                  "block py-3 border-b border-border",
                  "font-body text-lg text-foreground",
                  "hover:text-primary transition-colors",
                ].join(" ")}
              >
                {label}
              </Link>
            ))}
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
              {mounted && (
                <button
                  type="button"
                  onClick={() => setTheme(next.value)}
                  className={[
                    "flex items-center justify-center rounded-sm border border-border",
                    "text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors",
                  ].join(" ")}
                  style={{ minWidth: 40, minHeight: 40 }}
                  aria-label={`Theme: ${current.label}. Switch to ${next.label}.`}
                >
                  <current.Icon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
