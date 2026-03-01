/**
 * SiteHeader — shared navigation header for all pages.
 *
 * Accepts an optional backHref for pages that need a back link,
 * and a maxWidth prop to match the page's content container width.
 * Right-side actions are passed as children.
 */

import Link from "next/link";
import type { ReactNode } from "react";

interface SiteHeaderProps {
  /** If provided, renders a "← Back" link to this href */
  backHref?: string;
  /** Container max-width class — matches the page content width */
  maxWidth?: "max-w-2xl" | "max-w-6xl";
  /** Right-side actions (buttons, badges, etc.) */
  children?: ReactNode;
}

export function SiteHeader({
  backHref,
  maxWidth = "max-w-6xl",
  children,
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className={`${maxWidth} mx-auto px-4 py-3 flex items-center justify-between gap-4`}>

        {/* Left: back link (if any) + logo */}
        <div className="flex items-center gap-4 min-w-0">
          {backHref && (
            <Link
              href={backHref}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm shrink-0 font-body"
            >
              ← Back
            </Link>
          )}

          <Link href="/" className="flex flex-col leading-tight group">
            <span className="font-display text-gold tracking-widest uppercase text-sm group-hover:text-gold-bright transition-colors">
              Fenrir Ledger
            </span>
            <span className="font-body text-muted-foreground text-xs italic">
              Break free. Harvest every reward.
            </span>
          </Link>
        </div>

        {/* Right: action slot */}
        {children && (
          <div className="flex items-center gap-3 shrink-0">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
