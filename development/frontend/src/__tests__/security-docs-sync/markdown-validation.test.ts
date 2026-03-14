/**
 * Security Documentation Sync Validation Tests — Issue #703
 *
 * Verifies that:
 * 1. All markdown files in security/ are present and indexed
 * 2. README index links point to real files
 * 3. No stale "Vercel KV" or "Vercel serverless" references in live docs
 * 4. Architecture docs reflect GKE Autopilot infrastructure
 * 5. Deployment checklist references GKE, not Vercel
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, relative } from "path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const SECURITY_DIR = resolve(REPO_ROOT, "security");

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
      // skip unreadable dirs
    }
  }

  walk(dir);
  return files.sort();
}

describe("Security Documentation Sync — Issue #703", () => {
  describe("Markdown Files Existence", () => {
    it("should have all expected architecture files", () => {
      const expectedFiles = [
        "architecture/auth-architecture.md",
        "architecture/data-flow-diagrams.md",
        "architecture/trust-boundaries.md",
        "architecture/threat-model.md",
      ];

      for (const expected of expectedFiles) {
        const fullPath = resolve(SECURITY_DIR, expected);
        expect(existsSync(fullPath)).toBe(true);
      }
    });

    it("should have all expected checklist files", () => {
      const expectedFiles = [
        "checklists/api-route-checklist.md",
        "checklists/deployment-security.md",
      ];

      for (const expected of expectedFiles) {
        const fullPath = resolve(SECURITY_DIR, expected);
        expect(existsSync(fullPath)).toBe(true);
      }
    });

    it("should have README.md", () => {
      expect(existsSync(resolve(SECURITY_DIR, "README.md"))).toBe(true);
    });
  });

  describe("README Index Validation", () => {
    it("should have all architecture links pointing to real files", () => {
      const readme = readFileSync(
        resolve(SECURITY_DIR, "README.md"),
        "utf-8"
      );

      const archSection = readme.substring(
        readme.indexOf("## Architecture"),
        readme.indexOf("## Checklists")
      );

      const linkPattern = /\[([^\]]+)\]\(([^\)]+)\)/g;
      const links = Array.from(archSection.matchAll(linkPattern));

      for (const match of links) {
        const linkPath = match[2];
        const fullPath = resolve(SECURITY_DIR, linkPath);
        expect(existsSync(fullPath)).toBe(true);
      }
    });

    it("should have all checklist links pointing to real files", () => {
      const readme = readFileSync(
        resolve(SECURITY_DIR, "README.md"),
        "utf-8"
      );

      const checklistSection = readme.substring(
        readme.indexOf("## Checklists"),
        readme.indexOf("## Advisories")
      );

      const linkPattern = /\[([^\]]+)\]\(([^\)]+)\)/g;
      const links = Array.from(checklistSection.matchAll(linkPattern));

      for (const match of links) {
        const linkPath = match[2];
        const fullPath = resolve(SECURITY_DIR, linkPath);
        expect(existsSync(fullPath)).toBe(true);
      }
    });

    it("should have all report links pointing to real files", () => {
      const readme = readFileSync(
        resolve(SECURITY_DIR, "README.md"),
        "utf-8"
      );

      const reportsStart = readme.indexOf("## Reports");
      const archStart = readme.indexOf("## Architecture");
      const reportsSection = readme.substring(reportsStart, archStart);

      const linkPattern = /\(reports\/[^\)]+\.md\)/g;
      const links = Array.from(reportsSection.matchAll(linkPattern));

      expect(links.length).toBeGreaterThan(0);
      for (const match of links) {
        const linkPath = match[0].slice(1, -1); // remove parens
        const fullPath = resolve(SECURITY_DIR, linkPath);
        expect(existsSync(fullPath)).toBe(true);
      }
    });

    it("should reference GKE Autopilot in current state", () => {
      const readme = readFileSync(
        resolve(SECURITY_DIR, "README.md"),
        "utf-8"
      );
      expect(readme).toContain("GKE Autopilot");
    });

    it("should reference Upstash Redis for KV store", () => {
      const readme = readFileSync(
        resolve(SECURITY_DIR, "README.md"),
        "utf-8"
      );
      expect(readme).toContain("Upstash Redis");
    });

    it("should list Gmail MCP reports", () => {
      const readme = readFileSync(
        resolve(SECURITY_DIR, "README.md"),
        "utf-8"
      );
      expect(readme).toContain("gmail-mcp-deep-audit");
      expect(readme).toContain("gmail-mcp-pr324-review");
      expect(readme).toContain("gmail-mcp-pr324-remediation");
    });

    it("should list Patreon report as archived", () => {
      const readme = readFileSync(
        resolve(SECURITY_DIR, "README.md"),
        "utf-8"
      );
      expect(readme).toContain("Archived");
      expect(readme).toContain("patreon-integration");
      expect(readme).toContain("Patreon fully removed");
    });
  });

  describe("Stale Reference Detection — Live Docs Only", () => {
    const LIVE_DOCS = [
      "architecture/auth-architecture.md",
      "architecture/data-flow-diagrams.md",
      "architecture/trust-boundaries.md",
      "architecture/threat-model.md",
      "checklists/api-route-checklist.md",
      "checklists/deployment-security.md",
      "README.md",
    ];

    it("should not reference 'Vercel serverless' in live docs", () => {
      for (const doc of LIVE_DOCS) {
        const content = readFileSync(resolve(SECURITY_DIR, doc), "utf-8");
        expect(content).not.toContain("Vercel Serverless");
        expect(content).not.toContain("Vercel serverless");
      }
    });

    it("should not reference 'Vercel KV' in live docs", () => {
      for (const doc of LIVE_DOCS) {
        const content = readFileSync(resolve(SECURITY_DIR, doc), "utf-8");
        expect(content).not.toContain("Vercel KV");
      }
    });

    it("should reference GKE Autopilot in trust-boundaries.md", () => {
      const content = readFileSync(
        resolve(SECURITY_DIR, "architecture/trust-boundaries.md"),
        "utf-8"
      );
      expect(content).toContain("GKE Autopilot");
    });

    it("should reference GKE in deployment-security.md", () => {
      const content = readFileSync(
        resolve(SECURITY_DIR, "checklists/deployment-security.md"),
        "utf-8"
      );
      expect(content).toContain("GKE");
      expect(content).toContain("K8s Secrets");
    });

    it("should reference Upstash Redis in auth-architecture.md", () => {
      const content = readFileSync(
        resolve(SECURITY_DIR, "architecture/auth-architecture.md"),
        "utf-8"
      );
      expect(content).toContain("Upstash Redis");
    });
  });

  describe("Architecture Content Accuracy", () => {
    it("should list five trust zones in trust-boundaries.md", () => {
      const content = readFileSync(
        resolve(SECURITY_DIR, "architecture/trust-boundaries.md"),
        "utf-8"
      );
      expect(content).toContain("ZONE 1");
      expect(content).toContain("ZONE 2");
      expect(content).toContain("ZONE 3");
      expect(content).toContain("ZONE 4");
      expect(content).toContain("ZONE 5");
    });

    it("should reference requireAuth pattern in api-route-checklist.md", () => {
      const content = readFileSync(
        resolve(SECURITY_DIR, "checklists/api-route-checklist.md"),
        "utf-8"
      );
      expect(content).toContain("requireAuth(request)");
      expect(content).toContain("/api/auth/token");
      expect(content).toContain("/api/stripe/webhook");
    });

    it("should have last-reviewed dates from 2026-03-14 in live docs", () => {
      const liveDocs = [
        "architecture/auth-architecture.md",
        "architecture/data-flow-diagrams.md",
        "architecture/trust-boundaries.md",
        "architecture/threat-model.md",
        "checklists/api-route-checklist.md",
        "checklists/deployment-security.md",
      ];

      for (const doc of liveDocs) {
        const content = readFileSync(resolve(SECURITY_DIR, doc), "utf-8");
        expect(content).toContain("2026-03-14");
      }
    });
  });
});
