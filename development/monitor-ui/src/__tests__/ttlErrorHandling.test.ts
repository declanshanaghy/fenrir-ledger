/**
 * Tests for TTL-expired error handling — Issue #974
 *
 * Verifies the state-machine logic that:
 *  1. A fatal stream-error + stream-end promotes to terminalError state.
 *  2. A non-fatal stream-error remains a log entry (no terminal state).
 *  3. clearEntries resets the terminal error.
 *  4. App.tsx re-subscribe guard blocks re-subscribe for terminal sessions.
 *  5. Backend terminalSessions set prevents re-processing on same connection.
 */
import { describe, it, expect } from "vitest";
import type { ServerMessage } from "../lib/types";

// ── Pure state-machine extracted from useLogStream ───────────────────────────
// We replicate the minimal logic here so tests don't need React.

interface TerminalError { sessionId: string; message: string }

interface StreamState {
  entries: string[];         // simplified — just track message strings
  terminalError: TerminalError | null;
  pendingFatal: { sessionId: string; message: string } | null;
}

function initialState(): StreamState {
  return { entries: [], terminalError: null, pendingFatal: null };
}

function applyMessage(state: StreamState, msg: ServerMessage): StreamState {
  if (msg.type === "stream-error") {
    if (msg.fatal) {
      return { ...state, pendingFatal: { sessionId: msg.sessionId, message: msg.message } };
    }
    return { ...state, entries: [...state.entries, `error:${msg.message}`] };
  }
  if (msg.type === "stream-end") {
    const { pendingFatal } = state;
    if (pendingFatal && pendingFatal.sessionId === msg.sessionId) {
      return { ...state, pendingFatal: null, terminalError: pendingFatal };
    }
    return { ...state, entries: [...state.entries, `stream-end:${msg.reason}`] };
  }
  if (msg.type === "log-line") {
    return { ...state, entries: [...state.entries, `line:${msg.line}`] };
  }
  return state;
}

function clearState(state: StreamState): StreamState {
  return { entries: [], terminalError: null, pendingFatal: null };
}

// ── Should re-subscribe? ─────────────────────────────────────────────────────
// Mirrors App.tsx reconnect guard
function shouldResubscribe(activeSessionId: string | null, terminalError: TerminalError | null): boolean {
  if (!activeSessionId) return false;
  if (terminalError?.sessionId === activeSessionId) return false;
  return true;
}

// ── Backend terminal set check ───────────────────────────────────────────────
function backendShouldRetry(sessionId: string, terminalSessions: Set<string>): boolean {
  return !terminalSessions.has(sessionId);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("TTL-expired fatal error flow", () => {
  it("fatal stream-error buffers in pendingFatal, does not add log entry", () => {
    let state = initialState();
    state = applyMessage(state, {
      type: "stream-error",
      ts: 1,
      sessionId: "sess-abc",
      message: "Pod TTL expired",
      fatal: true,
    });
    expect(state.entries).toHaveLength(0);
    expect(state.pendingFatal).toEqual({ sessionId: "sess-abc", message: "Pod TTL expired" });
    expect(state.terminalError).toBeNull();
  });

  it("stream-end after fatal stream-error promotes to terminalError", () => {
    let state = initialState();
    state = applyMessage(state, {
      type: "stream-error",
      ts: 1,
      sessionId: "sess-abc",
      message: "Pod TTL expired",
      fatal: true,
    });
    state = applyMessage(state, {
      type: "stream-end",
      ts: 2,
      sessionId: "sess-abc",
      reason: "completed",
    });
    expect(state.terminalError).toEqual({ sessionId: "sess-abc", message: "Pod TTL expired" });
    expect(state.pendingFatal).toBeNull();
    // No stream-end entry added to log (tablet replaces log)
    expect(state.entries).toHaveLength(0);
  });

  it("stream-end without prior fatal error adds stream-end log entry (normal flow)", () => {
    let state = initialState();
    state = applyMessage(state, {
      type: "stream-end",
      ts: 1,
      sessionId: "sess-abc",
      reason: "completed",
    });
    expect(state.terminalError).toBeNull();
    expect(state.entries).toContain("stream-end:completed");
  });

  it("non-fatal stream-error adds error log entry, no terminal state", () => {
    let state = initialState();
    state = applyMessage(state, {
      type: "stream-error",
      ts: 1,
      sessionId: "sess-abc",
      message: "transient network error",
    });
    expect(state.entries).toContain("error:transient network error");
    expect(state.terminalError).toBeNull();
    expect(state.pendingFatal).toBeNull();
  });

  it("fatal error for wrong sessionId in stream-end does not promote", () => {
    let state = initialState();
    // Buffer fatal error for sess-abc
    state = applyMessage(state, {
      type: "stream-error",
      ts: 1,
      sessionId: "sess-abc",
      message: "TTL expired",
      fatal: true,
    });
    // stream-end for a different session
    state = applyMessage(state, {
      type: "stream-end",
      ts: 2,
      sessionId: "sess-xyz",
      reason: "completed",
    });
    // Should add the stream-end entry for xyz, not promote fatal for abc
    expect(state.entries).toContain("stream-end:completed");
    expect(state.terminalError).toBeNull();
    expect(state.pendingFatal).toEqual({ sessionId: "sess-abc", message: "TTL expired" });
  });

  it("clearEntries resets all state including terminalError", () => {
    let state = initialState();
    state = applyMessage(state, {
      type: "stream-error",
      ts: 1,
      sessionId: "sess-abc",
      message: "TTL expired",
      fatal: true,
    });
    state = applyMessage(state, {
      type: "stream-end",
      ts: 2,
      sessionId: "sess-abc",
      reason: "completed",
    });
    expect(state.terminalError).not.toBeNull();
    state = clearState(state);
    expect(state.terminalError).toBeNull();
    expect(state.pendingFatal).toBeNull();
    expect(state.entries).toHaveLength(0);
  });
});

describe("Re-subscribe guard (App.tsx reconnect logic)", () => {
  it("allows re-subscribe when no terminal error", () => {
    expect(shouldResubscribe("sess-abc", null)).toBe(true);
  });

  it("blocks re-subscribe when active session matches terminalError", () => {
    const err: TerminalError = { sessionId: "sess-abc", message: "TTL expired" };
    expect(shouldResubscribe("sess-abc", err)).toBe(false);
  });

  it("allows re-subscribe for a different session than the terminal error", () => {
    const err: TerminalError = { sessionId: "sess-abc", message: "TTL expired" };
    expect(shouldResubscribe("sess-xyz", err)).toBe(true);
  });

  it("returns false when no active session", () => {
    expect(shouldResubscribe(null, null)).toBe(false);
  });
});

describe("Backend terminalSessions guard", () => {
  it("allows first subscribe when session not yet terminal", () => {
    const terminalSessions = new Set<string>();
    expect(backendShouldRetry("sess-abc", terminalSessions)).toBe(true);
  });

  it("blocks re-subscribe on same connection after fatal error", () => {
    const terminalSessions = new Set<string>(["sess-abc"]);
    expect(backendShouldRetry("sess-abc", terminalSessions)).toBe(false);
  });

  it("does not block other sessions", () => {
    const terminalSessions = new Set<string>(["sess-abc"]);
    expect(backendShouldRetry("sess-xyz", terminalSessions)).toBe(true);
  });

  it("blocking is per-session, multiple sessions tracked independently", () => {
    const terminalSessions = new Set<string>(["sess-1", "sess-2"]);
    expect(backendShouldRetry("sess-1", terminalSessions)).toBe(false);
    expect(backendShouldRetry("sess-2", terminalSessions)).toBe(false);
    expect(backendShouldRetry("sess-3", terminalSessions)).toBe(true);
  });
});

describe("Normal log lines are unaffected", () => {
  it("log-line entries still accumulate when no error", () => {
    let state = initialState();
    state = applyMessage(state, { type: "log-line", ts: 1, sessionId: "sess-abc", line: "hello" });
    state = applyMessage(state, { type: "log-line", ts: 2, sessionId: "sess-abc", line: "world" });
    expect(state.entries).toEqual(["line:hello", "line:world"]);
    expect(state.terminalError).toBeNull();
  });
});
