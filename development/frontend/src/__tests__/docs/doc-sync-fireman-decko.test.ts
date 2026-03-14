/**
 * Vitest tests for Issue #701 — Doc sync: FiremanDecko (Principal Engineer)
 *
 * Validates that:
 * 1. No stale Vercel/Depot references remain in infrastructure/ or development/ markdown
 * 2. development/README.md indexes all markdown docs and QA handoffs
 * 3. infrastructure/ markdown files reference GKE (not Vercel/Depot)
 *
 * @ref #701
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as glob from "fast-glob";

// ---------------------------------------------------------------------------
// Load files
// ---------------------------------------------------------------------------

const repoRoot = path.resolve(__dirname, "../../../../..");

let devReadme: string;
let infraSmokeTest: string;
let infraAgentsReadme: string;
let infraRunbook: string;
let implPlan: string;
let securityReview: string;
let heimdallReview: string;

beforeAll(() => {
  devReadme = fs.readFileSync(
    path.join(repoRoot, "development/README.md"),
    "utf-8"
  );
  infraSmokeTest = fs.readFileSync(
    path.join(repoRoot, "infrastructure/SMOKE-TEST.md"),
    "utf-8"
  );
  infraAgentsReadme = fs.readFileSync(
    path.join(repoRoot, "infrastructure/k8s/agents/README.md"),
    "utf-8"
  );
  infraRunbook = fs.readFileSync(
    path.join(repoRoot, "infrastructure/k8s/app/RUNBOOK.md"),
    "utf-8"
  );
  implPlan = fs.readFileSync(
    path.join(repoRoot, "development/implementation-plan.md"),
    "utf-8"
  );
  securityReview = fs.readFileSync(
    path.join(repoRoot, "development/security-review-report.md"),
    "utf-8"
  );
  heimdallReview = fs.readFileSync(
    path.join(repoRoot, "development/heimdall-static-review.md"),
    "utf-8"
  );
});

// ---------------------------------------------------------------------------
// Infrastructure docs — must reference GKE, not Vercel/Depot
// ---------------------------------------------------------------------------

describe("infrastructure/ markdown — no stale Vercel/Depot references", () => {
  it("SMOKE-TEST.md references GKE", () => {
    expect(infraSmokeTest).toContain("GKE");
    expect(infraSmokeTest).not.toMatch(/\bVercel\b/i);
    expect(infraSmokeTest).not.toMatch(/\bDepot\b/i);
  });

  it("agents/README.md references GKE Autopilot", () => {
    expect(infraAgentsReadme).toContain("GKE Autopilot");
    expect(infraAgentsReadme).not.toMatch(/\bVercel\b/i);
    expect(infraAgentsReadme).not.toMatch(/\bDepot\b/i);
  });

  it("app/RUNBOOK.md references GKE", () => {
    expect(infraRunbook).toContain("GKE");
    expect(infraRunbook).not.toMatch(/\bVercel\b/i);
    expect(infraRunbook).not.toMatch(/\bDepot\b/i);
  });
});

// ---------------------------------------------------------------------------
// Development docs — stale Vercel references removed
// ---------------------------------------------------------------------------

describe("development/ markdown — stale Vercel references removed", () => {
  it("implementation-plan.md has no 'Vercel preview deployment' references", () => {
    expect(implPlan).not.toContain("Vercel preview deployment");
    expect(implPlan).not.toContain("Preview Vercel deployments");
  });

  it("security-review-report.md references GKE, not Vercel function cost", () => {
    expect(securityReview).not.toContain("Vercel function cost");
    expect(securityReview).toContain("GKE pod resource exhaustion");
  });

  it("heimdall-static-review.md references GKE, not Vercel", () => {
    expect(heimdallReview).not.toContain("Vercel function cost");
    expect(heimdallReview).not.toContain("Vercel KV");
    expect(heimdallReview).toContain("GKE pod resource exhaustion");
  });
});

// ---------------------------------------------------------------------------
// development/README.md — indexes all docs
// ---------------------------------------------------------------------------

describe("development/README.md — complete doc index", () => {
  const expectedDocLinks = [
    "docs/setup-guide.md",
    "implementation-plan.md",
    "security-review-report.md",
    "heimdall-static-review.md",
    "browser-traffic-report.md",
  ];

  const expectedQaLinks = [
    "qa-handoff.md",
    "qa-handoff-statusline.md",
    "qa-handoff-splash.md",
    "qa-handoff-palette.md",
    "frontend/qa-handoff.md",
    "frontend/QA-SPRINT-5.md",
    "frontend/LOKI-TEST-PLAN-anon-auth.md",
  ];

  it.each(expectedDocLinks)("indexes %s", (docLink) => {
    expect(devReadme).toContain(docLink);
  });

  it.each(expectedQaLinks)("indexes QA handoff: %s", (qaLink) => {
    expect(devReadme).toContain(qaLink);
  });

  it("references GKE Autopilot in source code section", () => {
    expect(devReadme).toContain("GKE Autopilot");
  });
});
