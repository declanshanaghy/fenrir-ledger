/**
 * Vitest tests for issue #974 — Norse error tablet (TTL expired / pod-not-found)
 *
 * AC tested:
 * - terminalError state is set in useLogStream when stream-error arrives
 * - terminalError is cleared in clearEntries (session switch)
 * - LogViewer renders Norse error tablet (full-pane) when terminalError is set
 * - Norse tablet shows session ID
 * - Norse tablet has role="alert" for accessibility
 * - Norse tablet replaces log terminal (log entries are not shown)
 * - Normal log entries render when terminalError is null
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { LogViewer } from "../components/LogViewer";
import { useLogStream } from "../hooks/useLogStream";
import type { LogEntry } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";

afterEach(cleanup);

// Minimal DisplayJob
const MOCK_JOB: DisplayJob = {
  sessionId: "issue-974-step1-fireman",
  name: "agent-issue-974-step1-fireman",
  issue: "974",
  step: "1",
  agentKey: "fireman",
  agentName: "FiremanDecko",
  status: "failed",
  startTime: Date.now(),
  completionTime: null,
};

const TTL_ERROR_MSG =
  "Logs unavailable — the pod for session issue-974-step1-fireman has been cleaned up (job TTL expired).";

// ── useLogStream — terminalError state ───────────────────────────────────────

describe("useLogStream — terminalError state (issue #974)", () => {
  it("starts with terminalError null", () => {
    const { result } = renderHook(() => useLogStream());
    expect(result.current.terminalError).toBeNull();
  });

  it("sets terminalError when stream-error is received", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => {
      result.current.handleMessage({
        type: "stream-error",
        ts: Date.now(),
        sessionId: "issue-974-step1-fireman",
        message: TTL_ERROR_MSG,
      });
    });
    expect(result.current.terminalError).toBe(TTL_ERROR_MSG);
  });

  it("clears terminalError on clearEntries (session switch)", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => {
      result.current.handleMessage({
        type: "stream-error",
        ts: Date.now(),
        sessionId: "issue-974-step1-fireman",
        message: TTL_ERROR_MSG,
      });
    });
    expect(result.current.terminalError).toBe(TTL_ERROR_MSG);
    act(() => {
      result.current.clearEntries();
    });
    expect(result.current.terminalError).toBeNull();
  });

  it("also adds an error entry to entries on stream-error", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => {
      result.current.handleMessage({
        type: "stream-error",
        ts: Date.now(),
        sessionId: "issue-974-step1-fireman",
        message: TTL_ERROR_MSG,
      });
    });
    const errorEntry = result.current.entries.find((e) => e.type === "error");
    expect(errorEntry).toBeDefined();
    expect(errorEntry?.message).toBe(TTL_ERROR_MSG);
  });
});

// ── LogViewer — Norse error tablet rendering ─────────────────────────────────

describe("LogViewer — Norse error tablet (issue #974)", () => {
  it("renders Norse error tablet when terminalError is set", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={MOCK_JOB}
        wsState="open"
        terminalError={TTL_ERROR_MSG}
      />
    );
    const tablet = container.querySelector(".norse-error-stone");
    expect(tablet).not.toBeNull();
  });

  it("Norse error pane has role=alert", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={MOCK_JOB}
        wsState="open"
        terminalError={TTL_ERROR_MSG}
      />
    );
    const alert = container.querySelector("[role='alert']");
    expect(alert).not.toBeNull();
  });

  it("Norse error tablet shows the session ID", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={MOCK_JOB}
        wsState="open"
        terminalError={TTL_ERROR_MSG}
      />
    );
    expect(container.textContent).toContain(MOCK_JOB.sessionId);
  });

  it("Norse error tablet shows the error message", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={MOCK_JOB}
        wsState="open"
        terminalError={TTL_ERROR_MSG}
      />
    );
    expect(container.textContent).toContain("cleaned up");
    expect(container.textContent).toContain("TTL expired");
  });

  it("Norse error tablet replaces log-terminal (no .log-terminal when terminalError is set)", () => {
    const entries: LogEntry[] = [
      { id: "l1", type: "raw", text: "some log line" },
    ];
    const { container } = render(
      <LogViewer
        entries={entries}
        activeJob={MOCK_JOB}
        wsState="open"
        terminalError={TTL_ERROR_MSG}
      />
    );
    expect(container.querySelector(".log-terminal")).toBeNull();
    expect(container.querySelector(".norse-error-stone")).not.toBeNull();
  });

  it("renders log-terminal normally when terminalError is null", () => {
    const entries: LogEntry[] = [
      { id: "l1", type: "raw", text: "some log line" },
    ];
    const { container } = render(
      <LogViewer
        entries={entries}
        activeJob={MOCK_JOB}
        wsState="open"
        terminalError={null}
      />
    );
    expect(container.querySelector(".log-terminal")).not.toBeNull();
    expect(container.querySelector(".norse-error-stone")).toBeNull();
  });

  it("Norse error pane has aria-label for accessibility", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={MOCK_JOB}
        wsState="open"
        terminalError={TTL_ERROR_MSG}
      />
    );
    const pane = container.querySelector(".norse-error-pane");
    expect(pane?.getAttribute("aria-label")).toBeTruthy();
  });
});
