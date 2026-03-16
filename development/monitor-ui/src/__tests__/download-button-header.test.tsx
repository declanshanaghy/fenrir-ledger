/**
 * Vitest component tests for issue #1071 — pin button in session header
 * (Replaces issue #991 download button tests — download replaced by pin toggle)
 *
 * AC tested:
 * - Pin button appears in session header badges area
 * - Button has correct tooltip (unpinned: "Pin to Odin's memory")
 * - Clicking pin calls onTogglePin handler
 * - Pin button renders in both normal and TTL-expired header states
 * - Pin button shows filled/gold state when isPinned=true
 * - No pin button when no active job is selected
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { LogViewer } from "../components/LogViewer";
import type { LogEntry } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";

// Mock localStorageLogs so we don't need real localStorage in component tests
vi.mock("../lib/localStorageLogs", () => ({
  appendLogLine: vi.fn(),
  getLog: vi.fn().mockReturnValue(null),
  getCachedLog: vi.fn().mockReturnValue(null),
  isPinned: vi.fn().mockReturnValue(false),
}));

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
  completionTime: null, issueTitle: null, branchName: null,
};

const TTL_JOB: DisplayJob = {
  ...MOCK_JOB,
  status: "failed",
  sessionId: "issue-991-ttl-session",
};

function makeTextEntry(text: string): LogEntry {
  return { id: "e1", type: "assistant-text", text };
}

// ---- Pin button present in header ----

describe("Pin button in session header (replaces download AC-4)", () => {
  it("renders pin button in the header-badges area when onTogglePin is provided", () => {
    const onTogglePin = vi.fn();
    const { container } = render(
      <LogViewer entries={[makeTextEntry("hello")]} activeJob={MOCK_JOB} wsState="open" onTogglePin={onTogglePin} />
    );
    const headerBadges = container.querySelector(".header-badges");
    expect(headerBadges).not.toBeNull();
    const btn = headerBadges!.querySelector(".pin-btn");
    expect(btn).not.toBeNull();
  });

  it("renders pin button in header-badges for TTL-expired session", () => {
    const onTogglePin = vi.fn();
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={TTL_JOB}
        wsState="closed"
        isTtlExpired={true}
        streamError="Logs unavailable — pod cleaned up (job TTL expired)."
        onTogglePin={onTogglePin}
      />
    );
    const headerBadges = container.querySelector(".header-badges");
    expect(headerBadges).not.toBeNull();
    const btn = headerBadges!.querySelector(".pin-btn");
    expect(btn).not.toBeNull();
  });

  it("does NOT render pin button when no active job is selected", () => {
    const { container } = render(
      <LogViewer entries={[]} activeJob={null} wsState="closed" />
    );
    const btn = container.querySelector(".pin-btn");
    expect(btn).toBeNull();
  });

  it("does NOT render pin button when onTogglePin is not provided", () => {
    const { container } = render(
      <LogViewer entries={[makeTextEntry("hello")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const btn = container.querySelector(".pin-btn");
    expect(btn).toBeNull();
  });
});

// ---- Pin button tooltip ----

describe("Pin button tooltip", () => {
  it("has title='Pin to Odin\u2019s memory' when unpinned", () => {
    const onTogglePin = vi.fn();
    const { container } = render(
      <LogViewer entries={[]} activeJob={MOCK_JOB} wsState="open" isPinned={false} onTogglePin={onTogglePin} />
    );
    const btn = container.querySelector(".pin-btn");
    expect(btn!.getAttribute("title")).toBe("Pin to Odin\u2019s memory");
  });

  it("has title='Unpin from Odin\u2019s memory' when pinned", () => {
    const onTogglePin = vi.fn();
    const { container } = render(
      <LogViewer entries={[]} activeJob={MOCK_JOB} wsState="open" isPinned={true} onTogglePin={onTogglePin} />
    );
    const btn = container.querySelector(".pin-btn");
    expect(btn!.getAttribute("title")).toBe("Unpin from Odin\u2019s memory");
  });

  it("has aria-pressed=false when unpinned", () => {
    const onTogglePin = vi.fn();
    const { container } = render(
      <LogViewer entries={[]} activeJob={MOCK_JOB} wsState="open" isPinned={false} onTogglePin={onTogglePin} />
    );
    const btn = container.querySelector(".pin-btn");
    expect(btn!.getAttribute("aria-pressed")).toBe("false");
  });

  it("has aria-pressed=true when pinned", () => {
    const onTogglePin = vi.fn();
    const { container } = render(
      <LogViewer entries={[]} activeJob={MOCK_JOB} wsState="open" isPinned={true} onTogglePin={onTogglePin} />
    );
    const btn = container.querySelector(".pin-btn");
    expect(btn!.getAttribute("aria-pressed")).toBe("true");
  });
});

// ---- Pin button click behavior ----

describe("Pin button click behavior", () => {
  it("calls onTogglePin on click", () => {
    const onTogglePin = vi.fn();
    const { container } = render(
      <LogViewer entries={[makeTextEntry("log line")]} activeJob={MOCK_JOB} wsState="open" onTogglePin={onTogglePin} />
    );
    const btn = container.querySelector(".pin-btn") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onTogglePin).toHaveBeenCalledOnce();
  });

  it("calls onTogglePin for TTL-expired session", () => {
    const onTogglePin = vi.fn();
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={TTL_JOB}
        wsState="closed"
        isTtlExpired={true}
        streamError="Logs unavailable — pod cleaned up (job TTL expired)."
        onTogglePin={onTogglePin}
      />
    );
    const btn = container.querySelector(".pin-btn") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(onTogglePin).toHaveBeenCalledOnce();
  });
});

// ---- Pin button SVG icon ----

describe("Pin button SVG icon", () => {
  it("renders an SVG icon inside the pin button", () => {
    const onTogglePin = vi.fn();
    const { container } = render(
      <LogViewer entries={[]} activeJob={MOCK_JOB} wsState="open" onTogglePin={onTogglePin} />
    );
    const btn = container.querySelector(".pin-btn");
    const svg = btn!.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
  });

  it("adds .pinned class when isPinned=true", () => {
    const onTogglePin = vi.fn();
    const { container } = render(
      <LogViewer entries={[]} activeJob={MOCK_JOB} wsState="open" isPinned={true} onTogglePin={onTogglePin} />
    );
    const btn = container.querySelector(".pin-btn");
    expect(btn!.classList.contains("pinned")).toBe(true);
  });

  it("does NOT add .pinned class when isPinned=false", () => {
    const onTogglePin = vi.fn();
    const { container } = render(
      <LogViewer entries={[]} activeJob={MOCK_JOB} wsState="open" isPinned={false} onTogglePin={onTogglePin} />
    );
    const btn = container.querySelector(".pin-btn");
    expect(btn!.classList.contains("pinned")).toBe(false);
  });
});
