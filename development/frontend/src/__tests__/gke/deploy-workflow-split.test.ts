/**
 * Vitest unit tests for split Deploy to GKE workflow — Issue #923
 *
 * Validates the deploy.yml workflow structure against acceptance criteria:
 * - Each service has its own independent job
 * - Jobs depend only on their own build/infra step
 * - verify-deployment runs after all deploy jobs with `always()`
 * - GitHub Actions summary shows per-service deploy status
 *
 * @ref #923
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";

const REPO_ROOT = join(__dirname, "../../../../..");
const WORKFLOW_PATH = join(REPO_ROOT, ".github/workflows/deploy.yml");

interface WorkflowJob {
  name: string;
  needs?: string | string[];
  if?: string;
  steps?: Array<{ name?: string; uses?: string; run?: string }>;
}

interface Workflow {
  jobs: Record<string, WorkflowJob>;
}

let workflow: Workflow;

beforeAll(() => {
  const raw = readFileSync(WORKFLOW_PATH, "utf8");
  workflow = parse(raw) as Workflow;
});

const SERVICE_JOBS = [
  "deploy-fenrir-app",
  "deploy-odin-throne",
  "deploy-umami",
  "deploy-redis",
] as const;

describe("Deploy workflow — split per-service jobs (Issue #923)", () => {
  describe("AC1: Each service has its own GHA job", () => {
    it.each(SERVICE_JOBS)("job %s exists", (jobName) => {
      expect(workflow.jobs).toHaveProperty(jobName);
    });

    it("monolithic deploy job no longer exists", () => {
      expect(workflow.jobs).not.toHaveProperty("deploy");
    });

    it("verify-deployment job exists", () => {
      expect(workflow.jobs).toHaveProperty("verify-deployment");
    });
  });

  describe("AC2 & AC3: Job dependency isolation", () => {
    it("deploy-fenrir-app depends only on build-and-push", () => {
      const needs = workflow.jobs["deploy-fenrir-app"].needs;
      const needsArr = Array.isArray(needs) ? needs : [needs];
      expect(needsArr).toEqual(["build-and-push"]);
    });

    it("deploy-odin-throne depends only on build-and-push-monitor", () => {
      const needs = workflow.jobs["deploy-odin-throne"].needs;
      const needsArr = Array.isArray(needs) ? needs : [needs];
      expect(needsArr).toEqual(["build-and-push-monitor"]);
    });

    it("deploy-umami depends only on terraform", () => {
      const needs = workflow.jobs["deploy-umami"].needs;
      const needsArr = Array.isArray(needs) ? needs : [needs];
      expect(needsArr).toEqual(["terraform"]);
    });

    it("deploy-redis depends only on terraform", () => {
      const needs = workflow.jobs["deploy-redis"].needs;
      const needsArr = Array.isArray(needs) ? needs : [needs];
      expect(needsArr).toEqual(["terraform"]);
    });

    it("deploy-fenrir-app does not depend on terraform", () => {
      const needs = workflow.jobs["deploy-fenrir-app"].needs;
      const needsArr = Array.isArray(needs) ? needs : [needs ?? ""];
      expect(needsArr).not.toContain("terraform");
    });

    it("deploy-odin-throne does not depend on terraform", () => {
      const needs = workflow.jobs["deploy-odin-throne"].needs;
      const needsArr = Array.isArray(needs) ? needs : [needs ?? ""];
      expect(needsArr).not.toContain("terraform");
    });
  });

  describe("AC4: A failed service does not block others", () => {
    it("verify-deployment uses if: always() so it runs even if a deploy fails", () => {
      const condition = workflow.jobs["verify-deployment"].if ?? "";
      expect(condition).toContain("always()");
    });

    it("deploy-umami and deploy-redis allow terraform skipped result", () => {
      const umamiIf = workflow.jobs["deploy-umami"].if ?? "";
      const redisIf = workflow.jobs["deploy-redis"].if ?? "";
      expect(umamiIf).toContain("skipped");
      expect(redisIf).toContain("skipped");
    });
  });

  describe("AC5: verify-deployment runs after all four deploys", () => {
    it("verify-deployment needs all four service jobs", () => {
      const needs = workflow.jobs["verify-deployment"].needs;
      const needsArr = Array.isArray(needs) ? needs : [needs ?? ""];
      expect(needsArr).toContain("deploy-fenrir-app");
      expect(needsArr).toContain("deploy-odin-throne");
      expect(needsArr).toContain("deploy-umami");
      expect(needsArr).toContain("deploy-redis");
    });

    it("verify-deployment has a health check step", () => {
      const steps = workflow.jobs["verify-deployment"].steps ?? [];
      const hasHealthCheck = steps.some(
        (s) => s.name?.toLowerCase().includes("health") || s.run?.includes("/api/health")
      );
      expect(hasHealthCheck).toBe(true);
    });
  });

  describe("AC6: GitHub Actions summary shows per-service status", () => {
    it("verify-deployment summary step includes all four service names", () => {
      const steps = workflow.jobs["verify-deployment"].steps ?? [];
      const summaryStep = steps.find((s) =>
        s.run?.includes("GITHUB_STEP_SUMMARY")
      );
      expect(summaryStep).toBeDefined();
      const run = summaryStep?.run ?? "";
      expect(run).toContain("fenrir-app");
      expect(run).toContain("redis");
      expect(run).toContain("umami");
      expect(run).toContain("odin-throne");
    });

    it("summary step references per-service job result expressions", () => {
      const steps = workflow.jobs["verify-deployment"].steps ?? [];
      const summaryStep = steps.find((s) =>
        s.run?.includes("GITHUB_STEP_SUMMARY")
      );
      const run = summaryStep?.run ?? "";
      expect(run).toContain("deploy-fenrir-app.result");
      expect(run).toContain("deploy-redis.result");
      expect(run).toContain("deploy-umami.result");
      expect(run).toContain("deploy-odin-throne.result");
    });
  });

  describe("GKE auth per-job (each deploy job is self-contained)", () => {
    it.each(SERVICE_JOBS)(
      "job %s has its own GKE credentials step",
      (jobName) => {
        const steps = workflow.jobs[jobName].steps ?? [];
        const hasGkeCredentials = steps.some((s) =>
          s.uses?.startsWith("google-github-actions/get-gke-credentials")
        );
        expect(hasGkeCredentials).toBe(true);
      }
    );

    it.each(SERVICE_JOBS)(
      "job %s has its own GCP auth step",
      (jobName) => {
        const steps = workflow.jobs[jobName].steps ?? [];
        const hasAuth = steps.some((s) =>
          s.uses?.startsWith("google-github-actions/auth")
        );
        expect(hasAuth).toBe(true);
      }
    );
  });
});
