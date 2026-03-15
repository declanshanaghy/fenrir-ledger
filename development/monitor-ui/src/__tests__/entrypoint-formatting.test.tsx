/**
 * Vitest tests for issue #987 — format sandbox entrypoint section in monitor log viewer
 *
 * AC tested:
 * - Kubectl timestamp prefixes are stripped before pattern matching
 * - Entrypoint lines are correctly identified between the two marker lines
 * - Session/Branch/Model displayed as a compact info card
 * - FATAL lines get special formatting (ep-fatal + role=alert)
 * - WARN lines use existing warning type
 * - Non-entrypoint lines are unaffected (rendered as raw)
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { LogViewer } from "../components/LogViewer";
import { useLogStream } from "../hooks/useLogStream";
import type { LogEntry } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";

afterEach(cleanup);

const MOCK_JOB: DisplayJob = {
  sessionId: "issue-987-test",
  name: "agent-issue-987-test",
  issueNumber: 987,
  issue: "987",
  agent: "fireman",
  agentKey: "fireman",
  agentName: "FiremanDecko",
  step: 1,
  status: "running",
  startedAt: new Date().toISOString(),
  completedAt: null,
  podName: null,
  fixture: false,
};

// Helper: send a log-line message through the hook
function sendLine(handleMessage: ReturnType<typeof useLogStream>["handleMessage"], line: string) {
  act(() => {
    handleMessage({ type: "log-line", line });
  });
}

// AC-1 + AC-2: Kubectl timestamp prefix is stripped and entrypoint section is tracked
describe("Timestamp stripping and entrypoint section detection (issue #987)", () => {
  it("strips kubectl timestamp prefix before matching the entrypoint start marker", () => {
    const { result } = renderHook(() => useLogStream());
    // Timestamp-prefixed start marker — without stripping this would not match
    sendLine(result.current.handleMessage, "2026-03-15T19:58:07Z === Agent Sandbox Entrypoint ===");
    const entries = result.current.entries;
    expect(entries.length).toBeGreaterThan(0);
    const header = entries.find((e) => e.type === "entrypoint-header");
    expect(header).toBeDefined();
    expect(header!.text).toBe("Agent Sandbox Entrypoint");
  });

  it("identifies entrypoint-info lines (Session/Branch/Model) inside the section", () => {
    const { result } = renderHook(() => useLogStream());
    sendLine(result.current.handleMessage, "=== Agent Sandbox Entrypoint ===");
    sendLine(result.current.handleMessage, "Session: abc-123");
    sendLine(result.current.handleMessage, "Branch: feat/issue-987");
    sendLine(result.current.handleMessage, "Model: claude-sonnet-4-6");
    const infos = result.current.entries.filter((e) => e.type === "entrypoint-info");
    expect(infos).toHaveLength(3);
    expect(infos.find((e) => e.detail === "Session")!.text).toBe("abc-123");
    expect(infos.find((e) => e.detail === "Branch")!.text).toBe("feat/issue-987");
    expect(infos.find((e) => e.detail === "Model")!.text).toBe("claude-sonnet-4-6");
  });
});

// AC-4: FATAL lines produce entrypoint-fatal entries and render with role=alert
describe("FATAL line formatting (issue #987)", () => {
  it("renders entrypoint-fatal entry as ep-fatal div with role=alert", () => {
    const entry: LogEntry = {
      id: "fatal-1",
      type: "entrypoint-fatal",
      text: "Git clone failed: repo not found",
    };
    const { container } = render(
      <LogViewer entries={[entry]} activeJob={MOCK_JOB} wsState="open" />
    );
    const fatalEl = container.querySelector(".ep-fatal");
    expect(fatalEl).not.toBeNull();
    expect(fatalEl!.getAttribute("role")).toBe("alert");
    expect(fatalEl!.textContent).toContain("Git clone failed");
    // X badge present
    const badge = fatalEl!.querySelector(".ep-fatal-badge");
    expect(badge).not.toBeNull();
  });
});

// AC-5: WARN lines produce warning-type entries
describe("WARN line classification (issue #987)", () => {
  it("classifies [WARN] lines as warning type inside the entrypoint section", () => {
    const { result } = renderHook(() => useLogStream());
    sendLine(result.current.handleMessage, "=== Agent Sandbox Entrypoint ===");
    sendLine(result.current.handleMessage, "[WARN] npm deprecated package detected");
    const warnings = result.current.entries.filter((e) => e.type === "warning");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toBe("npm deprecated package detected");
  });
});

// AC-3 + AC-6: Info card rendered inside EntrypointGroup; non-entrypoint lines unaffected
describe("EntrypointGroup info card and non-entrypoint lines (issue #987)", () => {
  it("renders ep-info-card inside EntrypointGroup when info items are present", () => {
    const infoChild: LogEntry = { id: "info-1", type: "entrypoint-info", detail: "Session", text: "s-abc" };
    const okChild: LogEntry = { id: "ok-1", type: "entrypoint-ok", text: "git clone" };
    const groupEntry: LogEntry = {
      id: "grp-1",
      type: "entrypoint-group",
      text: "Agent Sandbox Setup",
      children: [infoChild, okChild],
    };
    const { container } = render(
      <LogViewer entries={[groupEntry]} activeJob={MOCK_JOB} wsState="open" />
    );
    // Open the accordion to reveal body content
    const header = container.querySelector(".ep-group-header") as HTMLElement;
    expect(header).not.toBeNull();
    act(() => { header.click(); });
    const card = container.querySelector(".ep-info-card");
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain("Session:");
    expect(card!.textContent).toContain("s-abc");
  });

  it("lines outside the entrypoint section are rendered as raw (unaffected)", () => {
    const { result } = renderHook(() => useLogStream());
    // Send a line before any entrypoint markers — it should not be entrypoint-typed
    sendLine(result.current.handleMessage, "Some pre-entrypoint system log line");
    const entries = result.current.entries;
    const rawEntries = entries.filter((e) => e.type === "raw");
    expect(rawEntries).toHaveLength(1);
    expect(rawEntries[0]!.text).toBe("Some pre-entrypoint system log line");
    // No entrypoint-typed entries
    const entrypointEntries = entries.filter((e) =>
      ["entrypoint-header", "entrypoint-ok", "entrypoint-info", "entrypoint-fatal"].includes(e.type)
    );
    expect(entrypointEntries).toHaveLength(0);
  });
});
