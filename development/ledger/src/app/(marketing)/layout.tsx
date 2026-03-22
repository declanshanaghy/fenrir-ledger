/**
 * Marketing Layout Shell — Fenrir Ledger
 *
 * Shared layout for all public marketing pages:
 *   /home, /features, /pricing, /about, /blog, /privacy, /terms, /faq
 *
 * Provides:
 *   - Sticky navbar: logo, nav links, theme toggle, Launch App CTA, mobile hamburger
 *   - Footer: logo, tagline, nav columns, copyright (Norse styling)
 *   - Light/dark theme via next-themes (localStorage persistence)
 *
 * Wireframe spec: ux/wireframes/marketing-site/layout-shell.html
 * Theme spec:     ux/wireframes/marketing-site/theme-variants.html
 */

import type { ReactNode } from "react";
import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

interface MarketingLayoutProps {
  children: ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <MarketingNavbar />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
