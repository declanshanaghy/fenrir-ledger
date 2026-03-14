/**
 * Vitest tests for the Helm chart at infrastructure/helm/fenrir-app/ — Issue #779
 *
 * Validates:
 * 1. Chart structure — all required files exist
 * 2. Chart.yaml — valid metadata
 * 3. values.yaml — all required keys present with correct defaults
 * 4. values-prod.yaml — production overrides
 * 5. Templates — all expected templates exist and contain valid YAML
 * 6. Deploy workflow — uses helm upgrade --install
 *
 * @ref #779
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parse as parseYAML } from "yaml";

// ---------------------------------------------------------------------------
// Resolve paths
// ---------------------------------------------------------------------------

const repoRoot = path.resolve(__dirname, "../../../../..");
const helmDir = path.join(repoRoot, "infrastructure/helm/fenrir-app");
const templatesDir = path.join(helmDir, "templates");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readYAML(filePath: string): Record<string, unknown> {
  const content = fs.readFileSync(filePath, "utf-8");
  return parseYAML(content);
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Helm Chart Structure — Issue #779", () => {
  describe("required files exist", () => {
    const requiredFiles = [
      "Chart.yaml",
      "values.yaml",
      "values-prod.yaml",
      "templates/_helpers.tpl",
      "templates/deployment.yaml",
      "templates/service.yaml",
      "templates/ingress.yaml",
      "templates/secrets.yaml",
      "templates/redis.yaml",
    ];

    it.each(requiredFiles)("file %s exists", (file) => {
      expect(fileExists(path.join(helmDir, file))).toBe(true);
    });
  });

  describe("Chart.yaml", () => {
    let chart: Record<string, unknown>;

    beforeAll(() => {
      chart = readYAML(path.join(helmDir, "Chart.yaml"));
    });

    it("has apiVersion v2", () => {
      expect(chart.apiVersion).toBe("v2");
    });

    it("has name fenrir-app", () => {
      expect(chart.name).toBe("fenrir-app");
    });

    it("has type application", () => {
      expect(chart.type).toBe("application");
    });

    it("has a version string", () => {
      expect(typeof chart.version).toBe("string");
      expect(chart.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe("values.yaml defaults", () => {
    let values: Record<string, any>;

    beforeAll(() => {
      values = readYAML(path.join(helmDir, "values.yaml"));
    });

    it("sets namespace to fenrir-app", () => {
      expect(values.namespace).toBe("fenrir-app");
    });

    it("sets app replicas to 2", () => {
      expect(values.app.replicaCount).toBe(2);
    });

    it("configures app image repository", () => {
      expect(values.app.image.repository).toContain("fenrir-app");
    });

    it("configures app resources with cpu/memory", () => {
      expect(values.app.resources.requests.cpu).toBeDefined();
      expect(values.app.resources.requests.memory).toBeDefined();
      expect(values.app.resources.limits.cpu).toBeDefined();
      expect(values.app.resources.limits.memory).toBeDefined();
    });

    it("configures service as ClusterIP on port 80", () => {
      expect(values.service.type).toBe("ClusterIP");
      expect(values.service.port).toBe(80);
    });

    it("enables ingress with fenrirledger.com hosts", () => {
      expect(values.ingress.enabled).toBe(true);
      expect(values.ingress.hosts).toContain("fenrirledger.com");
      expect(values.ingress.hosts).toContain("www.fenrirledger.com");
    });

    it("enables ingress backendConfig with health check", () => {
      expect(values.ingress.backendConfig.enabled).toBe(true);
      expect(values.ingress.backendConfig.healthCheck.requestPath).toBe(
        "/api/health"
      );
    });

    it("enables managed certificate for domains", () => {
      expect(values.ingress.managedCertificate.enabled).toBe(true);
      expect(values.ingress.managedCertificate.domains).toContain(
        "fenrirledger.com"
      );
    });

    it("disables secrets by default (CD pipeline creates them)", () => {
      expect(values.secrets.enabled).toBe(false);
    });

    it("enables redis with correct defaults", () => {
      expect(values.redis.enabled).toBe(true);
      expect(values.redis.image).toBe("redis:7-alpine");
      expect(values.redis.replicas).toBe(1);
      expect(values.redis.persistence.size).toBe("1Gi");
    });

    it("sets NODE_ENV to production", () => {
      expect(values.app.env.NODE_ENV).toBe("production");
    });

    it("configures readiness, liveness, and startup probes", () => {
      expect(values.app.readinessProbe.httpGet.path).toBe("/api/health");
      expect(values.app.livenessProbe.httpGet.path).toBe("/api/health");
      expect(values.app.startupProbe.httpGet.path).toBe("/api/health");
    });
  });

  describe("values-prod.yaml overrides", () => {
    let prodValues: Record<string, any>;

    beforeAll(() => {
      prodValues = readYAML(path.join(helmDir, "values-prod.yaml"));
    });

    it("sets namespace to fenrir-app", () => {
      expect(prodValues.namespace).toBe("fenrir-app");
    });

    it("sets app replicas to 2", () => {
      expect(prodValues.app.replicaCount).toBe(2);
    });

    it("enables ingress", () => {
      expect(prodValues.ingress.enabled).toBe(true);
    });

    it("enables redis", () => {
      expect(prodValues.redis.enabled).toBe(true);
    });
  });

  describe("templates contain Helm directives", () => {
    const templateFiles = [
      "deployment.yaml",
      "service.yaml",
      "ingress.yaml",
      "secrets.yaml",
      "redis.yaml",
    ];

    it.each(templateFiles)(
      "template %s contains .Values references",
      (file) => {
        const content = fs.readFileSync(
          path.join(templatesDir, file),
          "utf-8"
        );
        expect(content).toContain(".Values.");
      }
    );

    it("deployment template uses image repository and tag from values", () => {
      const content = fs.readFileSync(
        path.join(templatesDir, "deployment.yaml"),
        "utf-8"
      );
      expect(content).toContain(".Values.app.image.repository");
      expect(content).toContain(".Values.app.image.tag");
    });

    it("deployment template uses replicas from values", () => {
      const content = fs.readFileSync(
        path.join(templatesDir, "deployment.yaml"),
        "utf-8"
      );
      expect(content).toContain(".Values.app.replicaCount");
    });

    it("ingress template is conditionally rendered", () => {
      const content = fs.readFileSync(
        path.join(templatesDir, "ingress.yaml"),
        "utf-8"
      );
      expect(content).toContain("if .Values.ingress.enabled");
    });

    it("secrets template is conditionally rendered", () => {
      const content = fs.readFileSync(
        path.join(templatesDir, "secrets.yaml"),
        "utf-8"
      );
      expect(content).toContain("if .Values.secrets.enabled");
    });

    it("redis template is conditionally rendered", () => {
      const content = fs.readFileSync(
        path.join(templatesDir, "redis.yaml"),
        "utf-8"
      );
      expect(content).toContain("if .Values.redis.enabled");
    });

    it("_helpers.tpl defines common label templates", () => {
      const content = fs.readFileSync(
        path.join(templatesDir, "_helpers.tpl"),
        "utf-8"
      );
      expect(content).toContain("fenrir-app.labels");
      expect(content).toContain("fenrir-app.selectorLabels");
      expect(content).toContain("fenrir-app.redisLabels");
    });
  });

  describe("deploy workflow uses Helm", () => {
    let workflowContent: string;

    beforeAll(() => {
      workflowContent = fs.readFileSync(
        path.join(repoRoot, ".github/workflows/deploy.yml"),
        "utf-8"
      );
    });

    it("uses helm upgrade --install", () => {
      expect(workflowContent).toContain("helm upgrade --install");
    });

    it("references the Helm chart path", () => {
      expect(workflowContent).toContain(
        "./infrastructure/helm/fenrir-app"
      );
    });

    it("uses values-prod.yaml for production", () => {
      expect(workflowContent).toContain("values-prod.yaml");
    });

    it("sets image tag via --set", () => {
      expect(workflowContent).toContain("--set app.image.tag=");
    });

    it("does not use kubectl apply for app manifests", () => {
      expect(workflowContent).not.toContain(
        "kubectl apply -f infrastructure/k8s/app/deployment.yaml"
      );
    });

    it("includes setup-helm action", () => {
      expect(workflowContent).toContain("azure/setup-helm");
    });
  });

  describe("raw manifests are preserved (not deleted)", () => {
    it("original deployment.yaml still exists for reference", () => {
      expect(
        fileExists(
          path.join(repoRoot, "infrastructure/k8s/app/deployment.yaml")
        )
      ).toBe(true);
    });

    it("original service.yaml still exists for reference", () => {
      expect(
        fileExists(
          path.join(repoRoot, "infrastructure/k8s/app/service.yaml")
        )
      ).toBe(true);
    });
  });
});
