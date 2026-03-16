/**
 * AgentProfileModal tests — Issue #1062
 * Validates clickable agent profile dialogs in monitor UI.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { AgentProfileModal } from "../components/AgentProfileModal";
import { JobCard } from "../components/JobCard";
import type { DisplayJob } from "../lib/types";

afterEach(cleanup);

beforeEach(() => {
  // Restore body overflow after each test
  document.body.style.overflow = "";
});

// ── AgentProfileModal rendering ──────────────────────────────────────────────

describe("AgentProfileModal — rendering", () => {
  it("renders agent name for firemandecko", () => {
    const { getByText } = render(
      <AgentProfileModal agentKey="firemandecko" theme="dark" onClose={() => {}} />
    );
    expect(getByText("FiremanDecko")).toBeDefined();
  });

  it("renders agent title", () => {
    const { getByText } = render(
      <AgentProfileModal agentKey="loki" theme="dark" onClose={() => {}} />
    );
    expect(getByText("QA Tester")).toBeDefined();
  });

  it("renders rune signature", () => {
    const { getByLabelText } = render(
      <AgentProfileModal agentKey="firemandecko" theme="dark" onClose={() => {}} />
    );
    expect(getByLabelText("Rune signature: FiremanDecko")).toBeDefined();
  });

  it("renders all 6 agent names without error", () => {
    const agents = ["firemandecko", "loki", "luna", "freya", "heimdall", "odin"];
    for (const agentKey of agents) {
      const { unmount } = render(
        <AgentProfileModal agentKey={agentKey} theme="dark" onClose={() => {}} />
      );
      unmount();
    }
  });

  it("renders Elder Futhark rune bands", () => {
    const { getAllByText } = render(
      <AgentProfileModal agentKey="loki" theme="dark" onClose={() => {}} />
    );
    // Both top and bottom rune bands should contain Futhark glyphs
    const bands = getAllByText(/ᚠ.*ᛟ/);
    expect(bands.length).toBeGreaterThanOrEqual(2);
  });

  it("renders role description for odin", () => {
    const { getByText } = render(
      <AgentProfileModal agentKey="odin" theme="dark" onClose={() => {}} />
    );
    // Match a phrase unique to the description (not the title)
    expect(getByText(/orchestrates the agents/)).toBeDefined();
  });

  it("renders portrait img with dark variant when theme=dark", () => {
    const { container } = render(
      <AgentProfileModal agentKey="loki" theme="dark" onClose={() => {}} />
    );
    const img = container.querySelector("img.apm-portrait") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.src).toContain("loki-dark");
  });

  it("renders portrait img with light variant when theme=light", () => {
    const { container } = render(
      <AgentProfileModal agentKey="loki" theme="light" onClose={() => {}} />
    );
    const img = container.querySelector("img.apm-portrait") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.src).toContain("loki-light");
  });

  it("has dialog role and aria-modal", () => {
    const { container } = render(
      <AgentProfileModal agentKey="freya" theme="dark" onClose={() => {}} />
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
  });

  it("has aria-labelledby pointing to agent name element", () => {
    const { container } = render(
      <AgentProfileModal agentKey="heimdall" theme="dark" onClose={() => {}} />
    );
    const dialog = container.querySelector('[role="dialog"]');
    const labelledBy = dialog?.getAttribute("aria-labelledby");
    expect(labelledBy).toBe("apm-agent-name");
    const nameEl = container.querySelector(`#${labelledBy}`);
    expect(nameEl).not.toBeNull();
    expect(nameEl?.textContent).toContain("Heimdall");
  });
});

// ── Close behaviour ───────────────────────────────────────────────────────────

describe("AgentProfileModal — close behaviour", () => {
  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <AgentProfileModal agentKey="loki" theme="dark" onClose={onClose} />
    );
    fireEvent.click(getByLabelText("Close agent profile"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when ESC key is pressed", () => {
    const onClose = vi.fn();
    render(<AgentProfileModal agentKey="loki" theme="dark" onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked (but not the modal shell)", () => {
    const onClose = vi.fn();
    const { container } = render(
      <AgentProfileModal agentKey="luna" theme="dark" onClose={onClose} />
    );
    const backdrop = container.querySelector(".apm-backdrop") as HTMLElement;
    // Simulate clicking the backdrop itself (target === currentTarget)
    fireEvent.click(backdrop, { target: backdrop });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose when clicking inside the modal shell", () => {
    const onClose = vi.fn();
    const { container } = render(
      <AgentProfileModal agentKey="luna" theme="dark" onClose={onClose} />
    );
    const shell = container.querySelector(".apm-shell") as HTMLElement;
    fireEvent.click(shell);
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ── Body scroll lock ──────────────────────────────────────────────────────────

describe("AgentProfileModal — body scroll lock", () => {
  it("locks body scroll on mount", () => {
    render(<AgentProfileModal agentKey="loki" theme="dark" onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body scroll on unmount", () => {
    const { unmount } = render(
      <AgentProfileModal agentKey="loki" theme="dark" onClose={() => {}} />
    );
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});

// ── JobCard avatar stopPropagation ────────────────────────────────────────────

describe("JobCard — avatar stopPropagation", () => {
  const makeJob = (agentKey: string): DisplayJob => ({
    sessionId: "s1",
    name: "test-job",
    issue: "1062",
    step: "3",
    agentKey,
    agentName: agentKey,
    status: "running",
    startTime: Date.now(),
    completionTime: null,
    issueTitle: "Agent profile dialogs",
    branchName: null,
    fixture: false,
  });

  it("calls onAvatarClick with agentKey when avatar button is clicked", () => {
    const onAvatarClick = vi.fn();
    const onClick = vi.fn();
    const { container } = render(
      <JobCard
        job={makeJob("firemandecko")}
        isActive={false}
        onClick={onClick}
        onAvatarClick={onAvatarClick}
      />
    );
    const avatarBtn = container.querySelector(".card-avatar-btn") as HTMLElement;
    expect(avatarBtn).not.toBeNull();
    fireEvent.click(avatarBtn);
    expect(onAvatarClick).toHaveBeenCalledWith("firemandecko");
  });

  it("does NOT trigger card onClick when avatar button is clicked (stopPropagation)", () => {
    const onAvatarClick = vi.fn();
    const onClick = vi.fn();
    const { container } = render(
      <JobCard
        job={makeJob("loki")}
        isActive={false}
        onClick={onClick}
        onAvatarClick={onAvatarClick}
      />
    );
    const avatarBtn = container.querySelector(".card-avatar-btn") as HTMLElement;
    fireEvent.click(avatarBtn);
    // Avatar click must NOT propagate to the card's onClick handler
    expect(onClick).not.toHaveBeenCalled();
  });

  it("clicking card body (not avatar) still triggers onClick", () => {
    const onAvatarClick = vi.fn();
    const onClick = vi.fn();
    const { container } = render(
      <JobCard
        job={makeJob("loki")}
        isActive={false}
        onClick={onClick}
        onAvatarClick={onAvatarClick}
      />
    );
    const card = container.querySelector(".card") as HTMLElement;
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onAvatarClick).not.toHaveBeenCalled();
  });
});
