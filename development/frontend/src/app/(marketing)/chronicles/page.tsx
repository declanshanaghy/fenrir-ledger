/**
 * Prose Edda Index — /chronicles
 *
 * The sagas of the forge. Each session carved into the record.
 * Sorted by date descending (newest first).
 * Uses marketing layout (navbar + footer).
 *
 * Ref: GitHub Issue #373, #429
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
    <section className="max-w-[1100px] mx-auto px-6 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-wide text-foreground mb-3">
          Prose Edda
        </h1>
        <p className="font-body text-muted-foreground text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
          These are not blog posts. These are the sagas of the forge.
          Each session carved into the record, as the skalds once carved runes into stone.
          The wolf does not explain — it declares. Read, and know what was built.
        </p>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {chronicles.map((entry) => (
          <Link
            key={entry.slug}
            href={`/chronicles/${entry.slug}`}
            className="group block border border-border rounded-sm bg-card hover:border-primary/50 transition-colors p-6"
          >
            {/* Rune + date */}
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-2xl text-primary opacity-60 group-hover:opacity-100 transition-opacity"
                aria-hidden="true"
              >
                {entry.rune}
              </span>
              <time
                dateTime={entry.date}
                className="font-mono text-[0.65rem] text-muted-foreground tracking-wide"
              >
                {formatDate(entry.date)}
              </time>
            </div>

            {/* Title */}
            <h2 className="font-heading text-base font-semibold text-foreground group-hover:text-primary transition-colors leading-snug mb-2">
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
