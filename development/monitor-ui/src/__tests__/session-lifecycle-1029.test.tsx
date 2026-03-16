/**
 * Issue #1029 — Monitor sidebar full session lifecycle: pending → running → succeeded/failed → purged
 *
 * Tests that:
 * - STATUS_ICONS, STATUS_COLORS, STATUS_LABELS all include "purged"
 * - JobCard renders the correct icon/color/label for every lifecycle state
 * - The purged state has a distinct visual style (gray, no pulse)
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { JobCard } from "../components/JobCard";
import { STATUS_ICONS, STATUS_COLORS, STATUS_LABELS } from "../lib/constants";
import type { DisplayJob } from "../lib/types";

// ── Constants coverage ────────────────────────────────────────────────────────

const ALL_STATUSES: Array<DisplayJob["status"]> = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "purged",
];

describe("STATUS constants include all lifecycle states (issue #1029)", () => {
  it.each(ALL_STATUSES)("STATUS_ICONS has entry for '%s'", (status) => {
    expect(STATUS_ICONS[status]).toBeDefined();
    expect(typeof STATUS_ICONS[status]).toBe("string");
    expect(STATUS_ICONS[status].length).toBeGreaterThan(0);
  });

  it.each(ALL_STATUSES)("STATUS_COLORS has entry for '%s'", (status) => {
    expect(STATUS_COLORS[status]).toBeDefined();
    expect(STATUS_COLORS[status]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(ALL_STATUSES)("STATUS_LABELS has entry for '%s'", (status) => {
    expect(STATUS_LABELS[status]).toBeDefined();
    expect(typeof STATUS_LABELS[status]).toBe("string");
  });
});

describe("purged status has correct visual style", () => {
  it("purged icon is the small open circle ◦", () => {
    expect(STATUS_ICONS["purged"]).toBe("\u25E6");
  });

  it("purged color is gray (#606070)", () => {
    expect(STATUS_COLORS["purged"]).toBe("#606070");
  });

  it("purged label is 'purged'", () => {
    expect(STATUS_LABELS["purged"]).toBe("purged");
  });

  it("purged color is different from all other status colors", () => {
    const otherColors = (["pending", "running", "succeeded", "failed"] as const).map(
      (s) => STATUS_COLORS[s]
    );
    expect(otherColors).not.toContain(STATUS_COLORS["purged"]);
  });
});

// ── JobCard rendering ─────────────────────────────────────────────────────────

function makeJob(status: DisplayJob["status"]): DisplayJob {
  return {
    sessionId: `test-${status}`,
    name: `agent-test-${status}`,
    issue: "1029",
    step: "1",
    agentKey: "loki",
    agentName: "Loki",
    status,
    startTime: status === "pending" ? null : Date.now(),
    completionTime: status === "succeeded" || status === "failed" || status === "purged" ? Date.now() : null,
    issueTitle: "Test session lifecycle",
    branchName: null,
  };
}

describe("JobCard renders all lifecycle states", () => {
  it.each(ALL_STATUSES)("renders without error for status '%s'", (status) => {
    const { container } = render(
      <JobCard job={makeJob(status)} isActive={false} onClick={() => {}} />
    );
    expect(container.querySelector(".card")).not.toBeNull();
  });

  it("running card has pulse class", () => {
    const { container } = render(
      <JobCard job={makeJob("running")} isActive={false} onClick={() => {}} />
    );
    expect(container.querySelector(".card-status.pulse")).not.toBeNull();
  });

  it("purged card has NO pulse class", () => {
    const { container } = render(
      <JobCard job={makeJob("purged")} isActive={false} onClick={() => {}} />
    );
    expect(container.querySelector(".card-status.pulse")).toBeNull();
  });

  it("pending card has NO pulse class", () => {
    const { container } = render(
      <JobCard job={makeJob("pending")} isActive={false} onClick={() => {}} />
    );
    expect(container.querySelector(".card-status.pulse")).toBeNull();
  });

  it("purged card shows 'purged' label in aria-label", () => {
    const { container } = render(
      <JobCard job={makeJob("purged")} isActive={false} onClick={() => {}} />
    );
    const card = container.querySelector("[role='listitem']");
    expect(card?.getAttribute("aria-label")).toContain("purged");
  });

  it("purged, succeeded, and failed cards each get a distinct status color", () => {
    // JSDOM normalises hex → rgb, so we compare computed colors across statuses
    // to verify each state uses a different color (not that a specific hex is set).
    const getColor = (status: DisplayJob["status"]) => {
      const { container } = render(
        <JobCard job={makeJob(status)} isActive={false} onClick={() => {}} />
      );
      return (container.querySelector(".card-status") as HTMLElement | null)?.style.color ?? "";
    };

    const purgedColor = getColor("purged");
    const succeededColor = getColor("succeeded");
    const failedColor = getColor("failed");
    const runningColor = getColor("running");

    expect(purgedColor).toBeTruthy();
    expect(purgedColor).not.toBe(succeededColor);
    expect(purgedColor).not.toBe(failedColor);
    expect(purgedColor).not.toBe(runningColor);
  });
});

// ── Lifecycle progression ────────────────────────────────────────────────────

describe("lifecycle state ordering makes sense", () => {
  it("all five states are distinct values", () => {
    const statuses = new Set(ALL_STATUSES);
    expect(statuses.size).toBe(5);
  });

  it("purged is distinct from succeeded (pod reaped !== job completed)", () => {
    expect(STATUS_ICONS["purged"]).not.toBe(STATUS_ICONS["succeeded"]);
    expect(STATUS_COLORS["purged"]).not.toBe(STATUS_COLORS["succeeded"]);
    expect(STATUS_LABELS["purged"]).not.toBe(STATUS_LABELS["succeeded"]);
  });
});
