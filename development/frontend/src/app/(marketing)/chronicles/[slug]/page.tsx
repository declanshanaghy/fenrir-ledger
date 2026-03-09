/**
 * Chronicle Detail — /chronicles/[slug]
 *
 * Renders individual session chronicle natively from MDX via next-mdx-remote/rsc.
 * No dangerouslySetInnerHTML — MDX compiles to React components at build time.
 * - Chronicle styling via chronicle.css scoped to .chronicle-page
 * - Previous / Next navigation between entries (sorted newest-first)
 * - Static generation via generateStaticParams
 *
 * Ref: GitHub Issue #373, #427
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import rehypeRaw from "rehype-raw";
import {
  getAllChronicles,
  getAllChroniclesSlugs,
  getChronicleBySlug,
} from "@/lib/chronicles";
import "../chronicle.css";

// ── Static generation ────────────────────────────────────────────────────────

export const dynamic = "force-static";

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return getAllChroniclesSlugs().map((slug) => ({ slug }));
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = getChronicleBySlug(slug);
  if (!entry) return { title: "Not Found" };
  return {
    title: `${entry.title} — Prose Edda · Fenrir Ledger`,
    description: entry.excerpt,
  };
}

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

/**
 * Strip leading whitespace from each line of MDX/HTML content.
 *
 * Markdown treats lines indented by 4+ spaces as code blocks, which causes
 * indented HTML in chronicle MDX files to render as escaped text instead of
 * styled markup. Dedenting prevents this while preserving content inside
 * inline <pre> blocks (which sit on single lines in our chronicles).
 *
 * Ref: GitHub Issue #407
 */
function dedentHtml(source: string): string {
  return source
    .split("\n")
    .map((line) => line.trimStart())
    .join("\n");
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ChronicleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = getChronicleBySlug(slug);
  if (!entry) notFound();

  // Build ordered list (newest first) for prev/next
  const all = getAllChronicles();
  const currentIdx = all.findIndex((e) => e.slug === slug);
  const prevEntry = currentIdx < all.length - 1 ? all[currentIdx + 1] : null; // older
  const nextEntry = currentIdx > 0 ? all[currentIdx - 1] : null; // newer

  return (
    <>
      {/* ── Chronicle content — native MDX rendering ── */}
      {/* format:'md' compiles HTML+markdown to React components at build time.
          dedentHtml strips leading whitespace so indented HTML isn't treated
          as markdown code blocks.  Ref: Issue #407 */}
      <MDXRemote
        source={dedentHtml(entry.content)}
        options={{ mdxOptions: { format: "md", rehypePlugins: [rehypeRaw] } }}
      />

      {/* ── Prev / Next navigation ── */}
      <nav
        className="max-w-[880px] mx-auto px-6 pt-10 pb-16 border-t border-border mt-4"
        aria-label="Chronicle navigation"
      >
        <div className="flex justify-between gap-6 flex-wrap">
          {/* Prev = older entry */}
          {prevEntry ? (
            <Link
              href={`/chronicles/${prevEntry.slug}`}
              className="group flex-1 min-w-0 flex flex-col gap-1 max-w-xs"
            >
              <span className="font-mono text-[0.6rem] text-muted-foreground tracking-widest uppercase">
                ← Previous
              </span>
              <span className="font-heading text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                {prevEntry.title}
              </span>
              <span className="font-mono text-[0.6rem] text-muted-foreground/50">
                {formatDate(prevEntry.date)}
              </span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}

          {/* Rune center divider */}
          <div
            className="self-center font-mono text-primary/30 text-lg"
            aria-hidden="true"
          >
            ᛟ
          </div>

          {/* Next = newer entry */}
          {nextEntry ? (
            <Link
              href={`/chronicles/${nextEntry.slug}`}
              className="group flex-1 min-w-0 flex flex-col gap-1 text-right max-w-xs ml-auto"
            >
              <span className="font-mono text-[0.6rem] text-muted-foreground tracking-widest uppercase">
                Next →
              </span>
              <span className="font-heading text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                {nextEntry.title}
              </span>
              <span className="font-mono text-[0.6rem] text-muted-foreground/50">
                {formatDate(nextEntry.date)}
              </span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
        </div>

        {/* Back to index */}
        <div className="mt-8 text-center">
          <Link
            href="/chronicles"
            className="font-mono text-[0.65rem] text-muted-foreground hover:text-primary transition-colors tracking-widest uppercase"
          >
            ↑ All Sagas
          </Link>
        </div>
      </nav>
    </>
  );
}
