/**
 * Quality Documentation Sync Validation Tests — Issue #702
 *
 * Verifies that:
 * 1. All markdown files in quality/ are accurate and up-to-date
 * 2. README index matches actual content
 * 3. No stale Vercel/Depot references remain in quality markdown
 * 4. Test counts in documentation match reality
 * 5. Flagged suites in quality-report.md actually exist
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, relative } from "path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const QUALITY_DIR = resolve(REPO_ROOT, "quality");
const TEST_SUITES_DIR = resolve(QUALITY_DIR, "test-suites");

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
    } catch {
      // directory doesn't exist
    }
  }

  walk(dir);
  return files.sort();
}

/**
 * Helper: Count test() calls in a spec file
 */
function countTests(specPath: string): number {
  const content = readFileSync(specPath, "utf-8");
  const matches = content.match(/^\s*test\(/gm);
  return matches ? matches.length : 0;
}

/**
 * Helper: Find all spec files in test-suites/
 */
function findSpecFiles(): string[] {
  const specs: string[] = [];

  function walk(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.name.endsWith(".spec.ts")) {
          specs.push(fullPath);
        }
      }
    } catch {
      // directory doesn't exist
    }
  }

  walk(TEST_SUITES_DIR);
  return specs.sort();
}

describe("Quality Documentation Sync — Issue #702", () => {
  describe("Markdown Files Existence", () => {
    it("should have all expected quality markdown files", () => {
      const expectedFiles = [
        "README.md",
        "quality-report.md",
        "test-guidelines.md",
        "e2e-test-audit.md",
        "issue-template.md",
      ];

      for (const expected of expectedFiles) {
        const fullPath = resolve(QUALITY_DIR, expected);
        expect(existsSync(fullPath)).toBe(true);
      }
    });
  });

  describe("README Index Accuracy", () => {
    it("should reference test-guidelines.md", () => {
      const readme = readFileSync(
        resolve(QUALITY_DIR, "README.md"),
        "utf-8"
      );
      expect(readme).toContain("test-guidelines.md");
    });

    it("should reference quality-report.md", () => {
      const readme = readFileSync(
        resolve(QUALITY_DIR, "README.md"),
        "utf-8"
      );
      expect(readme).toContain("quality-report.md");
    });

    it("should have E2E test count within 20% of actual", () => {
      const readme = readFileSync(
        resolve(QUALITY_DIR, "README.md"),
        "utf-8"
      );

      // Extract E2E test count from README
      const e2eMatch = readme.match(/E2E tests:\*\*\s*~?(\d+)/);
      expect(e2eMatch).toBeTruthy();
      const documentedCount = parseInt(e2eMatch![1], 10);

      // Count actual tests
      const specs = findSpecFiles();
      let actualCount = 0;
      for (const spec of specs) {
        actualCount += countTests(spec);
      }

      // Allow 20% drift before flagging
      const lowerBound = actualCount * 0.8;
      const upperBound = actualCount * 1.2;
      expect(documentedCount).toBeGreaterThanOrEqual(lowerBound);
      expect(documentedCount).toBeLessThanOrEqual(upperBound);
    });

    it("should reference GKE infrastructure, not Vercel", () => {
      const readme = readFileSync(
        resolve(QUALITY_DIR, "README.md"),
        "utf-8"
      );
      // README should not reference Vercel as the deployment platform
      expect(readme).not.toMatch(/deploy.*vercel/i);
      expect(readme).not.toMatch(/vercel.*deploy/i);
    });
  });

  describe("Stale Reference Detection", () => {
    it("should not have stale Vercel KV references in quality markdown", () => {
      const mdFiles = findMarkdownFiles(QUALITY_DIR);

      for (const filePath of mdFiles) {
        const content = readFileSync(filePath, "utf-8");
        const filename = relative(QUALITY_DIR, filePath);

        // "Vercel KV" should not appear — it's now "Upstash Redis"
        expect(content).not.toContain("Vercel KV");
      }
    });

    it("should not have Depot references in quality markdown", () => {
      const mdFiles = findMarkdownFiles(QUALITY_DIR);

      for (const filePath of mdFiles) {
        const content = readFileSync(filePath, "utf-8");
        expect(content).not.toMatch(/\bDepot\b/);
      }
    });

    it("should not reference Vercel as deployment platform in verify.sh", () => {
      const verifyPath = resolve(QUALITY_DIR, "scripts/verify.sh");
      const content = readFileSync(verifyPath, "utf-8");
      expect(content).not.toMatch(/Vercel/i);
    });
  });

  describe("Quality Report — Flagged Files Exist", () => {
    it("should only flag spec files that actually exist", () => {
      const report = readFileSync(
        resolve(QUALITY_DIR, "quality-report.md"),
        "utf-8"
      );

      // Extract spec file paths from the flagged files table
      const specPattern =
        /`(quality\/test-suites\/[^\`]+\.spec\.ts)`/g;
      const flaggedPaths = Array.from(report.matchAll(specPattern)).map(
        (m) => m[1]
      );

      for (const specPath of flaggedPaths) {
        const fullPath = resolve(REPO_ROOT, specPath);
        expect(existsSync(fullPath)).toBe(
          true,
          `Flagged file "${specPath}" should exist on disk`
        );
      }
    });
  });

  describe("Test Guidelines — Suite Table Accuracy", () => {
    it("should have E2E count in test-guidelines within 20% of actual", () => {
      const guidelines = readFileSync(
        resolve(QUALITY_DIR, "test-guidelines.md"),
        "utf-8"
      );

      // Extract E2E count from the "Current test counts" table
      const e2eMatch = guidelines.match(
        /E2E\s*\|\s*Playwright\s*\|\s*~?(\d+)/
      );
      expect(e2eMatch).toBeTruthy();
      const documentedCount = parseInt(e2eMatch![1], 10);

      const specs = findSpecFiles();
      let actualCount = 0;
      for (const spec of specs) {
        actualCount += countTests(spec);
      }

      const lowerBound = actualCount * 0.8;
      const upperBound = actualCount * 1.2;
      expect(documentedCount).toBeGreaterThanOrEqual(lowerBound);
      expect(documentedCount).toBeLessThanOrEqual(upperBound);
    });

    it("should have spec file count in suite table within 20% of actual", () => {
      const guidelines = readFileSync(
        resolve(QUALITY_DIR, "test-guidelines.md"),
        "utf-8"
      );

      // Extract file count from "Current E2E suites (N files, ~M tests)"
      const headerMatch = guidelines.match(
        /Current E2E suites \((\d+) files/
      );
      expect(headerMatch).toBeTruthy();
      const documentedFiles = parseInt(headerMatch![1], 10);

      const actualFiles = findSpecFiles().length;

      const lowerBound = actualFiles * 0.8;
      const upperBound = actualFiles * 1.2;
      expect(documentedFiles).toBeGreaterThanOrEqual(lowerBound);
      expect(documentedFiles).toBeLessThanOrEqual(upperBound);
    });
  });

  describe("E2E Test Audit — Archived Status", () => {
    it("should be marked as archived or historical", () => {
      const audit = readFileSync(
        resolve(QUALITY_DIR, "e2e-test-audit.md"),
        "utf-8"
      );
      expect(audit).toMatch(/ARCHIVED|historical|point-in-time/i);
    });
  });
});
