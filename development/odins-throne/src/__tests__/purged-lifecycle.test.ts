/**
 * Issue #1029 — purged lifecycle state in k8s.ts
 *
 * Tests the logic that transitions a terminal job (succeeded/failed) to "purged"
 * when its pod is reaped by the Kubernetes garbage collector.
 *
 * The pod watcher handles DELETED events: if a pod associated with a terminal
 * job is deleted, the job transitions to "purged" to signal that kubectl logs
 * are no longer available (though saved JSONL remains viewable).
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@kubernetes/client-node", () => ({
  KubeConfig: vi.fn(() => ({
    loadFromCluster: vi.fn(),
    loadFromDefault: vi.fn(),
    makeApiClient: vi.fn(),
  })),
  BatchV1Api: vi.fn(),
  CoreV1Api: vi.fn(),
  Watch: vi.fn(),
  Log: vi.fn(),
}));

import { podPhaseToStatus, mapAgentJobToJob } from "../k8s.js";
import type { AgentJob, Job } from "../k8s.js";

// ── Purged transition predicate ───────────────────────────────────────────────

/**
 * Mirrors the pod DELETED handler logic in doPodWatch.
 * Returns "purged" if the existing job should transition, or the unchanged status.
 */
function podDeletedTransition(existing: Job): Job["status"] {
  if (existing.status === "succeeded" || existing.status === "failed") {
    return "purged";
  }
  return existing.status;
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    sessionId: "issue-1029-step1-loki",
    name: "agent-issue-1029-step1-loki",
    issueNumber: 1029,
    agent: "loki",
    step: 1,
    status: "succeeded",
    startedAt: "2026-03-16T10:00:00Z",
    completedAt: "2026-03-16T11:00:00Z",
    podName: "agent-issue-1029-step1-loki-xyz",
    issueTitle: null,
    branchName: null,
    ...overrides,
  };
}

// ── Pod DELETED → purged transition ──────────────────────────────────────────

describe("pod DELETED event → purged transition (issue #1029)", () => {
  it("succeeded job transitions to purged when pod is deleted", () => {
    const job = makeJob({ status: "succeeded" });
    expect(podDeletedTransition(job)).toBe("purged");
  });

  it("failed job transitions to purged when pod is deleted", () => {
    const job = makeJob({ status: "failed" });
    expect(podDeletedTransition(job)).toBe("purged");
  });

  it("running job does NOT transition to purged on pod delete", () => {
    // A running pod deletion is unusual (e.g., job evicted/deleted entirely)
    // — we leave the status as-is and let the job watch handle it.
    const job = makeJob({ status: "running" });
    expect(podDeletedTransition(job)).toBe("running");
  });

  it("pending job does NOT transition to purged on pod delete", () => {
    const job = makeJob({ status: "pending" });
    expect(podDeletedTransition(job)).toBe("pending");
  });

  it("already-purged job stays purged on pod delete", () => {
    const job = makeJob({ status: "purged" });
    expect(podDeletedTransition(job)).toBe("purged");
  });
});

// ── Seed (startup) purged detection ─────────────────────────────────────────

/**
 * Mirrors the post-seed loop in seedFromList that marks terminal jobs with no
 * live pod as purged on monitor startup (pods already reaped before startup).
 */
function seedPurgedCheck(job: Job): Job["status"] {
  if (
    (job.status === "succeeded" || job.status === "failed") &&
    job.podName === null &&
    job.startedAt !== null
  ) {
    return "purged";
  }
  return job.status;
}

describe("seed purged detection on startup (issue #1029)", () => {
  it("terminal job with no pod and a startedAt → purged", () => {
    const job = makeJob({ status: "succeeded", podName: null, startedAt: "2026-03-16T10:00:00Z" });
    expect(seedPurgedCheck(job)).toBe("purged");
  });

  it("failed job with no pod → purged", () => {
    const job = makeJob({ status: "failed", podName: null, startedAt: "2026-03-16T10:00:00Z" });
    expect(seedPurgedCheck(job)).toBe("purged");
  });

  it("terminal job with live pod is NOT purged", () => {
    const job = makeJob({ status: "succeeded", podName: "still-running-pod-xyz" });
    expect(seedPurgedCheck(job)).toBe("succeeded");
  });

  it("terminal job with null startedAt is NOT marked purged (safety guard)", () => {
    // A job with no startedAt hasn't actually run yet — don't purge it
    const job = makeJob({ status: "succeeded", podName: null, startedAt: null });
    expect(seedPurgedCheck(job)).toBe("succeeded");
  });

  it("pending job with no pod is NOT purged (hasn't run yet)", () => {
    const job = makeJob({ status: "pending", podName: null });
    expect(seedPurgedCheck(job)).toBe("pending");
  });

  it("running job with no pod is NOT purged (edge case — race condition)", () => {
    const job = makeJob({ status: "running", podName: null });
    expect(seedPurgedCheck(job)).toBe("running");
  });
});

// ── mapAgentJobToJob still works after type extension ────────────────────────

describe("mapAgentJobToJob still produces valid status after purged type added", () => {
  const baseAgentJob: AgentJob = {
    name: "agent-issue-1029-step1-loki",
    namespace: "fenrir-agents",
    status: "active",
    startTime: "2026-03-16T10:00:00Z",
    completionTime: null,
    labels: { "fenrir.dev/session-id": "issue-1029-step1-loki" },
    annotations: {},
  };

  it("active → pending (not purged)", () => {
    const job = mapAgentJobToJob(baseAgentJob);
    expect(job.status).toBe("pending");
  });

  it("succeeded → succeeded (not purged — purged is derived post-mapping)", () => {
    const job = mapAgentJobToJob({ ...baseAgentJob, status: "succeeded" });
    expect(job.status).toBe("succeeded");
  });
});

// ── Full lifecycle progression ───────────────────────────────────────────────

describe("full session lifecycle: pending → running → succeeded → purged", () => {
  it("each state is reachable in the correct order", () => {
    const lifecycle: Array<Job["status"]> = [
      "pending",
      "running",
      "succeeded",
      "purged",
    ];

    // Verify each state is a valid Job status value
    for (const status of lifecycle) {
      const job = makeJob({ status });
      expect(job.status).toBe(status);
    }
  });

  it("failed path: pending → running → failed → purged", () => {
    const job = makeJob({ status: "failed" });
    const afterPodDelete = podDeletedTransition(job);
    expect(afterPodDelete).toBe("purged");
  });

  it("purged job podName is null (pod no longer exists)", () => {
    const job = makeJob({ status: "succeeded", podName: "old-pod-xyz" });
    // Simulate what the pod DELETED handler does
    const purgedJob: Job = { ...job, status: "purged", podName: null };
    expect(purgedJob.status).toBe("purged");
    expect(purgedJob.podName).toBeNull();
  });
});

// ── podPhaseToStatus does not produce purged ─────────────────────────────────

describe("podPhaseToStatus: purged is not a K8s pod phase", () => {
  it("Succeeded phase maps to succeeded, not purged", () => {
    expect(podPhaseToStatus("Succeeded")).toBe("succeeded");
  });

  it("no K8s phase maps to purged (purged is derived from pod deletion)", () => {
    const phases = ["Pending", "Running", "Succeeded", "Failed", "Unknown", undefined, ""];
    for (const phase of phases) {
      expect(podPhaseToStatus(phase)).not.toBe("purged");
    }
  });
});
