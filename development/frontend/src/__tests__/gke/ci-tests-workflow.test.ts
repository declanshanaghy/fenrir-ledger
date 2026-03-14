/**
 * Vitest tests for .github/workflows/ci-tests.yml — Issue #734
 *
 * Validates the CI tests workflow that replaces the former Vercel preview-based
 * CI. Runs tsc, unit tests, and Playwright E2E against GKE prod
 * (https://fenrirledger.com) on every push to PR branches.
 *
 * @ref #734
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parse as parseYAML } from "yaml";

// ---------------------------------------------------------------------------
// Load workflow YAML
// ---------------------------------------------------------------------------

let workflowContent: string;
let workflowYAML: Record<string, unknown>;

beforeAll(() => {
  const repoRoot = path.resolve(__dirname, "../../../../..");
  const workflowPath = path.join(repoRoot, ".github/workflows/ci-tests.yml");

  if (!fs.existsSync(workflowPath)) {
    throw new Error(`Workflow file not found at ${workflowPath}`);
  }

  workflowContent = fs.readFileSync(workflowPath, "utf-8");
  workflowYAML = parseYAML(workflowContent) as Record<string, unknown>;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GitHub Actions Workflow: .github/workflows/ci-tests.yml", () => {
  describe("Basic structure", () => {
    it("is valid YAML", () => {
      expect(workflowYAML).toBeDefined();
      expect(typeof workflowYAML).toBe("object");
    });

    it("has the correct name", () => {
      expect(workflowYAML.name).toBe("CI Tests");
    });

    it("has on/trigger configuration", () => {
      expect(workflowYAML.on).toBeDefined();
    });

    it("has jobs defined", () => {
      expect(workflowYAML.jobs).toBeDefined();
      expect(typeof workflowYAML.jobs).toBe("object");
    });
  });

  describe("Trigger configuration", () => {
    it("triggers on push to non-main branches", () => {
      const on = workflowYAML.on as Record<string, unknown>;
      const push = on.push as Record<string, unknown>;
      expect(push).toBeDefined();
      const branchesIgnore = push["branches-ignore"] as string[];
      expect(branchesIgnore).toContain("main");
    });

    it("does NOT trigger on deployment_status (Vercel removed)", () => {
      const on = workflowYAML.on as Record<string, unknown>;
      expect(on.deployment_status).toBeUndefined();
    });

    it("supports workflow_dispatch for manual runs", () => {
      const on = workflowYAML.on as Record<string, unknown>;
      expect(on.workflow_dispatch).toBeDefined();
    });
  });

  describe("Concurrency", () => {
    it("uses per-branch concurrency group", () => {
      const concurrency = workflowYAML.concurrency as Record<string, unknown>;
      expect(concurrency).toBeDefined();
      expect(concurrency.group).toContain("github.ref");
    });

    it("cancels in-progress runs", () => {
      const concurrency = workflowYAML.concurrency as Record<string, unknown>;
      expect(concurrency["cancel-in-progress"]).toBe(true);
    });
  });

  describe("CI job", () => {
    const getJob = (): Record<string, unknown> => {
      const jobs = workflowYAML.jobs as Record<string, Record<string, unknown>>;
      return jobs.ci;
    };

    it("exists and is named correctly", () => {
      const job = getJob();
      expect(job).toBeDefined();
      expect(job.name).toContain("TypeScript");
      expect(job.name).toContain("E2E");
    });

    it("runs on ubuntu-latest", () => {
      expect(getJob()["runs-on"]).toBe("ubuntu-latest");
    });

    it("has pull-requests: write permission for PR comments", () => {
      const permissions = getJob().permissions as Record<string, string>;
      expect(permissions["pull-requests"]).toBe("write");
    });

    it("sets working directory to development/frontend", () => {
      const defaults = getJob().defaults as Record<string, Record<string, string>>;
      expect(defaults.run["working-directory"]).toBe("development/frontend");
    });

    it("checks out code", () => {
      const steps = getJob().steps as Array<Record<string, unknown>>;
      const checkoutStep = steps.find(
        (s) => typeof s.name === "string" && s.name.includes("Checkout")
      );
      expect(checkoutStep).toBeDefined();
      expect(checkoutStep!.uses).toContain("actions/checkout");
    });

    it("sets up Node.js 20", () => {
      const steps = getJob().steps as Array<Record<string, unknown>>;
      const nodeStep = steps.find(
        (s) => typeof s.name === "string" && s.name.includes("Node")
      );
      expect(nodeStep).toBeDefined();
      expect(nodeStep!.uses).toContain("actions/setup-node");
      const withBlock = nodeStep!.with as Record<string, unknown>;
      expect(withBlock["node-version"]).toBe("20");
    });

    it("installs dependencies with npm ci", () => {
      const steps = getJob().steps as Array<Record<string, unknown>>;
      const installStep = steps.find(
        (s) => typeof s.name === "string" && s.name.includes("Install dependencies")
      );
      expect(installStep).toBeDefined();
      expect(installStep!.run).toBe("npm ci");
    });

    it("runs TypeScript check with step id", () => {
      const steps = getJob().steps as Array<Record<string, unknown>>;
      const tscStep = steps.find(
        (s) => typeof s.name === "string" && s.name.includes("TypeScript")
      );
      expect(tscStep).toBeDefined();
      expect(tscStep!.id).toBe("tsc");
      expect(tscStep!.run).toContain("tsc --noEmit");
    });

    it("runs unit tests with step id", () => {
      const steps = getJob().steps as Array<Record<string, unknown>>;
      const unitStep = steps.find(
        (s) => typeof s.name === "string" && s.name.includes("unit tests")
      );
      expect(unitStep).toBeDefined();
      expect(unitStep!.id).toBe("unit");
      expect(unitStep!.run).toContain("test:unit");
    });

    it("installs Playwright browsers (chromium only)", () => {
      const steps = getJob().steps as Array<Record<string, unknown>>;
      const installStep = steps.find(
        (s) => typeof s.name === "string" && s.name.includes("Playwright browsers")
      );
      expect(installStep).toBeDefined();
      expect(installStep!.run).toContain("playwright install");
      expect(installStep!.run).toContain("chromium");
    });

    it("runs Playwright E2E with SERVER_URL set to GKE prod", () => {
      const steps = getJob().steps as Array<Record<string, unknown>>;
      const e2eStep = steps.find(
        (s) => typeof s.name === "string" && s.name.includes("Playwright E2E")
      );
      expect(e2eStep).toBeDefined();
      expect(e2eStep!.id).toBe("e2e");
      const env = e2eStep!.env as Record<string, string>;
      expect(env.SERVER_URL).toBe("https://fenrirledger.com");
    });

    it("uploads Playwright report as artifact", () => {
      const steps = getJob().steps as Array<Record<string, unknown>>;
      const uploadStep = steps.find(
        (s) => typeof s.name === "string" && s.name.includes("Upload Playwright")
      );
      expect(uploadStep).toBeDefined();
      expect(uploadStep!.if).toContain("always()");
      expect(uploadStep!.uses).toContain("actions/upload-artifact");
    });

    it("upserts PR comment with CI results", () => {
      const steps = getJob().steps as Array<Record<string, unknown>>;
      const commentStep = steps.find(
        (s) => typeof s.name === "string" && s.name.includes("PR comment")
      );
      expect(commentStep).toBeDefined();
      expect(commentStep!.uses).toContain("actions/github-script");
    });
  });

  describe("No Vercel references", () => {
    it("does not reference VERCEL_BYPASS_SECRET", () => {
      expect(workflowContent).not.toContain("VERCEL_BYPASS_SECRET");
    });

    it("does not reference VERCEL_AUTOMATION_BYPASS_SECRET", () => {
      expect(workflowContent).not.toContain("VERCEL_AUTOMATION_BYPASS_SECRET");
    });

    it("does not reference deployment_status trigger", () => {
      expect(workflowContent).not.toContain("deployment_status");
    });

    it("does not reference Vercel preview URL", () => {
      expect(workflowContent.toLowerCase()).not.toContain("vercel preview");
    });
  });

  describe("GKE prod target", () => {
    it("uses https://fenrirledger.com as SERVER_URL", () => {
      expect(workflowContent).toContain("https://fenrirledger.com");
    });

    it("references CI Results in PR comment (not Vercel Preview)", () => {
      expect(workflowContent).toContain("CI Results");
    });
  });
});
