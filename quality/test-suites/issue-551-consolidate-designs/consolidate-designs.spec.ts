import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * QA Test Suite for Issue #551: Consolidate designs/ into root-level canonical dirs
 *
 * This suite validates the structural consolidation of design artifacts from
 * designs/ subdirectories into root-level canonical directories (ux/, product/, architecture/).
 *
 * Since this is a static content/docs reorganization with no interactive behavior,
 * tests verify file system state, path references, and configuration correctness.
 */

const REPO_ROOT = path.resolve(__dirname, "../../..");

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

function dirExists(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function findFilesInDir(dirPath: string, pattern?: RegExp): string[] {
  if (!dirExists(dirPath)) return [];
  const files: string[] = [];
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    if (item === ".gitkeep") continue;
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      if (!pattern || pattern.test(item)) {
        files.push(item);
      }
    }
  }
  return files;
}

test.describe("Issue #551 — Consolidate designs/ into root-level canonical dirs", () => {
  // ======== AC-1: designs/ directory deleted entirely ========
  test("AC-1: designs/ directory must be deleted entirely", () => {
    const designsPath = path.join(REPO_ROOT, "designs");
    expect(dirExists(designsPath)).toBe(
      false,
      "designs/ directory should be completely deleted"
    );
  });

  // ======== AC-2: UX consolidation ========
  test("AC-2: UX content moved from designs/ux-design/ to ux/", () => {
    // Check that ux/ directory exists
    const uxPath = path.join(REPO_ROOT, "ux");
    expect(dirExists(uxPath)).toBe(true, "ux/ directory should exist");

    // Check for unique files moved from designs/ux-design/
    expect(fileExists(path.join(uxPath, "light-theme-lightning.md"))).toBe(
      true,
      "light-theme-lightning.md should be in ux/"
    );
    expect(fileExists(path.join(uxPath, "light-theme-stone.md"))).toBe(
      true,
      "light-theme-stone.md should be in ux/"
    );

    // Check for interactions directory
    expect(dirExists(path.join(uxPath, "interactions"))).toBe(
      true,
      "interactions/ directory should exist in ux/"
    );

    // Check for wireframes directory
    expect(dirExists(path.join(uxPath, "wireframes"))).toBe(
      true,
      "wireframes/ directory should exist in ux/"
    );

    // Verify old designs/ux-design/ is gone
    const oldDesignsUx = path.join(REPO_ROOT, "designs", "ux-design");
    expect(dirExists(oldDesignsUx)).toBe(
      false,
      "designs/ux-design/ should be deleted"
    );
  });

  // ======== AC-3: Product consolidation ========
  test("AC-3: Product content moved from designs/product/ to product/", () => {
    // Check that product/ directory exists
    const productPath = path.join(REPO_ROOT, "product");
    expect(dirExists(productPath)).toBe(true, "product/ directory should exist");

    // Check for target-market subdirectory
    expect(dirExists(path.join(productPath, "target-market"))).toBe(
      true,
      "target-market/ directory should exist in product/"
    );

    // Check for copywriting.md (canonical, moved if stale version existed)
    expect(fileExists(path.join(productPath, "copywriting.md"))).toBe(
      true,
      "copywriting.md should be in product/"
    );

    // Check for product-design-brief.md
    expect(fileExists(path.join(productPath, "product-design-brief.md"))).toBe(
      true,
      "product-design-brief.md should be in product/"
    );

    // Verify old designs/product/ is gone
    const oldDesignsProduct = path.join(REPO_ROOT, "designs", "product");
    expect(dirExists(oldDesignsProduct)).toBe(
      false,
      "designs/product/ should be deleted"
    );

    // Verify designs/product/backlog/ is gone (entirely deleted, not moved)
    const oldBacklog = path.join(REPO_ROOT, "designs", "product", "backlog");
    expect(dirExists(oldBacklog)).toBe(
      false,
      "designs/product/backlog/ should be deleted (backlog tracked as GitHub Issues)"
    );
  });

  // ======== AC-4: Architecture consolidation ========
  test("AC-4: Architecture content moved from designs/architecture/ to architecture/", () => {
    // Check that architecture/ directory exists
    const archPath = path.join(REPO_ROOT, "architecture");
    expect(dirExists(archPath)).toBe(
      true,
      "architecture/ directory should exist"
    );

    // Check for ADRs subdirectory
    expect(dirExists(path.join(archPath, "adrs"))).toBe(
      true,
      "adrs/ directory should exist in architecture/"
    );

    // Check for unique docs moved from designs/architecture/
    expect(fileExists(path.join(archPath, "n8n-reddit-automation.md"))).toBe(
      true,
      "n8n-reddit-automation.md should be in architecture/"
    );
    expect(fileExists(path.join(archPath, "clerk-implementation-plan.md"))).toBe(
      true,
      "clerk-implementation-plan.md should be in architecture/"
    );
    expect(fileExists(path.join(archPath, "clerk-auth-qa-report.md"))).toBe(
      true,
      "clerk-auth-qa-report.md should be in architecture/"
    );
    expect(fileExists(path.join(archPath, "route-ownership.md"))).toBe(
      true,
      "route-ownership.md should be in architecture/"
    );

    // Verify old designs/architecture/ is gone
    const oldDesignsArch = path.join(REPO_ROOT, "designs", "architecture");
    expect(dirExists(oldDesignsArch)).toBe(
      false,
      "designs/architecture/ should be deleted"
    );
  });

  // ======== AC-5: ADR renumbering ========
  test("AC-5: Old ADRs renumbered into architecture/adrs/ continuing ADR-NNN sequence", () => {
    const adrsPath = path.join(REPO_ROOT, "architecture", "adrs");
    expect(dirExists(adrsPath)).toBe(true, "architecture/adrs/ should exist");

    // Verify ADR-001 through ADR-007 exist (original sequence)
    for (let i = 1; i <= 7; i++) {
      const adrNum = String(i).padStart(3, "0");
      const adrFile = path.join(adrsPath, `ADR-${adrNum}-*.md`);
      const files = findFilesInDir(adrsPath, new RegExp(`^ADR-${adrNum}`));
      expect(files.length).toBeGreaterThan(
        0,
        `ADR-${adrNum} should exist in architecture/adrs/`
      );
    }

    // Verify at least ADR-008+ exist (renumbered old ADRs)
    const files = findFilesInDir(adrsPath, /^ADR-/);
    expect(files.length).toBeGreaterThanOrEqual(
      8,
      "Should have at least ADR-001 through ADR-008 (original + renumbered old ADRs)"
    );

    // Verify no superseded/archived stubs remain
    const adrFiles = findFilesInDir(adrsPath);
    for (const file of adrFiles) {
      expect(file).not.toMatch(
        /adr-backend-server\.md|adr-openapi-spec\.md|backend-implementation-plan\.md|backend-ws-qa-report\.md/,
        `Superseded stub ${file} should be deleted`
      );
    }
  });

  // ======== AC-6: Agent configs updated ========
  test("AC-6: All agent configs updated with correct paths", () => {
    const agents = [
      "freya.md",
      "freya-profile.md",
      "luna.md",
      "fireman-decko.md",
      "loki.md",
      "heimdall.md",
    ];

    for (const agent of agents) {
      const agentPath = path.join(REPO_ROOT, ".claude", "agents", agent);
      if (!fileExists(agentPath)) {
        console.warn(`Agent config ${agent} not found, skipping`);
        continue;
      }

      const content = readFile(agentPath);

      // Check that no stale designs/ paths remain
      expect(content).not.toMatch(
        /designs\/product/,
        `${agent} should not reference designs/product`
      );
      expect(content).not.toMatch(
        /designs\/architecture/,
        `${agent} should not reference designs/architecture`
      );
      expect(content).not.toMatch(
        /designs\/ux-design/,
        `${agent} should not reference designs/ux-design`
      );

      // Freya-specific path checks
      if (agent.includes("freya")) {
        // Should reference product/ paths, not designs/product/
        if (content.includes("product-design-brief")) {
          expect(content).toMatch(
            /product\/product-design-brief\.md/,
            `${agent} should reference product/product-design-brief.md`
          );
        }
        if (content.includes("target-market")) {
          expect(content).toMatch(
            /product\/target-market/,
            `${agent} should reference product/target-market/`
          );
        }
      }

      // Luna-specific path checks
      if (agent === "luna.md") {
        // Should NOT reference designs/product/backlog/ (tracked as GitHub Issues)
        expect(content).not.toMatch(
          /designs\/product\/backlog/,
          `${agent} should not reference designs/product/backlog/`
        );
        // Should NOT reference product/backlog/ either
        expect(content).not.toMatch(
          /product\/backlog/,
          `${agent} should not reference product/backlog/ (tracked as GitHub Issues instead)`
        );
      }
    }
  });

  // ======== AC-7: No stale references in codebase ========
  test("AC-7: No stale designs/ references in source files", () => {
    // Search for designs/ references in key source files
    const filesToCheck = [
      "CLAUDE.md",
      "MEMORY.md",
      "README.md",
      "architecture/README.md",
      "product/README.md",
      "ux/README.md",
      "architecture/pipeline.md",
    ];

    for (const file of filesToCheck) {
      const filePath = path.join(REPO_ROOT, file);
      if (!fileExists(filePath)) {
        console.warn(`File ${file} not found, skipping`);
        continue;
      }

      const content = readFile(filePath);
      expect(content).not.toMatch(
        /designs\/ux-design/,
        `${file} should not reference designs/ux-design`
      );
      expect(content).not.toMatch(
        /designs\/product/,
        `${file} should not reference designs/product`
      );
      expect(content).not.toMatch(
        /designs\/architecture/,
        `${file} should not reference designs/architecture`
      );
    }
  });

  // ======== AC-8: No broken internal links ========
  test("AC-8: Cross-references in README files are valid", () => {
    const readmeFiles = [
      "architecture/README.md",
      "product/README.md",
      "ux/README.md",
    ];

    for (const readmeFile of readmeFiles) {
      const readmePath = path.join(REPO_ROOT, readmeFile);
      if (!fileExists(readmePath)) {
        console.warn(`README ${readmeFile} not found, skipping`);
        continue;
      }

      const content = readFile(readmePath);

      // Extract markdown links: [text](path)
      const linkMatches = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
      for (const match of linkMatches) {
        const linkPath = match[2];

        // Skip external URLs and anchors
        if (linkPath.startsWith("http") || linkPath.startsWith("#")) {
          continue;
        }

        // Resolve relative paths from the README's directory
        const readmeDir = path.dirname(readmePath);
        const resolvedPath = path.resolve(readmeDir, linkPath);
        const relativePath = path.relative(REPO_ROOT, resolvedPath);

        // Check if the referenced file/directory exists
        const pathExists = fileExists(resolvedPath) || dirExists(resolvedPath);
        if (!pathExists) {
          console.log(`[BROKEN LINK] ${readmeFile} → ${linkPath} (resolved: ${relativePath})`);
        }
        expect(pathExists).toBe(
          true,
          `${readmeFile} references ${linkPath}, but resolved path ${relativePath} does not exist`
        );
      }
    }
  });

  // ======== AC-9: Build and tsc pass ========
  test.skip("AC-9: tsc and build pass (run verify.sh separately)", () => {
    // This is verified via bash verify.sh, not in Playwright
    // Keeping placeholder for documentation of AC-9
  });
});
