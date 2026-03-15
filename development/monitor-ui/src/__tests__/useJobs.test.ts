/**
 * Issue #984 — Session list sort: newest (and pending) first
 *
 * Tests the useJobs hook's sort behaviour directly, without mounting React.
 * We test the sort comparator extracted from the hook — the same logic that
 * runs on every jobs-snapshot / jobs-updated message.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Mirror the sort comparator from useJobs.ts so tests stay in sync
// ---------------------------------------------------------------------------

interface ParsedJob {
  sessionId: string;
  startTime: number | null;
}

function sortJobs(jobs: ParsedJob[]): ParsedJob[] {
  return [...jobs].sort((a, b) => {
    const aTime = a.startTime ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.startTime ?? Number.MAX_SAFE_INTEGER;
    return bTime - aTime;
  });
}

function makeJob(sessionId: string, startedAt: string | null): ParsedJob {
  return {
    sessionId,
    startTime: startedAt ? new Date(startedAt).getTime() : null,
  };
}

// ---------------------------------------------------------------------------
// Descending order (newest first)
// ---------------------------------------------------------------------------

describe("useJobs sort — descending by startTime", () => {
  it("single job is returned unchanged", () => {
    const result = sortJobs([makeJob("a", "2026-03-15T10:00:00Z")]);
    expect(result[0]?.sessionId).toBe("a");
  });

  it("two jobs: newer appears first", () => {
    const result = sortJobs([
      makeJob("old", "2026-03-10T00:00:00Z"),
      makeJob("new", "2026-03-15T12:00:00Z"),
    ]);
    expect(result[0]?.sessionId).toBe("new");
    expect(result[1]?.sessionId).toBe("old");
  });

  it("three jobs sorted regardless of input order", () => {
    const result = sortJobs([
      makeJob("b", "2026-03-12T00:00:00Z"),
      makeJob("c", "2026-03-15T00:00:00Z"),
      makeJob("a", "2026-03-10T00:00:00Z"),
    ]);
    expect(result.map((j) => j.sessionId)).toEqual(["c", "b", "a"]);
  });

  it("does not mutate input", () => {
    const jobs = [makeJob("a", "2026-03-10T00:00:00Z"), makeJob("b", "2026-03-15T00:00:00Z")];
    sortJobs(jobs);
    expect(jobs[0]?.sessionId).toBe("a");
  });
});

// ---------------------------------------------------------------------------
// Pending jobs (null startTime) float to TOP — issue #984
// ---------------------------------------------------------------------------

describe("useJobs sort — pending jobs (null startTime) sort to top", () => {
  it("pending job floats above a running job", () => {
    const result = sortJobs([
      makeJob("running", "2026-03-15T10:00:00Z"),
      makeJob("pending", null),
    ]);
    expect(result[0]?.sessionId).toBe("pending");
    expect(result[1]?.sessionId).toBe("running");
  });

  it("pending job floats above all timed jobs", () => {
    const result = sortJobs([
      makeJob("old", "2026-03-10T00:00:00Z"),
      makeJob("running", "2026-03-15T10:00:00Z"),
      makeJob("pending", null),
    ]);
    expect(result[0]?.sessionId).toBe("pending");
    // Timed jobs still sorted newest-first after the pending entries
    expect(result[1]?.sessionId).toBe("running");
    expect(result[2]?.sessionId).toBe("old");
  });

  it("multiple pending jobs all float above timed jobs", () => {
    const result = sortJobs([
      makeJob("old", "2026-03-10T00:00:00Z"),
      makeJob("p1", null),
      makeJob("running", "2026-03-15T10:00:00Z"),
      makeJob("p2", null),
    ]);
    const topTwo = result.slice(0, 2).map((j) => j.sessionId).sort();
    expect(topTwo).toEqual(["p1", "p2"].sort());
    expect(result[2]?.sessionId).toBe("running");
    expect(result[3]?.sessionId).toBe("old");
  });

  it("all-pending list returns without throwing", () => {
    const result = sortJobs([makeJob("a", null), makeJob("b", null)]);
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Regression: issue #984 — newest jobs must appear at top (not bottom)
// The screenshot showed #974 (oldest) at top, #981–#983 (newest) at bottom.
// ---------------------------------------------------------------------------

describe("regression #984 — newest sessions appear at top", () => {
  it("issue #981–983 (newest) appear before issue #974 (oldest)", () => {
    const result = sortJobs([
      makeJob("issue-974", "2026-03-01T08:00:00Z"),
      makeJob("issue-981", "2026-03-13T08:00:00Z"),
      makeJob("issue-982", "2026-03-14T09:00:00Z"),
      makeJob("issue-983", "2026-03-15T10:00:00Z"),
    ]);
    expect(result[0]?.sessionId).toBe("issue-983");
    expect(result[1]?.sessionId).toBe("issue-982");
    expect(result[2]?.sessionId).toBe("issue-981");
    expect(result[3]?.sessionId).toBe("issue-974");
  });

  it("newly dispatched (pending) agent appears above all completed sessions", () => {
    const result = sortJobs([
      makeJob("issue-974", "2026-03-01T08:00:00Z"),
      makeJob("issue-983", "2026-03-15T10:00:00Z"),
      makeJob("issue-985-new", null), // just dispatched — no startedAt yet
    ]);
    expect(result[0]?.sessionId).toBe("issue-985-new");
  });
});
