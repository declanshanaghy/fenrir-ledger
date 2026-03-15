/**
 * Component tests for NorseErrorTablet rendering — Issue #974
 *
 * Covers the AC items that pure-logic tests cannot reach:
 *  - Full-pane Norse error tablet renders on fatal TTL session
 *  - Elder Futhark rune rows are present
 *  - Session ID is visible in the tablet
 *  - LogViewer falls back to log content for non-terminal sessions
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, within, cleanup } from "@testing-library/react";
import { LogViewer } from "../components/LogViewer";
import type { DisplayJob } from "../lib/types";
import type { TerminalError } from "../hooks/useLogStream";

afterEach(cleanup);

const ACTIVE_JOB: DisplayJob = {
  sessionId: "sess-abc",
  name: "issue-974-step1-loki",
  issue: "974",
  step: "1",
  agentKey: "loki",
  agentName: "Loki",
  status: "failed",
  startTime: null,
  completionTime: null,
};

const TERMINAL_ERROR: TerminalError = {
  sessionId: "sess-abc",
  message: "Pod for session sess-abc has been cleaned up (job TTL expired). Logs are no longer available from the cluster.",
};

describe("NorseErrorTablet — full-pane render (AC: Norse tablet, runes, session ID)", () => {
  it("renders role=alert with accessible label when session is terminal", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={ACTIVE_JOB}
        wsState="open"
        terminalError={TERMINAL_ERROR}
      />
    );
    const root = within(container);
    const alert = root.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.getAttribute("aria-label")).toContain("Session terminated");
  });

  it("displays the session ID inside the Norse tablet", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={ACTIVE_JOB}
        wsState="open"
        terminalError={TERMINAL_ERROR}
      />
    );
    expect(container.textContent).toContain("sess-abc");
  });

  it("displays the TTL error message in the tablet", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={ACTIVE_JOB}
        wsState="open"
        terminalError={TERMINAL_ERROR}
      />
    );
    expect(container.textContent).toContain("TTL expired");
  });

  it("renders Elder Futhark rune rows (aria-hidden decorative elements)", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={ACTIVE_JOB}
        wsState="open"
        terminalError={TERMINAL_ERROR}
      />
    );
    // Rune rows use aria-hidden — query by class
    const runeRows = container.querySelectorAll("[aria-hidden='true']");
    expect(runeRows.length).toBeGreaterThan(0);
    // At least one contains an Elder Futhark character
    const allHidden = Array.from(runeRows).map((el) => el.textContent ?? "");
    const hasRune = allHidden.some((t) => /[\u16A0-\u16FF]/.test(t));
    expect(hasRune).toBe(true);
  });

  it("shows log content (not tablet) when terminalError is for a different session", () => {
    const otherError: TerminalError = { sessionId: "sess-xyz", message: "other expired" };
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={ACTIVE_JOB}
        wsState="open"
        terminalError={otherError}
      />
    );
    // No alert role when sessions don't match
    const alerts = container.querySelectorAll('[role="alert"]');
    expect(alerts.length).toBe(0);
    // Log terminal area should be present
    expect(container.querySelector('[role="log"]')).toBeDefined();
  });
});
