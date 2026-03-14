/**
 * Vitest tests for .github/workflows/deploy.yml — Issue #694
 *
 * Validates the unified CI/CD workflow that runs on every push to main:
 * 1. Terraform plan + apply (GCS backend)
 * 2. Docker build + push to Artifact Registry
 * 3. Rolling deployment to GKE Autopilot
 * 4. Post-deploy health check
 *
 * @ref #694
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parse as parseYAML } from "yaml";

// ---------------------------------------------------------------------------
// Load workflow YAML
// ---------------------------------------------------------------------------

let workflowContent: string;
let workflowYAML: Record<string, any>;

beforeAll(() => {
  // Load from repo root — resolve relative to __dirname
  // __dirname = .../development/frontend/src/__tests__/gke
  // Need to go up 5 levels to repo root, then .github/workflows/
  const repoRoot = path.resolve(__dirname, "../../../../..");
  const workflowPath = path.join(
    repoRoot,
    ".github/workflows/deploy.yml"
  );

  if (!fs.existsSync(workflowPath)) {
    // Fallback: try common paths
    const altPath = path.resolve("/Users/declanshanaghy/src/github.com/declanshanaghy/fenrir-ledger/.github/workflows/deploy.yml");
    if (fs.existsSync(altPath)) {
      workflowContent = fs.readFileSync(altPath, "utf-8");
      workflowYAML = parseYAML(workflowContent);
      return;
    }
    throw new Error(`Workflow file not found at ${workflowPath} or fallback paths`);
  }

  workflowContent = fs.readFileSync(workflowPath, "utf-8");
  workflowYAML = parseYAML(workflowContent);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GitHub Actions Workflow: .github/workflows/deploy.yml", () => {
  describe("Basic structure", () => {
    it("is valid YAML", () => {
      expect(workflowYAML).toBeDefined();
      expect(typeof workflowYAML).toBe("object");
    });

    it("has a name", () => {
      expect(workflowYAML.name).toBeDefined();
      expect(workflowYAML.name).toBe("Deploy to GKE");
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
    it("triggers on push to main branch only", () => {
      const push = workflowYAML.on.push;
      expect(push).toBeDefined();
      expect(push.branches).toContain("main");
      expect(push.branches.length).toBe(1);
    });

    it("supports workflow_dispatch for manual runs", () => {
      const dispatch = workflowYAML.on.workflow_dispatch;
      expect(dispatch).toBeDefined();
      expect(dispatch.inputs).toBeDefined();
    });

    it("has optional input for custom image tag", () => {
      const inputs = workflowYAML.on.workflow_dispatch.inputs;
      expect(inputs.image_tag).toBeDefined();
      expect(inputs.image_tag.description).toContain("image tag");
      expect(inputs.image_tag.required).toBe(false);
    });

    it("has optional input to skip deployment", () => {
      const inputs = workflowYAML.on.workflow_dispatch.inputs;
      expect(inputs.skip_deploy).toBeDefined();
      expect(inputs.skip_deploy.type).toBe("boolean");
    });

    it("has optional input to skip terraform", () => {
      const inputs = workflowYAML.on.workflow_dispatch.inputs;
      expect(inputs.skip_terraform).toBeDefined();
      expect(inputs.skip_terraform.type).toBe("boolean");
    });
  });

  describe("Environment variables", () => {
    it("defines REGISTRY from GCP secrets", () => {
      const env = workflowYAML.env;
      expect(env.REGISTRY).toBeDefined();
      expect(env.REGISTRY).toContain("${{ secrets.GCP_REGION }}");
      expect(env.REGISTRY).toContain("${{ secrets.GCP_PROJECT_ID }}");
      expect(env.REGISTRY).toContain("fenrir-images");
    });

    it("defines IMAGE_NAME", () => {
      const env = workflowYAML.env;
      expect(env.IMAGE_NAME).toBe("fenrir-app");
    });

    it("defines IMAGE_TAG with fallback to git SHA", () => {
      const env = workflowYAML.env;
      expect(env.IMAGE_TAG).toBeDefined();
      expect(env.IMAGE_TAG).toContain("${{ inputs.image_tag");
      expect(env.IMAGE_TAG).toContain("github.sha");
    });
  });

  describe("Terraform job", () => {
    it("exists and is named correctly", () => {
      const job = workflowYAML.jobs.terraform;
      expect(job).toBeDefined();
      expect(job.name).toContain("Terraform");
    });

    it("runs on ubuntu-latest", () => {
      const job = workflowYAML.jobs.terraform;
      expect(job["runs-on"]).toBe("ubuntu-latest");
    });

    it("has skip condition", () => {
      const job = workflowYAML.jobs.terraform;
      expect(job.if).toBeDefined();
      expect(job.if).toContain("skip_terraform");
    });

    it("has proper permissions (contents:read, id-token:write)", () => {
      const job = workflowYAML.jobs.terraform;
      expect(job.permissions).toBeDefined();
      expect(job.permissions.contents).toBe("read");
      expect(job.permissions["id-token"]).toBe("write");
    });

    it("sets working directory to infrastructure", () => {
      const job = workflowYAML.jobs.terraform;
      expect(job.defaults).toBeDefined();
      expect(job.defaults.run["working-directory"]).toBe("infrastructure");
    });

    it("checks out code", () => {
      const job = workflowYAML.jobs.terraform;
      const checkoutStep = job.steps.find(
        (s: any) => s.name && s.name.includes("Checkout")
      );
      expect(checkoutStep).toBeDefined();
      expect(checkoutStep.uses).toContain("actions/checkout");
    });

    it("authenticates to Google Cloud", () => {
      const job = workflowYAML.jobs.terraform;
      const authStep = job.steps.find((s: any) =>
        s.name?.includes("Authenticate to Google Cloud")
      );
      expect(authStep).toBeDefined();
      expect(authStep.uses).toContain("google-github-actions/auth");
      expect(authStep.with.credentials_json).toContain("GCP_SA_KEY");
    });

    it("sets up Terraform", () => {
      const job = workflowYAML.jobs.terraform;
      const setupStep = job.steps.find((s: any) =>
        s.name?.includes("Set up Terraform")
      );
      expect(setupStep).toBeDefined();
      expect(setupStep.uses).toContain("hashicorp/setup-terraform");
    });

    it("runs terraform init", () => {
      const job = workflowYAML.jobs.terraform;
      const initStep = job.steps.find((s: any) =>
        s.name?.includes("Terraform Init")
      );
      expect(initStep).toBeDefined();
      expect(initStep.run).toContain("terraform init");
    });

    it("runs terraform plan", () => {
      const job = workflowYAML.jobs.terraform;
      const planStep = job.steps.find((s: any) =>
        s.name?.includes("Terraform Plan")
      );
      expect(planStep).toBeDefined();
      expect(planStep.run).toContain("terraform plan");
    });

    it("runs terraform apply", () => {
      const job = workflowYAML.jobs.terraform;
      const applyStep = job.steps.find((s: any) =>
        s.name?.includes("Terraform Apply")
      );
      expect(applyStep).toBeDefined();
      expect(applyStep.run).toContain("terraform apply");
    });

    it("passes TF_VAR env vars from secrets", () => {
      const job = workflowYAML.jobs.terraform;
      const planStep = job.steps.find((s: any) =>
        s.name?.includes("Terraform Plan")
      );
      expect(planStep.env).toBeDefined();
      expect(planStep.env.TF_VAR_project_id).toContain("GCP_PROJECT_ID");
      expect(planStep.env.TF_VAR_region).toContain("GCP_REGION");
      expect(planStep.env.TF_VAR_zone).toContain("GCP_ZONE");
      expect(planStep.env.TF_VAR_billing_account_id).toContain("TF_VAR_BILLING_ACCOUNT_ID");
    });

    it("outputs terraform summary", () => {
      const job = workflowYAML.jobs.terraform;
      const summaryStep = job.steps.find((s: any) =>
        s.name?.includes("Output Summary") || s.name?.includes("Terraform Output")
      );
      expect(summaryStep).toBeDefined();
      expect(summaryStep.run).toContain("GITHUB_STEP_SUMMARY");
    });
  });

  describe("Build & Push job", () => {
    it("exists and is named correctly", () => {
      const job = workflowYAML.jobs["build-and-push"];
      expect(job).toBeDefined();
      expect(job.name).toContain("Build");
    });

    it("depends on terraform job", () => {
      const job = workflowYAML.jobs["build-and-push"];
      expect(job.needs).toBe("terraform");
    });

    it("runs when terraform succeeds or is skipped", () => {
      const job = workflowYAML.jobs["build-and-push"];
      expect(job.if).toBeDefined();
      expect(job.if).toContain("always()");
      expect(job.if).toContain("terraform.result");
    });

    it("has correct permissions", () => {
      const job = workflowYAML.jobs["build-and-push"];
      expect(job.permissions.contents).toBe("read");
      expect(job.permissions["id-token"]).toBe("write");
    });

    it("outputs image digest and full image name", () => {
      const job = workflowYAML.jobs["build-and-push"];
      expect(job.outputs).toBeDefined();
      expect(job.outputs.image_digest).toBeDefined();
      expect(job.outputs.full_image).toBeDefined();
    });

    it("checks out code", () => {
      const job = workflowYAML.jobs["build-and-push"];
      const checkoutStep = job.steps.find(
        (s: any) => s.name && s.name.includes("Checkout")
      );
      expect(checkoutStep).toBeDefined();
    });

    it("authenticates to Google Cloud", () => {
      const job = workflowYAML.jobs["build-and-push"];
      const authStep = job.steps.find((s: any) =>
        s.name?.includes("Authenticate to Google Cloud")
      );
      expect(authStep).toBeDefined();
      expect(authStep.with.credentials_json).toContain("GCP_SA_KEY");
    });

    it("sets up Cloud SDK", () => {
      const job = workflowYAML.jobs["build-and-push"];
      const setupStep = job.steps.find((s: any) =>
        s.name?.includes("Cloud SDK")
      );
      expect(setupStep).toBeDefined();
      expect(setupStep.uses).toContain("google-github-actions/setup-gcloud");
    });

    it("configures Docker for Artifact Registry", () => {
      const job = workflowYAML.jobs["build-and-push"];
      const dockerStep = job.steps.find((s: any) =>
        s.name?.includes("Configure Docker")
      );
      expect(dockerStep).toBeDefined();
      expect(dockerStep.run).toContain("gcloud auth configure-docker");
    });

    it("sets up Docker Buildx", () => {
      const job = workflowYAML.jobs["build-and-push"];
      const buildxStep = job.steps.find((s: any) =>
        s.name?.includes("Docker Buildx")
      );
      expect(buildxStep).toBeDefined();
      expect(buildxStep.uses).toContain("docker/setup-buildx-action");
    });

    it("builds and pushes image with correct tags", () => {
      const job = workflowYAML.jobs["build-and-push"];
      const buildStep = job.steps.find((s: any) =>
        s.name?.includes("Build and push")
      );
      expect(buildStep).toBeDefined();
      expect(buildStep.uses).toContain("docker/build-push-action");
      expect(buildStep.with.push).toBe(true);
      expect(buildStep.with.file).toBe("./Dockerfile");
      // Tags is a pipe-delimited string, not an array
      const tagsStr = buildStep.with.tags;
      expect(typeof tagsStr).toBe("string");
      expect(tagsStr).toContain("IMAGE_TAG");
      expect(tagsStr).toContain("latest");
    });

    it("passes build args (NEXT_PUBLIC_BUILD_ID and NEXT_PUBLIC_APP_VERSION)", () => {
      const job = workflowYAML.jobs["build-and-push"];
      const buildStep = job.steps.find((s: any) =>
        s.name?.includes("Build and push")
      );
      expect(buildStep.with["build-args"]).toBeDefined();
      const buildArgs = buildStep.with["build-args"];
      expect(buildArgs).toContain("NEXT_PUBLIC_BUILD_ID");
      expect(buildArgs).toContain("NEXT_PUBLIC_APP_VERSION");
      expect(buildArgs).toContain("github.sha");
    });

    it("uses GitHub Actions cache for Docker layers", () => {
      const job = workflowYAML.jobs["build-and-push"];
      const buildStep = job.steps.find((s: any) =>
        s.name?.includes("Build and push")
      );
      expect(buildStep.with["cache-from"]).toContain("type=gha");
      expect(buildStep.with["cache-to"]).toContain("type=gha");
    });

    it("outputs image details to step summary", () => {
      const job = workflowYAML.jobs["build-and-push"];
      const summaryStep = job.steps.find((s: any) =>
        s.name?.includes("Output image details")
      );
      expect(summaryStep).toBeDefined();
      expect(summaryStep.run).toContain("GITHUB_STEP_SUMMARY");
    });
  });

  describe("Deploy job", () => {
    it("exists and is named correctly", () => {
      const job = workflowYAML.jobs.deploy;
      expect(job).toBeDefined();
      expect(job.name).toContain("Deploy");
    });

    it("depends on build-and-push job", () => {
      const job = workflowYAML.jobs.deploy;
      expect(job.needs).toBe("build-and-push");
    });

    it("respects skip_deploy flag", () => {
      const job = workflowYAML.jobs.deploy;
      expect(job.if).toBeDefined();
      expect(job.if).toContain("skip_deploy");
    });

    it("has correct permissions", () => {
      const job = workflowYAML.jobs.deploy;
      expect(job.permissions.contents).toBe("read");
      expect(job.permissions["id-token"]).toBe("write");
    });

    it("checks out code", () => {
      const job = workflowYAML.jobs.deploy;
      const checkoutStep = job.steps.find(
        (s: any) => s.name && s.name.includes("Checkout")
      );
      expect(checkoutStep).toBeDefined();
    });

    it("authenticates to Google Cloud", () => {
      const job = workflowYAML.jobs.deploy;
      const authStep = job.steps.find((s: any) =>
        s.name?.includes("Authenticate to Google Cloud")
      );
      expect(authStep).toBeDefined();
    });

    it("gets GKE credentials", () => {
      const job = workflowYAML.jobs.deploy;
      const gkeStep = job.steps.find((s: any) =>
        s.name?.includes("GKE credentials")
      );
      expect(gkeStep).toBeDefined();
      expect(gkeStep.uses).toContain("google-github-actions/get-gke-credentials");
      expect(gkeStep.with.cluster_name).toContain("GKE_CLUSTER_NAME");
      expect(gkeStep.with.location).toContain("GCP_ZONE");
      expect(gkeStep.with.project_id).toContain("GCP_PROJECT_ID");
    });

    it("creates/updates K8s secrets", () => {
      const job = workflowYAML.jobs.deploy;
      const secretStep = job.steps.find((s: any) =>
        s.name?.includes("K8s secrets")
      );
      expect(secretStep).toBeDefined();
      expect(secretStep.run).toContain("kubectl create secret");
      expect(secretStep.run).toContain("fenrir-app-secrets");
      expect(secretStep.run).toContain("fenrir-app");
    });

    it("deploys with Helm using image tag", () => {
      const job = workflowYAML.jobs.deploy;
      const helmStep = job.steps.find((s: any) =>
        s.name?.includes("Deploy with Helm")
      );
      expect(helmStep).toBeDefined();
      expect(helmStep.run).toContain("helm upgrade --install");
      expect(helmStep.run).toContain("fenrir-app");
      expect(helmStep.run).toContain("app.image.tag");
    });

    it("waits for Helm deployment to complete", () => {
      const job = workflowYAML.jobs.deploy;
      const helmStep = job.steps.find((s: any) =>
        s.name?.includes("Deploy with Helm")
      );
      expect(helmStep).toBeDefined();
      expect(helmStep.run).toContain("--wait");
      expect(helmStep.run).toContain("--timeout");
    });

    it("verifies deployment with kubectl commands", () => {
      const job = workflowYAML.jobs.deploy;
      const verifyStep = job.steps.find((s: any) =>
        s.name?.includes("Verify deployment") ||
        s.name?.includes("verify")
      );
      expect(verifyStep).toBeDefined();
      expect(verifyStep.run).toContain("kubectl get pods");
      expect(verifyStep.run).toContain("kubectl get svc");
      expect(verifyStep.run).toContain("kubectl get ingress");
    });
  });

  describe("Health check job", () => {
    it("exists and is named correctly", () => {
      const job = workflowYAML.jobs["health-check"];
      expect(job).toBeDefined();
      expect(job.name).toContain("Health Check");
    });

    it("depends on deploy job", () => {
      const job = workflowYAML.jobs["health-check"];
      expect(job.needs).toBe("deploy");
    });

    it("respects skip_deploy flag", () => {
      const job = workflowYAML.jobs["health-check"];
      expect(job.if).toBeDefined();
      expect(job.if).toContain("skip_deploy");
    });

    it("checks out code", () => {
      const job = workflowYAML.jobs["health-check"];
      const checkoutStep = job.steps.find(
        (s: any) => s.name && s.name.includes("Checkout")
      );
      expect(checkoutStep).toBeDefined();
    });

    it("authenticates to Google Cloud", () => {
      const job = workflowYAML.jobs["health-check"];
      const authStep = job.steps.find((s: any) =>
        s.name?.includes("Authenticate")
      );
      expect(authStep).toBeDefined();
    });

    it("gets GKE credentials", () => {
      const job = workflowYAML.jobs["health-check"];
      const gkeStep = job.steps.find((s: any) =>
        s.name?.includes("GKE credentials")
      );
      expect(gkeStep).toBeDefined();
    });

    it("runs health check against /api/health endpoint", () => {
      const job = workflowYAML.jobs["health-check"];
      const healthStep = job.steps.find((s: any) =>
        s.name?.includes("Health check")
      );
      expect(healthStep).toBeDefined();
      expect(healthStep.run).toContain("/api/health");
      expect(healthStep.run).toContain("curl");
    });

    it("has retry logic for health checks", () => {
      const job = workflowYAML.jobs["health-check"];
      const healthStep = job.steps.find((s: any) =>
        s.name?.includes("Health check")
      );
      expect(healthStep.run).toContain("RETRIES");
      expect(healthStep.run).toContain("for");
    });

    it("gracefully degrades when Ingress IP not available", () => {
      const job = workflowYAML.jobs["health-check"];
      const healthStep = job.steps.find((s: any) =>
        s.name?.includes("Health check")
      );
      expect(healthStep.run).toContain("warning");
      expect(healthStep.run).toContain("if");
    });
  });

  describe("Required secrets validation", () => {
    it("uses GCP_PROJECT_ID secret", () => {
      const content = workflowContent;
      expect(content).toContain("GCP_PROJECT_ID");
    });

    it("uses GCP_SA_KEY secret", () => {
      const content = workflowContent;
      expect(content).toContain("GCP_SA_KEY");
    });

    it("uses GCP_REGION secret", () => {
      const content = workflowContent;
      expect(content).toContain("GCP_REGION");
    });

    it("uses GCP_ZONE secret", () => {
      const content = workflowContent;
      expect(content).toContain("GCP_ZONE");
    });

    it("uses GKE_CLUSTER_NAME secret", () => {
      const content = workflowContent;
      expect(content).toContain("GKE_CLUSTER_NAME");
    });

    it("uses application secrets for K8s deployment", () => {
      const content = workflowContent;
      expect(content).toContain("GOOGLE_CLIENT_SECRET");
      expect(content).toContain("NEXT_PUBLIC_GOOGLE_CLIENT_ID");
      expect(content).toContain("GOOGLE_PICKER_API_KEY");
      expect(content).toContain("FENRIR_ANTHROPIC_API_KEY");
    });
  });

  describe("Job dependencies and ordering", () => {
    it("terraform job has no dependencies", () => {
      const job = workflowYAML.jobs.terraform;
      expect(job.needs).toBeUndefined();
    });

    it("build-and-push depends on terraform", () => {
      const job = workflowYAML.jobs["build-and-push"];
      expect(job.needs).toBe("terraform");
    });

    it("deploy depends on build-and-push", () => {
      const job = workflowYAML.jobs.deploy;
      expect(job.needs).toBe("build-and-push");
    });

    it("health-check depends on deploy", () => {
      const job = workflowYAML.jobs["health-check"];
      expect(job.needs).toBe("deploy");
    });
  });

  describe("Idempotency and safety", () => {
    it("terraform apply uses auto-approve (safe for idempotent infra)", () => {
      const job = workflowYAML.jobs.terraform;
      const applyStep = job.steps.find((s: any) =>
        s.name?.includes("Apply")
      );
      expect(applyStep.run).toContain("-auto-approve");
    });

    it("kubectl secret creation uses dry-run for idempotency", () => {
      const job = workflowYAML.jobs.deploy;
      const secretStep = job.steps.find((s: any) =>
        s.name?.includes("secrets")
      );
      expect(secretStep.run).toContain("dry-run");
    });

    it("health check is warning-only (doesn't block)", () => {
      const job = workflowYAML.jobs["health-check"];
      const healthStep = job.steps.find((s: any) =>
        s.name?.includes("Health check")
      );
      expect(healthStep.run).toContain("::warning");
    });
  });

  describe("Documentation and logging", () => {
    it("includes step summaries in GitHub run output", () => {
      const content = workflowContent;
      expect(content).toContain("GITHUB_STEP_SUMMARY");
    });

    it("terraform job outputs summary", () => {
      const job = workflowYAML.jobs.terraform;
      expect(job.steps.some((s: any) =>
        s.name?.includes("Output") || s.name?.includes("Summary")
      )).toBe(true);
    });

    it("build job outputs image details", () => {
      const job = workflowYAML.jobs["build-and-push"];
      expect(job.steps.some((s: any) =>
        s.name?.includes("Output")
      )).toBe(true);
    });

    it("deploy job outputs pod and service status", () => {
      const job = workflowYAML.jobs.deploy;
      expect(job.steps.some((s: any) =>
        s.name?.includes("Verify")
      )).toBe(true);
    });
  });
});
