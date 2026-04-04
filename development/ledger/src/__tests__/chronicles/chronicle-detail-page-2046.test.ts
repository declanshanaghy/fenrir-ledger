/**
 * Unit tests for chronicles/[slug]/page.tsx
 *
 * Focuses on the exported async functions generateStaticParams and
 * generateMetadata, since the page is an async Server Component and
 * the helper functions (dedentHtml, stripInlineHeader, etc.) are internal.
 *
 * Issue: #2046
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetAllChroniclesSlugs = vi.hoisted(() => vi.fn());
const mockGetChronicleBySlug = vi.hoisted(() => vi.fn());
const mockGetAllChronicles = vi.hoisted(() => vi.fn());

vi.mock("@/lib/chronicles", () => ({
  getAllChroniclesSlugs: () => mockGetAllChroniclesSlugs(),
  getChronicleBySlug: (slug: string) => mockGetChronicleBySlug(slug),
  getAllChronicles: () => mockGetAllChronicles(),
}));

// Mock MDX and CSS imports that would fail in test environment
vi.mock("next-mdx-remote/rsc", () => ({
  MDXRemote: () => null,
}));

vi.mock("rehype-raw", () => ({ default: () => {} }));

// CSS imports
vi.mock("../chronicle.css", () => ({}));
vi.mock("../chronicle-norse.css", () => ({}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: unknown }) => children,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("chronicles/[slug]/page generateStaticParams", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns slug params for all chronicle slugs", async () => {
    mockGetAllChroniclesSlugs.mockReturnValue(["session-1", "session-2", "agent-foo"]);
    const { generateStaticParams } = await import(
      "@/app/(marketing)/chronicles/[slug]/page"
    );
    const params = await generateStaticParams();
    expect(params).toEqual([
      { slug: "session-1" },
      { slug: "session-2" },
      { slug: "agent-foo" },
    ]);
  });

  it("returns empty array when no chronicles exist", async () => {
    mockGetAllChroniclesSlugs.mockReturnValue([]);
    const { generateStaticParams } = await import(
      "@/app/(marketing)/chronicles/[slug]/page"
    );
    const params = await generateStaticParams();
    expect(params).toEqual([]);
  });
});

describe("chronicles/[slug]/page generateMetadata", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns title and description when chronicle is found", async () => {
    mockGetChronicleBySlug.mockReturnValue({
      slug: "session-1",
      title: "Session 1: The Beginning",
      excerpt: "A great adventure begins.",
      date: "2025-01-01",
      rune: "ᚠ",
      category: "session",
      content: "some content",
    });
    const { generateMetadata } = await import(
      "@/app/(marketing)/chronicles/[slug]/page"
    );
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "session-1" }) });
    expect(meta.title).toContain("Session 1: The Beginning");
    expect(meta.description).toBe("A great adventure begins.");
  });

  it("returns Not Found metadata when chronicle is missing", async () => {
    mockGetChronicleBySlug.mockReturnValue(null);
    const { generateMetadata } = await import(
      "@/app/(marketing)/chronicles/[slug]/page"
    );
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "missing-slug" }) });
    expect(meta.title).toBe("Not Found");
  });
});
