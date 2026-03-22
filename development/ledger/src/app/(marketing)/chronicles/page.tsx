/**
 * Prose Edda Index — /chronicles
 *
 * The sagas of the forge. Each session carved into the record.
 * Sorted by date descending (newest first).
 * Uses marketing layout (navbar + footer).
 *
 * Layout: Card grid — 3 columns desktop, 2 tablet, 1 mobile.
 * Typography: Cinzel headings, Source Serif body, JetBrains Mono meta.
 * Theme-aware via Tailwind tokens (light/dark).
 *
 * Ref: GitHub Issue #373, #429, #465
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getAllChronicles } from "@/lib/chronicles";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Prose Edda · Fenrir Ledger",
  description:
    "The sagas of the Fenrir Ledger forge — each session carved into the record, as the skalds once carved runes into stone.",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ChroniclesIndexPage() {
  const chronicles = getAllChronicles();

  return (
    <section className="max-w-[1200px] mx-auto px-6 py-16">
      {/* Header — centered, marketing typography */}
      <header className="text-center pb-12 mb-12 border-b border-border">
        <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-wide text-foreground mb-4">
          Prose Edda
        </h1>
        <p className="font-body text-muted-foreground text-sm md:text-base max-w-[700px] mx-auto leading-relaxed">
          The sagas of the forge. Each session carved into the record,
          as the skalds once carved runes into stone.
          Technical chronicles from the development of Fenrir Ledger.
        </p>
      </header>

      {/* Card grid — 3 desktop, 2 tablet, 1 mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {chronicles.map((entry) => (
          <Link
            key={entry.slug}
            href={`/chronicles/${entry.slug}`}
            className="group block border border-border rounded-sm bg-card hover:border-primary/50 transition-colors p-6 flex flex-col gap-4"
          >
            {/* Rune + badge + date header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="text-[28px] text-primary opacity-60 group-hover:opacity-100 transition-opacity"
                  aria-hidden="true"
                >
                  {entry.rune}
                </span>
                {entry.category === "agent" && (
                  <span className="font-mono text-[0.55rem] font-semibold tracking-widest uppercase px-1.5 py-0.5 border border-emerald-500/40 text-emerald-500 bg-emerald-500/5 rounded-sm">
                    Agent
                  </span>
                )}
              </div>
              <time
                dateTime={entry.date}
                className="font-mono text-[0.65rem] text-muted-foreground tracking-wide uppercase"
              >
                {formatDate(entry.date)}
              </time>
            </div>

            {/* Title */}
            <h2 className="font-heading text-lg font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
              {entry.title}
            </h2>

            {/* Excerpt */}
            {entry.excerpt && (
              <p className="font-body text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                {entry.excerpt}
              </p>
            )}

          </Link>
        ))}
      </div>
    </section>
  );
}
