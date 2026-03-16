/**
 * Regression tests for issue #1036 — React error #310 crash in monitor UI.
 *
 * Two bugs were fixed:
 *
 * 1. useMemo (lastAssistantTextId) was called AFTER three conditional early
 *    returns in LogViewer. This violated React's rules of hooks: when
 *    activeJob transitions from null → a real session the hook call count
 *    changes, corrupting React's internal linked-list and crashing the UI.
 *    Fix: useMemo moved before all early returns.
 *
 * 2. CopySessionIdButton was rendered in .session-meta-row instead of
 *    .header-badges — a regression from the session-header refactor in #1012.
 *    Tests here verify it lives in .header-badges in ALL render paths.
 *
 * AC covered:
 * - LogViewer renders without crash when activeJob is initially null then set
 * - LogViewer renders without crash when transitioning between render paths
 * - CopySessionIdButton is in .header-badges for normal / TTL-expired /
 *   node-unreachable sessions
 * - NorseVerdictInscription renders correctly after activeJob transition
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
  getCachedLog: vi.fn().mockReturnValue(null),
  isPinned: vi.fn().mockReturnValue(false),
}));

afterEach(cleanup);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_JOB: DisplayJob = {
  sessionId: "issue-1036-step1-test",
  name: "agent-issue-1036-step1-test",
  issue: "1036",
  step: "1",
  agentKey: "firemandecko",
  agentName: "FiremanDecko",
  status: "running",
  startTime: Date.now(),
  completionTime: null,
  issueTitle: "Monitor UI crashes with React error #310",
  branchName: "fix/issue-1036-monitor-react-310",
};

const TTL_JOB: DisplayJob = {
  ...MOCK_JOB,
  status: "failed",
  sessionId: "issue-1036-ttl-session",
};

const NODE_UNREACHABLE_JOB: DisplayJob = {
  ...MOCK_JOB,
  status: "failed",
  sessionId: "issue-1036-node-session",
};

function makeEntry(text: string): LogEntry {
  return { id: `e-${Math.random()}`, type: "assistant-text", text };
}

const VERDICT_TEXT = `## FiremanDecko → Loki Handoff

**Branch:** \`fix/issue-1036\`

**What changed:**
- LogViewer useMemo moved before early returns
- CopySessionIdButton moved to header-badges

**Build:** tsc + build PASS. Ready for QA.`;

// ── Hooks rules — useMemo must not be called conditionally ────────────────────

describe("React rules-of-hooks regression (issue #1036)", () => {
  it("renders without crash when activeJob is null (empty state)", () => {
    expect(() =>
      render(<LogViewer entries={[]} activeJob={null} wsState="closed" />)
    ).not.toThrow();
  });

  it("renders without crash when activeJob is a real session", () => {
    expect(() =>
      render(
        <LogViewer
          entries={[makeEntry("hello")]}
          activeJob={MOCK_JOB}
          wsState="open"
        />
      )
    ).not.toThrow();
  });

  it("renders without crash when activeJob transitions null → session (rules-of-hooks scenario)", () => {
    // This is the scenario that triggered React #310 before the fix.
    // First render with null, then update to a real job — hook call count changes.
    function Wrapper() {
      const [job, setJob] = useState<DisplayJob | null>(null);
      return (
        <>
          <button onClick={() => setJob(MOCK_JOB)}>select</button>
          <LogViewer
            entries={[makeEntry("hello from the fix")]}
            activeJob={job}
            wsState="open"
          />
        </>
      );
    }
    const { container } = render(<Wrapper />);
    // Transition null → session — should not throw
    expect(() =>
      act(() => {
        (container.querySelector("button") as HTMLButtonElement).click();
      })
    ).not.toThrow();
  });

  it("renders without crash when activeJob transitions session → null", () => {
    function Wrapper() {
      const [job, setJob] = useState<DisplayJob | null>(MOCK_JOB);
      return (
        <>
          <button onClick={() => setJob(null)}>deselect</button>
          <LogViewer entries={[makeEntry("hello")]} activeJob={job} wsState="open" />
        </>
      );
    }
    const { container } = render(<Wrapper />);
    expect(() =>
      act(() => {
        (container.querySelector("button") as HTMLButtonElement).click();
      })
    ).not.toThrow();
  });

  it("renders without crash when transitioning between TTL-expired and normal session", () => {
    function Wrapper() {
      const [ttl, setTtl] = useState(true);
      return (
        <>
          <button onClick={() => setTtl(false)}>clear ttl</button>
          <LogViewer
            entries={[]}
            activeJob={MOCK_JOB}
            wsState="closed"
            isTtlExpired={ttl}
            streamError={ttl ? "TTL expired" : null}
          />
        </>
      );
    }
    const { container } = render(<Wrapper />);
    expect(() =>
      act(() => {
        (container.querySelector("button") as HTMLButtonElement).click();
      })
    ).not.toThrow();
  });
});

// ── CopySessionIdButton placement regression (issue #1036) ───────────────────

describe("CopySessionIdButton in .header-badges (issue #1036)", () => {
  it("copy button is in header-badges for a normal running session", () => {
    const { container } = render(
      <LogViewer entries={[makeEntry("hello")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const badges = container.querySelector(".header-badges");
    expect(badges).not.toBeNull();
    expect(badges!.querySelector(".copy-session-btn")).not.toBeNull();
  });

  it("copy button is NOT in session-meta-row (regression check)", () => {
    const { container } = render(
      <LogViewer entries={[makeEntry("hello")]} activeJob={MOCK_JOB} wsState="open" />
    );
    const metaRow = container.querySelector(".session-meta-row");
    // May or may not exist, but if it does the button must not be inside it
    if (metaRow) {
      expect(metaRow.querySelector(".copy-session-btn")).toBeNull();
    }
  });

  it("copy button is in header-badges for TTL-expired session", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={TTL_JOB}
        wsState="closed"
        isTtlExpired={true}
        streamError="TTL expired — pod cleaned up."
      />
    );
    const badges = container.querySelector(".header-badges");
    expect(badges).not.toBeNull();
    expect(badges!.querySelector(".copy-session-btn")).not.toBeNull();
  });

  it("copy button is in header-badges for node-unreachable session", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={NODE_UNREACHABLE_JOB}
        wsState="closed"
        isNodeUnreachable={true}
        streamError="Node unreachable — kubelet timeout."
      />
    );
    const badges = container.querySelector(".header-badges");
    expect(badges).not.toBeNull();
    expect(badges!.querySelector(".copy-session-btn")).not.toBeNull();
  });

  it("copy button and pin button both live in header-badges when onTogglePin is provided", () => {
    const onTogglePin = vi.fn();
    const { container } = render(
      <LogViewer entries={[makeEntry("hello")]} activeJob={MOCK_JOB} wsState="open" onTogglePin={onTogglePin} />
    );
    const badges = container.querySelector(".header-badges");
    expect(badges!.querySelector(".copy-session-btn")).not.toBeNull();
    expect(badges!.querySelector(".pin-btn")).not.toBeNull();
  });

  it("no copy button when activeJob is null", () => {
    const { container } = render(
      <LogViewer entries={[]} activeJob={null} wsState="closed" />
    );
    expect(container.querySelector(".copy-session-btn")).toBeNull();
  });
});

// ── NorseVerdictInscription renders correctly after hooks fix ─────────────────

describe("NorseVerdictInscription still renders after hooks fix (issue #1036)", () => {
  it("verdict tablet renders for last assistant text that is a verdict", () => {
    const entries: LogEntry[] = [
      makeEntry("Starting implementation..."),
      makeEntry(VERDICT_TEXT),
    ];
    const { container } = render(
      <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
    );
    expect(container.querySelector(".nvi-shell")).not.toBeNull();
  });

  it("verdict tablet does not render when last entry is plain text", () => {
    const entries: LogEntry[] = [
      makeEntry(VERDICT_TEXT),
      makeEntry("Continuing with next task."),
    ];
    const { container } = render(
      <LogViewer entries={entries} activeJob={MOCK_JOB} wsState="open" />
    );
    expect(container.querySelector(".nvi-shell")).toBeNull();
  });

  it("verdict tablet renders correctly after null→session transition", () => {
    function Wrapper() {
      const [job, setJob] = useState<DisplayJob | null>(null);
      return (
        <>
          <button onClick={() => setJob(MOCK_JOB)}>select</button>
          <LogViewer
            entries={[makeEntry(VERDICT_TEXT)]}
            activeJob={job}
            wsState="open"
          />
        </>
      );
    }
    const { container } = render(<Wrapper />);
    act(() => {
      (container.querySelector("button") as HTMLButtonElement).click();
    });
    // After transition, verdict tablet should render
    expect(container.querySelector(".nvi-shell")).not.toBeNull();
  });
});
