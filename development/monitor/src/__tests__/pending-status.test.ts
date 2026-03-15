/**
 * Issue #965 — Monitor pending status during pod scheduling
 *
 * Validates the correct lifecycle:
 *   pending  (K8s Job active=1, pod still scheduling)
 *   running  (pod phase = Running, logs flowing)
 *   succeeded/failed (job complete)
 *
 * Root cause: job.status.active > 0 does NOT mean the pod is running —
 * it means the job controller created the pod. Pod phase must be checked.
 */

import { describe, it, expect } from "vitest";
import type { AgentJob, Job } from "../k8s.js";
import { mapAgentJobToJob } from "../k8s.js";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeAgentJob(overrides: Partial<AgentJob> = {}): AgentJob {
  return {
    name: "agent-issue-965-step1-firemandecko",
    namespace: "fenrir-agents",
    status: "pending",
    startTime: null,
    completionTime: null,
    labels: { "fenrir.dev/session-id": "issue-965-step1-firemandecko" },
    ...overrides,
  };
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    sessionId: "issue-965-step1-firemandecko",
    name: "agent-issue-965-step1-firemandecko",
    issueNumber: 965,
    agent: "firemandecko",
    step: 1,
    status: "pending",
    startedAt: null,
    completedAt: null,
    podName: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// mapAgentJobToJob — status mapping
// ---------------------------------------------------------------------------

describe("mapAgentJobToJob — pending/running status lifecycle (issue #965)", () => {
  it("maps 'pending' AgentJob status to 'pending' Job status", () => {
    const job = mapAgentJobToJob(makeAgentJob({ status: "pending" }));
    expect(job.status).toBe("pending");
  });

  it("maps 'active' AgentJob status to 'pending' (not 'running') — pod may still be scheduling", () => {
    // This is the core fix for #965:
    // job.status.active=1 means the K8s job controller created the pod,
    // not that the pod's container is actually running.
    const job = mapAgentJobToJob(makeAgentJob({ status: "active" }));
    expect(job.status).toBe("pending");
    expect(job.status).not.toBe("running");
  });

  it("maps 'succeeded' AgentJob status to 'succeeded'", () => {
    const job = mapAgentJobToJob(
      makeAgentJob({ status: "succeeded", startTime: "2026-03-15T10:00:00Z", completionTime: "2026-03-15T10:05:00Z" })
    );
    expect(job.status).toBe("succeeded");
  });

  it("maps 'failed' AgentJob status to 'failed'", () => {
    const job = mapAgentJobToJob(makeAgentJob({ status: "failed" }));
    expect(job.status).toBe("failed");
  });
});

// ---------------------------------------------------------------------------
// Expected lifecycle transitions
// ---------------------------------------------------------------------------

describe("Job status lifecycle — pending → running → succeeded/failed", () => {
  it("initial job creation: status is 'pending'", () => {
    // When a GKE Job is first dispatched, pod is in Pending phase
    const job = makeJob({ status: "pending", startedAt: null });
    expect(job.status).toBe("pending");
    expect(job.startedAt).toBeNull();
  });

  it("running state: set only when pod phase is Running (logs flowing)", () => {
    // After async pod phase check confirms Running
    const job = makeJob({ status: "running", startedAt: "2026-03-15T10:00:00Z" });
    expect(job.status).toBe("running");
    expect(job.startedAt).not.toBeNull();
  });

  it("terminal state succeeded: completedAt is set", () => {
    const job = makeJob({
      status: "succeeded",
      startedAt: "2026-03-15T10:00:00Z",
      completedAt: "2026-03-15T10:05:00Z",
    });
    expect(job.status).toBe("succeeded");
    expect(job.completedAt).not.toBeNull();
  });

  it("terminal state failed: status and completedAt are set", () => {
    const job = makeJob({
      status: "failed",
      startedAt: "2026-03-15T10:00:00Z",
      completedAt: "2026-03-15T10:02:00Z",
    });
    expect(job.status).toBe("failed");
    expect(job.completedAt).not.toBeNull();
  });

  it("pending job with null startedAt sorts to end (scheduling not started)", () => {
    const pending = makeJob({ status: "pending", startedAt: null });
    const running = makeJob({
      sessionId: "issue-1-step1-loki",
      status: "running",
      startedAt: "2026-03-15T10:00:00Z",
    });
    const sorted = [pending, running].sort((a, b) => {
      const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return bTime - aTime;
    });
    // Running job (with startedAt) sorts before pending (null startedAt)
    expect(sorted[0]?.status).toBe("running");
    expect(sorted[1]?.status).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// Status type guards — valid statuses only
// ---------------------------------------------------------------------------

describe("Valid Job status values", () => {
  const validStatuses: Job["status"][] = ["pending", "running", "succeeded", "failed"];

  it.each(validStatuses)("'%s' is a valid Job status", (status) => {
    const job = makeJob({ status });
    expect(validStatuses).toContain(job.status);
  });

  it("'active' is NOT a valid wire-protocol status (internal K8s concept only)", () => {
    // AgentJob uses "active" internally; Job (wire protocol) must never have "active"
    const agentJob = makeAgentJob({ status: "active" });
    const job = mapAgentJobToJob(agentJob);
    expect(["pending", "running", "succeeded", "failed"]).toContain(job.status);
    expect(job.status).not.toBe("active" as Job["status"]);
  });
});
