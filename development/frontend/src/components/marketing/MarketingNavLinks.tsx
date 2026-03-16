"use client";

/**
 * MarketingNavLinks — shared nav link list for marketing site navigation.
 *
 * Used by:
 *   - MarketingNavbar (desktop center links + mobile overlay)
 *   - LedgerTopBar   (centered in ledger header, desktop only)
 *
 * Issue: #1034
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/chronicles", label: "Prose Edda" },
  { href: "/about", label: "About" },
  { href: "/free-trial", label: "Free Trial" },
  { href: "/pricing", label: "Pricing" },
] as const;

/** Check whether a nav link matches the current pathname. */
export function isNavLinkActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

interface MarketingNavLinksProps {
  /** Called after a link is clicked — useful for closing mobile overlays */
  onLinkClick?: () => void;
}

/**
 * Renders the five marketing nav links as inline items.
 * Wrap with a flex container that sets the gap (e.g. `flex items-center gap-8`).
 * Active link gets a border highlight; inactive links use muted foreground.
 */
export function MarketingNavLinks({ onLinkClick }: MarketingNavLinksProps) {
  const pathname = usePathname();

  return (
    <>
      {NAV_LINKS.map(({ href, label }) => {
        const active = isNavLinkActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => onLinkClick?.()}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "font-heading text-sm font-semibold text-foreground border border-border px-2.5 py-1 hover:border-primary/50 transition-colors"
                : "font-heading text-sm text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
