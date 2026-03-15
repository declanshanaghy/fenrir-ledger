/**
 * k8s-watch.test.ts — Loki QA tests for watchAgentJobs and mapAgentJobToJob
 * Issue #917: Replace job list polling with WebSocket push
 *
 * Acceptance Criteria tested:
 *   AC-W1  ADDED K8s event adds job to the watch map and calls onUpdate
 *   AC-W2  MODIFIED K8s event updates existing job in the map
 *   AC-W3  DELETED K8s event removes job from the map
 *   AC-W4  cancel() stops reconnection after the watch stream ends
 *   AC-W5  mapAgentJobToJob maps AgentJob.status "active" → Job.status "running"
 *          and parses sessionId/issueNumber/agent/step from the session-id label
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── K8s mock ─────────────────────────────────────────────────────────────────

type WatchHandler = (type: string, obj: unknown) => void;
type WatchDone = (err: Error | null) => void;

let capturedHandler: WatchHandler | undefined;
let capturedDoneHandler: WatchDone | undefined;
const mockAbort = vi.fn();
const mockWatchFn = vi.fn<
  (
    path: string,
    opts: unknown,
    handler: WatchHandler,
    done: WatchDone
  ) => Promise<{ abort(): void }>
>();

vi.mock("@kubernetes/client-node", () => ({
  KubeConfig: vi.fn().mockImplementation(function (
    this: Record<string, unknown>
  ) {
    this.loadFromCluster = vi.fn();
    this.loadFromDefault = vi.fn();
    this.makeApiClient = vi.fn().mockReturnValue({
      listNamespacedJob: vi.fn().mockResolvedValue({ items: [] }),
      listNamespacedPod: vi.fn().mockResolvedValue({ items: [] }),
    });
  }),
  BatchV1Api: class BatchV1Api {},
  CoreV1Api: class CoreV1Api {},
  Log: vi.fn(),
  Watch: vi.fn().mockImplementation(function () {
    return { watch: mockWatchFn };
  }),
}));

const { watchAgentJobs, mapAgentJobToJob } = await import("../k8s.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJob(
  name: string,
  status: { active?: number; succeeded?: number; failed?: number },
  labels: Record<string, string> = {}
) {
  return {
    metadata: { name, namespace: "fenrir-app", labels },
    status,
  };
}

function setupWatch() {
  mockWatchFn.mockImplementation(
    async (_path, _opts, handler, done) => {
      capturedHandler = handler;
      capturedDoneHandler = done;
      return { abort: mockAbort };
    }
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("watchAgentJobs — event handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandler = undefined;
    capturedDoneHandler = undefined;
    setupWatch();
  });

  it("AC-W1: ADDED event adds the job and calls onUpdate with it", async () => {
    const onUpdate = vi.fn();
    const onError = vi.fn();

    watchAgentJobs("fenrir-app", "app=odin-agent", onUpdate, onError);
    await new Promise((r) => setTimeout(r, 10));

    capturedHandler!("ADDED", makeJob("job-a", { active: 1 }, { "fenrir.dev/session-id": "issue-1-step1-loki" }));

    expect(onUpdate).toHaveBeenCalledOnce();
    const jobs = onUpdate.mock.calls[0][0];
    expect(jobs).toHaveLength(1);
    expect(jobs[0].name).toBe("job-a");
    expect(jobs[0].status).toBe("running");
  });

  it("AC-W2: MODIFIED event updates the existing job in the map", async () => {
    const onUpdate = vi.fn();

    watchAgentJobs("fenrir-app", "app=odin-agent", onUpdate, vi.fn());
    await new Promise((r) => setTimeout(r, 10));

    capturedHandler!("ADDED", makeJob("job-m", { active: 1 }));
    capturedHandler!("MODIFIED", makeJob("job-m", { succeeded: 1 }));

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
    const jobs = lastCall[0];
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("succeeded");
  });

  it("AC-W3: DELETED event removes the job from the map", async () => {
    const onUpdate = vi.fn();

    watchAgentJobs("fenrir-app", "app=odin-agent", onUpdate, vi.fn());
    await new Promise((r) => setTimeout(r, 10));

    capturedHandler!("ADDED", makeJob("job-del", { active: 1 }));
    capturedHandler!("DELETED", makeJob("job-del", {}));

    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
    const jobs = lastCall[0];
    expect(jobs).toHaveLength(0);
  });

  it("AC-W4: cancel() stops reconnection — doneHandler does not reschedule after cancel", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();

    const cancel = watchAgentJobs("fenrir-app", "app=odin-agent", vi.fn(), onError);
    await Promise.resolve(); // allow doWatch to start

    // Cancel before the watch stream ends
    cancel();

    // Simulate the watch stream ending with an error after cancel
    capturedDoneHandler?.(new Error("connection reset"));

    // Fast-forward enough time that a reconnect would have fired
    vi.advanceTimersByTime(6000);

    // mockWatchFn should only have been called once (the initial call)
    expect(mockWatchFn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

describe("mapAgentJobToJob — status and meta mapping", () => {
  it("AC-W5a: maps AgentJob.status 'active' → Job.status 'running'", () => {
    const agentJob = {
      name: "agent-abc",
      namespace: "fenrir-app",
      status: "active" as const,
      startTime: "2026-03-15T12:00:00Z",
      completionTime: null,
      labels: { "fenrir.dev/session-id": "issue-42-step2-firemandecko" },
    };
    const job = mapAgentJobToJob(agentJob);
    expect(job.status).toBe("running");
  });

  it("AC-W5b: parses issueNumber, step, and agent from session-id label pattern", () => {
    const agentJob = {
      name: "agent-issue-99-step3-luna",
      namespace: "fenrir-app",
      status: "succeeded" as const,
      startTime: null,
      completionTime: null,
      labels: { "fenrir.dev/session-id": "issue-99-step3-luna" },
    };
    const job = mapAgentJobToJob(agentJob);
    expect(job.issueNumber).toBe(99);
    expect(job.step).toBe(3);
    expect(job.agent).toBe("luna");
    expect(job.sessionId).toBe("issue-99-step3-luna");
  });
});
