/**
 * Vitest regression tests for issue #1027 — optional agentKey type fixes.
 *
 * AC tested (type-fix regressions):
 * - JobCard renders without crash when agentKey is undefined
 * - NorseTablet (LogViewer entrypoint-task) renders without agentKey (uses fallback rune)
 * - NorseErrorTablet renders both ttl-expired and node-unreachable variants without crash
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { JobCard } from "../components/JobCard";
import { NorseErrorTablet } from "../components/NorseErrorTablet";
import { LogViewer } from "../components/LogViewer";
import type { DisplayJob } from "../lib/types";
import type { LogEntry } from "../hooks/useLogStream";

afterEach(cleanup);

const BASE_JOB: DisplayJob = {
  sessionId: "issue-1027-test",
  name: "agent-issue-1027-test",
  issue: "1027",
  agentName: "Unknown Agent",
  step: "1",
  status: "running",
  startTime: null,
  completionTime: null,
};

// ── JobCard — undefined agentKey ───────────────────────────────────────────────

describe("JobCard — optional agentKey (issue #1027)", () => {
  it("renders without crash when agentKey is undefined", () => {
    // agentKey is omitted — DisplayJob.agentKey is now optional
    const job: DisplayJob = { ...BASE_JOB, agentKey: undefined };
    const { container } = render(
      <JobCard job={job} isActive={false} onClick={() => {}} />
    );
    expect(container.querySelector(".card")).not.toBeNull();
  });

  it("renders with agentKey defined (known agent path unaffected)", () => {
    const job: DisplayJob = { ...BASE_JOB, agentKey: "fireman", agentName: "FiremanDecko" };
    const { container } = render(
      <JobCard job={job} isActive={false} onClick={() => {}} />
    );
    const card = container.querySelector(".card");
    expect(card).not.toBeNull();
    expect(container.textContent).toContain("FiremanDecko");
  });
});

// ── LogViewer — NorseTablet without agentKey ───────────────────────────────────

describe("LogViewer — NorseTablet fallback rune when agentKey absent (issue #1027)", () => {
  it("renders entrypoint-task entry without agentKey without crashing", () => {
    const entries: LogEntry[] = [
      { type: "entrypoint-task", text: "Run the test suite", timestamp: Date.now() },
    ];
    // Job has no agentKey — tests conditional-spread fix in LogViewer.tsx
    const job: DisplayJob = { ...BASE_JOB, agentKey: undefined };
    const { container } = render(
      <LogViewer
        entries={entries}
        activeJob={job}
        wsState="open"
        isTtlExpired={false}
        streamError={null}
      />
    );
    expect(container.textContent).toContain("Run the test suite");
  });
});

// ── NorseErrorTablet — both variants render ────────────────────────────────────

describe("NorseErrorTablet — seal non-null assert (issue #1027)", () => {
  it("renders ttl-expired variant with seal runes and inscription", () => {
    const { container } = render(
      <NorseErrorTablet
        sessionId="issue-1027-test"
        message="Pod TTL expired."
        variant="ttl-expired"
      />
    );
    expect(container.querySelector(".net-seal-epic")).not.toBeNull();
    // Yggdrasil rune row from ERROR_TABLET_SEALS["ttl-expired"]
    expect(container.textContent).toContain("ᛃᚷᚷᛞᚱᚨᛊᛁᛚ");
  });

  it("renders node-unreachable variant with seal runes and inscription", () => {
    const { container } = render(
      <NorseErrorTablet
        sessionId="issue-1027-test"
        message="Node unreachable."
        variant="node-unreachable"
      />
    );
    expect(container.querySelector(".net-seal-epic")).not.toBeNull();
    // Bifröst rune row from ERROR_TABLET_SEALS["node-unreachable"]
    expect(container.textContent).toContain("ᛒᛁᚠᚱᛟᛊᛏ");
  });
});
