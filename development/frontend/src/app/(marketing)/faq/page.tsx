/**
 * FAQ page — /faq
 *
 * Categorized frequently asked questions seeded from subreddit research
 * and common product questions. Data lives in src/data/faq.json for easy
 * maintenance.
 *
 * Categories:
 *   1. Getting Started
 *   2. Features
 *   3. Pricing
 *   4. Privacy and Security
 *   5. Technical
 *
 * Uses the (marketing) layout (nav + footer) via MarketingLayout.
 * Static export: force-static so this page is pre-rendered at build time.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "./FaqAccordion";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about Fenrir Ledger — getting started, features, pricing, privacy, and technical details.",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-10 pb-20">
      {/* Back link */}
      <Link
        href="/"
        className="inline-block mb-6 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
      >
        ← Back to Fenrir Ledger
      </Link>

      {/* Page title */}
      <h1 className="font-display text-3xl text-gold mb-2">
        Frequently Asked Questions
      </h1>
      <p className="font-body text-muted-foreground mb-10 leading-relaxed">
        Everything you need to know about Fenrir Ledger. Can&rsquo;t find an answer?{" "}
        <a
          href="mailto:support@fenrirledger.com"
          className="text-gold underline hover:brightness-110 transition-colors"
        >
          Contact us
        </a>
        .
      </p>

      {/* Accordion — client component */}
      <FaqAccordion />
    </div>
  );
}
