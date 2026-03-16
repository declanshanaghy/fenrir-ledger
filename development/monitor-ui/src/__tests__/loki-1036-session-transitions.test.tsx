/**
 * Loki QA tests for issue #1036 — additional coverage beyond FiremanDecko's regression tests.
 *
 * Focus areas:
 * 1. Round-trip session transitions (select → deselect → reselect) — stress test hooks stability
 * 2. TTL-expired → active transition (reverse of FiremanDecko's test)
 * 3. Node-unreachable → active transition
 * 4. Multiple rapid consecutive transitions
 * 5. Diverse log entry types rendering without crash
 * 6. Session ID truncation display in header
 * 7. Fixture speed controls render without crash
 * 8. Accessibility: aria-label on main content area
 *
 * These tests augment react-error-310-regression.test.tsx — no duplication.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { useState } from "react";
import { LogViewer } from "../components/LogViewer";
import type { LogEntry } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";

vi.mock("../lib/localStorageLogs", () => ({
  downloadLog: vi.fn(),
  appendLogLine: vi.fn(),
  getLog: vi.fn().mockReturnValue("mock log"),
}));

afterEach(cleanup);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTIVE_JOB: DisplayJob = {
  sessionId: "issue-1036-loki-active",
  name: "agent-issue-1036-loki-active",
  issue: "1036",
  step: "2",
  agentKey: "loki",
  agentName: "Loki",
  status: "running",
  startTime: Date.now(),
  completionTime: null,
  issueTitle: "Monitor UI crashes with React error #310",
  branchName: "fix/issue-1036-monitor-react-310",
};

const SECOND_JOB: DisplayJob = {
  ...ACTIVE_JOB,
  sessionId: "issue-1036-loki-second",
  name: "agent-issue-1036-loki-second",
  step: "3",
  agentKey: "freya",
  agentName: "Freya",
};

const TTL_JOB: DisplayJob = {
  ...ACTIVE_JOB,
  status: "failed",
  sessionId: "issue-1036-loki-ttl",
};

const NODE_JOB: DisplayJob = {
  ...ACTIVE_JOB,
  status: "failed",
  sessionId: "issue-1036-loki-node",
};

function text(t: string): LogEntry {
  return { id: `e-${Math.random()}`, type: "assistant-text", text: t };
}

// ── Round-trip transitions (hooks stability) ───────────────────────────────────

describe("Round-trip session transitions — hooks stability (issue #1036)", () => {
  it("select → deselect → reselect does not crash", () => {
    function Wrapper() {
      const [job, setJob] = useState<DisplayJob | null>(null);
      return (
        <>
          <button id="sel" onClick={() => setJob(ACTIVE_JOB)}>select</button>
          <button id="desel" onClick={() => setJob(null)}>deselect</button>
          <LogViewer entries={[text("hello")]} activeJob={job} wsState="open" />
        </>
      );
    }
    const { container } = render(<Wrapper />);
    const sel = container.querySelector("#sel") as HTMLButtonElement;
    const desel = container.querySelector("#desel") as HTMLButtonElement;

    expect(() => act(() => { sel.click(); })).not.toThrow();
    expect(() => act(() => { desel.click(); })).not.toThrow();
    expect(() => act(() => { sel.click(); })).not.toThrow();
  });

  it("TTL-expired → active session does not crash", () => {
    function Wrapper() {
      const [ttl, setTtl] = useState(true);
      return (
        <>
          <button onClick={() => setTtl(false)}>go active</button>
          <LogViewer
            entries={[text("log line")]}
            activeJob={ACTIVE_JOB}
            wsState="open"
            isTtlExpired={ttl}
            streamError={ttl ? "TTL expired — pod cleaned up." : null}
          />
        </>
      );
    }
    const { container } = render(<Wrapper />);
    expect(() =>
      act(() => { (container.querySelector("button") as HTMLButtonElement).click(); })
    ).not.toThrow();
  });

  it("node-unreachable → active session does not crash", () => {
    function Wrapper() {
      const [nodeErr, setNodeErr] = useState(true);
      return (
        <>
          <button onClick={() => setNodeErr(false)}>go active</button>
          <LogViewer
            entries={[text("log line")]}
            activeJob={ACTIVE_JOB}
            wsState="open"
            isNodeUnreachable={nodeErr}
            streamError={nodeErr ? "Node unreachable — kubelet timeout." : null}
          />
        </>
      );
    }
    const { container } = render(<Wrapper />);
    expect(() =>
      act(() => { (container.querySelector("button") as HTMLButtonElement).click(); })
    ).not.toThrow();
  });

  it("switching between two different active sessions does not crash", () => {
    function Wrapper() {
      const [job, setJob] = useState<DisplayJob>(ACTIVE_JOB);
      return (
        <>
          <button id="j1" onClick={() => setJob(ACTIVE_JOB)}>job1</button>
          <button id="j2" onClick={() => setJob(SECOND_JOB)}>job2</button>
          <LogViewer entries={[text("data")]} activeJob={job} wsState="open" />
        </>
      );
    }
    const { container } = render(<Wrapper />);
    const j2 = container.querySelector("#j2") as HTMLButtonElement;
    const j1 = container.querySelector("#j1") as HTMLButtonElement;

    expect(() => act(() => { j2.click(); })).not.toThrow();
    expect(() => act(() => { j1.click(); })).not.toThrow();
    expect(() => act(() => { j2.click(); })).not.toThrow();
  });

  it("multiple rapid null→session→null transitions do not crash", () => {
    function Wrapper() {
      const [job, setJob] = useState<DisplayJob | null>(null);
      return (
        <>
          <button id="sel" onClick={() => setJob(ACTIVE_JOB)}>select</button>
          <button id="desel" onClick={() => setJob(null)}>deselect</button>
          <LogViewer entries={[text("data")]} activeJob={job} wsState="closed" />
        </>
      );
    }
    const { container } = render(<Wrapper />);
    const sel = container.querySelector("#sel") as HTMLButtonElement;
    const desel = container.querySelector("#desel") as HTMLButtonElement;

    // 5 rapid round-trips
    for (let i = 0; i < 5; i++) {
      expect(() => act(() => { sel.click(); })).not.toThrow();
      expect(() => act(() => { desel.click(); })).not.toThrow();
    }
  });
});

// ── Log entry types — no crash guarantee ──────────────────────────────────────

describe("Various log entry types render without crash (issue #1036)", () => {
  const ENTRIES: LogEntry[] = [
    { id: "e-sys", type: "system", detail: "System initialized", text: undefined },
    { id: "e-tool", type: "tool-use", text: "Read file", toolName: "Read", toolInput: { path: "/foo" } },
    { id: "e-warn", type: "warning", message: "Low disk space", text: undefined },
    { id: "e-err", type: "error", message: "Connection refused", text: undefined },
    { id: "e-raw", type: "raw", text: "raw log output" },
    { id: "e-end", type: "stream-end", reason: "completed", text: undefined },
    { id: "e-txt", type: "assistant-text", text: "Some agent response" },
    { id: "e-think", type: "assistant-text", detail: "thinking", text: "thinking..." },
  ];

  it("renders a mixed bag of entry types without crashing", () => {
    expect(() =>
      render(<LogViewer entries={ENTRIES} activeJob={ACTIVE_JOB} wsState="open" />)
    ).not.toThrow();
  });

  it("renders system entry without crash", () => {
    const entries: LogEntry[] = [
      { id: "e1", type: "system", detail: "init", text: undefined },
    ];
    expect(() =>
      render(<LogViewer entries={entries} activeJob={ACTIVE_JOB} wsState="open" />)
    ).not.toThrow();
  });

  it("renders warning entry without crash", () => {
    const entries: LogEntry[] = [
      { id: "e1", type: "warning", message: "Something went wrong", text: undefined },
    ];
    expect(() =>
      render(<LogViewer entries={entries} activeJob={ACTIVE_JOB} wsState="open" />)
    ).not.toThrow();
  });

  it("renders error entry without crash", () => {
    const entries: LogEntry[] = [
      { id: "e1", type: "error", message: "Fatal error", text: undefined },
    ];
    expect(() =>
      render(<LogViewer entries={entries} activeJob={ACTIVE_JOB} wsState="open" />)
    ).not.toThrow();
  });

  it("renders stream-end entry without crash", () => {
    const entries: LogEntry[] = [
      { id: "e1", type: "stream-end", reason: "done", text: undefined },
    ];
    expect(() =>
      render(<LogViewer entries={entries} activeJob={ACTIVE_JOB} wsState="open" />)
    ).not.toThrow();
  });

  it("renders verdict entry without crash", () => {
    const entries: LogEntry[] = [
      { id: "e1", type: "verdict", verdictResult: "PASS", text: undefined },
    ];
    expect(() =>
      render(<LogViewer entries={entries} activeJob={ACTIVE_JOB} wsState="open" />)
    ).not.toThrow();
  });

  it("renders raw entry without crash", () => {
    const entries: LogEntry[] = [
      { id: "e1", type: "raw", text: "raw npm output here" },
    ];
    expect(() =>
      render(<LogViewer entries={entries} activeJob={ACTIVE_JOB} wsState="open" />)
    ).not.toThrow();
  });

  it("renders entrypoint-group entry without crash", () => {
    const entries: LogEntry[] = [
      {
        id: "e1",
        type: "entrypoint-group",
        text: "Environment setup",
        children: [
          { id: "c1", type: "entrypoint-ok", text: "git clone ✓" },
          { id: "c2", type: "entrypoint-info", detail: "branch", text: "fix/issue-1036" },
        ],
      },
    ];
    expect(() =>
      render(<LogViewer entries={entries} activeJob={ACTIVE_JOB} wsState="open" />)
    ).not.toThrow();
  });

  it("renders entrypoint-group with fatal error without crash", () => {
    const entries: LogEntry[] = [
      {
        id: "e1",
        type: "entrypoint-group",
        text: "Environment setup",
        children: [
          { id: "c1", type: "entrypoint-fatal", text: "npm ci failed" },
        ],
      },
    ];
    expect(() =>
      render(<LogViewer entries={entries} activeJob={ACTIVE_JOB} wsState="open" />)
    ).not.toThrow();
  });

  it("renders tool-batch entry without crash", () => {
    const entries: LogEntry[] = [
      {
        id: "e1",
        type: "tool-batch",
        text: "2 tools",
        complete: true,
        children: [
          { id: "c1", type: "tool-use", text: "Read", toolName: "Read" },
          { id: "c2", type: "tool-use", text: "Glob", toolName: "Glob" },
        ],
      },
    ];
    expect(() =>
      render(<LogViewer entries={entries} activeJob={ACTIVE_JOB} wsState="open" />)
    ).not.toThrow();
  });

  it("renders thinking entry styled differently (no agent bubble)", () => {
    const entries: LogEntry[] = [
      { id: "e1", type: "assistant-text", detail: "thinking", text: "Let me think..." },
    ];
    const { container } = render(
      <LogViewer entries={entries} activeJob={ACTIVE_JOB} wsState="open" />
    );
    expect(container.querySelector(".ev-thinking")).not.toBeNull();
    // A thinking entry should not produce an agent-bubble
    expect(container.querySelector(".agent-bubble")).toBeNull();
  });
});

// ── Session ID truncation in header ───────────────────────────────────────────

describe("Session ID truncation in SessionHeader (issue #1036)", () => {
  it("shows truncated session ID (last 8 chars) for long session IDs", () => {
    const { container } = render(
      <LogViewer entries={[text("hello")]} activeJob={ACTIVE_JOB} wsState="open" />
    );
    // sessionId = "issue-1036-loki-active" (22 chars) → last 8 = "i-active"
    const chip = container.querySelector(".session-id-chip");
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toContain("i-active");
  });

  it("session ID chip has correct aria-label", () => {
    const { container } = render(
      <LogViewer entries={[text("hello")]} activeJob={ACTIVE_JOB} wsState="open" />
    );
    const chip = container.querySelector(".session-id-chip");
    expect(chip!.getAttribute("aria-label")).toBe(
      `Session ID: ${ACTIVE_JOB.sessionId}`
    );
  });

  it("session ID chip has full sessionId in title for short IDs", () => {
    const shortJob: DisplayJob = {
      ...ACTIVE_JOB,
      sessionId: "abc12345",
    };
    const { container } = render(
      <LogViewer entries={[text("hello")]} activeJob={shortJob} wsState="open" />
    );
    const chip = container.querySelector(".session-id-chip");
    expect(chip!.textContent).toContain("abc12345");
  });
});

// ── Accessibility: aria-label on main content areas ───────────────────────────

describe("Accessibility — aria-label on content areas (issue #1036)", () => {
  it("main content has aria-label='Log viewer'", () => {
    const { container } = render(
      <LogViewer entries={[text("hi")]} activeJob={ACTIVE_JOB} wsState="open" />
    );
    const main = container.querySelector("main");
    expect(main!.getAttribute("aria-label")).toBe("Log viewer");
  });

  it("empty state has aria-label='No session selected'", () => {
    const { container } = render(
      <LogViewer entries={[]} activeJob={null} wsState="closed" />
    );
    const emptyState = container.querySelector("[aria-label='No session selected']");
    expect(emptyState).not.toBeNull();
  });

  it("log-terminal has role='log' and aria-live='polite'", () => {
    const { container } = render(
      <LogViewer entries={[text("data")]} activeJob={ACTIVE_JOB} wsState="open" />
    );
    const terminal = container.querySelector(".log-terminal");
    expect(terminal!.getAttribute("role")).toBe("log");
    expect(terminal!.getAttribute("aria-live")).toBe("polite");
  });

  it("log-terminal has aria-label='Session logs'", () => {
    const { container } = render(
      <LogViewer entries={[text("data")]} activeJob={ACTIVE_JOB} wsState="open" />
    );
    const terminal = container.querySelector(".log-terminal");
    expect(terminal!.getAttribute("aria-label")).toBe("Session logs");
  });
});

// ── Fixture speed controls ────────────────────────────────────────────────────

describe("Fixture speed controls render without crash (issue #1036)", () => {
  it("renders speed controls when isFixture=true", () => {
    const { container } = render(
      <LogViewer
        entries={[text("data")]}
        activeJob={ACTIVE_JOB}
        wsState="open"
        isFixture={true}
      />
    );
    expect(container.querySelector(".speed-controls")).not.toBeNull();
    expect(container.querySelector(".speed-btn")).not.toBeNull();
  });

  it("does not render speed controls when isFixture is not set", () => {
    const { container } = render(
      <LogViewer entries={[text("data")]} activeJob={ACTIVE_JOB} wsState="open" />
    );
    expect(container.querySelector(".speed-controls")).toBeNull();
  });
});

// ── wsState variations ────────────────────────────────────────────────────────

describe("wsState variations render without crash (issue #1036)", () => {
  const states: Array<"connecting" | "open" | "closed" | "error"> = [
    "connecting", "open", "closed", "error",
  ];

  for (const state of states) {
    it(`renders without crash with wsState="${state}"`, () => {
      expect(() =>
        render(
          <LogViewer entries={[text("data")]} activeJob={ACTIVE_JOB} wsState={state} />
        )
      ).not.toThrow();
    });
  }
});
