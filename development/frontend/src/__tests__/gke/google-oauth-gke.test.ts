/**
 * Vitest tests for Issue #744 — Google OAuth client ID in GKE build
 *
 * Validates that:
 * 1. Dockerfile declares NEXT_PUBLIC_GOOGLE_CLIENT_ID as ARG + ENV in build stage
 * 2. deploy.yml passes NEXT_PUBLIC_GOOGLE_CLIENT_ID as a Docker build-arg
 * 3. layout.tsx does NOT import @vercel/analytics
 * 4. package.json does NOT list @vercel/analytics
 *
 * @ref #744
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parse as parseYAML } from "yaml";

// ---------------------------------------------------------------------------
// Load files
// ---------------------------------------------------------------------------

let dockerfileContent: string;
let workflowContent: string;
let workflowYAML: Record<string, any>;
let layoutContent: string;
let packageJSON: Record<string, any>;

beforeAll(() => {
  const repoRoot = path.resolve(__dirname, "../../../../..");

  dockerfileContent = fs.readFileSync(
    path.join(repoRoot, "Dockerfile"),
    "utf-8"
  );

  const workflowPath = path.join(repoRoot, ".github/workflows/deploy.yml");
  workflowContent = fs.readFileSync(workflowPath, "utf-8");
  workflowYAML = parseYAML(workflowContent);

  layoutContent = fs.readFileSync(
    path.join(
      repoRoot,
      "development/frontend/src/app/layout.tsx"
    ),
    "utf-8"
  );

  packageJSON = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, "development/frontend/package.json"),
      "utf-8"
    )
  );
});

// ---------------------------------------------------------------------------
// Dockerfile
// ---------------------------------------------------------------------------

describe("Dockerfile — NEXT_PUBLIC_GOOGLE_CLIENT_ID (issue #744)", () => {
  it("declares NEXT_PUBLIC_GOOGLE_CLIENT_ID as a build ARG", () => {
    expect(dockerfileContent).toMatch(/^ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID/m);
  });

  it("sets NEXT_PUBLIC_GOOGLE_CLIENT_ID as an ENV from the ARG", () => {
    expect(dockerfileContent).toMatch(
      /^ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=\$\{NEXT_PUBLIC_GOOGLE_CLIENT_ID\}/m
    );
  });

  it("places the ARG in the builder stage (after FROM ... AS builder)", () => {
    const builderIdx = dockerfileContent.indexOf("AS builder");
    const runnerIdx = dockerfileContent.indexOf("AS runner");
    const argIdx = dockerfileContent.indexOf(
      "ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID"
    );
    expect(argIdx).toBeGreaterThan(builderIdx);
    expect(argIdx).toBeLessThan(runnerIdx);
  });
});

// ---------------------------------------------------------------------------
// deploy.yml
// ---------------------------------------------------------------------------

describe("deploy.yml — NEXT_PUBLIC_GOOGLE_CLIENT_ID build-arg (issue #744)", () => {
  it("passes NEXT_PUBLIC_GOOGLE_CLIENT_ID in build-args", () => {
    const buildJob = workflowYAML.jobs["build-and-push"];
    const buildStep = buildJob.steps.find(
      (s: any) => s.name?.includes("Build and push")
    );
    expect(buildStep.with["build-args"]).toContain(
      "NEXT_PUBLIC_GOOGLE_CLIENT_ID"
    );
  });

  it("sources NEXT_PUBLIC_GOOGLE_CLIENT_ID from secrets", () => {
    const buildJob = workflowYAML.jobs["build-and-push"];
    const buildStep = buildJob.steps.find(
      (s: any) => s.name?.includes("Build and push")
    );
    expect(buildStep.with["build-args"]).toContain(
      "secrets.NEXT_PUBLIC_GOOGLE_CLIENT_ID"
    );
  });

  it("also injects NEXT_PUBLIC_GOOGLE_CLIENT_ID via K8s secrets for runtime", () => {
    const deployJob = workflowYAML.jobs.deploy;
    const secretStep = deployJob.steps.find(
      (s: any) => s.name?.includes("K8s secrets")
    );
    expect(secretStep.run).toContain("NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  });
});

// ---------------------------------------------------------------------------
// layout.tsx — no Vercel analytics
// ---------------------------------------------------------------------------

describe("layout.tsx — Vercel analytics removed (issue #744)", () => {
  it("does not import @vercel/analytics", () => {
    expect(layoutContent).not.toContain("@vercel/analytics");
  });

  it("does not render <Analytics />", () => {
    expect(layoutContent).not.toMatch(/<Analytics\s*\/>/);
  });
});

// ---------------------------------------------------------------------------
// package.json — no Vercel analytics
// ---------------------------------------------------------------------------

describe("package.json — @vercel/analytics removed (issue #744)", () => {
  it("does not list @vercel/analytics in dependencies", () => {
    expect(packageJSON.dependencies).not.toHaveProperty("@vercel/analytics");
  });

  it("does not list @vercel/analytics in devDependencies", () => {
    expect(packageJSON.devDependencies).not.toHaveProperty(
      "@vercel/analytics"
    );
  });
});
