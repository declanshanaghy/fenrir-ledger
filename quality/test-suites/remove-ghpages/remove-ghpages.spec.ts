/**
 * GitHub Pages Removal Test Suite — Fenrir Ledger Issue #215
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates GitHub Issue #215: Remove GitHub Pages deployment; trigger Vercel
 * production deploy on sessions changes.
 *
 * Requirements:
 *   1. .github/workflows/pages.yml must NOT exist (GitHub Pages workflow removed)
 *   2. .github/workflows/vercel-production.yml must exist
 *   3. vercel-production.yml must include 'sessions/**' in its paths trigger
 *
 * Data isolation: These are file-system tests. No seed/clear needed.
 */

import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

// Resolve repo root (assumes test runs from development/frontend)
const REPO_ROOT = path.resolve(__dirname, "../../..");

test.describe("Issue #215: Remove GitHub Pages, add Vercel sessions trigger", () => {
  test("pages.yml workflow does NOT exist", () => {
    const pagesWorkflowPath = path.join(REPO_ROOT, ".github/workflows/pages.yml");
    const exists = fs.existsSync(pagesWorkflowPath);
    expect(exists).toBe(false);
  });

  test("vercel-production.yml workflow exists", () => {
    const vercelWorkflowPath = path.join(
      REPO_ROOT,
      ".github/workflows/vercel-production.yml"
    );
    const exists = fs.existsSync(vercelWorkflowPath);
    expect(exists).toBe(true);
  });

  test("vercel-production.yml includes sessions/** in paths trigger", () => {
    const vercelWorkflowPath = path.join(
      REPO_ROOT,
      ".github/workflows/vercel-production.yml"
    );
    const content = fs.readFileSync(vercelWorkflowPath, "utf-8");

    // Check that sessions/** is in the paths trigger
    expect(content).toContain("sessions/**");

    // Verify it's in a proper YAML paths context (on: push: paths:)
    const pathsSection = content.match(/paths:[\s\S]*?-\s*'([^']+)'/g);
    expect(pathsSection).toBeTruthy();

    const hasSessionsPath = content.match(
      /paths:[\s\S]*?-\s*['"]?sessions\/\*\*['"]?/
    );
    expect(hasSessionsPath).toBeTruthy();
  });

  test("vercel-production.yml includes development/frontend/** in paths trigger", () => {
    const vercelWorkflowPath = path.join(
      REPO_ROOT,
      ".github/workflows/vercel-production.yml"
    );
    const content = fs.readFileSync(vercelWorkflowPath, "utf-8");

    // Verify development/frontend/** path is still present
    const hasFrontendPath = content.match(
      /paths:[\s\S]*?-\s*['"]?development\/frontend\/\*\*['"]?/
    );
    expect(hasFrontendPath).toBeTruthy();
  });

  test("vercel-production.yml workflow has valid YAML structure", () => {
    const vercelWorkflowPath = path.join(
      REPO_ROOT,
      ".github/workflows/vercel-production.yml"
    );
    const content = fs.readFileSync(vercelWorkflowPath, "utf-8");

    // Check for critical workflow keys
    expect(content).toContain("name:");
    expect(content).toContain("on:");
    expect(content).toContain("push:");
    expect(content).toContain("branches:");
    expect(content).toContain("paths:");
    expect(content).toContain("jobs:");
    expect(content).toContain("runs-on:");
    expect(content).toContain("steps:");
  });
});
