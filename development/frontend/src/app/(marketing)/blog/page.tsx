/**
 * Blog Index — /blog
 *
 * Lists all Fenrir Ledger session chronicles sorted newest-first.
 * Each entry shows: rune symbol, title, date, excerpt.
 * Norse saga aesthetic — not a generic blog grid.
 *
 * Data source: content/blog/*.mdx (frontmatter only)
 * Ref: GitHub Issue #340
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getAllChronicles } from "@/lib/blog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Session Chronicles — Fenrir Ledger",
  description:
    "The wolf's work log. Session-by-session chronicles of building Fenrir Ledger — told in the voice of Norse saga.",
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

export default function BlogPage() {
  const chronicles = getAllChronicles();

  return (
    <div className="max-w-[880px] mx-auto px-6 py-16 md:py-20">

      {/* ── Header ── */}
      <header className="mb-14 text-center">
        <p className="font-mono text-xs tracking-[0.4em] text-primary uppercase mb-5 opacity-70">
          ᛉ ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ ᛉ
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-wide text-foreground mb-4">
          Session Chronicles
        </h1>
        <p className="font-body text-muted-foreground max-w-[520px] mx-auto text-sm leading-relaxed">
          The wolf&apos;s work log. Every session, every act, every rune carved in
          code — told in the voice of Norse saga.
        </p>
      </header>

      {/* ── Rune divider ── */}
      <div
        className="flex items-center gap-5 mb-12"
        aria-hidden="true"
      >
        <div className="flex-1 h-px bg-border" />
        <span className="font-mono text-primary text-xs tracking-[0.5em] opacity-50">
          ᛟ ᚠ ᛁ
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* ── Chronicle list ── */}
      <ol className="flex flex-col gap-0" aria-label="Session chronicles">
        {chronicles.map((entry, idx) => (
          <li key={entry.slug}>
            <Link
              href={`/blog/${entry.slug}`}
              className="group flex gap-5 py-6 border-b border-border hover:border-primary/40 transition-colors"
            >
              {/* Rune glyph */}
              <div
                className="
                  w-11 h-11 flex-shrink-0
                  flex items-center justify-center
                  bg-card border border-border
                  font-mono text-xl text-primary
                  group-hover:border-primary group-hover:shadow-gold-sm
                  transition-all
                "
                aria-hidden="true"
              >
                {entry.rune}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Date + index */}
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="font-mono text-[0.65rem] text-muted-foreground tracking-widest uppercase">
                    {formatDate(entry.date)}
                  </span>
                  <span className="font-mono text-[0.58rem] text-muted-foreground/40">
                    #{String(chronicles.length - idx).padStart(2, "0")}
                  </span>
                </div>

                {/* Title */}
                <h2 className="font-heading text-base font-semibold text-foreground group-hover:text-primary transition-colors leading-snug mb-1.5">
                  {entry.title}
                </h2>

                {/* Excerpt */}
                <p className="font-body text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {entry.excerpt}
                </p>
              </div>

              {/* Arrow */}
              <div className="flex-shrink-0 self-center font-mono text-muted-foreground/30 group-hover:text-primary/60 transition-colors text-sm">
                →
              </div>
            </Link>
          </li>
        ))}
      </ol>

      {/* ── Empty state ── */}
      {chronicles.length === 0 && (
        <p className="text-center font-body text-muted-foreground py-20">
          The forge is cold. No chronicles yet.
        </p>
      )}

      {/* ── Footer cipher ── */}
      <div className="mt-16 text-center">
        <p
          className="font-mono text-xs text-muted-foreground/30 tracking-[0.4em]"
          aria-hidden="true"
        >
          ᛏ ᚢ ᛈ ᚠ ᛁ ᚱ
        </p>
      </div>
    </div>
  );
}
