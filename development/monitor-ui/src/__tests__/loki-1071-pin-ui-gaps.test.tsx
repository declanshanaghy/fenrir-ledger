/**
 * Loki QA — Issue #1071: pin-to-cache UI gap tests
 *
 * Covers component-level edge cases NOT in download-button-header.test.tsx:
 * - Pin button is hidden (showPin=false) on node-unreachable variant
 * - JobCard shows 📌 badge for cached sessions
 * - JobCard does NOT show badge for non-cached statuses
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { LogViewer } from "../components/LogViewer";
import { JobCard } from "../components/JobCard";
import type { DisplayJob } from "../lib/types";

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

// ── Test fixtures ─────────────────────────────────────────────────────────────

const BASE_JOB: DisplayJob = {
  sessionId: "issue-1071-test-session",
  name: "agent-issue-1071-test-session",
  issue: "1071",
  step: "1",
  agentKey: "fireman",
  agentName: "FiremanDecko",
  status: "running",
  startTime: Date.now(),
  completionTime: null,
  issueTitle: "Replace download button with pin-to-cache",
  branchName: "enhance/issue-1071-pin-to-cache",
};

const NODE_MESSAGE =
  "Node unreachable — the Kubernetes node running session issue-1071-test-session is not responding (kubelet timeout). The cluster is retrying; logs will resume if the node recovers.";

// ── Pin button hidden on node-unreachable (handoff: showPin=false) ────────────

describe("Pin button hidden on node-unreachable (AC: showPin=false)", () => {
  it("pin button is NOT rendered when isNodeUnreachable=true (showPin=false)", () => {
    const onTogglePin = vi.fn();
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={{ ...BASE_JOB, status: "failed" }}
        wsState="closed"
        isNodeUnreachable={true}
        streamError={NODE_MESSAGE}
        onTogglePin={onTogglePin}
      />
    );
    // NorseErrorTablet renders with showPin=false — no .pin-btn in DOM
    const btn = container.querySelector(".pin-btn");
    expect(btn).toBeNull();
  });

  it("pin button IS rendered when isTtlExpired=true (TTL-expired → showPin=true)", () => {
    const onTogglePin = vi.fn();
    const TTL_MESSAGE = "Logs unavailable — pod cleaned up (job TTL expired).";
    const { container } = render(
      <LogViewer
        entries={[]}
        activeJob={{ ...BASE_JOB, status: "failed" }}
        wsState="closed"
        isTtlExpired={true}
        streamError={TTL_MESSAGE}
        onTogglePin={onTogglePin}
      />
    );
    const btn = container.querySelector(".pin-btn");
    expect(btn).not.toBeNull();
  });
});

// ── JobCard — cached pin badge ────────────────────────────────────────────────

describe("JobCard — 📌 badge for cached sessions (AC: sidebar pin badge)", () => {
  it("renders .card-pin-badge for status=cached", () => {
    const cachedJob: DisplayJob = { ...BASE_JOB, status: "cached" };
    const { container } = render(
      <JobCard job={cachedJob} isActive={false} onClick={() => {}} />
    );
    const badge = container.querySelector(".card-pin-badge");
    expect(badge).not.toBeNull();
  });

  it("card-pin-badge title is 'Pinned to Odin\u2019s memory'", () => {
    const cachedJob: DisplayJob = { ...BASE_JOB, status: "cached" };
    const { container } = render(
      <JobCard job={cachedJob} isActive={false} onClick={() => {}} />
    );
    const badge = container.querySelector(".card-pin-badge");
    expect(badge?.getAttribute("title")).toBe("Pinned to Odin\u2019s memory");
  });

  it("card-pin-badge contains the 📌 emoji", () => {
    const cachedJob: DisplayJob = { ...BASE_JOB, status: "cached" };
    const { container } = render(
      <JobCard job={cachedJob} isActive={false} onClick={() => {}} />
    );
    const badge = container.querySelector(".card-pin-badge");
    expect(badge?.textContent).toBe("\uD83D\uDCCC");
  });

  it("does NOT render .card-pin-badge for status=running", () => {
    const { container } = render(
      <JobCard job={{ ...BASE_JOB, status: "running" }} isActive={false} onClick={() => {}} />
    );
    expect(container.querySelector(".card-pin-badge")).toBeNull();
  });

  it("does NOT render .card-pin-badge for status=succeeded", () => {
    const { container } = render(
      <JobCard job={{ ...BASE_JOB, status: "succeeded" }} isActive={false} onClick={() => {}} />
    );
    expect(container.querySelector(".card-pin-badge")).toBeNull();
  });

  it("does NOT render .card-pin-badge for status=failed", () => {
    const { container } = render(
      <JobCard job={{ ...BASE_JOB, status: "failed" }} isActive={false} onClick={() => {}} />
    );
    expect(container.querySelector(".card-pin-badge")).toBeNull();
  });

  it("cached job card shows status icon/label indicating pinned status", () => {
    const cachedJob: DisplayJob = { ...BASE_JOB, status: "cached" };
    const { container } = render(
      <JobCard job={cachedJob} isActive={false} onClick={() => {}} />
    );
    // The status label for 'cached' is "pinned"
    expect(container.textContent).toMatch(/pinned/i);
  });
});
