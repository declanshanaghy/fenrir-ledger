/**
 * chronicles.ts — Chronicle utilities for Fenrir Ledger
 *
 * Reads MDX files from content/blog/, parses frontmatter via gray-matter,
 * and returns typed chronicle metadata.
 *
 * Used by:
 *   - (marketing)/chronicles/page.tsx — chronicles index listing
 *   - (marketing)/chronicles/[slug]/page.tsx — individual entry renderer
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChronicleEntry {
  /** URL-safe slug (filename without .mdx) */
  slug: string;
  /** Chronicle session title */
  title: string;
  /** ISO date string, e.g. "2026-03-08" */
  date: string;
  /** Elder Futhark rune for this session */
  rune: string;
  /** Short excerpt for index listing */
  excerpt: string;
}

export interface ChronicleEntryWithContent extends ChronicleEntry {
  /** Raw MDX source content */
  content: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CONTENT_DIR = path.join(process.cwd(), "content/blog");

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Read all .mdx files from content/blog/ and return parsed frontmatter. */
export function getAllChronicles(): ChronicleEntry[] {
  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".mdx"));

  const entries: ChronicleEntry[] = files.map((file) => {
    const slug = file.replace(/\.mdx$/, "");
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf8");
    const { data } = matter(raw);
    return {
      slug,
      title: (data.title as string) || slug,
      date: (data.date as string) || "2026-01-01",
      rune: (data.rune as string) || "ᚠ",
      excerpt: (data.excerpt as string) || "",
    };
  });

  // Sort newest first
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

/** Return all slugs — used by generateStaticParams */
export function getAllChroniclesSlugs(): string[] {
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

/** Read a single chronicle by slug, including raw MDX content. */
export function getChronicleBySlug(slug: string): ChronicleEntryWithContent | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  return {
    slug,
    title: (data.title as string) || slug,
    date: (data.date as string) || "2026-01-01",
    rune: (data.rune as string) || "ᚠ",
    excerpt: (data.excerpt as string) || "",
    content,
  };
}
