/**
 * Blog Entry — /blog/[slug]
 *
 * Renders individual session chronicle natively from MDX via next-mdx-remote/rsc.
 * No dangerouslySetInnerHTML — MDX compiles to React components at build time.
 * - Breadcrumb: Home > Blog > [Session Title]
 * - Chronicle styling via chronicle.css scoped to .chronicle-page
 * - Previous / Next navigation between entries (sorted newest-first)
 * - Static generation via generateStaticParams
 *
 * Ref: GitHub Issue #340
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import {
  getAllChronicles,
  getAllChroniclesSlugs,
  getChronicleBySlug,
} from "@/lib/blog";
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
    title: `${entry.title} — Session Chronicle · Fenrir Ledger`,
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function BlogEntryPage({
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
      {/* ── Breadcrumb ── */}
      <nav
        className="max-w-[880px] mx-auto px-6 pt-6 pb-2"
        aria-label="Breadcrumb"
      >
        <ol className="flex items-center gap-2 font-mono text-[0.65rem] text-muted-foreground tracking-wide uppercase flex-wrap">
          <li>
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true" className="opacity-40">
            /
          </li>
          <li>
            <Link href="/blog" className="hover:text-primary transition-colors">
              Blog
            </Link>
          </li>
          <li aria-hidden="true" className="opacity-40">
            /
          </li>
          <li
            className="text-foreground opacity-70 truncate max-w-[200px] sm:max-w-none"
            aria-current="page"
          >
            {entry.title}
          </li>
        </ol>
      </nav>

      {/* ── Chronicle content — native MDX rendering ── */}
      {/* format:'md' allows HTML mixed content (<pre> with nested elements) */}
      <MDXRemote
        source={entry.content}
        options={{ mdxOptions: { format: "md" } }}
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
              href={`/blog/${prevEntry.slug}`}
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
              href={`/blog/${nextEntry.slug}`}
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
            href="/blog"
            className="font-mono text-[0.65rem] text-muted-foreground hover:text-primary transition-colors tracking-widest uppercase"
          >
            ↑ All Chronicles
          </Link>
        </div>
      </nav>
    </>
  );
}
