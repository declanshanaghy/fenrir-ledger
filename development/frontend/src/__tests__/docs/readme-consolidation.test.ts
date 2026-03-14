/**
 * Top-level README Consolidation Validation Tests — Issue #704
 *
 * Verifies that:
 * 1. All directory README links in the Project Structure table are valid
 * 2. Tech stack reflects GKE Autopilot (not Vercel/Depot)
 * 3. All Sacred Scrolls internal links point to real files
 * 4. Each agent directory is linked from the top-level README
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const REPO_ROOT = resolve(__dirname, "../../../../..");
const README_PATH = resolve(REPO_ROOT, "README.md");
const readmeContent = readFileSync(README_PATH, "utf-8");

describe("Top-level README Consolidation — Issue #704", () => {
  describe("Directory README Links", () => {
    const directoryReadmes = [
      "product/README.md",
      "ux/README.md",
      "architecture/README.md",
      "development/README.md",
      "quality/README.md",
      "security/README.md",
    ];

    it.each(directoryReadmes)(
      "should link to %s and the file should exist",
      (readmePath) => {
        expect(readmeContent).toContain(readmePath);
        expect(existsSync(resolve(REPO_ROOT, readmePath))).toBe(true);
      }
    );
  });

  describe("GKE Autopilot References", () => {
    it("should mention GKE Autopilot in tech stack", () => {
      expect(readmeContent).toContain("GKE Autopilot");
    });

    it("should mention Upstash Redis as database", () => {
      expect(readmeContent).toContain("Upstash Redis");
    });

    it("should mention Stripe Direct for payments", () => {
      expect(readmeContent).toContain("Stripe Direct");
    });

    it("should not reference Vercel as hosting platform", () => {
      // Vercel may appear in ADR/research links but should not appear as the hosting platform
      const techStackSection = readmeContent.split("## Tech Stack")[1]?.split("---")[0] ?? "";
      expect(techStackSection).not.toContain("Vercel");
    });
  });

  describe("Sacred Scrolls Link Validation", () => {
    const scrollsLinks = [
      "product/product-design-brief.md",
      "ux/theme-system.md",
      "ux/wireframes.md",
      "ux/interactions.md",
      "architecture/system-design.md",
      "architecture/adrs/",
      "security/architecture/threat-model.md",
      "security/architecture/auth-architecture.md",
      "quality/test-guidelines.md",
      "quality/quality-report.md",
      "quality/test-suites/",
      "development/docs/setup-guide.md",
    ];

    it.each(scrollsLinks)(
      "should link to %s and the path should exist",
      (linkPath) => {
        expect(readmeContent).toContain(linkPath);
        expect(existsSync(resolve(REPO_ROOT, linkPath))).toBe(true);
      }
    );
  });

  describe("Project Structure Table", () => {
    it("should contain a Project Structure section", () => {
      expect(readmeContent).toContain("## Project Structure");
    });

    const owners = [
      { dir: "product/", owner: "Freya" },
      { dir: "ux/", owner: "Luna" },
      { dir: "architecture/", owner: "FiremanDecko" },
      { dir: "development/", owner: "FiremanDecko" },
      { dir: "quality/", owner: "Loki" },
      { dir: "security/", owner: "Heimdall" },
    ];

    it.each(owners)(
      "should list $dir as owned by $owner",
      ({ dir, owner }) => {
        // Extract from "## Project Structure" to the next "##" heading
        const structureSection =
          readmeContent.split("## Project Structure")[1]?.split(/\n## /)[0] ?? "";
        expect(structureSection).toContain(dir);
        expect(structureSection).toContain(owner);
      }
    );
  });

  describe("Getting Started Section", () => {
    it("should include setup instructions", () => {
      expect(readmeContent).toContain("## Getting Started");
    });

    it("should reference the setup script", () => {
      expect(readmeContent).toContain("development/scripts/setup-local.sh");
    });

    it("should link to the full setup guide", () => {
      expect(readmeContent).toContain("development/docs/setup-guide.md");
    });
  });
});
