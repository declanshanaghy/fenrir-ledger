/**
 * Vitest tests for GitHub Actions CI/CD workflow — Issue #680
 *
 * These tests verify that the GKE deployment workflow is properly configured for:
 * 1. Triggering on changes to app code and K8s manifests
 * 2. Building and pushing Docker images to Google Artifact Registry
 * 3. Deploying with proper secret injection from GitHub Secrets
 * 4. Rolling deployments with health checks
 *
 * @ref #680
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { load } from "js-yaml";

interface GitHubWorkflow {
  name?: string;
  on?: Record<string, unknown>;
  env?: Record<string, unknown>;
  jobs?: Record<string, unknown>;
}

describe("GitHub Actions Workflow — GKE Deployment", () => {
  let workflow: GitHubWorkflow;

  beforeAll(() => {
    const workflowPath = resolve(
      process.cwd(),
      "infrastructure/github-workflow-deploy-gke.yml"
    );
    workflow = load(readFileSync(workflowPath, "utf-8")) as GitHubWorkflow;
  });

  describe("Workflow metadata", () => {
    it("has name: 'Deploy to GKE'", () => {
      expect(workflow.name).toBe("Deploy to GKE");
    });

    it("triggers on push to main branch", () => {
      const trigger = workflow.on as Record<string, unknown>;
      const push = trigger.push as Record<string, unknown>;
      const branches = push.branches as string[];
      expect(branches).toContain("main");
    });

    it("triggers on app source code changes", () => {
      const trigger = workflow.on as Record<string, unknown>;
      const push = trigger.push as Record<string, unknown>;
      const paths = push.paths as string[];
      expect(paths).toContain("development/frontend/**");
    });

    it("triggers on Dockerfile changes", () => {
      const trigger = workflow.on as Record<string, unknown>;
      const push = trigger.push as Record<string, unknown>;
      const paths = push.paths as string[];
      expect(paths).toContain("Dockerfile");
    });

    it("triggers on K8s manifest changes", () => {
      const trigger = workflow.on as Record<string, unknown>;
      const push = trigger.push as Record<string, unknown>;
      const paths = push.paths as string[];
      expect(paths).toContain("infrastructure/k8s/app/**");
    });

    it("supports workflow_dispatch for manual deployments", () => {
      const trigger = workflow.on as Record<string, unknown>;
      expect(trigger.workflow_dispatch).toBeDefined();
    });

    it("accepts custom image tag input", () => {
      const dispatch = workflow.on?.workflow_dispatch as Record<
        string,
        Record<string, unknown>
      >;
      const inputs = dispatch?.inputs as Record<string, unknown>;
      const imageTag = inputs?.image_tag as Record<string, string>;
      expect(imageTag.description).toContain("Custom image tag");
    });
  });

  describe("Environment variables", () => {
    const env = workflow.env as Record<string, string>;

    it("defines REGISTRY from GCP_REGION and GCP_PROJECT_ID", () => {
      expect(env.REGISTRY).toContain("docker.pkg.dev");
      expect(env.REGISTRY).toContain("${{ secrets.GCP_REGION }}");
      expect(env.REGISTRY).toContain("${{ secrets.GCP_PROJECT_ID }}");
    });

    it("defines IMAGE_NAME=fenrir-app", () => {
      expect(env.IMAGE_NAME).toBe("fenrir-app");
    });

    it("defaults IMAGE_TAG to github.sha (git commit hash)", () => {
      expect(env.IMAGE_TAG).toContain("${{ inputs.image_tag || github.sha }}");
    });
  });

  describe("Build and push job", () => {
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>;
    const buildJob = jobs["build-and-push"] as Record<string, unknown>;

    it("has 'build-and-push' job", () => {
      expect(buildJob).toBeDefined();
    });

    it("runs on ubuntu-latest", () => {
      expect(buildJob["runs-on"]).toBe("ubuntu-latest");
    });

    it("requests read:contents and write:id-token permissions", () => {
      const permissions = buildJob.permissions as Record<string, string>;
      expect(permissions.contents).toBe("read");
      expect(permissions["id-token"]).toBe("write");
    });

    it("outputs image_digest and full_image for downstream jobs", () => {
      const outputs = buildJob.outputs as Record<string, string>;
      expect(outputs).toBeDefined();
      expect(outputs.image_digest).toContain("${{ steps.build.outputs.digest }}");
      expect(outputs.full_image).toContain("fenrir-app");
    });

    it("checks out code", () => {
      const steps = buildJob.steps as Array<Record<string, unknown>>;
      const checkout = steps.find((s) => s.name === "Checkout code");
      expect(checkout).toBeDefined();
    });

    it("authenticates to Google Cloud with service account key", () => {
      const steps = buildJob.steps as Array<Record<string, unknown>>;
      const auth = steps.find((s) =>
        (s.name as string).includes("Authenticate to Google Cloud")
      );
      expect(auth).toBeDefined();
      const uses = auth?.uses as string;
      expect(uses).toContain("google-github-actions/auth");
    });

    it("configures Docker for Artifact Registry", () => {
      const steps = buildJob.steps as Array<Record<string, unknown>>;
      const configure = steps.find((s) =>
        (s.name as string).includes("Configure Docker")
      );
      expect(configure).toBeDefined();
    });

    it("builds and pushes Docker image with docker/build-push-action", () => {
      const steps = buildJob.steps as Array<Record<string, unknown>>;
      const build = steps.find(
        (s) => (s.name as string).includes("Build and push app image")
      );
      expect(build?.uses).toContain("docker/build-push-action");
    });

    it("tags image with both tag and 'latest'", () => {
      const steps = buildJob.steps as Array<Record<string, unknown>>;
      const build = steps.find(
        (s) => (s.name as string).includes("Build and push app image")
      );
      const tags = build?.with?.tags as string;
      expect(tags).toContain("${REGISTRY}");
      expect(tags).toContain("latest");
    });

    it("passes NEXT_PUBLIC_BUILD_ID and NEXT_PUBLIC_APP_VERSION as build args", () => {
      const steps = buildJob.steps as Array<Record<string, unknown>>;
      const build = steps.find(
        (s) => (s.name as string).includes("Build and push app image")
      );
      const buildArgs = build?.with?.["build-args"] as string;
      expect(buildArgs).toContain("NEXT_PUBLIC_BUILD_ID");
      expect(buildArgs).toContain("NEXT_PUBLIC_APP_VERSION");
    });

    it("uses GitHub Actions cache for Docker layers", () => {
      const steps = buildJob.steps as Array<Record<string, unknown>>;
      const build = steps.find(
        (s) => (s.name as string).includes("Build and push app image")
      );
      expect(build?.with?.["cache-from"]).toContain("type=gha");
      expect(build?.with?.["cache-to"]).toContain("type=gha");
    });
  });

  describe("Deploy job", () => {
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>;
    const deployJob = jobs.deploy as Record<string, unknown>;

    it("has 'deploy' job dependent on 'build-and-push'", () => {
      expect(deployJob).toBeDefined();
      expect(deployJob.needs).toBe("build-and-push");
    });

    it("only runs if skip_deploy is not set", () => {
      expect(deployJob.if).toContain("!inputs.skip_deploy");
    });

    it("authenticates to Google Cloud", () => {
      const steps = deployJob.steps as Array<Record<string, unknown>>;
      const auth = steps.find((s) =>
        (s.name as string).includes("Authenticate to Google Cloud")
      );
      expect(auth).toBeDefined();
    });

    it("gets GKE cluster credentials", () => {
      const steps = deployJob.steps as Array<Record<string, unknown>>;
      const getCredentials = steps.find((s) =>
        (s.name as string).includes("Get GKE credentials")
      );
      expect(getCredentials).toBeDefined();
      expect(getCredentials?.uses).toContain("google-github-actions/get-gke-credentials");
    });

    it("creates/updates K8s secrets with all required env vars", () => {
      const steps = deployJob.steps as Array<Record<string, unknown>>;
      const createSecrets = steps.find((s) =>
        (s.name as string).includes("Create/update K8s secrets")
      );
      expect(createSecrets).toBeDefined();
      const run = createSecrets?.run as string;
      expect(run).toContain("kubectl create secret generic fenrir-app-secrets");
      expect(run).toContain("NEXT_PUBLIC_GOOGLE_CLIENT_ID");
      expect(run).toContain("GOOGLE_CLIENT_SECRET");
      expect(run).toContain("STRIPE_SECRET_KEY");
      expect(run).toContain("FENRIR_ANTHROPIC_API_KEY");
    });

    it("applies K8s manifests (deployment, service, ingress)", () => {
      const steps = deployJob.steps as Array<Record<string, unknown>>;
      const apply = steps.find((s) =>
        (s.name as string).includes("Apply K8s manifests")
      );
      expect(apply).toBeDefined();
      const run = apply?.run as string;
      expect(run).toContain("infrastructure/k8s/app/deployment.yaml");
      expect(run).toContain("infrastructure/k8s/app/service.yaml");
      expect(run).toContain("infrastructure/k8s/app/ingress.yaml");
    });

    it("updates deployment image to newly built image", () => {
      const steps = deployJob.steps as Array<Record<string, unknown>>;
      const updateImage = steps.find((s) =>
        (s.name as string).includes("Update deployment image")
      );
      expect(updateImage).toBeDefined();
      const run = updateImage?.run as string;
      expect(run).toContain("kubectl set image deployment/fenrir-app");
    });

    it("waits for rollout to complete (300s timeout)", () => {
      const steps = deployJob.steps as Array<Record<string, unknown>>;
      const rollout = steps.find((s) =>
        (s.name as string).includes("Wait for rollout")
      );
      expect(rollout).toBeDefined();
      const run = rollout?.run as string;
      expect(run).toContain("kubectl rollout status");
      expect(run).toContain("--timeout=300s");
    });

    it("performs post-deploy health check", () => {
      const steps = deployJob.steps as Array<Record<string, unknown>>;
      const healthCheck = steps.find((s) =>
        (s.name as string).includes("Post-deploy health check")
      );
      expect(healthCheck).toBeDefined();
      const run = healthCheck?.run as string;
      expect(run).toContain("/api/health");
    });
  });

  describe("Secrets (required from GitHub)", () => {
    const steps = (
      (workflow.jobs as Record<string, Record<string, unknown>>).deploy.steps as Array<Record<string, unknown>>
    );
    const secretsStep = steps.find((s) =>
      (s.name as string).includes("Create/update K8s secrets")
    );
    const secretsRun = secretsStep?.run as string;

    const requiredSecrets = [
      "GCP_PROJECT_ID",
      "GCP_SA_KEY",
      "GCP_REGION",
      "GCP_ZONE",
      "GKE_CLUSTER_NAME",
      "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_PICKER_API_KEY",
      "FENRIR_ANTHROPIC_API_KEY",
      "ENTITLEMENT_ENCRYPTION_KEY",
      "STRIPE_SECRET_KEY",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_ID",
      "KV_REST_API_URL",
      "KV_REST_API_TOKEN",
    ];

    requiredSecrets.forEach((secret) => {
      it(`references GitHub secret: ${secret}`, () => {
        expect(secretsRun).toContain(`${{ secrets.${secret} }}`);
      });
    });
  });
});
