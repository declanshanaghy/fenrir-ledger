/**
 * MarketingFooter — shared footer for all marketing pages.
 *
 * Structure:
 *   - Logo + tagline (centered)
 *   - 3-column link grid: Product | Resources | Legal
 *   - CTA: "Open the Ledger"
 *   - Copyright line (Norse styling)
 *
 * Wireframe: ux/wireframes/marketing-site/layout-shell.html
 * Also references: ux/wireframes/marketing/static-site-footer.html
 */

import Link from "next/link";

const FOOTER_COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { href: "/chronicles", label: "Session Chronicles" },
      { href: "/changelog", label: "Changelog" },
      { href: "/about", label: "About" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
] as const;

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card pt-18 pb-12">
      <div className="max-w-[1100px] mx-auto px-6" style={{ paddingTop: "72px" }}>

        {/* Logo */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-block font-display text-xl font-bold tracking-widest uppercase text-foreground hover:text-primary transition-colors"
            aria-label="Fenrir Ledger — home"
          >
            ᛟ FENRIR LEDGER
          </Link>
          <p className="mt-2 font-body text-sm text-muted-foreground italic">
            Every reward has a deadline. Fenrir doesn&apos;t forget.
          </p>
        </div>

        {/* 3-column link grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 mb-12 text-center sm:text-left">
          {FOOTER_COLUMNS.map(({ heading, links }) => (
            <div key={heading}>
              <h4 className="font-heading text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                {heading}
              </h4>
              <ul className="flex flex-col gap-3">
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mb-12">
          <Link
            href="/ledger"
            className={[
              "inline-flex items-center justify-center px-8 py-3",
              "font-heading text-sm tracking-wide",
              "border border-border text-foreground",
              "hover:border-primary/50 hover:text-primary transition-colors",
              "rounded-sm",
            ].join(" ")}
          >
            Open the Ledger
          </Link>
        </div>

        {/* Bottom copyright */}
        <div className="border-t border-border pt-8 text-center">
          <p className="font-body text-xs text-muted-foreground">
            © {year} Fenrir Ledger · Forged by FiremanDecko · Guarded by Freya · Tested by Loki
          </p>
        </div>
      </div>
    </footer>
  );
}
