/**
 * Vitest component tests for issue #991 — download button in session header
 *
 * AC tested:
 * - Download button appears in session header badges area (AC-4)
 * - Button has tooltip "Download session log" (AC-6)
 * - Clicking download calls downloadLog with the active sessionId (AC-5)
 * - Button renders in both normal and TTL-expired header states
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { LogViewer } from "../components/LogViewer";
import type { LogEntry } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";

// Mock localStorageLogs so we don't need real localStorage in component tests
vi.mock("../lib/localStorageLogs", () => ({
  downloadLog: vi.fn(),
  appendLogLine: vi.fn(),
  getLog: vi.fn().mockReturnValue("mock log content"),
}));

import { downloadLog } from "../lib/localStorageLogs";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const MOCK_JOB: DisplayJob = {
  sessionId: "issue-991-test-session",
  name: "agent-issue-991-test-session",
  issue: "991",
  step: "1",
  agentKey: "fireman",
  agentName: "FiremanDecko",
  status: "running",
  startTime: Date.now(),
  completionTime: null,
};

const TTL_JOB: DisplayJob = {
  ...MOCK_JOB,
  status: "failed",
  sessionId: "issue-991-ttl-session",
};

function makeTextEntry(text: string): LogEntry {
  return { id: "e1", type: "assistant-text", text };
}

// ---- AC-4: Download button present in header ----

describe("Download button in session header (AC-4)", () => {
  it("renders download button in the header-badges area", () => {
    const { container } = render(
      <LogViewer entries={[makeTextEntry("hello")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const headerBadges = container.querySelector(".header-badges");
    expect(headerBadges).not.toBeNull();
    const btn = headerBadges!.querySelector(".download-log-btn");
    expect(btn).not.toBeNull();
  });

  it("renders download button in header-badges for TTL-expired session", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={TTL_JOB}
        wsState="closed"
        isTtlExpired={true}
        streamError="Logs unavailable — pod cleaned up (job TTL expired)."
      />
    );
    const headerBadges = container.querySelector(".header-badges");
    expect(headerBadges).not.toBeNull();
    const btn = headerBadges!.querySelector(".download-log-btn");
    expect(btn).not.toBeNull();
  });

  it("does NOT render download button when no active job is selected", () => {
    const { container } = render(
      <LogViewer entries={[]} activeJob={null} wsState="closed" />
    );
    const btn = container.querySelector(".download-log-btn");
    expect(btn).toBeNull();
  });
});

// ---- AC-6: Tooltip ----

describe("Download button tooltip (AC-6)", () => {
  it("has title='Download session log'", () => {
    const { container } = render(
      <LogViewer entries={[]} activeJob={MOCK_JOB} wsState="open" />
    );
    const btn = container.querySelector(".download-log-btn");
    expect(btn!.getAttribute("title")).toBe("Download session log");
  });

  it("has aria-label='Download session log'", () => {
    const { container } = render(
      <LogViewer entries={[]} activeJob={MOCK_JOB} wsState="open" />
    );
    const btn = container.querySelector(".download-log-btn");
    expect(btn!.getAttribute("aria-label")).toBe("Download session log");
  });
});

// ---- AC-5: Clicking download calls downloadLog with sessionId ----

describe("Download button click behavior (AC-5)", () => {
  it("calls downloadLog with the activeJob.sessionId on click", () => {
    const { container } = render(
      <LogViewer entries={[makeTextEntry("log line")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const btn = container.querySelector(".download-log-btn") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(downloadLog).toHaveBeenCalledOnce();
    expect(downloadLog).toHaveBeenCalledWith("issue-991-test-session");
  });

  it("calls downloadLog with the correct sessionId for TTL-expired session", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={TTL_JOB}
        wsState="closed"
        isTtlExpired={true}
        streamError="Logs unavailable — pod cleaned up (job TTL expired)."
      />
    );
    const btn = container.querySelector(".download-log-btn") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(downloadLog).toHaveBeenCalledWith("issue-991-ttl-session");
  });
});

// ---- Download button renders SVG icon ----

describe("Download button SVG icon", () => {
  it("renders an SVG icon inside the download button", () => {
    const { container } = render(
      <LogViewer entries={[]} activeJob={MOCK_JOB} wsState="open" />
    );
    const btn = container.querySelector(".download-log-btn");
    const svg = btn!.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
  });
});
