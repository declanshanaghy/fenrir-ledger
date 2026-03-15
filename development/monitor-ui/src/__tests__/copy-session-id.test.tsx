/**
 * Vitest component tests for issue #1009 — copy-session-id button in header
 *
 * AC tested:
 * - Copy button renders in header-badges for normal session
 * - Copy button renders in header-badges for TTL-expired session
 * - Copy button renders in header-badges for node-unreachable session
 * - Copy button does NOT render when no active job is selected
 * - Clicking copy button calls navigator.clipboard.writeText with sessionId
 * - Button shows clipboard icon before copy, check icon after copy
 * - Button title/aria-label changes on copy
 * - Does not disrupt layout (header-badges still contains download button)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import { LogViewer } from "../components/LogViewer";
import type { LogEntry } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";

vi.mock("../lib/localStorageLogs", () => ({
  downloadLog: vi.fn(),
  appendLogLine: vi.fn(),
  getLog: vi.fn().mockReturnValue("mock log content"),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const MOCK_JOB: DisplayJob = {
  sessionId: "issue-1009-step1-firemandecko-e96269d4",
  name: "agent-issue-1009-step1-firemandecko-e96269d4",
  issue: "1009",
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
  sessionId: "issue-1009-ttl-session",
};

const NODE_UNREACHABLE_JOB: DisplayJob = {
  ...MOCK_JOB,
  status: "failed",
  sessionId: "issue-1009-node-unreachable-session",
};

function makeTextEntry(text: string): LogEntry {
  return { id: "e1", type: "assistant-text", text };
}

// ── Presence tests ─────────────────────────────────────────────────────────────

describe("Copy session ID button — presence", () => {
  it("renders in header-badges for a normal session", () => {
    const { container } = render(
      <LogViewer entries={[makeTextEntry("hello")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const headerBadges = container.querySelector(".header-badges");
    expect(headerBadges).not.toBeNull();
    const btn = headerBadges!.querySelector(".copy-session-btn");
    expect(btn).not.toBeNull();
  });

  it("renders in header-badges for TTL-expired session", () => {
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
    const btn = headerBadges!.querySelector(".copy-session-btn");
    expect(btn).not.toBeNull();
  });

  it("renders in header-badges for node-unreachable session", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={NODE_UNREACHABLE_JOB}
        wsState="closed"
        isNodeUnreachable={true}
        streamError="Fenrir strains at his bonds — the node is unreachable."
      />
    );
    const headerBadges = container.querySelector(".header-badges");
    expect(headerBadges).not.toBeNull();
    const btn = headerBadges!.querySelector(".copy-session-btn");
    expect(btn).not.toBeNull();
  });

  it("does NOT render when no active job is selected", () => {
    const { container } = render(
      <LogViewer entries={[]} activeJob={null} wsState="closed" />
    );
    const btn = container.querySelector(".copy-session-btn");
    expect(btn).toBeNull();
  });
});

// ── Clipboard API tests ────────────────────────────────────────────────────────

describe("Copy session ID button — clipboard", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it("calls navigator.clipboard.writeText with the sessionId on click", async () => {
    const { container } = render(
      <LogViewer entries={[makeTextEntry("hello")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const btn = container.querySelector(".copy-session-btn") as HTMLButtonElement;
    await act(async () => { fireEvent.click(btn); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "issue-1009-step1-firemandecko-e96269d4"
    );
  });

  it("calls writeText with correct sessionId for TTL-expired session", async () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={TTL_JOB}
        wsState="closed"
        isTtlExpired={true}
        streamError="Logs unavailable — pod cleaned up (job TTL expired)."
      />
    );
    const btn = container.querySelector(".copy-session-btn") as HTMLButtonElement;
    await act(async () => { fireEvent.click(btn); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("issue-1009-ttl-session");
  });
});

// ── Visual feedback tests ──────────────────────────────────────────────────────

describe("Copy session ID button — visual feedback", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it("has title='Copy session ID' before click", () => {
    const { container } = render(
      <LogViewer entries={[]} activeJob={MOCK_JOB} wsState="open" />
    );
    const btn = container.querySelector(".copy-session-btn");
    expect(btn!.getAttribute("title")).toBe("Copy session ID");
  });

  it("has aria-label='Copy session ID' before click", () => {
    const { container } = render(
      <LogViewer entries={[]} activeJob={MOCK_JOB} wsState="open" />
    );
    const btn = container.querySelector(".copy-session-btn");
    expect(btn!.getAttribute("aria-label")).toBe("Copy session ID");
  });

  it("adds .copied class and changes title after click", async () => {
    const { container } = render(
      <LogViewer entries={[makeTextEntry("log")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const btn = container.querySelector(".copy-session-btn") as HTMLButtonElement;
    await act(async () => { fireEvent.click(btn); });
    expect(btn.classList.contains("copied")).toBe(true);
    expect(btn.getAttribute("title")).toBe("Copied!");
    expect(btn.getAttribute("aria-label")).toBe("Session ID copied");
  });
});

// ── Layout — download button still present alongside copy button ───────────────

describe("Copy session ID button — layout coexistence", () => {
  it("download button still renders alongside copy button in normal state", () => {
    const { container } = render(
      <LogViewer entries={[makeTextEntry("hello")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const headerBadges = container.querySelector(".header-badges");
    expect(headerBadges!.querySelector(".copy-session-btn")).not.toBeNull();
    expect(headerBadges!.querySelector(".download-log-btn")).not.toBeNull();
  });
});
