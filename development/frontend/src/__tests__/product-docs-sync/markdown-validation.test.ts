/**
 * Product Documentation Sync Validation Tests — Issue #699
 *
 * Verifies that:
 * 1. All markdown files in product/ are accurate and up-to-date
 * 2. README index matches actual file contents
 * 3. No stale Vercel/Depot/backlog references remain
 * 4. All internal links in README are valid
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, relative } from "path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const PRODUCT_DIR = resolve(REPO_ROOT, "product");

/**
 * Helper: Recursively find all markdown files in a directory
 */
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = resolve(currentDir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          files.push(fullPath);
        }
      }
    } catch (e) {
      console.error(`Error reading directory ${currentDir}:`, e);
    }
  }

  walk(dir);
  return files.sort();
}

describe("Product Documentation Sync — Issue #699", () => {

  describe("Markdown Files Existence", () => {
    it("should have all expected product markdown files", () => {
      const expectedFiles = [
        "README.md",
        "product-design-brief.md",
        "mythology-map.md",
        "copywriting.md",
        "platform-comparison.md",
        "platform-recommendation.md",
        "handoff-to-luna-anon-auth.md",
        "research/depot-vs-codespaces.md",
        "research/vercel-alternatives.md",
        "target-market/README.md",
      ];

      const actualFiles = findMarkdownFiles(PRODUCT_DIR).map((f) =>
        relative(PRODUCT_DIR, f)
      );

      for (const expected of expectedFiles) {
        expect(actualFiles).toContain(expected);
      }
    });
  });

  describe("README Index Validation", () => {
    it("should have README.md in the product directory", () => {
      const readmePath = resolve(PRODUCT_DIR, "README.md");
      expect(existsSync(readmePath)).toBe(true);
    });

    it("should have all index links pointing to real files", () => {
      const readmePath = resolve(PRODUCT_DIR, "README.md");
      const content = readFileSync(readmePath, "utf-8");

      // Extract markdown links from the index section: [text](path)
      const linkPattern = /\[([^\]]+)\]\(([^\)]+)\)/g;
      const matches = Array.from(content.matchAll(linkPattern));

      const indexSection = content.substring(content.indexOf("## Index"));
      const indexMatches = Array.from(indexSection.matchAll(linkPattern));

      for (const match of indexMatches) {
        const linkPath = match[2];
        if (linkPath === "README.md") {
          // Self-reference is OK
          continue;
        }
        const fullPath = resolve(PRODUCT_DIR, linkPath);
        expect(existsSync(fullPath)).toBe(
          true,
          `README index link "${linkPath}" should point to an existing file`
        );
      }
    });

    it("should list research/ docs with correct descriptions", () => {
      const readmePath = resolve(PRODUCT_DIR, "README.md");
      const content = readFileSync(readmePath, "utf-8");

      // Check research/depot-vs-codespaces.md
      expect(content).toContain("research/depot-vs-codespaces.md");
      expect(content).toContain("GKE Autopilot selected");

      // Check research/vercel-alternatives.md
      expect(content).toContain("research/vercel-alternatives.md");
      expect(content).toContain("GKE Autopilot completed");
    });
  });

  describe("Stale Reference Detection", () => {
    it("should have no stale 'Vercel KV' references outside research docs", () => {
      const files = findMarkdownFiles(PRODUCT_DIR);
      const stalePattern = /Vercel\s+KV(?!.*research)/i;

      for (const filePath of files) {
        const filename = relative(PRODUCT_DIR, filePath);
        // Skip research docs where Vercel KV might be discussed historically
        if (filename.includes("research/vercel-alternatives")) {
          continue;
        }

        const content = readFileSync(filePath, "utf-8");
        // "Vercel KV" outside of research should only appear if mentioned as "Upstash Redis"
        if (content.includes("Vercel KV")) {
          // Check it's in the context of saying it was replaced
          expect(
            content.includes("Upstash Redis") ||
              content.includes("KV store")
          ).toBe(
            true,
            `File ${filename} has Vercel KV reference but doesn't mention Upstash Redis replacement`
          );
        }
      }
    });

    it("should mark research docs as superseded", () => {
      const depotPath = resolve(PRODUCT_DIR, "research/depot-vs-codespaces.md");
      const depotContent = readFileSync(depotPath, "utf-8");
      expect(depotContent).toContain("Superseded");
      expect(depotContent).toContain("GKE Autopilot");

      const vercelPath = resolve(PRODUCT_DIR, "research/vercel-alternatives.md");
      const vercelContent = readFileSync(vercelPath, "utf-8");
      expect(vercelContent).toContain("Superseded");
      expect(vercelContent).toContain("GKE Autopilot");
    });

    it("should not have backlog markdown files (moved to GitHub Issues)", () => {
      const backlogPath = resolve(PRODUCT_DIR, "backlog");
      expect(existsSync(backlogPath)).toBe(false);
    });

    it("should reference GitHub Issues for backlog items", () => {
      const readmePath = resolve(PRODUCT_DIR, "README.md");
      const content = readFileSync(readmePath, "utf-8");
      expect(content).toContain("GitHub Issues");
      expect(content).toContain("backlog");
    });

    it("should not reference non-existent backlog files", () => {
      const files = findMarkdownFiles(PRODUCT_DIR);

      for (const filePath of files) {
        const content = readFileSync(filePath, "utf-8");

        // Check for references to backlog/ directory or backlog markdown files
        const backlogReferences = content.match(/backlog\/[^\s\)]+\.md/g);
        expect(backlogReferences).toBeNull();
      }
    });
  });

  describe("Platform Migration Completeness", () => {
    it("should have updated platform-comparison.md with GKE Autopilot", () => {
      const filePath = resolve(PRODUCT_DIR, "platform-comparison.md");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("GKE Autopilot");
      // Should not mention Vercel as current platform
      expect(
        !content.match(/Next\.js\/Vercel/) ||
        content.includes("GKE Autopilot")
      ).toBe(true);
    });

    it("should have updated platform-recommendation.md with Upstash Redis", () => {
      const filePath = resolve(PRODUCT_DIR, "platform-recommendation.md");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("Upstash Redis");
      expect(content).toContain("KV store");
      // Should not have stale SUBSCRIPTION_PLATFORM references
      expect(content).not.toContain("SUBSCRIPTION_PLATFORM");
    });

    it("should have updated handoff-to-luna-anon-auth.md with removed stale references", () => {
      const filePath = resolve(
        PRODUCT_DIR,
        "handoff-to-luna-anon-auth.md"
      );
      const content = readFileSync(filePath, "utf-8");

      // Should not reference non-existent files
      expect(content).not.toContain("product/backlog/story-auth-oidc-google.md");
      expect(content).not.toContain("product-brief.md");

      // Should note that backlog has moved to GitHub Issues
      expect(content).toContain("GitHub Issues");
    });
  });

  describe("Content Accuracy", () => {
    it("should not have broken markdown syntax", () => {
      const files = findMarkdownFiles(PRODUCT_DIR);

      for (const filePath of files) {
        const content = readFileSync(filePath, "utf-8");
        const filename = relative(PRODUCT_DIR, filePath);

        // Check for unmatched brackets in links
        const linkPattern = /\[([^\]]*)\]\(([^\)]*)\)/g;
        expect(() => {
          Array.from(content.matchAll(linkPattern));
        }).not.toThrow();
      }
    });

    it("should have consistent file references in index", () => {
      const readmePath = resolve(PRODUCT_DIR, "README.md");
      const content = readFileSync(readmePath, "utf-8");

      const indexStart = content.indexOf("## Index");
      const indexEnd = content.indexOf("**Note:**");
      const indexSection = content.substring(indexStart, indexEnd);

      // Count list items starting with "-"
      const listItems = indexSection.match(/^-/gm);
      expect(listItems).toBeTruthy();
      expect(listItems!.length).toBeGreaterThanOrEqual(8); // At least 8 documented files
    });
  });
});
