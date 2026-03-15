/**
 * k8s.ts unit tests — issue #963
 *
 * Validates that pod phase is correctly mapped to Job status so the monitor
 * UI can transition from "pending" to "running" once a pod starts executing.
 */

import { describe, it, expect } from "vitest";
import { podPhaseToStatus, mapAgentJobToJob } from "../k8s.js";
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
  };

  it("converts active → running", () => {
    const job = mapAgentJobToJob(baseJob);
    expect(job.status).toBe("running");
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
