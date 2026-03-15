/**
 * Sidebar layout tests — Issue #981
 * Validates that ThemeSwitcher is rendered inline with the session counter
 * inside the count-row container (not on a separate row).
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, within, cleanup } from "@testing-library/react";
import { Sidebar } from "../components/Sidebar";
import type { DisplayJob } from "../lib/types";

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
});

const makeJob = (id: string): DisplayJob => ({
  sessionId: id,
  name: `job-${id}`,
  issue: "123",
  step: "1",
  agentKey: "loki",
  agentName: "Loki",
  status: "running",
  startTime: Date.now(),
  completionTime: null, issueTitle: null, branchName: null,
});

describe("Sidebar — count-row inline layout (issue #981)", () => {
  it("session counter and theme buttons are inside the same count-row element", () => {
    const { container } = render(
      <Sidebar jobs={[makeJob("a")]} activeSessionId={null} quote="test" onSelectSession={() => {}} />
    );
    const countRow = container.querySelector(".count-row");
    expect(countRow).not.toBeNull();
    const root = within(countRow as HTMLElement);
    // session counter is present in the row
    expect(root.getByText(/session/)).toBeDefined();
    // theme switcher buttons are present in the same row
    expect(root.getByRole("button", { name: "Light theme" })).toBeDefined();
    expect(root.getByRole("button", { name: "Dark theme" })).toBeDefined();
  });

  it("session counter reflects the number of jobs passed as props", () => {
    const { container } = render(
      <Sidebar
        jobs={[makeJob("a"), makeJob("b"), makeJob("c")]}
        activeSessionId={null}
        quote="test"
        onSelectSession={() => {}}
      />
    );
    const counter = container.querySelector(".count");
    expect(counter?.textContent).toMatch(/3 sessions/);
  });
});
