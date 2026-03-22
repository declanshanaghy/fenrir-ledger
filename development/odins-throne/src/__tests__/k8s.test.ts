/**
 * k8s.ts unit tests — issue #963, #1404
 *
 * Validates that:
 * - Pod phase is correctly mapped to Job status (issue #963)
 * - deleteAgentJob calls BatchV1Api with correct job name and propagation policy (issue #1404)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the k8s client — avoids real kubeconfig discovery and network calls.
const mockDeleteNamespacedJob = vi.fn();

vi.mock("@kubernetes/client-node", () => ({
  KubeConfig: vi.fn(() => ({
    loadFromCluster: vi.fn(),
    loadFromDefault: vi.fn(),
    makeApiClient: vi.fn(() => ({
      deleteNamespacedJob: mockDeleteNamespacedJob,
    })),
  })),
  BatchV1Api: vi.fn(),
  CoreV1Api: vi.fn(),
  Watch: vi.fn(),
  Log: vi.fn(),
}));

import { podPhaseToStatus, mapAgentJobToJob, deleteAgentJob } from "../k8s.js";
import type { AgentJob } from "../k8s.js";

// ── podPhaseToStatus ──────────────────────────────────────────────────────────

describe("podPhaseToStatus", () => {
  it("maps Pending → pending", () => {
    expect(podPhaseToStatus("Pending")).toBe("pending");
  });

  it("maps Running → running", () => {
    expect(podPhaseToStatus("Running")).toBe("running");
  });

  it("maps Succeeded → succeeded", () => {
    expect(podPhaseToStatus("Succeeded")).toBe("succeeded");
  });

  it("maps Failed → failed", () => {
    expect(podPhaseToStatus("Failed")).toBe("failed");
  });

  it("returns null for Unknown phase", () => {
    expect(podPhaseToStatus("Unknown")).toBeNull();
  });

  it("returns null for undefined phase", () => {
    expect(podPhaseToStatus(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(podPhaseToStatus("")).toBeNull();
  });

  it("is case-sensitive (lowercase 'running' is not mapped)", () => {
    expect(podPhaseToStatus("running")).toBeNull();
  });
});

// ── mapAgentJobToJob ──────────────────────────────────────────────────────────

describe("mapAgentJobToJob", () => {
  const baseJob: AgentJob = {
    name: "agent-issue-123-step1-firemandecko",
    namespace: "fenrir-agents",
    status: "active",
    startTime: "2026-03-15T10:00:00Z",
    completionTime: null,
    labels: { "fenrir.dev/session-id": "issue-123-step1-firemandecko" },
    annotations: {},
  };

  it("converts active → pending (pod may still be scheduling — issue #965)", () => {
    // K8s Job status.active=1 means the job controller created the pod,
    // NOT that the pod container is running. The pod watcher upgrades
    // pending → running once pod phase == "Running".
    const job = mapAgentJobToJob(baseJob);
    expect(job.status).toBe("pending");
    expect(job.status).not.toBe("running");
  });

  it("preserves pending status", () => {
    const job = mapAgentJobToJob({ ...baseJob, status: "pending" });
    expect(job.status).toBe("pending");
  });

  it("preserves succeeded status", () => {
    const job = mapAgentJobToJob({ ...baseJob, status: "succeeded" });
    expect(job.status).toBe("succeeded");
  });

  it("preserves failed status", () => {
    const job = mapAgentJobToJob({ ...baseJob, status: "failed" });
    expect(job.status).toBe("failed");
  });

  it("parses sessionId, issueNumber, agent, step from session-id label", () => {
    const job = mapAgentJobToJob(baseJob);
    expect(job.sessionId).toBe("issue-123-step1-firemandecko");
    expect(job.issueNumber).toBe(123);
    expect(job.agent).toBe("firemandecko");
    expect(job.step).toBe(1);
  });

  it("falls back to job name when session-id label is absent", () => {
    const job = mapAgentJobToJob({ ...baseJob, labels: {} });
    expect(job.sessionId).toBe("issue-123-step1-firemandecko");
  });

  it("sets podName to null (populated later by pod watcher)", () => {
    const job = mapAgentJobToJob(baseJob);
    expect(job.podName).toBeNull();
  });

  it("maps startTime and completionTime", () => {
    const job = mapAgentJobToJob({
      ...baseJob,
      startTime: "2026-03-15T10:00:00Z",
      completionTime: "2026-03-15T11:00:00Z",
      status: "succeeded",
    });
    expect(job.startedAt).toBe("2026-03-15T10:00:00Z");
    expect(job.completedAt).toBe("2026-03-15T11:00:00Z");
  });
});

// ── Status lifecycle progression ──────────────────────────────────────────────

describe("status lifecycle (pending → running → succeeded)", () => {
  it("pod phases cover the full K8s lifecycle", () => {
    const lifecycle: Array<[string, string]> = [
      ["Pending", "pending"],
      ["Running", "running"],
      ["Succeeded", "succeeded"],
      ["Failed", "failed"],
    ];

    for (const [phase, expected] of lifecycle) {
      expect(podPhaseToStatus(phase)).toBe(expected);
    }
  });

  it("pod phase Running overrides a job-derived pending status", () => {
    // Simulate: job has status.active=1 (mapped to pending by conservative job watcher)
    // Pod reports Running — should now show running
    const jobPhase = podPhaseToStatus("Running");
    expect(jobPhase).toBe("running");
  });
});

// ── deleteAgentJob (#1404 — Ragnarök cancel) ──────────────────────────────────

describe("deleteAgentJob", () => {
  beforeEach(() => {
    mockDeleteNamespacedJob.mockReset();
  });

  it("calls deleteNamespacedJob with agent-<sessionId> job name", async () => {
    mockDeleteNamespacedJob.mockResolvedValueOnce({});

    await deleteAgentJob("issue-1404-step1-fireman");

    expect(mockDeleteNamespacedJob).toHaveBeenCalledOnce();
    const call = mockDeleteNamespacedJob.mock.calls[0][0] as {
      name: string;
      namespace: string;
      body: Record<string, unknown>;
    };
    expect(call.name).toBe("agent-issue-1404-step1-fireman");
  });

  it("uses Background propagation policy to cascade pod deletion", async () => {
    mockDeleteNamespacedJob.mockResolvedValueOnce({});

    await deleteAgentJob("issue-1404-step1-fireman");

    const call = mockDeleteNamespacedJob.mock.calls[0][0] as {
      body: Record<string, unknown>;
    };
    expect(call.body).toMatchObject({ propagationPolicy: "Background" });
  });

  it("uses the default fenrir-agents namespace", async () => {
    mockDeleteNamespacedJob.mockResolvedValueOnce({});

    await deleteAgentJob("issue-1404-step1-fireman");

    const call = mockDeleteNamespacedJob.mock.calls[0][0] as {
      namespace: string;
    };
    expect(call.namespace).toBe("fenrir-agents");
  });

  it("accepts a custom namespace override", async () => {
    mockDeleteNamespacedJob.mockResolvedValueOnce({});

    await deleteAgentJob("issue-1404-step1-fireman", "custom-ns");

    const call = mockDeleteNamespacedJob.mock.calls[0][0] as {
      namespace: string;
    };
    expect(call.namespace).toBe("custom-ns");
  });

  it("propagates k8s API errors to the caller", async () => {
    mockDeleteNamespacedJob.mockRejectedValueOnce(new Error("403 Forbidden"));

    await expect(deleteAgentJob("issue-1404-step1-fireman")).rejects.toThrow(
      "403 Forbidden"
    );
  });
});
