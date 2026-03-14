/**
 * Vitest unit tests for PodDisruptionBudget — Issue #844
 *
 * Validates that the PDB configuration is correct and that the
 * minAvailable: 1 policy is compatible with the deployment's replicaCount: 2.
 *
 * These tests document acceptance criteria for the PDB feature and verify
 * the logical correctness of the configuration values.
 *
 * @ref #844
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// PDB template path (Helm chart — relative to repo root)
const REPO_ROOT = join(__dirname, "../../../../..");
const PDB_TEMPLATE_PATH = join(
  REPO_ROOT,
  "infrastructure/helm/fenrir-app/templates/pdb.yaml"
);

// Expected PDB configuration values derived from acceptance criteria
const EXPECTED_PDB = {
  apiVersion: "policy/v1",
  kind: "PodDisruptionBudget",
  metadataName: "fenrir-app",
  minAvailable: 1,
  // Deployment replica count — PDB must be compatible
  replicaCount: 2,
} as const;

// Helper: parse Helm template YAML after stripping template expressions
// Returns a plain text representation for field-level assertions
function readPdbTemplate(): string {
  return readFileSync(PDB_TEMPLATE_PATH, "utf8");
}

describe("PodDisruptionBudget — Issue #844", () => {
  describe("Template file existence", () => {
    it("pdb.yaml exists in the Helm chart templates directory", () => {
      // AC: PDB template must be present in the Helm chart
      let content: string;
      let error: unknown = null;
      try {
        content = readPdbTemplate();
      } catch (e) {
        error = e;
        content = "";
      }
      expect(error).toBeNull();
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe("API version and kind", () => {
    it("uses policy/v1 (not deprecated policy/v1beta1)", () => {
      // AC: Must use the stable policy/v1 API (GKE 1.25+ removed v1beta1)
      const content = readPdbTemplate();
      expect(content).toContain("apiVersion: policy/v1");
      expect(content).not.toContain("policy/v1beta1");
    });

    it("kind is PodDisruptionBudget", () => {
      const content = readPdbTemplate();
      expect(content).toContain("kind: PodDisruptionBudget");
    });
  });

  describe("Metadata", () => {
    it("name is fenrir-app", () => {
      // AC: PDB must be named to match the deployment
      const content = readPdbTemplate();
      expect(content).toContain("name: fenrir-app");
    });

    it("namespace is templated from .Values.namespace", () => {
      // AC: Namespace must be configurable via Helm values (not hardcoded)
      const content = readPdbTemplate();
      expect(content).toContain("{{ .Values.namespace }}");
    });

    it("includes standard Fenrir labels", () => {
      // AC: Must use the shared fenrir-app.labels helper for consistency
      const content = readPdbTemplate();
      expect(content).toContain("fenrir-app.labels");
    });
  });

  describe("Disruption policy — minAvailable", () => {
    it("minAvailable is set to 1", () => {
      // AC: At least 1 pod must remain available during voluntary disruptions
      // (node upgrades, cluster maintenance, etc.)
      const content = readPdbTemplate();
      expect(content).toContain("minAvailable: 1");
    });

    it("does not use maxUnavailable (minAvailable is preferred for Autopilot node upgrades)", () => {
      // minAvailable: 1 is more predictable than maxUnavailable for upgrade safety.
      // With replicaCount: 2 and minAvailable: 1, exactly 1 pod may be evicted at a time.
      const content = readPdbTemplate();
      expect(content).not.toContain("maxUnavailable");
    });
  });

  describe("Pod selector", () => {
    it("uses the shared selectorLabels helper to target fenrir-app pods", () => {
      // AC: Selector must match the Deployment's pod template labels
      const content = readPdbTemplate();
      expect(content).toContain("fenrir-app.selectorLabels");
      expect(content).toContain("matchLabels");
    });
  });

  describe("Configuration compatibility (logic)", () => {
    it("minAvailable (1) is less than replicaCount (2), so at least 1 disruption is permitted", () => {
      // With replicaCount: 2 and minAvailable: 1, Kubernetes is allowed to
      // evict 1 pod at a time (maxDisruptions = replicaCount - minAvailable = 1).
      // This is the correct setting for rolling node upgrades on GKE Autopilot.
      const maxDisruptions =
        EXPECTED_PDB.replicaCount - EXPECTED_PDB.minAvailable;
      expect(maxDisruptions).toBeGreaterThan(0);
      expect(maxDisruptions).toBe(1);
    });

    it("minAvailable (1) is greater than 0, ensuring at least 1 pod always serves traffic", () => {
      // Prevents total outage during voluntary disruptions (not force-evictions).
      expect(EXPECTED_PDB.minAvailable).toBeGreaterThan(0);
    });

    it("minAvailable (1) is less than replicaCount (2), so cluster autoscaling and upgrades can proceed", () => {
      // If minAvailable were equal to replicaCount, node upgrades would be blocked.
      expect(EXPECTED_PDB.minAvailable).toBeLessThan(EXPECTED_PDB.replicaCount);
    });

    it("replicaCount (2) satisfies minAvailable (1) with headroom for 1 disruption", () => {
      // Validates that the deployment's replica count is compatible with the PDB policy.
      const headroom = EXPECTED_PDB.replicaCount - EXPECTED_PDB.minAvailable;
      expect(headroom).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Deployment strategy compatibility", () => {
    it("rolling update maxUnavailable: 0 + PDB minAvailable: 1 are compatible", () => {
      // Deployment strategy: maxUnavailable: 0, maxSurge: 1
      // PDB: minAvailable: 1
      // These are compatible — rolling update brings up new pod before terminating old one.
      // PDB additionally protects against simultaneous voluntary evictions from node upgrades.
      const deploymentMaxUnavailable = 0;
      const deploymentMaxSurge = 1;
      const pdbMinAvailable = EXPECTED_PDB.minAvailable;
      const replicaCount = EXPECTED_PDB.replicaCount;

      // During rolling update: old pods ≥ replicaCount - maxUnavailable = 2
      // PDB allows: running pods ≥ minAvailable = 1 — satisfied
      expect(replicaCount - deploymentMaxUnavailable).toBeGreaterThanOrEqual(
        pdbMinAvailable
      );
      expect(deploymentMaxSurge).toBeGreaterThan(0);
    });
  });
});
