import { describe, it, expect } from "vitest";
import { parseBranchTitle, resolveSessionTitle } from "../lib/resolveSessionTitle";
import type { DisplayJob } from "../lib/types";

// Minimal DisplayJob factory for tests
function makeJob(overrides: Partial<DisplayJob> = {}): DisplayJob {
  return {
    sessionId: "issue-987-step1-firemandecko-e96269d4",
    name: "agent-issue-987-step1-firemandecko-e96269d4",
    issue: "987",
    step: "1",
    agentKey: "firemandecko",
    agentName: "FiremanDecko",
    status: "running",
    startTime: null,
    completionTime: null,
    issueTitle: null,
    branchName: null,
    ...overrides,
  };
}

describe("parseBranchTitle", () => {
  it("parses fix/ branch with issue number and slug", () => {
    expect(parseBranchTitle("fix/issue-987-picker-gate", "1")).toBe(
      "Issue #987 – picker gate – Step 1"
    );
  });

  it("parses feat/ branch", () => {
    expect(parseBranchTitle("feat/issue-681-gke-sandboxes", "2")).toBe(
      "Issue #681 – gke sandboxes – Step 2"
    );
  });

  it("parses ux/ branch", () => {
    expect(parseBranchTitle("ux/issue-989-session-header-title", "1")).toBe(
      "Issue #989 – session header title – Step 1"
    );
  });

  it("parses branch without type prefix", () => {
    expect(parseBranchTitle("issue-999-some-feature", "3")).toBe(
      "Issue #999 – some feature – Step 3"
    );
  });

  it("handles branch with no slug after issue number", () => {
    expect(parseBranchTitle("fix/issue-42", "1")).toBe("Issue #42 – Step 1");
  });

  it("returns branch unchanged when no issue number found", () => {
    expect(parseBranchTitle("main", "1")).toBe("main");
  });
});

describe("resolveSessionTitle", () => {
  it("priority 1: uses issueTitle when present", () => {
    const job = makeJob({ issueTitle: "fix: gate /api/config/picker on Karl OR active trial" });
    expect(resolveSessionTitle(job)).toBe(
      "Issue #987 – fix: gate /api/config/picker on Karl OR active trial – Step 1"
    );
  });

  it("priority 2: falls back to branchName parse when issueTitle is null", () => {
    const job = makeJob({ branchName: "fix/issue-987-picker-gate" });
    expect(resolveSessionTitle(job)).toBe("Issue #987 – picker gate – Step 1");
  });

  it("priority 3: falls back to raw sessionId when both are null", () => {
    const job = makeJob();
    expect(resolveSessionTitle(job)).toBe("issue-987-step1-firemandecko-e96269d4");
  });

  it("issueTitle takes precedence over branchName", () => {
    const job = makeJob({
      issueTitle: "The real title",
      branchName: "fix/issue-987-picker-gate",
    });
    expect(resolveSessionTitle(job)).toBe("Issue #987 – The real title – Step 1");
  });

  it("uses correct step number in title", () => {
    const job = makeJob({
      step: "3",
      issueTitle: "some fix",
    });
    expect(resolveSessionTitle(job)).toBe("Issue #987 – some fix – Step 3");
  });

  it("gracefully handles empty issueTitle string (falsy)", () => {
    const job = makeJob({ issueTitle: "", branchName: "fix/issue-987-picker-gate" });
    expect(resolveSessionTitle(job)).toBe("Issue #987 – picker gate – Step 1");
  });
});
