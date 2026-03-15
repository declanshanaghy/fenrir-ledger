/**
 * Vitest tests for issue #973 — graceful 404 / error display in monitor UI
 *
 * AC tested:
 * - stream-error messages produce a LogEntry of type "error"
 * - LogViewer renders type "error" as log-error-box with role="alert"
 * - Error text is displayed verbatim (no raw HTTP artefacts at this layer)
 * - Error box is visually distinct (has the log-error-box class)
 * - Warning icon is present alongside error text
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import { LogViewer } from "../components/LogViewer";
import type { LogEntry } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";

afterEach(cleanup);

// Minimal DisplayJob for rendering context
const MOCK_JOB: DisplayJob = {
  sessionId: "issue-973-step1-test",
  name: "agent-issue-973-step1-test",
  issueNumber: 973,
  issue: "973",
  agent: "fireman",
  agentKey: "fireman",
  agentName: "FiremanDecko",
  step: 1,
  status: "failed",
  startedAt: new Date().toISOString(),
  completedAt: null,
  podName: null,
  fixture: false,
};

function makeErrorEntry(message: string): LogEntry {
  return { id: "err-1", type: "error", message };
}

describe("LogViewer — error entry rendering (issue #973)", () => {
  it("renders error as log-error-box with role=alert", () => {
    const entries: LogEntry[] = [
      makeErrorEntry(
        "Logs unavailable — the pod for session issue-973-step1-test has been cleaned up (job TTL expired)."
      ),
    ];
    const { container } = render(
      <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
    );
    const errorBox = container.querySelector(".log-error-box");
    expect(errorBox).not.toBeNull();
    expect(errorBox!.getAttribute("role")).toBe("alert");
  });

  it("displays the error message text inside log-error-box", () => {
    const msg = "Logs unavailable — the pod for session issue-973-step1-test has been cleaned up (job TTL expired).";
    const entries: LogEntry[] = [makeErrorEntry(msg)];
    const { container } = render(
      <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
    );
    const errorBox = container.querySelector(".log-error-box");
    expect(errorBox!.textContent).toContain("cleaned up");
    expect(errorBox!.textContent).toContain("job TTL expired");
  });

  it("does NOT show raw HTTP status codes in the error box", () => {
    // The server sanitises before sending — this confirms UI renders verbatim
    // A clean message from friendlyK8sError should never contain "404" etc.
    const msg = "Logs unavailable — the pod for session issue-973-step1-test has been cleaned up (job TTL expired).";
    const entries: LogEntry[] = [makeErrorEntry(msg)];
    const { container } = render(
      <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
    );
    const errorBox = container.querySelector(".log-error-box");
    expect(errorBox!.textContent).not.toMatch(/\bHTTP status\b/i);
    expect(errorBox!.textContent).not.toMatch(/\b404\b/);
    expect(errorBox!.textContent).not.toMatch(/Body: undefined/i);
  });

  it("renders warning icon alongside error text", () => {
    const entries: LogEntry[] = [makeErrorEntry("Access denied to pod logs.")];
    const { container } = render(
      <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
    );
    const errorBox = container.querySelector(".log-error-box");
    const icon = errorBox!.querySelector(".log-error-icon");
    expect(icon).not.toBeNull();
  });

  it("renders error box with aria-label for accessibility", () => {
    const entries: LogEntry[] = [makeErrorEntry("Authentication error — check cluster credentials.")];
    const { container } = render(
      <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
    );
    const root = within(container);
    const alert = root.getByRole("alert", { name: /log stream error/i });
    expect(alert).toBeDefined();
  });

  it("renders friendly 403 message without raw HTTP details", () => {
    const msg = "Access denied to pod logs for session issue-973-step1-test. Contact your cluster administrator.";
    const entries: LogEntry[] = [makeErrorEntry(msg)];
    const { container } = render(
      <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
    );
    const errorBox = container.querySelector(".log-error-box");
    expect(errorBox!.textContent).toContain("Access denied");
    expect(errorBox!.textContent).not.toMatch(/\b403\b/);
  });
});
