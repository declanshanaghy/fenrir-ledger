/**
 * Top-level README Consolidation Validation Tests — Issue #704
 *
 * Verifies that:
 * 1. All directory README links in the Sacred Scrolls section are valid
 * 2. README references GKE Autopilot infrastructure (not Vercel/Depot)
 * 3. All Sacred Scrolls internal links point to real files
 * 4. Each agent directory is linked from the top-level README
 *
 * Note: Issue #800 redesigned the README — removed ## Tech Stack,
 * ## Project Structure, ## Getting Started sections and replaced with
 * ## Agent Profiles. Tests for those removed sections have been updated.
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
    it("should mention GKE Autopilot (infrastructure badge or text)", () => {
      // GKE Autopilot referenced in the Production badge and infrastructure section
      expect(readmeContent).toContain("GKE");
    });

    it("should not reference Vercel as hosting platform", () => {
      // README must not promote Vercel — GKE Autopilot is the hosting platform
      // (Vercel may appear in ADR research docs but not as primary host in README)
      expect(readmeContent).not.toContain("hosted on Vercel");
      expect(readmeContent).not.toContain("deploy to Vercel");
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

  describe("Domain Ownership via Sacred Scrolls", () => {
    // Issue #800 replaced ## Project Structure with ## Agent Profiles.
    // Ownership is now expressed through the Sacred Scrolls section.
    const ownershipChecks = [
      { dir: "product/", owner: "Freya" },
      { dir: "ux/", owner: "Luna" },
      { dir: "architecture/", owner: "FiremanDecko" },
      { dir: "development/", owner: "FiremanDecko" },
      { dir: "quality/", owner: "Loki" },
      { dir: "security/", owner: "Heimdall" },
    ];

    it.each(ownershipChecks)(
      "should mention $dir and $owner somewhere in the README",
      ({ dir, owner }) => {
        expect(readmeContent).toContain(dir);
        expect(readmeContent).toContain(owner);
      }
    );
  });

  describe("Setup Guide Reference", () => {
    it("should link to the full setup guide", () => {
      expect(readmeContent).toContain("development/docs/setup-guide.md");
    });
  });
});
