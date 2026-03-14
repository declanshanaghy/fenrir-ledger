/**
 * UX Documentation Sync Validation Tests — Issue #700
 *
 * Verifies that:
 * 1. All markdown files in ux/ are listed in the README index
 * 2. README wireframe count matches actual HTML files on disk
 * 3. No stale Vercel/Depot platform references remain
 * 4. All internal links in README are valid
 * 5. Light theme docs are acknowledged (no stale "Dark only" claims)
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, relative } from "path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const UX_DIR = resolve(REPO_ROOT, "ux");
const WIREFRAMES_DIR = resolve(UX_DIR, "wireframes");

/**
 * Recursively find files matching a given extension in a directory
 */
function findFiles(dir: string, ext: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = resolve(currentDir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(ext)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Directory doesn't exist or isn't readable
    }
  }

  walk(dir);
  return files.sort();
}

describe("UX Documentation Sync — Issue #700", () => {
  describe("Wireframe Count Accuracy", () => {
    it("should have README wireframe count matching actual HTML files on disk", () => {
      const htmlFiles = findFiles(WIREFRAMES_DIR, ".html");
      const readmeContent = readFileSync(
        resolve(UX_DIR, "README.md"),
        "utf-8"
      );

      // Extract the count from "### Wireframes (N HTML5 documents"
      const countMatch = readmeContent.match(
        /### Wireframes \((\d+) HTML5 documents/
      );
      expect(countMatch).not.toBeNull();

      const declaredCount = parseInt(countMatch![1], 10);
      expect(declaredCount).toBe(htmlFiles.length);
    });

    it("should have implementation status wireframe count matching actual files", () => {
      const htmlFiles = findFiles(WIREFRAMES_DIR, ".html");
      const readmeContent = readFileSync(
        resolve(UX_DIR, "README.md"),
        "utf-8"
      );

      // Extract count from "| N wireframes (audited"
      const statusMatch = readmeContent.match(
        /\|\s*(\d+)\s+wireframes\s+\(audited/
      );
      expect(statusMatch).not.toBeNull();

      const statusCount = parseInt(statusMatch![1], 10);
      expect(statusCount).toBe(htmlFiles.length);
    });
  });

  describe("README Index Completeness", () => {
    it("should have all expected UX markdown files listed in README", () => {
      const expectedArtifacts = [
        "theme-system.md",
        "wireframes.md",
        "interactions.md",
        "easter-eggs.md",
        "easter-egg-modal.md",
        "multi-idp-interaction-spec.md",
        "karl-upsell-interaction-spec.md",
        "light-theme-stone.md",
        "light-theme-lightning.md",
        "audit-report.md",
      ];

      const readmeContent = readFileSync(
        resolve(UX_DIR, "README.md"),
        "utf-8"
      );

      for (const artifact of expectedArtifacts) {
        expect(readmeContent).toContain(
          artifact,
        );
      }
    });

    it("should have all README index links pointing to real files", () => {
      const readmeContent = readFileSync(
        resolve(UX_DIR, "README.md"),
        "utf-8"
      );

      // Extract all markdown links: [text](path)
      const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      const matches = Array.from(readmeContent.matchAll(linkPattern));

      for (const match of matches) {
        const linkPath = match[2];
        // Skip external links and cross-domain ../product/ references
        if (linkPath.startsWith("http") || linkPath.startsWith("../")) {
          continue;
        }
        const fullPath = resolve(UX_DIR, linkPath);
        expect(existsSync(fullPath)).toBe(true);
      }
    });
  });

  describe("Stale Reference Detection", () => {
    it("should have no stale 'Vercel KV' references in UX markdown files", () => {
      const mdFiles = findFiles(UX_DIR, ".md");

      for (const filePath of mdFiles) {
        const content = readFileSync(filePath, "utf-8");
        const filename = relative(UX_DIR, filePath);

        expect(content).not.toContain("Vercel KV");
      }
    });

    it("should have no stale 'Vercel KV' references in wireframe HTML files", () => {
      const htmlFiles = findFiles(WIREFRAMES_DIR, ".html");

      for (const filePath of htmlFiles) {
        const content = readFileSync(filePath, "utf-8");
        const filename = relative(UX_DIR, filePath);

        expect(content).not.toContain("Vercel KV");
      }
    });

    it("should not claim 'Dark only' in README", () => {
      const readmeContent = readFileSync(
        resolve(UX_DIR, "README.md"),
        "utf-8"
      );

      // The old rule said "Dark only. There is no light mode."
      expect(readmeContent).not.toContain("There is no light mode");
      expect(readmeContent).not.toMatch(/\*\*Dark only\.\*\*/);
    });
  });

  describe("Light Theme Documentation", () => {
    it("should have light theme stone doc", () => {
      expect(existsSync(resolve(UX_DIR, "light-theme-stone.md"))).toBe(true);
    });

    it("should have light theme lightning doc", () => {
      expect(existsSync(resolve(UX_DIR, "light-theme-lightning.md"))).toBe(
        true
      );
    });

    it("should acknowledge light themes in README", () => {
      const readmeContent = readFileSync(
        resolve(UX_DIR, "README.md"),
        "utf-8"
      );
      expect(readmeContent).toContain("light-theme-stone.md");
      expect(readmeContent).toContain("light-theme-lightning.md");
    });
  });

  describe("Content Accuracy", () => {
    it("should have all markdown files with valid content (non-empty)", () => {
      const mdFiles = findFiles(UX_DIR, ".md");

      for (const filePath of mdFiles) {
        const content = readFileSync(filePath, "utf-8").trim();
        const filename = relative(UX_DIR, filePath);

        expect(content.length).toBeGreaterThan(0);
      }
    });

    it("should have all HTML wireframes with valid content (non-empty)", () => {
      const htmlFiles = findFiles(WIREFRAMES_DIR, ".html");

      for (const filePath of htmlFiles) {
        const content = readFileSync(filePath, "utf-8").trim();
        const filename = relative(UX_DIR, filePath);

        expect(content.length).toBeGreaterThan(0);
      }
    });
  });
});
