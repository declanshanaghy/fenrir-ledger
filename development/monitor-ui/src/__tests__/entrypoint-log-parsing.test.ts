/**
 * Vitest tests for issue #990 — K8s timestamp prefix breaks entrypoint log parsing
 *
 * AC tested:
 * - K8s ISO timestamp prefix is correctly stripped by the server-side regex
 * - parseEntrypointLine correctly classifies all entrypoint line types
 * - Lines with no timestamp (fixture replay) continue to parse correctly
 *
 * Loki augmented:
 * - AC: "Starting Claude Code" collapses prior entries into entrypoint-group (handleMessage)
 * - Session ID with colons in value is captured in full
 * - Non-Z timezone format (+00:00) is NOT stripped (future-proofing safety)
 * - Task prompt buffering produces entrypoint-task entry via handleMessage
 */

import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { parseEntrypointLine, useLogStream } from "../hooks/useLogStream";

// The server-side strip regex used in ws.ts — tested in isolation here so
// regressions are caught without spinning up the full WebSocket server.
const K8S_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/;

function stripTimestamp(line: string): string {
  return line.replace(K8S_TIMESTAMP_RE, "");
}

describe("K8s timestamp strip regex", () => {
  it("strips a nanosecond-precision timestamp", () => {
    expect(stripTimestamp("2026-03-15T20:10:19.903085617Z === Agent Sandbox Entrypoint ==="))
      .toBe("=== Agent Sandbox Entrypoint ===");
  });

  it("strips a millisecond-precision timestamp", () => {
    expect(stripTimestamp("2026-03-15T20:10:19.903Z [ok] git credentials configured"))
      .toBe("[ok] git credentials configured");
  });

  it("strips a second-precision timestamp", () => {
    expect(stripTimestamp("2026-03-15T20:10:19Z Session: issue-983-step1-test"))
      .toBe("Session: issue-983-step1-test");
  });

  it("leaves lines without a timestamp unchanged", () => {
    expect(stripTimestamp("[ok] git credentials configured"))
      .toBe("[ok] git credentials configured");
    expect(stripTimestamp("=== Agent Sandbox Entrypoint ==="))
      .toBe("=== Agent Sandbox Entrypoint ===");
  });

  it("does not strip mid-line timestamps", () => {
    const line = "some text 2026-03-15T20:10:19Z more text";
    expect(stripTimestamp(line)).toBe(line);
  });
});

describe("parseEntrypointLine — no timestamps (fixture replay)", () => {
  it("parses === header === as entrypoint-header", () => {
    const entry = parseEntrypointLine("=== Agent Sandbox Entrypoint ===");
    expect(entry.type).toBe("entrypoint-header");
    expect(entry.text).toBe("Agent Sandbox Entrypoint");
  });

  it("parses [ok] line as entrypoint-ok", () => {
    const entry = parseEntrypointLine("[ok] git credentials configured");
    expect(entry.type).toBe("entrypoint-ok");
    expect(entry.text).toBe("git credentials configured");
  });

  it("parses Session: key-value as entrypoint-info", () => {
    const entry = parseEntrypointLine("Session: issue-983-step1-test");
    expect(entry.type).toBe("entrypoint-info");
    expect(entry.detail).toBe("Session");
    expect(entry.text).toBe("issue-983-step1-test");
  });

  it("parses Branch: key-value as entrypoint-info", () => {
    const entry = parseEntrypointLine("Branch: fix/issue-983-test");
    expect(entry.type).toBe("entrypoint-info");
    expect(entry.detail).toBe("Branch");
  });

  it("parses Model: key-value as entrypoint-info", () => {
    const entry = parseEntrypointLine("Model: claude-sonnet-4-6");
    expect(entry.type).toBe("entrypoint-info");
    expect(entry.detail).toBe("Model");
  });

  it("parses Working directory: key-value as entrypoint-info", () => {
    const entry = parseEntrypointLine("Working directory: /workspace/repo");
    expect(entry.type).toBe("entrypoint-info");
    expect(entry.detail).toBe("Working directory");
  });

  it("parses --- TASK PROMPT --- as entrypoint-header", () => {
    const entry = parseEntrypointLine("--- TASK PROMPT ---");
    expect(entry.type).toBe("entrypoint-header");
    expect(entry.text).toBe("TASK PROMPT");
  });

  it("parses --- END PROMPT --- as entrypoint-header", () => {
    const entry = parseEntrypointLine("--- END PROMPT ---");
    expect(entry.type).toBe("entrypoint-header");
    expect(entry.text).toBe("END PROMPT");
  });

  it("parses unknown lines as raw", () => {
    const entry = parseEntrypointLine("npm warn deprecated foo@1.0.0");
    expect(entry.type).toBe("raw");
  });
});

describe("parseEntrypointLine — after timestamp stripping (live K8s path)", () => {
  // Simulate what ws.ts does: strip timestamp, then client parses the clean line.
  function parseLiveK8sLine(rawLine: string) {
    return parseEntrypointLine(stripTimestamp(rawLine));
  }

  it("parses timestamped === header === correctly", () => {
    const entry = parseLiveK8sLine("2026-03-15T20:10:19.903085617Z === Agent Sandbox Entrypoint ===");
    expect(entry.type).toBe("entrypoint-header");
    expect(entry.text).toBe("Agent Sandbox Entrypoint");
  });

  it("parses timestamped [ok] line correctly", () => {
    const entry = parseLiveK8sLine("2026-03-15T20:10:19.942174358Z [ok] git credentials configured");
    expect(entry.type).toBe("entrypoint-ok");
    expect(entry.text).toBe("git credentials configured");
  });

  it("parses timestamped Session: line correctly", () => {
    const entry = parseLiveK8sLine("2026-03-15T20:10:19.903168207Z Session: issue-983-step1-firemandecko-59116e60");
    expect(entry.type).toBe("entrypoint-info");
    expect(entry.detail).toBe("Session");
    expect(entry.text).toBe("issue-983-step1-firemandecko-59116e60");
  });

  it("parses timestamped === Starting Claude Code === line correctly", () => {
    const entry = parseLiveK8sLine("2026-03-15T20:10:25.000000000Z === Starting Claude Code ===");
    expect(entry.type).toBe("entrypoint-header");
    expect(entry.text).toBe("Starting Claude Code");
  });

  it("parses timestamped --- TASK PROMPT --- correctly", () => {
    const entry = parseLiveK8sLine("2026-03-15T20:10:20.123456789Z --- TASK PROMPT ---");
    expect(entry.type).toBe("entrypoint-header");
    expect(entry.text).toBe("TASK PROMPT");
  });

  it("does not mis-parse a plain raw line that happens to have numbers", () => {
    const entry = parseLiveK8sLine("2026-03-15T20:10:20.000Z Run npm install...");
    expect(entry.type).toBe("raw");
  });
});

// ── Loki augmentation — issue #990 gaps ──────────────────────────────────────

describe("parseEntrypointLine — edge cases (Loki)", () => {
  it("captures Session value containing colons in full", () => {
    // Session IDs can include colons in agent-naming schemes
    const entry = parseEntrypointLine("Session: issue-990:fix:firemandecko-abc123");
    expect(entry.type).toBe("entrypoint-info");
    expect(entry.detail).toBe("Session");
    expect(entry.text).toBe("issue-990:fix:firemandecko-abc123");
  });

  it("does NOT strip non-Z timezone prefix (+00:00 format)", () => {
    // K8s always emits Z, but verify other formats don't silently corrupt lines
    const raw = "2026-03-15T20:10:19+00:00 [ok] git credentials configured";
    expect(stripTimestamp(raw)).toBe(raw);
  });
});

describe("useLogStream handleMessage — AC coverage (Loki)", () => {
  it("collapses prior entries into entrypoint-group when Starting Claude Code arrives", () => {
    const { result } = renderHook(() => useLogStream());

    act(() => {
      // Three setup lines arrive before the Starting Claude Code marker
      result.current.handleMessage({ type: "log-line", ts: 1, sessionId: "s1", line: "=== Agent Sandbox Entrypoint ===" });
      result.current.handleMessage({ type: "log-line", ts: 2, sessionId: "s1", line: "[ok] git credentials configured" });
      result.current.handleMessage({ type: "log-line", ts: 3, sessionId: "s1", line: "Session: issue-990-loki-test" });
    });

    expect(result.current.entries).toHaveLength(3);

    act(() => {
      result.current.handleMessage({ type: "log-line", ts: 4, sessionId: "s1", line: "=== Starting Claude Code ===" });
    });

    // Collapse: one group + the Starting Claude Code header itself
    expect(result.current.entries).toHaveLength(2);
    const group = result.current.entries[0]!;
    expect(group.type).toBe("entrypoint-group");
    expect(group.text).toBe("Agent Sandbox Setup");
    expect(group.children).toHaveLength(3);

    const ccHeader = result.current.entries[1]!;
    expect(ccHeader.type).toBe("entrypoint-header");
    expect(ccHeader.text).toBe("Starting Claude Code");
  });

  it("buffers TASK PROMPT lines and emits entrypoint-task on END PROMPT", () => {
    const { result } = renderHook(() => useLogStream());

    act(() => {
      result.current.handleMessage({ type: "log-line", ts: 1, sessionId: "s1", line: "--- TASK PROMPT ---" });
      result.current.handleMessage({ type: "log-line", ts: 2, sessionId: "s1", line: "You are Loki, QA agent." });
      result.current.handleMessage({ type: "log-line", ts: 3, sessionId: "s1", line: "Validate everything." });
      result.current.handleMessage({ type: "log-line", ts: 4, sessionId: "s1", line: "--- END PROMPT ---" });
    });

    // The buffered lines should produce exactly one entrypoint-task
    const taskEntry = result.current.entries.find((e: any) => e.type === "entrypoint-task");
    expect(taskEntry).toBeDefined();
    expect(taskEntry?.text).toContain("You are Loki, QA agent.");
    expect(taskEntry?.text).toContain("Validate everything.");
    // The TASK PROMPT / END PROMPT delimiters should NOT appear as separate entries
    const rawDelimiters = result.current.entries.filter(
      (e: any) => e.text === "--- TASK PROMPT ---" || e.text === "--- END PROMPT ---"
    );
    expect(rawDelimiters).toHaveLength(0);
  });
});
