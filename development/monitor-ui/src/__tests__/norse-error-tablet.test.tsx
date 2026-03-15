/**
 * Vitest tests for issue #974 — Norse error tablet and TTL-expired loop prevention.
 *
 * AC tested:
 * - NorseErrorTablet renders with role="alert" and correct aria-label
 * - Session ID is displayed in the tablet
 * - Heading uses Cinzel Decorative styling class
 * - Error message is displayed verbatim
 * - Rune decorations are present
 * - useLogStream correctly sets isTtlExpired when stream-error + stream-end received
 * - useLogStream.isTtlExpired is false for non-TTL errors
 * - useLogStream.clearEntries resets isTtlExpired
 * - LogViewer renders NorseErrorTablet (not log-terminal) when isTtlExpired=true
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { NorseErrorTablet } from "../components/NorseErrorTablet";
import { LogViewer } from "../components/LogViewer";
import { useLogStream, TTL_ERROR_PATTERN } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";

afterEach(cleanup);

// ── Test fixtures ─────────────────────────────────────────────────────────────

const TTL_MESSAGE =
  "Logs unavailable — the pod for session issue-974-step1-test has been cleaned up (job TTL expired).";

const NON_TTL_MESSAGE =
  "Access denied to pod logs for session issue-974-step1-test. Contact your cluster administrator.";

const MOCK_JOB: DisplayJob = {
  sessionId: "issue-974-step1-test",
  name: "agent-issue-974-step1-test",
  issue: "974",
  step: "1",
  agentKey: "fireman",
  agentName: "FiremanDecko",
  status: "failed",
  startTime: null,
  completionTime: null,
};

// ── NorseErrorTablet rendering ────────────────────────────────────────────────

describe("NorseErrorTablet — rendering (issue #974)", () => {
  it("renders with role=alert", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-974-step1-test" message={TTL_MESSAGE} />
    );
    const tablet = container.querySelector("[role='alert']");
    expect(tablet).not.toBeNull();
  });

  it("has aria-label indicating TTL expired", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-974-step1-test" message={TTL_MESSAGE} />
    );
    const tablet = container.querySelector("[role='alert']");
    expect(tablet?.getAttribute("aria-label")).toMatch(/TTL expired|session error/i);
  });

  it("displays the session ID", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-974-step1-test" message={TTL_MESSAGE} />
    );
    expect(container.textContent).toContain("issue-974-step1-test");
  });

  it("displays the error message", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-974-step1-test" message={TTL_MESSAGE} />
    );
    expect(container.textContent).toContain("cleaned up");
    expect(container.textContent).toContain("TTL expired");
  });

  it("renders the Cinzel Decorative heading element", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-974-step1-test" message={TTL_MESSAGE} />
    );
    const heading = container.querySelector(".net-heading");
    expect(heading).not.toBeNull();
    expect(heading?.tagName).toBe("H1");
  });

  it("renders Elder Futhark rune decorations", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-974-step1-test" message={TTL_MESSAGE} />
    );
    // Should contain at least one rune character from the Elder Futhark
    expect(container.textContent).toMatch(/[ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ]/);
  });

  it("uses .norse-error-tablet root class", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-974-step1-test" message={TTL_MESSAGE} />
    );
    expect(container.querySelector(".norse-error-tablet")).not.toBeNull();
  });
});

// ── useLogStream — TTL tracking ───────────────────────────────────────────────

describe("useLogStream — isTtlExpired state (issue #974)", () => {
  it("isTtlExpired is false by default", () => {
    const { result } = renderHook(() => useLogStream());
    expect(result.current.isTtlExpired).toBe(false);
  });

  it("isTtlExpired is false after stream-error alone (no stream-end yet)", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => {
      result.current.handleMessage({
        type: "stream-error",
        ts: Date.now(),
        sessionId: "issue-974-step1-test",
        message: TTL_MESSAGE,
      });
    });
    expect(result.current.isTtlExpired).toBe(false);
  });

  it("isTtlExpired becomes true after stream-error then stream-end with TTL message", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => {
      result.current.handleMessage({
        type: "stream-error",
        ts: Date.now(),
        sessionId: "issue-974-step1-test",
        message: TTL_MESSAGE,
      });
      result.current.handleMessage({
        type: "stream-end",
        ts: Date.now(),
        sessionId: "issue-974-step1-test",
        reason: "failed",
      });
    });
    expect(result.current.isTtlExpired).toBe(true);
  });

  it("isTtlExpired is false when error is not TTL-related", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => {
      result.current.handleMessage({
        type: "stream-error",
        ts: Date.now(),
        sessionId: "issue-974-step1-test",
        message: NON_TTL_MESSAGE,
      });
      result.current.handleMessage({
        type: "stream-end",
        ts: Date.now(),
        sessionId: "issue-974-step1-test",
        reason: "failed",
      });
    });
    expect(result.current.isTtlExpired).toBe(false);
  });

  it("clearEntries resets isTtlExpired to false", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => {
      result.current.handleMessage({
        type: "stream-error",
        ts: Date.now(),
        sessionId: "issue-974-step1-test",
        message: TTL_MESSAGE,
      });
      result.current.handleMessage({
        type: "stream-end",
        ts: Date.now(),
        sessionId: "issue-974-step1-test",
        reason: "failed",
      });
    });
    expect(result.current.isTtlExpired).toBe(true);

    act(() => {
      result.current.clearEntries();
    });
    expect(result.current.isTtlExpired).toBe(false);
  });

  it("streamError is set after receiving stream-error message", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => {
      result.current.handleMessage({
        type: "stream-error",
        ts: Date.now(),
        sessionId: "issue-974-step1-test",
        message: TTL_MESSAGE,
      });
    });
    expect(result.current.streamError).toBe(TTL_MESSAGE);
  });

  it("streamEnded is set after receiving stream-end message", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => {
      result.current.handleMessage({
        type: "stream-end",
        ts: Date.now(),
        sessionId: "issue-974-step1-test",
        reason: "completed",
      });
    });
    expect(result.current.streamEnded).toBe(true);
  });
});

// ── TTL_ERROR_PATTERN ─────────────────────────────────────────────────────────

describe("TTL_ERROR_PATTERN", () => {
  it("matches TTL-expired messages", () => {
    expect(TTL_ERROR_PATTERN.test(TTL_MESSAGE)).toBe(true);
  });

  it("matches pod-not-found alternative message", () => {
    const altMsg =
      "Pod for session issue-974-step1-loki has been cleaned up (job TTL expired). Logs are no longer available from the cluster.";
    expect(TTL_ERROR_PATTERN.test(altMsg)).toBe(true);
  });

  it("does not match non-TTL error messages", () => {
    expect(TTL_ERROR_PATTERN.test(NON_TTL_MESSAGE)).toBe(false);
  });
});

// ── LogViewer — Norse tablet vs log terminal ──────────────────────────────────

describe("LogViewer — renders NorseErrorTablet when isTtlExpired (issue #974)", () => {
  it("renders NorseErrorTablet (not log-terminal) when isTtlExpired=true", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={MOCK_JOB}
        wsState="open"
        isTtlExpired={true}
        streamError={TTL_MESSAGE}
      />
    );
    expect(container.querySelector(".norse-error-tablet")).not.toBeNull();
    expect(container.querySelector(".log-terminal")).toBeNull();
  });

  it("renders log-terminal (not NorseErrorTablet) when isTtlExpired=false", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={MOCK_JOB}
        wsState="open"
        isTtlExpired={false}
        streamError={null}
      />
    );
    expect(container.querySelector(".log-terminal")).not.toBeNull();
    expect(container.querySelector(".norse-error-tablet")).toBeNull();
  });

  it("NorseErrorTablet has role=alert within LogViewer", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={MOCK_JOB}
        wsState="open"
        isTtlExpired={true}
        streamError={TTL_MESSAGE}
      />
    );
    expect(container.querySelector("[role='alert']")).not.toBeNull();
  });

  it("NorseErrorTablet displays the session ID within LogViewer", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={MOCK_JOB}
        wsState="open"
        isTtlExpired={true}
        streamError={TTL_MESSAGE}
      />
    );
    expect(container.textContent).toContain("issue-974-step1-test");
  });
});
