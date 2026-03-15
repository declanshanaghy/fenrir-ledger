/**
 * Vitest tests for issue #985 — node-unreachable error display in monitor UI
 *
 * AC tested:
 * - NODE_UNREACHABLE_PATTERN matches friendly messages from the server
 * - useLogStream.isNodeUnreachable becomes true after stream-error (node msg) + stream-end
 * - useLogStream.isNodeUnreachable is false for non-node errors
 * - useLogStream.clearEntries resets isNodeUnreachable
 * - LogViewer renders NorseErrorTablet (not log-terminal) when isNodeUnreachable=true
 * - NorseErrorTablet node-unreachable variant has correct aria-label
 * - No internal IPs, raw JSON, or HTTP headers exposed in the error display
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { LogViewer } from "../components/LogViewer";
import { NorseErrorTablet } from "../components/NorseErrorTablet";
import { useLogStream, NODE_UNREACHABLE_PATTERN } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";

afterEach(cleanup);

// ── Test fixtures ─────────────────────────────────────────────────────────────

const NODE_MESSAGE =
  "Node unreachable — the Kubernetes node running session issue-985-step1-fireman is not responding (kubelet timeout). The cluster is retrying; logs will resume if the node recovers.";

const NON_NODE_MESSAGE =
  "Access denied to pod logs for session issue-985-step1-fireman. Contact your cluster administrator.";

const TTL_MESSAGE =
  "Logs unavailable — the pod for session issue-985-step1-fireman has been cleaned up (job TTL expired).";

const MOCK_JOB: DisplayJob = {
  sessionId: "issue-985-step1-fireman",
  name: "agent-issue-985-step1-fireman",
  issue: "985",
  step: "1",
  agentKey: "fireman",
  agentName: "FiremanDecko",
  status: "failed",
  startTime: null,
  completionTime: null,
};

// ── NODE_UNREACHABLE_PATTERN ───────────────────────────────────────────────────

describe("NODE_UNREACHABLE_PATTERN (issue #985)", () => {
  it("matches the node-unreachable friendly message", () => {
    expect(NODE_UNREACHABLE_PATTERN.test(NODE_MESSAGE)).toBe(true);
  });

  it("does NOT match TTL-expired messages", () => {
    expect(NODE_UNREACHABLE_PATTERN.test(TTL_MESSAGE)).toBe(false);
  });

  it("does NOT match access-denied messages", () => {
    expect(NODE_UNREACHABLE_PATTERN.test(NON_NODE_MESSAGE)).toBe(false);
  });
});

// ── useLogStream — isNodeUnreachable state ────────────────────────────────────

describe("useLogStream — isNodeUnreachable state (issue #985)", () => {
  it("isNodeUnreachable is false by default", () => {
    const { result } = renderHook(() => useLogStream());
    expect(result.current.isNodeUnreachable).toBe(false);
  });

  it("isNodeUnreachable is false after stream-error alone (no stream-end)", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => {
      result.current.handleMessage({
        type: "stream-error",
        ts: Date.now(),
        sessionId: "issue-985-step1-fireman",
        message: NODE_MESSAGE,
      });
    });
    expect(result.current.isNodeUnreachable).toBe(false);
  });

  it("isNodeUnreachable becomes true after stream-error then stream-end with node message", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => {
      result.current.handleMessage({
        type: "stream-error",
        ts: Date.now(),
        sessionId: "issue-985-step1-fireman",
        message: NODE_MESSAGE,
      });
      result.current.handleMessage({
        type: "stream-end",
        ts: Date.now(),
        sessionId: "issue-985-step1-fireman",
        reason: "failed",
      });
    });
    expect(result.current.isNodeUnreachable).toBe(true);
  });

  it("isNodeUnreachable is false when error is not node-related", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => {
      result.current.handleMessage({
        type: "stream-error",
        ts: Date.now(),
        sessionId: "issue-985-step1-fireman",
        message: NON_NODE_MESSAGE,
      });
      result.current.handleMessage({
        type: "stream-end",
        ts: Date.now(),
        sessionId: "issue-985-step1-fireman",
        reason: "failed",
      });
    });
    expect(result.current.isNodeUnreachable).toBe(false);
  });

  it("isNodeUnreachable is false for TTL-expired errors", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => {
      result.current.handleMessage({
        type: "stream-error",
        ts: Date.now(),
        sessionId: "issue-985-step1-fireman",
        message: TTL_MESSAGE,
      });
      result.current.handleMessage({
        type: "stream-end",
        ts: Date.now(),
        sessionId: "issue-985-step1-fireman",
        reason: "failed",
      });
    });
    expect(result.current.isNodeUnreachable).toBe(false);
  });

  it("clearEntries resets isNodeUnreachable to false", () => {
    const { result } = renderHook(() => useLogStream());
    act(() => {
      result.current.handleMessage({
        type: "stream-error",
        ts: Date.now(),
        sessionId: "issue-985-step1-fireman",
        message: NODE_MESSAGE,
      });
      result.current.handleMessage({
        type: "stream-end",
        ts: Date.now(),
        sessionId: "issue-985-step1-fireman",
        reason: "failed",
      });
    });
    expect(result.current.isNodeUnreachable).toBe(true);

    act(() => {
      result.current.clearEntries();
    });
    expect(result.current.isNodeUnreachable).toBe(false);
  });
});

// ── NorseErrorTablet — node-unreachable variant ───────────────────────────────

describe("NorseErrorTablet — node-unreachable variant (issue #985)", () => {
  it("renders with role=alert", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-985-step1-fireman" message={NODE_MESSAGE} variant="node-unreachable" />
    );
    expect(container.querySelector("[role='alert']")).not.toBeNull();
  });

  it("has aria-label indicating node unreachable", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-985-step1-fireman" message={NODE_MESSAGE} variant="node-unreachable" />
    );
    const tablet = container.querySelector("[role='alert']");
    expect(tablet?.getAttribute("aria-label")).toMatch(/node unreachable/i);
  });

  it("displays the session ID", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-985-step1-fireman" message={NODE_MESSAGE} variant="node-unreachable" />
    );
    expect(container.textContent).toContain("issue-985-step1-fireman");
  });

  it("displays the error message without raw HTTP details", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-985-step1-fireman" message={NODE_MESSAGE} variant="node-unreachable" />
    );
    expect(container.textContent).toContain("kubelet timeout");
    expect(container.textContent).not.toMatch(/\bHTTP status\b/i);
    expect(container.textContent).not.toMatch(/Body: undefined/i);
    expect(container.textContent).not.toMatch(/\b(10|192|172)\.\d+\.\d+\.\d+\b/);
  });

  it("uses .norse-error-tablet root class", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-985-step1-fireman" message={NODE_MESSAGE} variant="node-unreachable" />
    );
    expect(container.querySelector(".norse-error-tablet")).not.toBeNull();
  });

  it("default variant (no prop) still uses TTL-expired aria-label", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="issue-985-step1-fireman" message={TTL_MESSAGE} />
    );
    const tablet = container.querySelector("[role='alert']");
    expect(tablet?.getAttribute("aria-label")).toMatch(/TTL expired|session error/i);
  });
});

// ── LogViewer — node-unreachable tablet rendering ─────────────────────────────

describe("LogViewer — renders NorseErrorTablet when isNodeUnreachable (issue #985)", () => {
  it("renders NorseErrorTablet (not log-terminal) when isNodeUnreachable=true", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={MOCK_JOB}
        wsState="open"
        isNodeUnreachable={true}
        streamError={NODE_MESSAGE}
      />
    );
    expect(container.querySelector(".norse-error-tablet")).not.toBeNull();
    expect(container.querySelector(".log-terminal")).toBeNull();
  });

  it("renders log-terminal (not NorseErrorTablet) when isNodeUnreachable=false and no TTL", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={MOCK_JOB}
        wsState="open"
        isNodeUnreachable={false}
        isTtlExpired={false}
        streamError={null}
      />
    );
    expect(container.querySelector(".log-terminal")).not.toBeNull();
    expect(container.querySelector(".norse-error-tablet")).toBeNull();
  });

  it("node-unreachable tablet has role=alert within LogViewer", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={MOCK_JOB}
        wsState="open"
        isNodeUnreachable={true}
        streamError={NODE_MESSAGE}
      />
    );
    expect(container.querySelector("[role='alert']")).not.toBeNull();
  });

  it("node-unreachable tablet displays session ID within LogViewer", () => {
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={MOCK_JOB}
        wsState="open"
        isNodeUnreachable={true}
        streamError={NODE_MESSAGE}
      />
    );
    expect(container.textContent).toContain("issue-985-step1-fireman");
  });
});
