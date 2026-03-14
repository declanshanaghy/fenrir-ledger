/**
 * Unit tests for lib/chronicles.ts — chronicle metadata parsing and category support.
 *
 * Tests the category field (session vs agent) used to distinguish
 * agent reports from session chronicles in the index and detail pages.
 *
 * Refs: Issue #738
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChronicleEntry, ChronicleEntryWithContent } from "@/lib/chronicles";

// ── Mock filesystem ─────────────────────────────────────────────────────────

const mockFiles: Record<string, string> = {};

vi.mock("fs", () => ({
  default: {
    readdirSync: vi.fn(() => Object.keys(mockFiles)),
    readFileSync: vi.fn((filePath: string) => {
      const filename = filePath.split("/").pop() || "";
      if (mockFiles[filename]) return mockFiles[filename];
      throw new Error(`ENOENT: no such file: ${filePath}`);
    }),
    existsSync: vi.fn((filePath: string) => {
      const filename = filePath.split("/").pop() || "";
      return !!mockFiles[filename];
    }),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function addMockFile(filename: string, frontmatter: Record<string, string>, content = "") {
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: "${v}"`)
    .join("\n");
  mockFiles[filename] = `---\n${fm}\n---\n${content}`;
}

function clearMockFiles() {
  for (const key of Object.keys(mockFiles)) {
    delete mockFiles[key];
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("chronicles lib", () => {
  beforeEach(() => {
    clearMockFiles();
    vi.resetModules();
  });

  afterEach(() => {
    clearMockFiles();
  });

  describe("getAllChronicles", () => {
    it("returns session category by default when no category in frontmatter", async () => {
      addMockFile("test-session.mdx", {
        title: "Test Session",
        date: "2026-03-10",
        rune: "ᛏ",
        excerpt: "A test session",
        slug: "test-session",
      });

      const { getAllChronicles } = await import("@/lib/chronicles");
      const entries = getAllChronicles();

      expect(entries).toHaveLength(1);
      expect(entries[0].category).toBe("session");
    });

    it("returns agent category when frontmatter specifies category: agent", async () => {
      addMockFile("agent-test.mdx", {
        title: "Agent Report: Test",
        date: "2026-03-14",
        rune: "ᚲ",
        excerpt: "An agent report",
        slug: "agent-test",
        category: "agent",
      });

      const { getAllChronicles } = await import("@/lib/chronicles");
      const entries = getAllChronicles();

      expect(entries).toHaveLength(1);
      expect(entries[0].category).toBe("agent");
    });

    it("returns both session and agent chronicles sorted by date", async () => {
      addMockFile("session-one.mdx", {
        title: "Session One",
        date: "2026-03-08",
        rune: "ᛏ",
        excerpt: "First session",
        slug: "session-one",
      });
      addMockFile("agent-report.mdx", {
        title: "Agent Report",
        date: "2026-03-14",
        rune: "ᚲ",
        excerpt: "Agent report",
        slug: "agent-report",
        category: "agent",
      });

      const { getAllChronicles } = await import("@/lib/chronicles");
      const entries = getAllChronicles();

      expect(entries).toHaveLength(2);
      // Newest first
      expect(entries[0].slug).toBe("agent-report");
      expect(entries[0].category).toBe("agent");
      expect(entries[1].slug).toBe("session-one");
      expect(entries[1].category).toBe("session");
    });
  });

  describe("getChronicleBySlug", () => {
    it("returns category field for agent chronicles", async () => {
      addMockFile("agent-test.mdx", {
        title: "Agent Report",
        date: "2026-03-14",
        rune: "ᚲ",
        excerpt: "An agent report",
        slug: "agent-test",
        category: "agent",
      }, "<div>content</div>");

      const { getChronicleBySlug } = await import("@/lib/chronicles");
      const entry = getChronicleBySlug("agent-test");

      expect(entry).not.toBeNull();
      expect(entry!.category).toBe("agent");
      expect(entry!.content).toContain("<div>content</div>");
    });

    it("defaults to session category when not specified", async () => {
      addMockFile("plain-session.mdx", {
        title: "Plain Session",
        date: "2026-03-10",
        rune: "ᛏ",
        excerpt: "A session",
        slug: "plain-session",
      }, "body");

      const { getChronicleBySlug } = await import("@/lib/chronicles");
      const entry = getChronicleBySlug("plain-session");

      expect(entry).not.toBeNull();
      expect(entry!.category).toBe("session");
    });

    it("returns null for non-existent slug", async () => {
      const { getChronicleBySlug } = await import("@/lib/chronicles");
      const entry = getChronicleBySlug("does-not-exist");
      expect(entry).toBeNull();
    });
  });
});
