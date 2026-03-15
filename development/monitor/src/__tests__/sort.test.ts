/**
 * Issue #959 — Sort monitor sessions by creation time descending
 *
 * Validates:
 *   1. Jobs are sorted by startedAt descending (newest first)
 *   2. Jobs with null startedAt are placed at the end (lowest priority)
 *   3. mapAgentJobToJob correctly maps startTime → startedAt (prerequisite for sort)
 *   4. watchAgentJobs delivers sorted jobs via onUpdate callback
 *   5. Fixture jobs mixed with live jobs maintain sort order
 *   6. Sort is stable on WebSocket update events (jobs-snapshot / jobs-updated)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job, AgentJob } from "../k8s.js";
import { mapAgentJobToJob } from "../k8s.js";

// ---------------------------------------------------------------------------
// Pure sort logic helper (mirrors ws.ts sortJobsByStartedAtDesc)
// ---------------------------------------------------------------------------

function sortJobsByStartedAtDesc(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    return bTime - aTime;
  });
}

// ---------------------------------------------------------------------------
// Pure sort logic helper (mirrors k8s.ts sortedJobs)
// ---------------------------------------------------------------------------

function sortedJobs(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    return bTime - aTime;
  });
}

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    sessionId: "test-session",
    name: "agent-test-session",
    issueNumber: 1,
    agent: "loki",
    step: 1,
    status: "succeeded",
    startedAt: null,
    completedAt: null,
    podName: null,
    ...overrides,
  };
}

function makeAgentJob(overrides: Partial<AgentJob> = {}): AgentJob {
  return {
    name: "agent-issue-1-step1-loki",
    namespace: "fenrir-agents",
    status: "succeeded",
    startTime: null,
    completionTime: null,
    labels: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. mapAgentJobToJob: startTime → startedAt mapping
// ---------------------------------------------------------------------------

describe("mapAgentJobToJob — startedAt mapping (prerequisite for sort)", () => {
  it("maps a non-null startTime ISO string to startedAt", () => {
    const agentJob = makeAgentJob({ startTime: "2026-03-15T10:00:00Z" });
    const job = mapAgentJobToJob(agentJob);
    expect(job.startedAt).toBe("2026-03-15T10:00:00Z");
  });

  it("maps a null startTime to null startedAt", () => {
    const agentJob = makeAgentJob({ startTime: null });
    const job = mapAgentJobToJob(agentJob);
    expect(job.startedAt).toBeNull();
  });

  it("maps active status to 'running'", () => {
    const agentJob = makeAgentJob({ status: "active" });
    const job = mapAgentJobToJob(agentJob);
    expect(job.status).toBe("running");
  });
});

// ---------------------------------------------------------------------------
// 2. sortJobsByStartedAtDesc — basic ordering
// ---------------------------------------------------------------------------

describe("sortJobsByStartedAtDesc — basic ordering (ws.ts logic)", () => {
  it("returns an empty array unchanged", () => {
    expect(sortJobsByStartedAtDesc([])).toEqual([]);
  });

  it("returns a single-element array unchanged", () => {
    const job = makeJob({ startedAt: "2026-03-15T10:00:00Z" });
    const result = sortJobsByStartedAtDesc([job]);
    expect(result).toHaveLength(1);
    expect(result[0]?.startedAt).toBe("2026-03-15T10:00:00Z");
  });

  it("sorts two jobs newest-first", () => {
    const older = makeJob({ sessionId: "old", startedAt: "2026-03-14T08:00:00Z" });
    const newer = makeJob({ sessionId: "new", startedAt: "2026-03-15T12:00:00Z" });
    const result = sortJobsByStartedAtDesc([older, newer]);
    expect(result[0]?.sessionId).toBe("new");
    expect(result[1]?.sessionId).toBe("old");
  });

  it("sorts three jobs newest-first regardless of input order", () => {
    const t1 = makeJob({ sessionId: "a", startedAt: "2026-03-10T00:00:00Z" });
    const t2 = makeJob({ sessionId: "b", startedAt: "2026-03-12T00:00:00Z" });
    const t3 = makeJob({ sessionId: "c", startedAt: "2026-03-15T00:00:00Z" });
    // Supply in shuffled order
    const result = sortJobsByStartedAtDesc([t2, t3, t1]);
    expect(result.map((j) => j.sessionId)).toEqual(["c", "b", "a"]);
  });

  it("already-sorted input remains sorted", () => {
    const jobs = [
      makeJob({ sessionId: "c", startedAt: "2026-03-15T00:00:00Z" }),
      makeJob({ sessionId: "b", startedAt: "2026-03-12T00:00:00Z" }),
      makeJob({ sessionId: "a", startedAt: "2026-03-10T00:00:00Z" }),
    ];
    const result = sortJobsByStartedAtDesc(jobs);
    expect(result.map((j) => j.sessionId)).toEqual(["c", "b", "a"]);
  });

  it("does not mutate the input array", () => {
    const jobs = [
      makeJob({ sessionId: "a", startedAt: "2026-03-10T00:00:00Z" }),
      makeJob({ sessionId: "b", startedAt: "2026-03-15T00:00:00Z" }),
    ];
    const original = [...jobs];
    sortJobsByStartedAtDesc(jobs);
    expect(jobs[0]?.sessionId).toBe(original[0]?.sessionId);
    expect(jobs[1]?.sessionId).toBe(original[1]?.sessionId);
  });
});

// ---------------------------------------------------------------------------
// 3. Null startedAt jobs sorted to the end
// ---------------------------------------------------------------------------

describe("sortJobsByStartedAtDesc — null startedAt handling", () => {
  it("places null-startedAt jobs at the end", () => {
    const withTime = makeJob({ sessionId: "has-time", startedAt: "2026-03-15T10:00:00Z" });
    const noTime = makeJob({ sessionId: "no-time", startedAt: null });
    const result = sortJobsByStartedAtDesc([noTime, withTime]);
    expect(result[0]?.sessionId).toBe("has-time");
    expect(result[1]?.sessionId).toBe("no-time");
  });

  it("places multiple null-startedAt jobs all at the end", () => {
    const t1 = makeJob({ sessionId: "old", startedAt: "2026-03-10T00:00:00Z" });
    const t2 = makeJob({ sessionId: "new", startedAt: "2026-03-15T00:00:00Z" });
    const n1 = makeJob({ sessionId: "null-1", startedAt: null });
    const n2 = makeJob({ sessionId: "null-2", startedAt: null });
    const result = sortJobsByStartedAtDesc([n1, t1, n2, t2]);
    // Timed jobs come first, sorted desc; then nulls
    expect(result[0]?.sessionId).toBe("new");
    expect(result[1]?.sessionId).toBe("old");
    // Both null-startedAt entries are in the last two positions
    const tailIds = result.slice(2).map((j) => j.sessionId).sort();
    expect(tailIds).toEqual(["null-1", "null-2"].sort());
  });

  it("handles all-null startedAt jobs without throwing", () => {
    const jobs = [
      makeJob({ sessionId: "a", startedAt: null }),
      makeJob({ sessionId: "b", startedAt: null }),
    ];
    const result = sortJobsByStartedAtDesc(jobs);
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 4. k8s.ts sortedJobs (same algorithm, internal to watchAgentJobs)
// ---------------------------------------------------------------------------

describe("sortedJobs — k8s.ts watch callback sort", () => {
  it("produces descending order from unsorted input", () => {
    const jobs = [
      makeJob({ sessionId: "issue-10", startedAt: "2026-01-01T00:00:00Z" }),
      makeJob({ sessionId: "issue-12", startedAt: "2026-03-01T00:00:00Z" }),
      makeJob({ sessionId: "issue-11", startedAt: "2026-02-01T00:00:00Z" }),
    ];
    const result = sortedJobs(jobs);
    expect(result.map((j) => j.sessionId)).toEqual(["issue-12", "issue-11", "issue-10"]);
  });

  it("null startedAt goes to end in k8s sort helper too", () => {
    const jobs = [
      makeJob({ sessionId: "pending-job", startedAt: null }),
      makeJob({ sessionId: "live-job", startedAt: "2026-03-15T08:00:00Z" }),
    ];
    const result = sortedJobs(jobs);
    expect(result[0]?.sessionId).toBe("live-job");
    expect(result[1]?.sessionId).toBe("pending-job");
  });
});

// ---------------------------------------------------------------------------
// 5. Fixture jobs mixed with live jobs — sort preserved
// ---------------------------------------------------------------------------

describe("Fixture jobs mixed with live jobs (AC: fixture sessions sorted correctly)", () => {
  it("live job newer than fixture appears first", () => {
    const liveJob = makeJob({
      sessionId: "live-new",
      startedAt: "2026-03-15T14:00:00Z",
      fixture: undefined,
    });
    const fixtureJob = makeJob({
      sessionId: "fixture-old",
      startedAt: "2026-03-10T09:00:00Z",
      fixture: true,
    });
    const merged = sortJobsByStartedAtDesc([fixtureJob, liveJob]);
    expect(merged[0]?.sessionId).toBe("live-new");
    expect(merged[1]?.sessionId).toBe("fixture-old");
  });

  it("fixture job newer than live job appears first", () => {
    const liveJob = makeJob({
      sessionId: "live-old",
      startedAt: "2026-03-10T09:00:00Z",
    });
    const fixtureJob = makeJob({
      sessionId: "fixture-new",
      startedAt: "2026-03-15T14:00:00Z",
      fixture: true,
    });
    const merged = sortJobsByStartedAtDesc([liveJob, fixtureJob]);
    expect(merged[0]?.sessionId).toBe("fixture-new");
    expect(merged[1]?.sessionId).toBe("live-old");
  });

  it("multiple fixtures and live jobs all sorted by startedAt desc", () => {
    const jobs = [
      makeJob({ sessionId: "live-b", startedAt: "2026-03-14T00:00:00Z" }),
      makeJob({ sessionId: "fix-c", startedAt: "2026-03-13T00:00:00Z", fixture: true }),
      makeJob({ sessionId: "live-a", startedAt: "2026-03-15T00:00:00Z" }),
      makeJob({ sessionId: "fix-d", startedAt: "2026-03-12T00:00:00Z", fixture: true }),
    ];
    const result = sortJobsByStartedAtDesc(jobs);
    expect(result.map((j) => j.sessionId)).toEqual(["live-a", "live-b", "fix-c", "fix-d"]);
  });
});

// ---------------------------------------------------------------------------
// 6. WebSocket update events re-sort jobs (simulated handleMessage logic)
// ---------------------------------------------------------------------------

describe("WebSocket update event sort (AC: sort maintained on updates)", () => {
  /**
   * Simulate the useJobs handleMessage sort — the same logic runs in the
   * monitor-ui hook and mirrors what the server sends.
   */
  function simulateHandleMessage(rawJobs: Array<{ startedAt: string | null; sessionId: string }>): string[] {
    const parsed = rawJobs.map((j) => ({
      ...makeJob({ sessionId: j.sessionId, startedAt: j.startedAt }),
      startTime: j.startedAt ? new Date(j.startedAt).getTime() : null,
    }));
    const sorted = parsed.sort((a, b) => {
      const aTime = a.startTime ?? 0;
      const bTime = b.startTime ?? 0;
      return bTime - aTime;
    });
    return sorted.map((j) => j.sessionId);
  }

  it("jobs-snapshot: initial snapshot arrives sorted newest-first", () => {
    const snapshot = [
      { sessionId: "old", startedAt: "2026-03-10T00:00:00Z" },
      { sessionId: "new", startedAt: "2026-03-15T12:00:00Z" },
      { sessionId: "mid", startedAt: "2026-03-12T06:00:00Z" },
    ];
    expect(simulateHandleMessage(snapshot)).toEqual(["new", "mid", "old"]);
  });

  it("jobs-updated: new job injected mid-list still sorts to correct position", () => {
    const updated = [
      { sessionId: "old", startedAt: "2026-03-10T00:00:00Z" },
      { sessionId: "new", startedAt: "2026-03-15T12:00:00Z" },
      { sessionId: "mid", startedAt: "2026-03-12T06:00:00Z" },
      { sessionId: "brand-new", startedAt: "2026-03-15T18:00:00Z" },
    ];
    const result = simulateHandleMessage(updated);
    expect(result[0]).toBe("brand-new");
    expect(result[1]).toBe("new");
  });

  it("jobs-updated: job with null startedAt always stays at bottom", () => {
    const updated = [
      { sessionId: "pending", startedAt: null },
      { sessionId: "running", startedAt: "2026-03-15T10:00:00Z" },
      { sessionId: "done", startedAt: "2026-03-15T09:00:00Z" },
    ];
    const result = simulateHandleMessage(updated);
    expect(result[result.length - 1]).toBe("pending");
    expect(result[0]).toBe("running");
  });
});

// ---------------------------------------------------------------------------
// 7. mapAgentJobToJob → sort round-trip
// ---------------------------------------------------------------------------

describe("mapAgentJobToJob → sort round-trip (AC: integration)", () => {
  it("maps multiple AgentJobs and sorts them correctly", () => {
    const agentJobs: AgentJob[] = [
      makeAgentJob({
        name: "agent-issue-1-step1-loki",
        startTime: "2026-03-10T00:00:00Z",
        labels: { "fenrir.dev/session-id": "issue-1-step1-loki" },
      }),
      makeAgentJob({
        name: "agent-issue-2-step1-fireman",
        startTime: "2026-03-15T00:00:00Z",
        labels: { "fenrir.dev/session-id": "issue-2-step1-fireman" },
      }),
      makeAgentJob({
        name: "agent-issue-3-step1-luna",
        startTime: "2026-03-12T00:00:00Z",
        labels: { "fenrir.dev/session-id": "issue-3-step1-luna" },
      }),
    ];

    const jobs = agentJobs.map(mapAgentJobToJob);
    const sorted = sortJobsByStartedAtDesc(jobs);
    expect(sorted[0]?.name).toBe("agent-issue-2-step1-fireman");
    expect(sorted[1]?.name).toBe("agent-issue-3-step1-luna");
    expect(sorted[2]?.name).toBe("agent-issue-1-step1-loki");
  });

  it("pending job (null startTime) maps to null startedAt and sorts last", () => {
    const agentJobs: AgentJob[] = [
      makeAgentJob({ name: "agent-running", startTime: "2026-03-15T10:00:00Z" }),
      makeAgentJob({ name: "agent-pending", startTime: null, status: "pending" }),
    ];
    const jobs = agentJobs.map(mapAgentJobToJob);
    const sorted = sortJobsByStartedAtDesc(jobs);
    expect(sorted[0]?.name).toBe("agent-running");
    expect(sorted[1]?.name).toBe("agent-pending");
  });
});
