/**
 * Issue #989 — Session Header Title: QA augmentation tests
 *
 * These tests cover gaps not addressed by FiremanDecko's resolveSessionTitle.test.ts:
 *   - parseBranchTitle edge cases (chore prefix, numeric slug, long slug)
 *   - resolveSessionTitle with different issue numbers
 *   - SessionHeader short-ID truncation logic (pure, no DOM)
 *   - JobCard cardTitle logic (pure derivation from DisplayJob fields)
 *
 * All tests are pure logic — no DOM, no Playwright.
 */

import { describe, it, expect } from "vitest";
import { parseBranchTitle, resolveSessionTitle } from "../lib/resolveSessionTitle";
import type { DisplayJob } from "../lib/types";

// ---------------------------------------------------------------------------
// Minimal DisplayJob factory
// ---------------------------------------------------------------------------
function makeJob(overrides: Partial<DisplayJob> = {}): DisplayJob {
  return {
    sessionId: "issue-989-step1-loki-ab12cd34",
    name: "agent-issue-989-step1-loki-ab12cd34",
    issue: "989",
    step: "1",
    agentKey: "loki",
    agentName: "Loki",
    status: "running",
    startTime: null,
    completionTime: null,
    issueTitle: null,
    branchName: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure helper that mirrors SessionHeader's short-ID logic:
//   last 8 chars when sessionId.length > 8, else full sessionId
// ---------------------------------------------------------------------------
function shortSessionId(sessionId: string): string {
  return sessionId.length > 8 ? sessionId.slice(-8) : sessionId;
}

// ---------------------------------------------------------------------------
// Pure helper that mirrors JobCard's cardTitle derivation:
//   issueTitle present → "#<issue> – <issueTitle>"
//   otherwise         → resolveSessionTitle(job)
// ---------------------------------------------------------------------------
function deriveCardTitle(job: DisplayJob): string {
  return job.issueTitle
    ? `#${job.issue} \u2013 ${job.issueTitle}`
    : resolveSessionTitle(job);
}

// ===========================================================================
// parseBranchTitle — additional edge cases
// ===========================================================================
describe("parseBranchTitle — edge cases not covered by FiremanDecko", () => {
  it("parses chore/ prefix branch", () => {
    expect(parseBranchTitle("chore/issue-101-cleanup-deps", "1")).toBe(
      "Issue #101 – cleanup deps – Step 1"
    );
  });

  it("parses hotfix/ prefix branch", () => {
    expect(parseBranchTitle("hotfix/issue-500-crash-on-load", "2")).toBe(
      "Issue #500 – crash on load – Step 2"
    );
  });

  it("preserves multiple hyphenated words as spaced slug", () => {
    // "add-dark-mode-toggle" should become "add dark mode toggle"
    expect(parseBranchTitle("feat/issue-200-add-dark-mode-toggle", "1")).toBe(
      "Issue #200 – add dark mode toggle – Step 1"
    );
  });

  it("handles branch with trailing hyphen after issue number", () => {
    // "issue-42-" with trailing hyphen should produce empty slug → step only
    expect(parseBranchTitle("fix/issue-42-", "1")).toBe("Issue #42 – Step 1");
  });

  it("returns full branch string when branch has no slash and no issue pattern", () => {
    expect(parseBranchTitle("dependabot/npm_and_yarn/lodash-4.17.21", "1")).toBe(
      "dependabot/npm_and_yarn/lodash-4.17.21"
    );
  });

  it("uses the step argument correctly for step 5", () => {
    expect(parseBranchTitle("fix/issue-123-some-bug", "5")).toBe(
      "Issue #123 – some bug – Step 5"
    );
  });
});

// ===========================================================================
// resolveSessionTitle — additional coverage
// ===========================================================================
describe("resolveSessionTitle — additional edge cases", () => {
  it("uses job.issue number in the formatted title (not a hardcoded value)", () => {
    const job = makeJob({ issue: "42", issueTitle: "tiny fix" });
    expect(resolveSessionTitle(job)).toBe("Issue #42 – tiny fix – Step 1");
  });

  it("branchName fallback uses correct issue number from branch, not job.issue", () => {
    // branchName issue number is what parseBranchTitle parses
    const job = makeJob({ issue: "1", branchName: "fix/issue-987-other" });
    expect(resolveSessionTitle(job)).toBe("Issue #987 – other – Step 1");
  });

  it("falls back to sessionId when branchName has no parseable issue", () => {
    const job = makeJob({ branchName: "main" });
    // parseBranchTitle("main", "1") returns "main" (no issue match)
    // resolveSessionTitle then gets "main" from parseBranchTitle, not sessionId
    // This is the expected behavior: branch is used if present, even if not parseable
    expect(resolveSessionTitle(job)).toBe("main");
  });

  it("very long issueTitle is included verbatim (no truncation in utility)", () => {
    const longTitle = "A".repeat(120);
    const job = makeJob({ issueTitle: longTitle });
    expect(resolveSessionTitle(job)).toBe(`Issue #989 – ${longTitle} – Step 1`);
  });

  it("issueTitle with special characters is preserved verbatim", () => {
    const job = makeJob({ issueTitle: "fix: <script> injection & XSS \"test\"" });
    expect(resolveSessionTitle(job)).toBe(
      'Issue #989 – fix: <script> injection & XSS "test" – Step 1'
    );
  });

  it("sessionId used as fallback when both issueTitle and branchName are null", () => {
    const job = makeJob({ sessionId: "abc123", issueTitle: null, branchName: null });
    expect(resolveSessionTitle(job)).toBe("abc123");
  });
});

// ===========================================================================
// SessionHeader short-ID truncation logic
// ===========================================================================
describe("SessionHeader short-ID truncation", () => {
  it("truncates sessionId to last 8 chars when longer than 8", () => {
    expect(shortSessionId("issue-989-step1-loki-ab12cd34")).toBe("ab12cd34");
  });

  it("returns full sessionId when exactly 8 chars", () => {
    expect(shortSessionId("ab12cd34")).toBe("ab12cd34");
  });

  it("returns full sessionId when shorter than 8 chars", () => {
    expect(shortSessionId("abc")).toBe("abc");
  });

  it("truncates a long uuid-style session ID correctly", () => {
    expect(shortSessionId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe("34567890");
  });
});

// ===========================================================================
// JobCard cardTitle derivation logic
// ===========================================================================
describe("JobCard cardTitle logic (AC: sidebar cards show issue title)", () => {
  it("shows #issue – issueTitle when issueTitle is set", () => {
    const job = makeJob({ issue: "989", issueTitle: "Replace monitor session header" });
    expect(deriveCardTitle(job)).toBe("#989 \u2013 Replace monitor session header");
  });

  it("falls back to resolveSessionTitle when issueTitle is null and branchName present", () => {
    const job = makeJob({ branchName: "ux/issue-989-session-header-title" });
    // resolveSessionTitle → parseBranchTitle → "Issue #989 – session header title – Step 1"
    expect(deriveCardTitle(job)).toBe("Issue #989 – session header title – Step 1");
  });

  it("falls back to raw sessionId when neither issueTitle nor branchName", () => {
    const job = makeJob();
    expect(deriveCardTitle(job)).toBe(job.sessionId);
  });

  it("empty issueTitle falls through to resolveSessionTitle", () => {
    const job = makeJob({ issueTitle: "", branchName: "fix/issue-989-bug" });
    // empty string is falsy, so falls back to resolveSessionTitle
    expect(deriveCardTitle(job)).toBe("Issue #989 – bug – Step 1");
  });

  it("uses em dash separator (U+2013) not a regular hyphen", () => {
    const job = makeJob({ issue: "989", issueTitle: "Some title" });
    const title = deriveCardTitle(job);
    // U+2013 (en dash) used as separator
    expect(title).toContain("\u2013");
    expect(title).not.toContain(" - "); // not a plain hyphen
  });
});
