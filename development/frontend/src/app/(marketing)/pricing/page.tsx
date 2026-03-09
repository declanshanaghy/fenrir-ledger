/**
 * Pricing Page — /pricing
 *
 * Thrall (Free) vs Karl ($3.99/month) tier comparison.
 * Includes tier cards, detailed comparison table, FAQ accordion, and CTAs.
 *
 * Feature gates sourced from PREMIUM_FEATURES registry in types.ts:
 *   cloud-sync, multi-household, data-export
 *   (smart-import listed descriptively; not yet in registry as a slug)
 *
 * Do NOT list advanced-analytics, extended-history, or cosmetic-perks —
 * these are not exposed in the product per the issue spec.
 *
 * Wireframe: ux/wireframes/marketing-site/pricing.html
 * export const dynamic = 'force-static' — no server data fetching.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PricingFaqAccordion } from "./PricingFaqAccordion";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Pricing — Fenrir Ledger",
  description:
    "Two tiers. One price. No dark patterns. Thrall is free forever. Karl unlocks the full arsenal for $3.99/month.",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function CheckIcon({ included }: { included: boolean }) {
  if (included) {
    return (
      <span
        className="shrink-0 font-mono text-sm text-primary"
        aria-label="Included"
      >
        ✓
      </span>
    );
  }
  return (
    <span
      className="shrink-0 font-mono text-sm text-muted-foreground/30"
      aria-label="Not included"
    >
      —
    </span>
  );
}

// ── Page sections ─────────────────────────────────────────────────────────────

function PageHero() {
  return (
    <section aria-label="Pricing hero" className="border-b border-border bg-card">
      <div className="max-w-[1100px] mx-auto px-6 py-16 sm:py-24 text-center">
        <p className="font-mono text-xs tracking-[0.3em] text-primary uppercase mb-4">
          ᛟ · ᚦ · ᚲ
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-wide text-foreground mb-5 leading-none">
          Choose Your Standing
        </h1>
        <p className="font-body text-lg sm:text-xl italic text-muted-foreground max-w-md mx-auto mb-3 leading-relaxed">
          Two tiers. One price. No dark patterns.
        </p>
        <p className="font-body text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Thrall gets you started — free forever, no credit card required.
          Karl unlocks the full arsenal for the serious churner.
        </p>
      </div>
    </section>
  );
}

function TierCardsSection() {
  return (
    <section aria-label="Tier comparison cards" className="border-b border-border">
      <div className="max-w-[1100px] mx-auto px-6 py-14 sm:py-20">

        {/* Tier cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-[900px] mx-auto">

          {/* THRALL — Free */}
          <div className="border border-border bg-card p-9">
            <div className="text-3xl text-primary mb-4" aria-hidden="true">ᚦ</div>
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-foreground mb-1">
              Thrall
            </h2>
            <p className="font-body text-sm italic text-muted-foreground mb-5">
              The free fighter. No chains, no cost.
            </p>
            <p className="font-display text-5xl font-black text-foreground leading-none mb-1">
              $0
            </p>
            <p className="font-body text-xs tracking-[0.05em] text-muted-foreground mb-7">
              Free forever — no credit card required
            </p>

            <Link
              href="/ledger"
              className={[
                "block text-center px-6 py-3.5 mb-7",
                "font-heading text-xs font-bold tracking-widest uppercase",
                "border-2 border-border text-foreground",
                "hover:bg-muted transition-colors",
                "rounded-sm",
              ].join(" ")}
              data-app-link
            >
              Start Free →
            </Link>

            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3 pt-5 border-t border-border">
              What&apos;s included
            </p>
            <ul className="flex flex-col gap-3" aria-label="Thrall tier features">
              {[
                "Annual fee tracking with 60-day warnings",
                "Sign-up bonus & minimum spend tracking",
                "Velocity management (Chase 5/24, Citi 1/8, etc.)",
                "The Howl — urgent cards dashboard",
                "Card archive (Valhalla)",
                "Single household",
                "Google sign-in",
              ].map((feat) => (
                <li key={feat} className="flex items-start gap-3">
                  <CheckIcon included />
                  <span className="font-body text-sm text-foreground">{feat}</span>
                </li>
              ))}
              {/* Karl features shown as excluded */}
              {[
                "Cloud Sync (multi-device)",
                "Multi-Household management",
                "Smart Import (AI-Powered)",
                "Data Export (CSV / JSON)",
              ].map((feat) => (
                <li key={feat} className="flex items-start gap-3">
                  <span
                    className="shrink-0 font-mono text-sm text-muted-foreground/30"
                    aria-label="Not included"
                  >
                    ✗
                  </span>
                  <span className="font-body text-sm text-muted-foreground/40 line-through decoration-solid">
                    {feat}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* KARL — Paid, featured */}
          <div className="relative border-2 border-foreground bg-card p-9">
            {/* Most popular badge */}
            <div
              className={[
                "absolute -top-3 left-1/2 -translate-x-1/2",
                "bg-foreground text-background",
                "font-mono text-[10px] tracking-[0.15em] uppercase",
                "px-4 py-1 whitespace-nowrap",
              ].join(" ")}
              aria-label="Most popular tier"
            >
              Most Popular
            </div>

            <div className="text-3xl text-primary mb-4" aria-hidden="true">ᚲ</div>
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-foreground mb-1">
              Karl
            </h2>
            <p className="font-body text-sm italic text-muted-foreground mb-5">
              The free farmer. Owns the land he works.
            </p>
            <p className="font-display text-5xl font-black text-foreground leading-none mb-1">
              $3.99
            </p>
            <p className="font-body text-xs tracking-[0.05em] text-muted-foreground mb-7">
              per month · cancel anytime
            </p>

            <Link
              href="/ledger"
              className={[
                "block text-center px-6 py-3.5 mb-7",
                "font-heading text-xs font-bold tracking-widest uppercase",
                "bg-foreground text-background",
                "hover:opacity-90 transition-opacity",
                "rounded-sm",
              ].join(" ")}
              data-app-link
            >
              Upgrade to Karl →
            </Link>

            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3 pt-5 border-t border-border">
              Everything in Thrall, plus
            </p>
            <ul className="flex flex-col gap-3" aria-label="Karl tier premium features">
              {[
                { name: "Cloud Sync", desc: "real-time sync across all devices" },
                { name: "Multi-Household", desc: "manage multiple household ledgers" },
                { name: "Smart Import", desc: "AI extracts card data from spreadsheets" },
                { name: "Data Export", desc: "CSV and JSON export, anytime" },
                { name: "All current and future Karl-tier features", desc: null },
                { name: "Support the project — keeps Fenrir independent", desc: null },
              ].map(({ name, desc }) => (
                <li key={name} className="flex items-start gap-3">
                  <CheckIcon included />
                  <span className="font-body text-sm text-foreground">
                    {desc ? (
                      <>
                        <strong>{name}</strong>
                        {" "}— {desc}
                      </>
                    ) : (
                      name
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-center mt-10 font-body text-sm italic text-muted-foreground">
          Both tiers use Google Sign-In. No separate account creation.
          Karl subscriptions are managed via Stripe — cancel anytime from settings.
        </p>
      </div>
    </section>
  );
}

function ComparisonTableSection() {
  return (
    <section aria-label="Full feature comparison" className="border-b border-border">
      <div className="max-w-[1100px] mx-auto px-6 py-14 sm:py-20">

        <div className="text-center mb-10">
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary uppercase mb-3">ᛊ</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-foreground mb-3">
            Full Comparison
          </h2>
          <p className="font-body text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            Every feature, side by side. No hidden differences.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-body text-sm" aria-label="Thrall vs Karl feature comparison">
            <thead>
              <tr className="border-b-2 border-foreground">
                <th className="text-left py-3 px-4 font-mono text-[11px] tracking-[0.15em] uppercase text-muted-foreground">
                  Feature
                </th>
                <th className="text-center py-3 px-4 w-[120px] font-mono text-[11px] tracking-[0.15em] uppercase text-muted-foreground">
                  Thrall
                  <br />
                  <span className="font-body text-[10px] normal-case tracking-normal text-muted-foreground/70">Free</span>
                </th>
                <th className="text-center py-3 px-4 w-[120px] font-mono text-[11px] tracking-[0.15em] uppercase text-muted-foreground">
                  Karl
                  <br />
                  <span className="font-body text-[10px] normal-case tracking-normal text-muted-foreground/70">$3.99/mo</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Core Tracking */}
              <tr>
                <td
                  colSpan={3}
                  className="bg-muted/50 py-2 px-4 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground border-t border-border"
                >
                  Core Tracking
                </td>
              </tr>
              {[
                "Annual fee tracking with 60-day advance warning",
                "Sign-up bonus & minimum spend deadline tracking",
                "Velocity management (Chase 5/24, Citi 1/8, Amex OPLB, etc.)",
                "The Howl — urgent cards dashboard (fee + promo alerts)",
                "Card archive — Valhalla (closed cards with full history)",
                "Google Sign-In authentication",
              ].map((feat) => (
                <tr key={feat} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-4 text-foreground">{feat}</td>
                  <td className="py-2.5 px-4 text-center"><CheckIcon included /></td>
                  <td className="py-2.5 px-4 text-center"><CheckIcon included /></td>
                </tr>
              ))}

              {/* Data & Devices */}
              <tr>
                <td
                  colSpan={3}
                  className="bg-muted/50 py-2 px-4 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground border-t border-border"
                >
                  Data &amp; Devices
                </td>
              </tr>
              {[
                { name: "Cloud Sync — real-time sync across all signed-in devices", thrall: false, karl: true },
                { name: "Smart Import — AI-powered extraction from spreadsheets (CSV/XLSX)", thrall: false, karl: true },
                { name: "Data Export — download your ledger as CSV or JSON", thrall: false, karl: true },
              ].map(({ name, thrall, karl }) => (
                <tr key={name} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-4 text-foreground">{name}</td>
                  <td className="py-2.5 px-4 text-center"><CheckIcon included={thrall} /></td>
                  <td className="py-2.5 px-4 text-center"><CheckIcon included={karl} /></td>
                </tr>
              ))}

              {/* Households */}
              <tr>
                <td
                  colSpan={3}
                  className="bg-muted/50 py-2 px-4 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground border-t border-border"
                >
                  Households
                </td>
              </tr>
              {[
                { name: "Single household", thrall: true, karl: true },
                { name: "Multi-Household — create and manage multiple household ledgers", thrall: false, karl: true },
              ].map(({ name, thrall, karl }) => (
                <tr key={name} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-4 text-foreground">{name}</td>
                  <td className="py-2.5 px-4 text-center"><CheckIcon included={thrall} /></td>
                  <td className="py-2.5 px-4 text-center"><CheckIcon included={karl} /></td>
                </tr>
              ))}

              {/* Support */}
              <tr>
                <td
                  colSpan={3}
                  className="bg-muted/50 py-2 px-4 font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground border-t border-border"
                >
                  Support &amp; Future Features
                </td>
              </tr>
              {[
                { name: "Community support (GitHub Issues)", thrall: true, karl: true },
                { name: "All future Karl-tier features at no extra cost", thrall: false, karl: true },
              ].map(({ name, thrall, karl }) => (
                <tr key={name} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-4 text-foreground">{name}</td>
                  <td className="py-2.5 px-4 text-center"><CheckIcon included={thrall} /></td>
                  <td className="py-2.5 px-4 text-center"><CheckIcon included={karl} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section aria-label="Frequently asked questions" className="border-b border-border">
      <div className="max-w-[1100px] mx-auto px-6 py-14 sm:py-20">

        <div className="text-center mb-10">
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary uppercase mb-3">
            ᚹ · Frequently Asked
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-foreground mb-3">
            Questions About the Price
          </h2>
          <p className="font-body text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            Everything you&apos;d want to know before deciding.
          </p>
        </div>

        <PricingFaqAccordion />

        <p className="text-center mt-8 font-body text-sm text-muted-foreground">
          More questions?{" "}
          <Link
            href="/faq"
            className="underline hover:text-foreground transition-colors"
          >
            Read the full FAQ →
          </Link>
        </p>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section aria-label="Final call to action" className="bg-card border-b border-border">
      <div className="max-w-[1100px] mx-auto px-6 py-20 sm:py-28 text-center">
        <p className="font-mono text-xs tracking-[0.3em] text-primary uppercase mb-6" aria-hidden="true">
          ᚠ
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-5">
          The ledger is open. The fee dates are not waiting.
        </h2>
        <p className="font-body text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
          Start free. Upgrade when you need the full arsenal.
          Either way, the wolf watches.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/ledger"
            className={[
              "inline-flex items-center justify-center px-10 py-4",
              "font-heading text-sm font-bold tracking-widest uppercase",
              "bg-primary text-primary-foreground",
              "hover:brightness-110 transition-all",
              "rounded-sm",
            ].join(" ")}
            data-app-link
          >
            Start Free →
          </Link>
          <Link
            href="/features"
            className={[
              "inline-flex items-center justify-center px-6 py-3",
              "font-heading text-xs font-bold tracking-widest uppercase",
              "border border-border text-foreground",
              "hover:bg-muted transition-colors",
              "rounded-sm",
            ].join(" ")}
          >
            See All Features
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <>
      <PageHero />
      <TierCardsSection />
      <ComparisonTableSection />
      <FaqSection />
      <FinalCta />
    </>
  );
}
