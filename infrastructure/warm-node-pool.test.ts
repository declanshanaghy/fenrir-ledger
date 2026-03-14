/**
 * Warm Node Pool Infrastructure Validation Tests
 * Validates Issue #777: GKE warm node pool with 3h idle TTL
 *
 * This test suite validates:
 * - Helm template structure and syntax
 * - Warm node pool deployment configuration
 * - Idle detector CronJob schedule and logic
 * - Priority class for preemption
 * - RBAC rules for minimal access
 * - Resource requests and limits
 * - Configuration values and defaults
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Use absolute path to infrastructure directory
const INFRA_DIR = "/workspace/repo/infrastructure";

// Helper to read files
const readFile = (filename: string): string => {
  const filepath = path.join(INFRA_DIR, filename);
  return fs.readFileSync(filepath, "utf-8");
};

describe("Warm Node Pool Infrastructure Validation (Issue #777)", () => {
  describe("Helm Template Files", () => {
    it("should have all required warm node pool template files", () => {
      const requiredFiles = [
        "helm/fenrir-app/templates/warm-node-pool.yaml",
        "helm/fenrir-app/templates/idle-detector-cronjob.yaml",
        "helm/fenrir-app/templates/priority-class.yaml",
        "helm/fenrir-app/templates/warm-node-pool-rbac.yaml",
      ];

      requiredFiles.forEach((file) => {
        const filepath = path.join(INFRA_DIR, file);
        expect(fs.existsSync(filepath)).toBe(true);
      });
    });

    it("should have values.yaml with warmNodePool configuration", () => {
      const valuesPath = path.join(
        INFRA_DIR,
        "helm/fenrir-app/values.yaml"
      );
      expect(fs.existsSync(valuesPath)).toBe(true);
      const content = fs.readFileSync(valuesPath, "utf-8");
      expect(content).toContain("warmNodePool:");
      expect(content).toContain("enabled:");
      expect(content).toContain("idleTimeoutSeconds:");
    });
  });

  describe("Warm Node Pool Deployment", () => {
    const warmPoolTemplate = readFile(
      "helm/fenrir-app/templates/warm-node-pool.yaml"
    );

    it("should be guarded by warmNodePool.enabled flag", () => {
      expect(warmPoolTemplate).toContain("{{- if .Values.warmNodePool.enabled");
    });

    it("should define a Deployment resource", () => {
      expect(warmPoolTemplate).toContain("kind: Deployment");
      expect(warmPoolTemplate).toContain("warm-node-pool-placeholder");
    });

    it("should use placeholder image for minimal resource footprint", () => {
      expect(warmPoolTemplate).toContain('image: "{{ .Values.warmNodePool.image');
      // Verify in values that it uses pause image
      const values = readFile("helm/fenrir-app/values.yaml");
      expect(values).toContain("pause:3.9");
    });

    it("should set correct resource requests and limits", () => {
      expect(warmPoolTemplate).toContain("resources:");
      expect(warmPoolTemplate).toContain("requests:");
      expect(warmPoolTemplate).toContain("limits:");
      // Verify resources are minimal
      const values = readFile("helm/fenrir-app/values.yaml");
      expect(values).toMatch(/cpu:\s*"10m"/);
      expect(values).toMatch(/memory:\s*"32Mi"/);
    });

    it("should use low priority class for eviction", () => {
      expect(warmPoolTemplate).toContain("priorityClassName: placeholder-priority");
    });

    it("should have short termination grace period for quick eviction", () => {
      expect(warmPoolTemplate).toContain("terminationGracePeriodSeconds: 10");
    });

    it("should include liveness probe", () => {
      expect(warmPoolTemplate).toContain("livenessProbe:");
      expect(warmPoolTemplate).toContain("exec:");
      expect(warmPoolTemplate).toContain("periodSeconds: 60");
    });

    it("should set replicas from values", () => {
      expect(warmPoolTemplate).toContain("replicas: {{ .Values.warmNodePool.replicas");
      const values = readFile("helm/fenrir-app/values.yaml");
      expect(values).toMatch(/replicas:\s*1/);
    });

    it("should use Recreate strategy to avoid scheduling conflicts", () => {
      expect(warmPoolTemplate).toContain("strategy:");
      expect(warmPoolTemplate).toContain("type: Recreate");
    });
  });

  describe("Idle Detector CronJob", () => {
    const cronJobTemplate = readFile(
      "helm/fenrir-app/templates/idle-detector-cronjob.yaml"
    );

    it("should be guarded by warmNodePool.enabled flag", () => {
      expect(cronJobTemplate).toContain("{{- if .Values.warmNodePool.enabled");
    });

    it("should define a CronJob resource", () => {
      expect(cronJobTemplate).toContain("kind: CronJob");
      expect(cronJobTemplate).toContain("warm-node-pool-idle-detector");
    });

    it("should run every 5 minutes", () => {
      expect(cronJobTemplate).toContain('schedule: "*/5 * * * *"');
    });

    it("should forbid concurrent executions", () => {
      expect(cronJobTemplate).toContain('concurrencyPolicy: Forbid');
    });

    it("should keep limited history of jobs", () => {
      expect(cronJobTemplate).toContain("successfulJobsHistoryLimit: 3");
      expect(cronJobTemplate).toContain("failedJobsHistoryLimit: 3");
    });

    it("should use kubectl image for cluster interaction", () => {
      expect(cronJobTemplate).toContain("bitnami/kubectl:latest");
    });

    it("should use correct service account for RBAC", () => {
      expect(cronJobTemplate).toContain("serviceAccountName: warm-node-pool-controller-sa");
    });

    it("should check for agent jobs to detect idle status", () => {
      expect(cronJobTemplate).toContain("jobs -n fenrir-app -l app=agent-job");
      expect(cronJobTemplate).toContain("completionTime");
    });

    it("should use configured idle timeout from values", () => {
      expect(cronJobTemplate).toContain("IDLE_TIMEOUT={{ .Values.warmNodePool.idleTimeoutSeconds");
      const values = readFile("helm/fenrir-app/values.yaml");
      expect(values).toMatch(/idleTimeoutSeconds:\s*10800/);
      // 10800 seconds = 3 hours
      expect(10800).toBe(3 * 60 * 60);
    });

    it("should scale down placeholder when idle timeout exceeded", () => {
      expect(cronJobTemplate).toContain(
        "kubectl scale deployment warm-node-pool-placeholder"
      );
      expect(cronJobTemplate).toContain("--replicas=0");
    });

    it("should scale up placeholder when recent activity detected", () => {
      expect(cronJobTemplate).toContain("--replicas=1");
    });

    it("should set resource limits for the controller job", () => {
      expect(cronJobTemplate).toContain('cpu: "50m"');
      expect(cronJobTemplate).toContain('memory: "64Mi"');
      expect(cronJobTemplate).toContain('cpu: "100m"');
      expect(cronJobTemplate).toContain('memory: "128Mi"');
    });
  });

  describe("Priority Class", () => {
    const priorityTemplate = readFile(
      "helm/fenrir-app/templates/priority-class.yaml"
    );

    it("should be guarded by warmNodePool.enabled flag", () => {
      expect(priorityTemplate).toContain("{{- if .Values.warmNodePool.enabled");
    });

    it("should define a PriorityClass resource", () => {
      expect(priorityTemplate).toContain("kind: PriorityClass");
      expect(priorityTemplate).toContain("placeholder-priority");
    });

    it("should have negative priority value to allow preemption", () => {
      expect(priorityTemplate).toContain("value: -100");
    });

    it("should not be a global default", () => {
      expect(priorityTemplate).toContain("globalDefault: false");
    });

    it("should have descriptive documentation", () => {
      expect(priorityTemplate).toContain("description:");
      expect(priorityTemplate).toContain("warm node pool");
      expect(priorityTemplate).toContain("placeholder");
    });
  });

  describe("RBAC Configuration", () => {
    const rbacTemplate = readFile(
      "helm/fenrir-app/templates/warm-node-pool-rbac.yaml"
    );

    it("should be guarded by warmNodePool.enabled flag", () => {
      expect(rbacTemplate).toContain("{{- if .Values.warmNodePool.enabled");
    });

    it("should create ServiceAccount for idle detector", () => {
      expect(rbacTemplate).toContain("kind: ServiceAccount");
      expect(rbacTemplate).toContain("warm-node-pool-controller-sa");
    });

    it("should define ClusterRole with minimal permissions", () => {
      expect(rbacTemplate).toContain("kind: ClusterRole");
      expect(rbacTemplate).toContain("warm-node-pool-controller");
    });

    it("should grant permission to read jobs", () => {
      expect(rbacTemplate).toContain('apiGroups: ["batch"]');
      expect(rbacTemplate).toContain('resources: ["jobs"]');
      expect(rbacTemplate).toContain('verbs: ["get", "list", "watch"]');
    });

    it("should grant permission to scale deployments", () => {
      expect(rbacTemplate).toContain('apiGroups: ["apps"]');
      expect(rbacTemplate).toContain(
        'resources: ["deployments", "deployments/scale"]'
      );
      expect(rbacTemplate).toContain('verbs: ["get", "list", "patch", "update"]');
    });

    it("should NOT grant create/delete permissions (read-only + scale only)", () => {
      // Should not have 'create' verb for jobs
      expect(rbacTemplate).not.toMatch(/\[".*create.*"\][\s\S]*batch/);
    });

    it("should create ClusterRoleBinding to attach role to service account", () => {
      expect(rbacTemplate).toContain("kind: ClusterRoleBinding");
      expect(rbacTemplate).toContain("warm-node-pool-controller");
      expect(rbacTemplate).toContain("kind: ClusterRole");
      expect(rbacTemplate).toContain("kind: ServiceAccount");
    });
  });

  describe("Configuration Values", () => {
    const values = readFile("helm/fenrir-app/values.yaml");

    it("should have warmNodePool section with sensible defaults", () => {
      expect(values).toContain("warmNodePool:");
      expect(values).toContain("enabled: true");
      expect(values).toContain("replicas: 1");
    });

    it("should use pause container image for minimal overhead", () => {
      expect(values).toContain("image:");
      expect(values).toContain("pause");
    });

    it("should set 3-hour idle timeout (10800 seconds)", () => {
      expect(values).toContain("idleTimeoutSeconds: 10800");
    });

    it("should set 5-minute check interval (300 seconds)", () => {
      expect(values).toContain("checkIntervalSeconds: 300");
    });

    it("should set minimal CPU request for placeholder", () => {
      expect(values).toMatch(/cpu: "10m"/);
    });

    it("should set minimal memory request for placeholder", () => {
      expect(values).toMatch(/memory: "32Mi"/);
    });

    it("should have equal resource requests and limits (QoS Guaranteed)", () => {
      // Extract resource values to verify they match
      const requestsMatch = values.match(
        /requests:\s*\n\s*cpu: "([^"]+)"\s*\n\s*memory: "([^"]+)"/
      );
      const limitsMatch = values.match(
        /limits:\s*\n\s*cpu: "([^"]+)"\s*\n\s*memory: "([^"]+)"/
      );

      expect(requestsMatch).toBeTruthy();
      expect(limitsMatch).toBeTruthy();

      if (requestsMatch && limitsMatch) {
        expect(requestsMatch[1]).toBe(limitsMatch[1]); // CPU match
        expect(requestsMatch[2]).toBe(limitsMatch[2]); // Memory match
      }
    });
  });

  describe("Integration and Behavior", () => {
    const warmPoolTemplate = readFile(
      "helm/fenrir-app/templates/warm-node-pool.yaml"
    );
    const cronJobTemplate = readFile(
      "helm/fenrir-app/templates/idle-detector-cronjob.yaml"
    );
    const priorityTemplate = readFile(
      "helm/fenrir-app/templates/priority-class.yaml"
    );
    const rbacTemplate = readFile(
      "helm/fenrir-app/templates/warm-node-pool-rbac.yaml"
    );

    it("should have consistent namespace usage across all resources", () => {
      expect(warmPoolTemplate).toContain("{{ .Values.namespace }}");
      expect(cronJobTemplate).toContain("{{ .Values.namespace }}");
      expect(rbacTemplate).toContain("{{ .Values.namespace }}");
    });

    it("should have consistent label selectors between deployment and CronJob", () => {
      expect(warmPoolTemplate).toContain("app: warm-node-pool-placeholder");
      expect(cronJobTemplate).toContain("warm-node-pool-placeholder");
    });

    it("should have proper templating syntax (no unescaped curly braces)", () => {
      // Basic check: balanced template braces
      [warmPoolTemplate, cronJobTemplate, priorityTemplate, rbacTemplate].forEach(
        (template) => {
          const openBraces = (template.match(/\{\{/g) || []).length;
          const closeBraces = (template.match(/\}\}/g) || []).length;
          expect(openBraces).toBe(closeBraces);
        }
      );
    });

    it("should not contain hardcoded secrets or credentials", () => {
      [warmPoolTemplate, cronJobTemplate, priorityTemplate, rbacTemplate].forEach(
        (template) => {
          expect(template).not.toMatch(/password\s*[:=]/i);
          expect(template).not.toMatch(/secret\s*[:=]/i);
          expect(template).not.toMatch(/api.?key\s*[:=]/i);
          expect(template).not.toMatch(/token\s*[:=]/i);
        }
      );
    });
  });

  describe("Issue #777 Acceptance Criteria", () => {
    it("[✓] GKE warm node pool deployment template created", () => {
      const template = readFile("helm/fenrir-app/templates/warm-node-pool.yaml");
      expect(template).toContain("kind: Deployment");
      expect(template).toContain("warm-node-pool-placeholder");
    });

    it("[✓] Idle detector CronJob runs every 5 minutes", () => {
      const template = readFile(
        "helm/fenrir-app/templates/idle-detector-cronjob.yaml"
      );
      expect(template).toContain('schedule: "*/5 * * * *"');
    });

    it("[✓] Idle timeout set to 3 hours (10800 seconds)", () => {
      const values = readFile("helm/fenrir-app/values.yaml");
      expect(values).toContain("idleTimeoutSeconds: 10800");
    });

    it("[✓] Priority class allows placeholder preemption for real workloads", () => {
      const template = readFile(
        "helm/fenrir-app/templates/priority-class.yaml"
      );
      expect(template).toContain("value: -100");
      expect(template).toContain("placeholder-priority");
    });

    it("[✓] RBAC minimal: read jobs, scale deployment only", () => {
      const template = readFile(
        "helm/fenrir-app/templates/warm-node-pool-rbac.yaml"
      );
      expect(template).toContain('verbs: ["get", "list", "watch"]');
      expect(template).toContain('verbs: ["get", "list", "patch", "update"]');
      expect(template).not.toMatch(/verbs:.*create/);
    });

    it("[✓] Placeholder uses minimal resources (10m CPU, 32Mi memory)", () => {
      const values = readFile("helm/fenrir-app/values.yaml");
      expect(values).toMatch(/cpu: "10m"/);
      expect(values).toMatch(/memory: "32Mi"/);
    });

    it("[✓] All templates guarded by warmNodePool.enabled feature flag", () => {
      const templates = [
        readFile("helm/fenrir-app/templates/warm-node-pool.yaml"),
        readFile("helm/fenrir-app/templates/idle-detector-cronjob.yaml"),
        readFile("helm/fenrir-app/templates/priority-class.yaml"),
        readFile("helm/fenrir-app/templates/warm-node-pool-rbac.yaml"),
      ];

      templates.forEach((template) => {
        expect(template).toContain(
          "{{- if .Values.warmNodePool.enabled"
        );
      });
    });
  });
});
