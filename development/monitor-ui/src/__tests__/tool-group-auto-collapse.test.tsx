/**
 * Vitest tests for issue #1017 — Tool groups in log viewer auto-collapse
 * when auto-scrolling is enabled.
 *
 * AC tested:
 * - The latest tool-batch group starts expanded
 * - Previous tool-batch groups collapse when a newer one arrives (auto-scroll on)
 * - Manual toggle works: user can re-open a collapsed group
 * - Completion of a batch triggers auto-collapse (existing behaviour, preserved)
 * - When auto-scroll is re-enabled, non-latest batches collapse
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
  getLog: vi.fn().mockReturnValue(""),
}));

afterEach(cleanup);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_JOB: DisplayJob = {
  sessionId: "issue-1017-step1-test",
  name: "agent-issue-1017-step1-test",
  issue: "1017",
  step: "1",
  agentKey: "firemandecko",
  agentName: "FiremanDecko",
  status: "running",
  startTime: Date.now(),
  completionTime: null,
  issueTitle: "Tool groups auto-collapse during auto-scroll",
  branchName: "fix/issue-1017-tool-group-collapse",
};

function makeBatch(id: string, label: string, complete = false): LogEntry {
  return {
    id,
    type: "tool-batch",
    text: label,
    complete,
    children: [
      {
        id: `${id}-child`,
        type: "tool-use",
        toolName: "Read",
        toolBadge: "📖",
        toolPreview: "reading file",
        toolId: `tool-${id}`,
      },
    ],
  };
}

function allBatchDivs(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll(".ev-tool-batch");
}

function isOpen(el: Element): boolean {
  return el.classList.contains("open");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ToolBatchGroup auto-collapse — issue #1017", () => {
  it("single batch starts expanded (it is the latest)", () => {
    const entries: LogEntry[] = [makeBatch("b1", "1 reading")];
    const { container } = render(
      <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
    );
    const batches = allBatchDivs(container);
    expect(batches.length).toBe(1);
    expect(isOpen(batches[0]!)).toBe(true);
  });

  it("previous batch collapses when a new batch appears (auto-scroll on by default)", () => {
    // Start with one batch (it is latest → open).
    function Wrapper() {
      const [entries, setEntries] = useState<LogEntry[]>([
        makeBatch("b1", "1 reading"),
      ]);
      return (
        <>
          <button
            data-testid="add"
            onClick={() =>
              setEntries((prev) => [...prev, makeBatch("b2", "1 editing")])
            }
          >
            add
          </button>
          <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
        </>
      );
    }

    const { container } = render(<Wrapper />);

    // Before: one batch, open
    expect(allBatchDivs(container).length).toBe(1);
    expect(isOpen(allBatchDivs(container)[0]!)).toBe(true);

    // Add second batch
    act(() => {
      (container.querySelector("[data-testid=add]") as HTMLButtonElement).click();
    });

    const batches = allBatchDivs(container);
    expect(batches.length).toBe(2);
    // First batch (b1) should now be collapsed
    expect(isOpen(batches[0]!)).toBe(false);
    // Second batch (b2) — the new latest — should remain open
    expect(isOpen(batches[1]!)).toBe(true);
  });

  it("completed batch auto-collapses (existing behaviour preserved)", () => {
    function Wrapper() {
      const [entries, setEntries] = useState<LogEntry[]>([
        makeBatch("b1", "1 reading", false),
      ]);
      return (
        <>
          <button
            data-testid="complete"
            onClick={() =>
              setEntries([makeBatch("b1", "1 reading", true)])
            }
          >
            complete
          </button>
          <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
        </>
      );
    }

    const { container } = render(<Wrapper />);
    expect(isOpen(allBatchDivs(container)[0]!)).toBe(true);

    act(() => {
      (
        container.querySelector("[data-testid=complete]") as HTMLButtonElement
      ).click();
    });

    expect(isOpen(allBatchDivs(container)[0]!)).toBe(false);
  });

  it("user can manually re-open a collapsed previous batch", () => {
    function Wrapper() {
      const [entries, setEntries] = useState<LogEntry[]>([
        makeBatch("b1", "1 reading"),
      ]);
      return (
        <>
          <button
            data-testid="add"
            onClick={() =>
              setEntries((prev) => [...prev, makeBatch("b2", "1 editing")])
            }
          >
            add
          </button>
          <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
        </>
      );
    }

    const { container } = render(<Wrapper />);

    // Add second batch — first should collapse
    act(() => {
      (container.querySelector("[data-testid=add]") as HTMLButtonElement).click();
    });

    const batches = allBatchDivs(container);
    expect(isOpen(batches[0]!)).toBe(false);

    // Click header of first batch to re-open it
    act(() => {
      (batches[0]!.querySelector(".ev-tool-batch-header") as HTMLElement).click();
    });

    expect(isOpen(allBatchDivs(container)[0]!)).toBe(true);
  });

  it("multiple previous batches all collapse when new batch arrives", () => {
    function Wrapper() {
      const [entries, setEntries] = useState<LogEntry[]>([
        makeBatch("b1", "1 reading"),
        makeBatch("b2", "1 editing"),
      ]);
      return (
        <>
          <button
            data-testid="add"
            onClick={() =>
              setEntries((prev) => [...prev, makeBatch("b3", "1 committing")])
            }
          >
            add
          </button>
          <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
        </>
      );
    }

    const { container } = render(<Wrapper />);

    // Initially: b1 closed (not latest), b2 open (latest)
    let batches = allBatchDivs(container);
    expect(batches.length).toBe(2);
    expect(isOpen(batches[0]!)).toBe(false);
    expect(isOpen(batches[1]!)).toBe(true);

    act(() => {
      (container.querySelector("[data-testid=add]") as HTMLButtonElement).click();
    });

    batches = allBatchDivs(container);
    expect(batches.length).toBe(3);
    expect(isOpen(batches[0]!)).toBe(false);
    expect(isOpen(batches[1]!)).toBe(false);
    expect(isOpen(batches[2]!)).toBe(true);
  });

  it("non-latest batches collapse when auto-scroll is re-enabled", () => {
    // LogViewer auto-scroll starts ON. To test re-enable we:
    // 1. Add two batches (second is latest, first collapses)
    // 2. Re-open the first batch manually (simulating user expanding while scrolled up)
    // 3. Click the autoscroll-fab to toggle off then back on
    // 4. Verify the first batch collapses again

    const initialEntries: LogEntry[] = [
      makeBatch("b1", "1 reading"),
      makeBatch("b2", "1 editing"),
    ];
    function Wrapper() {
      return (
        <LogViewer entries={initialEntries} activeJob={MOCK_JOB} wsState="open" />
      );
    }

    const { container } = render(<Wrapper />);

    // b1 starts collapsed (not latest)
    let batches = allBatchDivs(container);
    expect(isOpen(batches[0]!)).toBe(false);

    // Manually open b1
    act(() => {
      (batches[0]!.querySelector(".ev-tool-batch-header") as HTMLElement).click();
    });
    batches = allBatchDivs(container);
    expect(isOpen(batches[0]!)).toBe(true);

    // Toggle auto-scroll OFF
    const fab = container.querySelector(".autoscroll-fab") as HTMLButtonElement;
    act(() => { fab.click(); });

    // Toggle auto-scroll ON again — b1 should collapse (non-latest + auto-scroll re-enabled)
    act(() => { fab.click(); });

    batches = allBatchDivs(container);
    expect(isOpen(batches[0]!)).toBe(false);
    // Latest (b2) should still be open
    expect(isOpen(batches[1]!)).toBe(true);
  });
});
