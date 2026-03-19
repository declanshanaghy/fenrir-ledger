/**
 * QA tests for Issue #1450 — Remove malformed chronicle:
 * agent-issue-1405-step2-loki-bbd343ef
 *
 * Validates acceptance criteria:
 *   AC1: The malformed chronicle file is removed
 *   AC2: Chronicle index/listing renders without errors
 *
 * Uses the real filesystem (no fs mock) to verify the actual content/blog/
 * directory state after the fix.
 *
 * Refs: Issue #1450
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const REMOVED_SLUG = "agent-issue-1405-step2-loki-bbd343ef";
const CONTENT_DIR = path.join(process.cwd(), "content/blog");

describe("Issue #1450: remove malformed chronicle", () => {
  describe("AC1: malformed chronicle file is removed", () => {
    it("the removed MDX file no longer exists on disk", () => {
      const filePath = path.join(CONTENT_DIR, `${REMOVED_SLUG}.mdx`);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it("getAllChroniclesSlugs() does not include the removed slug", async () => {
      const { getAllChroniclesSlugs } = await import("@/lib/chronicles");
      const slugs = getAllChroniclesSlugs();
      expect(slugs).not.toContain(REMOVED_SLUG);
    });

    it("getChronicleBySlug returns null for the removed slug", async () => {
      const { getChronicleBySlug } = await import("@/lib/chronicles");
      const entry = getChronicleBySlug(REMOVED_SLUG);
      expect(entry).toBeNull();
    });
  });

  describe("AC2: chronicle index/listing renders without errors", () => {
    it("getAllChronicles() returns a non-empty list without the removed entry", async () => {
      const { getAllChronicles } = await import("@/lib/chronicles");
      const chronicles = getAllChronicles();

      // Index still has entries
      expect(chronicles.length).toBeGreaterThan(0);

      // Removed slug is not listed
      const slugs = chronicles.map((c) => c.slug);
      expect(slugs).not.toContain(REMOVED_SLUG);
    });

    it("getAllChronicles() returns valid entries with required fields", async () => {
      const { getAllChronicles } = await import("@/lib/chronicles");
      const chronicles = getAllChronicles();

      for (const entry of chronicles) {
        expect(entry.slug).toBeTruthy();
        expect(entry.title).toBeTruthy();
        expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(entry.rune).toBeTruthy();
        expect(["session", "agent"]).toContain(entry.category);
      }
    });

    it("known valid slugs still appear in the listing", async () => {
      const { getAllChroniclesSlugs } = await import("@/lib/chronicles");
      const slugs = getAllChroniclesSlugs();

      // At least one of the known valid chronicles must still be present
      const knownValid = [
        "agent-issue-839-step1-firemandecko-08287a1f",
        "brain-slug",
        "fuckin-loki",
      ];
      const found = knownValid.filter((s) => slugs.includes(s));
      expect(found.length).toBeGreaterThan(0);
    });
  });
});
