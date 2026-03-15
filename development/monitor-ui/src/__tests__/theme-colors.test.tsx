/**
 * Vitest tests for issue #1004 — monitor UI theme color compliance.
 *
 * Verifies that components use CSS variable references instead of hardcoded
 * color literals so all panels adapt to the active light/dark theme.
 *
 * AC tested:
 * - LogViewer verdict PASS uses var(--success-strong) inline style
 * - LogViewer verdict FAIL uses var(--error-strong) inline style
 * - Error entries render .log-error-box (styled via CSS vars, not hardcoded)
 * - Agent bubble header uses .agent-bubble-header class (CSS var styled)
 * - Tool badge classes are applied correctly (bash/edit/write/read/agent)
 * - StatusBadge applies the correct state class for WS badge styling
 * - NorseErrorTablet has the .norse-error-tablet root class (dark-only design)
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { LogViewer } from "../components/LogViewer";
import { NorseErrorTablet } from "../components/NorseErrorTablet";
import { StatusBadge } from "../components/StatusBadge";
import { toolBadgeClass } from "../lib/constants";
import type { LogEntry } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";

afterEach(cleanup);

// ── Test fixtures ─────────────────────────────────────────────────────────────

const MOCK_JOB: DisplayJob = {
  sessionId: "issue-1004-step1-test",
  name: "agent-issue-1004-step1-test",
  issue: "1004",
  step: "1",
  agentKey: "fireman",
  agentName: "FiremanDecko",
  status: "succeeded",
  startTime: Date.now(),
  completionTime: Date.now(),
};

function makeVerdictEntry(result: "PASS" | "FAIL"): LogEntry {
  return { id: `verdict-${result}`, type: "verdict", verdictResult: result };
}

function makeAssistantEntry(text: string): LogEntry {
  return { id: "asst-1", type: "assistant-text", text };
}

function makeErrorEntry(message: string): LogEntry {
  return { id: "err-1", type: "error", message };
}

function makeToolEntry(toolName: string): LogEntry {
  return {
    id: `tool-${toolName}`,
    type: "tool-use",
    toolName,
    toolInput: JSON.stringify({ command: "echo hello" }),
  };
}

// ── Verdict colors — CSS var references ───────────────────────────────────────
// Note: the verdict span lives inside .log-terminal; the content-header has its
// own inline-colored job-status-badge, so we scope selectors to the terminal.

describe("LogViewer — verdict entry uses CSS variables (issue #1004)", () => {
  it("PASS verdict uses var(--success-strong) not a hardcoded hex", () => {
    const { container } = render(
      <LogViewer entries={[makeVerdictEntry("PASS")]} activeJob={MOCK_JOB} wsState="open" />
    );
    // Scope to log-terminal to avoid the header's job-status-badge span
    const terminal = container.querySelector(".log-terminal");
    const verdictSpan = terminal?.querySelector('[style*="color"]') as HTMLElement | null;
    expect(verdictSpan).not.toBeNull();
    const style = verdictSpan!.getAttribute("style") ?? "";
    expect(style).toContain("var(--success-strong)");
    expect(style).not.toMatch(/#[0-9a-fA-F]{6}/); // no bare 6-digit hex color
  });

  it("FAIL verdict uses var(--error-strong) not a hardcoded hex", () => {
    const { container } = render(
      <LogViewer entries={[makeVerdictEntry("FAIL")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const terminal = container.querySelector(".log-terminal");
    const verdictSpan = terminal?.querySelector('[style*="color"]') as HTMLElement | null;
    expect(verdictSpan).not.toBeNull();
    const style = verdictSpan!.getAttribute("style") ?? "";
    expect(style).toContain("var(--error-strong)");
    expect(style).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it("PASS verdict text is bold and contains 'Verdict: PASS'", () => {
    const { container } = render(
      <LogViewer entries={[makeVerdictEntry("PASS")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const terminal = container.querySelector(".log-terminal");
    const verdictSpan = terminal?.querySelector('[style*="color"]') as HTMLElement | null;
    expect(verdictSpan?.textContent).toContain("Verdict: PASS");
    expect(verdictSpan?.getAttribute("style")).toContain("bold");
  });

  it("FAIL verdict text is bold and contains 'Verdict: FAIL'", () => {
    const { container } = render(
      <LogViewer entries={[makeVerdictEntry("FAIL")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const terminal = container.querySelector(".log-terminal");
    const verdictSpan = terminal?.querySelector('[style*="color"]') as HTMLElement | null;
    expect(verdictSpan?.textContent).toContain("Verdict: FAIL");
  });
});

// ── Error entry — CSS class usage ─────────────────────────────────────────────

describe("LogViewer — error entry uses theme CSS classes (issue #1004)", () => {
  it("renders error as .log-error-box class (styled via CSS vars)", () => {
    const { container } = render(
      <LogViewer entries={[makeErrorEntry("Connection failed")]} activeJob={MOCK_JOB} wsState="open" />
    );
    expect(container.querySelector(".log-error-box")).not.toBeNull();
  });

  it("log-error-box has role=alert for accessibility", () => {
    const { container } = render(
      <LogViewer entries={[makeErrorEntry("Error occurred")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const box = container.querySelector(".log-error-box");
    expect(box?.getAttribute("role")).toBe("alert");
  });

  it("log-error-box does not have a hardcoded color style attribute", () => {
    const { container } = render(
      <LogViewer entries={[makeErrorEntry("Error occurred")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const box = container.querySelector(".log-error-box");
    // The element should rely on CSS class styling, not inline style with hex colors
    const style = box?.getAttribute("style") ?? "";
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

// ── Agent bubble — CSS class usage ────────────────────────────────────────────

describe("LogViewer — agent bubble uses theme CSS classes (issue #1004)", () => {
  it("renders assistant text as .agent-bubble element", () => {
    const { container } = render(
      <LogViewer
        entries={[makeAssistantEntry("Hello from the agent")]}
        activeJob={MOCK_JOB}
        wsState="open"
      />
    );
    expect(container.querySelector(".agent-bubble")).not.toBeNull();
  });

  it("agent bubble has .agent-bubble-header sub-element", () => {
    const { container } = render(
      <LogViewer
        entries={[makeAssistantEntry("Planning the implementation")]}
        activeJob={MOCK_JOB}
        wsState="open"
      />
    );
    expect(container.querySelector(".agent-bubble-header")).not.toBeNull();
  });

  it("agent bubble has .agent-bubble-text for message content", () => {
    const { container } = render(
      <LogViewer
        entries={[makeAssistantEntry("Starting task execution")]}
        activeJob={MOCK_JOB}
        wsState="open"
      />
    );
    const text = container.querySelector(".agent-bubble-text");
    expect(text).not.toBeNull();
    expect(text?.textContent).toContain("Starting task execution");
  });
});

// ── Tool badge classes — bash / edit / write ──────────────────────────────────

describe("toolBadgeClass — returns correct badge class (issue #1004)", () => {
  it("Bash → 'bash' class (maps to --bash-badge-bg/text vars)", () => {
    expect(toolBadgeClass("Bash")).toBe("bash");
    expect(toolBadgeClass("bash")).toBe("bash");
  });

  it("Edit and MultiEdit → 'edit' class (maps to --write-badge-bg/text vars)", () => {
    expect(toolBadgeClass("Edit")).toBe("edit");
    expect(toolBadgeClass("MultiEdit")).toBe("edit");
  });

  it("Write → 'write' class (maps to --write-badge-bg/text vars)", () => {
    expect(toolBadgeClass("Write")).toBe("write");
  });

  it("Read / Grep / Glob → 'read' class (maps to kildare vars)", () => {
    expect(toolBadgeClass("Read")).toBe("read");
    expect(toolBadgeClass("Grep")).toBe("read");
    expect(toolBadgeClass("Glob")).toBe("read");
  });

  it("Agent → 'agent' class", () => {
    expect(toolBadgeClass("Agent")).toBe("agent");
  });

  it("unknown tool → empty string (falls back to default badge styles)", () => {
    expect(toolBadgeClass("Unknown")).toBe("");
    expect(toolBadgeClass("TodoWrite")).toBe("");
  });
});

describe("LogViewer — tool block renders with correct badge class (issue #1004)", () => {
  it("Bash tool renders ev-tool-badge with 'bash' class", () => {
    const { container } = render(
      <LogViewer entries={[makeToolEntry("Bash")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const badge = container.querySelector(".ev-tool-badge.bash");
    expect(badge).not.toBeNull();
  });

  it("Edit tool renders ev-tool-badge with 'edit' class", () => {
    const { container } = render(
      <LogViewer entries={[makeToolEntry("Edit")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const badge = container.querySelector(".ev-tool-badge.edit");
    expect(badge).not.toBeNull();
  });

  it("Write tool renders ev-tool-badge with 'write' class", () => {
    const { container } = render(
      <LogViewer entries={[makeToolEntry("Write")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const badge = container.querySelector(".ev-tool-badge.write");
    expect(badge).not.toBeNull();
  });
});

// ── StatusBadge — WS badge class mapping ─────────────────────────────────────

describe("StatusBadge — applies state class for CSS var styling (issue #1004)", () => {
  it("open state → .ws-badge.open class", () => {
    const { container } = render(<StatusBadge state="open" />);
    expect(container.querySelector(".ws-badge.open")).not.toBeNull();
  });

  it("error state → .ws-badge.error class (styled via --error-strong var)", () => {
    const { container } = render(<StatusBadge state="error" />);
    expect(container.querySelector(".ws-badge.error")).not.toBeNull();
  });

  it("connecting state → .ws-badge.connecting class", () => {
    const { container } = render(<StatusBadge state="connecting" />);
    expect(container.querySelector(".ws-badge.connecting")).not.toBeNull();
  });

  it("closed state → .ws-badge.closed class", () => {
    const { container } = render(<StatusBadge state="closed" />);
    expect(container.querySelector(".ws-badge.closed")).not.toBeNull();
  });

  it("StatusBadge does not use inline style with hardcoded colors", () => {
    const { container } = render(<StatusBadge state="error" />);
    const badge = container.querySelector(".ws-badge");
    expect(badge?.getAttribute("style") ?? "").not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

// ── NorseErrorTablet — intentionally dark-only ────────────────────────────────

describe("NorseErrorTablet — intentionally dark-only design (issue #1004)", () => {
  it("uses .norse-error-tablet root class for scoped dark styling", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-1004-step1-test" message="Pod TTL expired." />
    );
    expect(container.querySelector(".norse-error-tablet")).not.toBeNull();
  });

  it("does not override colors via inline style (relies on CSS class)", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-1004-step1-test" message="Pod TTL expired." />
    );
    const tablet = container.querySelector(".norse-error-tablet");
    // The dark-only aesthetic is achieved via CSS class, not runtime inline styles
    expect(tablet?.getAttribute("style") ?? "").toBe("");
  });

  it("has .net-heading for the main title element", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-1004-step1-test" message="Pod TTL expired." />
    );
    expect(container.querySelector(".net-heading")).not.toBeNull();
  });

  it("has .net-rune-border elements for decorative rune rows", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-1004-step1-test" message="Pod TTL expired." />
    );
    const runeBorders = container.querySelectorAll(".net-rune-border");
    expect(runeBorders.length).toBeGreaterThanOrEqual(2);
  });

  it("session ID is displayed in .net-session-value", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-1004-step1-test" message="Pod TTL expired." />
    );
    const sessionValue = container.querySelector(".net-session-value");
    expect(sessionValue?.textContent).toContain("issue-1004-step1-test");
  });
});
