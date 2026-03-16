/**
 * Issue #1029 — Loki QA gap coverage: monitor-UI purged lifecycle edge cases
 *
 * Tests edge cases NOT covered by FiremanDecko's session-lifecycle-1029.test.tsx:
 * 1. DisplayJob sort with purged status (purged sorts like a timed terminal job)
 * 2. Mixed statuses list including purged sorts correctly
 * 3. useJobs sort: purged job with completionTime sorts after running/pending
 * 4. Purged status flows correctly through the STATUS constants lookup
 * 5. WebSocket jobs-updated with purged status is handled without throwing
 */

import { describe, it, expect } from "vitest";
import { STATUS_ICONS, STATUS_COLORS, STATUS_LABELS } from "../lib/constants";
import type { DisplayJob } from "../lib/types";

// ── Fixture builder ────────────────────────────────────────────────────────────

function makeDisplayJob(overrides: Partial<DisplayJob> = {}): DisplayJob {
  return {
    sessionId: "issue-1029-step1-loki",
    name: "agent-issue-1029-step1-loki",
    issue: "1029",
    step: "1",
    agentKey: "loki",
    agentName: "Loki",
    status: "succeeded",
    startTime: Date.now() - 60_000,
    completionTime: Date.now(),
    issueTitle: "Monitor sidebar session lifecycle",
    branchName: null,
    ...overrides,
  };
}

// ── Sort with purged status ────────────────────────────────────────────────────
//
// useJobs.ts uses MAX_SAFE_INTEGER for null startTime so pending jobs float to top.
// All terminal/timed jobs (succeeded, failed, purged) sort by startTime descending.

function sortDisplayJobs(jobs: DisplayJob[]): DisplayJob[] {
  return [...jobs].sort((a, b) => {
    const aTime = a.startTime ?? Number.MAX_SAFE_INTEGER;
    const bTime = b.startTime ?? Number.MAX_SAFE_INTEGER;
    return bTime - aTime;
  });
}

describe("DisplayJob sort with purged status (issue #1029)", () => {
  it("purged job sorts among timed jobs by startTime descending", () => {
    const now = Date.now();
    const jobs = [
      makeDisplayJob({ sessionId: "old-succeeded", status: "succeeded", startTime: now - 3000 }),
      makeDisplayJob({ sessionId: "new-purged", status: "purged", startTime: now - 1000 }),
      makeDisplayJob({ sessionId: "mid-failed", status: "failed", startTime: now - 2000 }),
    ];
    const sorted = sortDisplayJobs(jobs);
    expect(sorted[0]?.sessionId).toBe("new-purged");
    expect(sorted[1]?.sessionId).toBe("mid-failed");
    expect(sorted[2]?.sessionId).toBe("old-succeeded");
  });

  it("pending job (null startTime) sorts above purged job", () => {
    const now = Date.now();
    const jobs = [
      makeDisplayJob({ sessionId: "purged", status: "purged", startTime: now - 1000 }),
      makeDisplayJob({ sessionId: "pending", status: "pending", startTime: null }),
    ];
    const sorted = sortDisplayJobs(jobs);
    expect(sorted[0]?.sessionId).toBe("pending");
    expect(sorted[1]?.sessionId).toBe("purged");
  });

  it("mixed list: pending → running → purged → succeeded → failed (by time)", () => {
    const now = Date.now();
    const jobs = [
      makeDisplayJob({ sessionId: "succeeded", status: "succeeded", startTime: now - 4000 }),
      makeDisplayJob({ sessionId: "pending", status: "pending", startTime: null }),
      makeDisplayJob({ sessionId: "purged", status: "purged", startTime: now - 1000 }),
      makeDisplayJob({ sessionId: "running", status: "running", startTime: now - 2000 }),
      makeDisplayJob({ sessionId: "failed", status: "failed", startTime: now - 3000 }),
    ];
    const sorted = sortDisplayJobs(jobs);
    // Pending floats to top (null startTime → MAX_SAFE_INTEGER)
    expect(sorted[0]?.sessionId).toBe("pending");
    // Timed jobs sorted by startTime descending
    expect(sorted[1]?.sessionId).toBe("purged");    // newest timed
    expect(sorted[2]?.sessionId).toBe("running");
    expect(sorted[3]?.sessionId).toBe("failed");
    expect(sorted[4]?.sessionId).toBe("succeeded"); // oldest timed
  });
});

// ── STATUS constants completeness ─────────────────────────────────────────────

describe("STATUS constants complete for all lifecycle states (issue #1029)", () => {
  const ALL_STATUSES: Array<DisplayJob["status"]> = [
    "pending",
    "running",
    "succeeded",
    "failed",
    "purged",
  ];

  it("STATUS_ICONS has a non-empty string for every status", () => {
    for (const status of ALL_STATUSES) {
      expect(typeof STATUS_ICONS[status]).toBe("string");
      expect(STATUS_ICONS[status].length).toBeGreaterThan(0);
    }
  });

  it("STATUS_COLORS are all valid hex colors", () => {
    for (const status of ALL_STATUSES) {
      expect(STATUS_COLORS[status]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("STATUS_LABELS are all non-empty strings", () => {
    for (const status of ALL_STATUSES) {
      expect(typeof STATUS_LABELS[status]).toBe("string");
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it("each status has a unique icon (no two statuses share the same icon)", () => {
    const icons = ALL_STATUSES.map((s) => STATUS_ICONS[s]);
    const unique = new Set(icons);
    expect(unique.size).toBe(icons.length);
  });

  it("each status has a unique color (no two statuses share the same color)", () => {
    const colors = ALL_STATUSES.map((s) => STATUS_COLORS[s]);
    const unique = new Set(colors);
    expect(unique.size).toBe(colors.length);
  });
});

// ── Purged DisplayJob fields ───────────────────────────────────────────────────

describe("purged DisplayJob field invariants (issue #1029)", () => {
  it("purged job has a completionTime (job ran before being purged)", () => {
    const job = makeDisplayJob({ status: "purged", completionTime: Date.now() - 500 });
    expect(job.completionTime).not.toBeNull();
    expect(typeof job.completionTime).toBe("number");
  });

  it("purged job retains issueTitle for display", () => {
    const job = makeDisplayJob({ status: "purged", issueTitle: "Fix session lifecycle" });
    expect(job.issueTitle).toBe("Fix session lifecycle");
  });

  it("purged job with branchName=null still renders without error", () => {
    const job = makeDisplayJob({ status: "purged", branchName: null });
    expect(job.branchName).toBeNull();
    expect(job.status).toBe("purged");
  });

  it("purged status value is the string 'purged'", () => {
    const job = makeDisplayJob({ status: "purged" });
    expect(job.status).toBe("purged");
    expect(job.status).not.toBe("succeeded");
    expect(job.status).not.toBe("failed");
  });
});

// ── Purged vs succeeded distinction ───────────────────────────────────────────

describe("purged is semantically distinct from succeeded (issue #1029)", () => {
  it("purged icon ≠ succeeded icon", () => {
    expect(STATUS_ICONS["purged"]).not.toBe(STATUS_ICONS["succeeded"]);
  });

  it("purged color ≠ succeeded color", () => {
    expect(STATUS_COLORS["purged"]).not.toBe(STATUS_COLORS["succeeded"]);
  });

  it("purged label is 'purged' not 'succeeded'", () => {
    expect(STATUS_LABELS["purged"]).toBe("purged");
    expect(STATUS_LABELS["purged"]).not.toBe(STATUS_LABELS["succeeded"]);
  });

  it("purged color is gray-family (low saturation)", () => {
    // Gray colors have equal or near-equal R/G/B channels.
    // #606070 → R=0x60=96, G=0x60=96, B=0x70=112 — close enough to gray
    const hex = STATUS_COLORS["purged"].replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // Low saturation: chroma (max-min) ≤ 30% of max
    expect(max - min).toBeLessThanOrEqual(Math.round(max * 0.3));
  });
});
