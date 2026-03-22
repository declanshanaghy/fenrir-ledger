/**
 * DashboardTabButton — component behaviour tests for issue #1684.
 *
 * Validates the extracted DashboardTabButton component renders the correct
 * ARIA attributes, badge variants, and lock/gate states depending on the
 * entitlement gates passed in.
 *
 * Pure rendering tests — no hooks, no router, no context needed.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardTabButton } from "@/components/dashboard/DashboardTabButton";
import type { DashboardTabButtonProps } from "@/components/dashboard/DashboardTabButton";
import type { DashboardGates } from "@/hooks/useDashboardTabs";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_GATES: DashboardGates = {
  isHowlUnlocked: true,
  hasValhalla: true,
  hasVelocity: true,
  hasTrash: true,
};

const THRALL_GATES: DashboardGates = {
  isHowlUnlocked: false,
  hasValhalla: false,
  hasVelocity: false,
  hasTrash: false,
};

const makeActiveTab = (
  id: "howl" | "hunt" | "active" | "valhalla" | "all" | "trash",
): DashboardTabButtonProps["tab"] => ({
  id,
  label: id.charAt(0).toUpperCase() + id.slice(1),
  rune: "ᚲ",
  panelId: `panel-${id}`,
  buttonId: `tab-${id}`,
});

const defaultProps = (
  overrides: Partial<DashboardTabButtonProps> = {},
): DashboardTabButtonProps => ({
  tab: makeActiveTab("active"),
  isActive: false,
  count: 3,
  gates: FULL_GATES,
  ragnarokActive: false,
  howlHasCards: false,
  howlBadgeShake: false,
  onHowlAnimationEnd: vi.fn(),
  onClick: vi.fn(),
  onKeyDown: vi.fn(),
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DashboardTabButton — ARIA roles and attributes", () => {
  it("renders with role='tab'", () => {
    render(<DashboardTabButton {...defaultProps()} />);
    expect(screen.getByRole("tab")).toBeDefined();
  });

  it("aria-selected is false when isActive=false", () => {
    render(<DashboardTabButton {...defaultProps({ isActive: false })} />);
    expect(screen.getByRole("tab").getAttribute("aria-selected")).toBe("false");
  });

  it("aria-selected is true when isActive=true", () => {
    render(<DashboardTabButton {...defaultProps({ isActive: true })} />);
    expect(screen.getByRole("tab").getAttribute("aria-selected")).toBe("true");
  });

  it("tabIndex is 0 when active, -1 when inactive", () => {
    const { rerender } = render(
      <DashboardTabButton {...defaultProps({ isActive: true })} />,
    );
    expect(screen.getByRole("tab").getAttribute("tabindex")).toBe("0");

    rerender(<DashboardTabButton {...defaultProps({ isActive: false })} />);
    expect(screen.getByRole("tab").getAttribute("tabindex")).toBe("-1");
  });

  it("sets aria-controls to panelId for ungated tab", () => {
    render(
      <DashboardTabButton
        {...defaultProps({ tab: makeActiveTab("active"), gates: FULL_GATES })}
      />,
    );
    expect(screen.getByRole("tab").getAttribute("aria-controls")).toBe(
      "panel-active",
    );
  });

  it("aria-controls is absent for gated tab (Thrall → valhalla)", () => {
    render(
      <DashboardTabButton
        {...defaultProps({
          tab: makeActiveTab("valhalla"),
          gates: THRALL_GATES,
        })}
      />,
    );
    expect(
      screen.getByRole("tab").getAttribute("aria-controls"),
    ).toBeNull();
  });
});

describe("DashboardTabButton — gated tabs (Thrall user)", () => {
  it("howl tab: aria-label includes 'Karl tier required'", () => {
    render(
      <DashboardTabButton
        {...defaultProps({
          tab: makeActiveTab("howl"),
          gates: THRALL_GATES,
        })}
      />,
    );
    const btn = screen.getByRole("tab");
    expect(btn.getAttribute("aria-label")).toContain("Karl tier required");
  });

  it("valhalla tab: aria-label includes 'Karl tier required'", () => {
    render(
      <DashboardTabButton
        {...defaultProps({
          tab: makeActiveTab("valhalla"),
          gates: THRALL_GATES,
        })}
      />,
    );
    expect(
      screen.getByRole("tab").getAttribute("aria-label"),
    ).toContain("Karl tier required");
  });

  it("hunt tab: aria-label includes 'Karl tier required'", () => {
    render(
      <DashboardTabButton
        {...defaultProps({
          tab: makeActiveTab("hunt"),
          gates: THRALL_GATES,
        })}
      />,
    );
    expect(
      screen.getByRole("tab").getAttribute("aria-label"),
    ).toContain("Karl tier required");
  });

  it("trash tab (Thrall): aria-label includes 'upgrade to Karl'", () => {
    render(
      <DashboardTabButton
        {...defaultProps({
          tab: makeActiveTab("trash"),
          gates: THRALL_GATES,
        })}
      />,
    );
    expect(
      screen.getByRole("tab").getAttribute("aria-label"),
    ).toContain("Karl");
  });

  it("ungated tab (active, full access): no aria-label override", () => {
    render(
      <DashboardTabButton
        {...defaultProps({
          tab: makeActiveTab("active"),
          gates: FULL_GATES,
        })}
      />,
    );
    // No aria-label override — use tab label
    expect(screen.getByRole("tab").getAttribute("aria-label")).toBeNull();
  });
});

describe("DashboardTabButton — Ragnarök override label", () => {
  it("shows 'Ragnarök Approaches' label for active howl tab in ragnarok mode", () => {
    render(
      <DashboardTabButton
        {...defaultProps({
          tab: makeActiveTab("howl"),
          gates: FULL_GATES,
          ragnarokActive: true,
          isActive: true,
        })}
      />,
    );
    expect(screen.getByRole("tab").textContent).toContain(
      "Ragnarök Approaches",
    );
  });

  it("shows normal label for non-howl tab even in ragnarok mode", () => {
    render(
      <DashboardTabButton
        {...defaultProps({
          tab: { ...makeActiveTab("active"), label: "Active" },
          gates: FULL_GATES,
          ragnarokActive: true,
        })}
      />,
    );
    expect(screen.getByRole("tab").textContent).toContain("Active");
  });

  it("shows normal howl label when ragnarok is NOT active", () => {
    render(
      <DashboardTabButton
        {...defaultProps({
          tab: { ...makeActiveTab("howl"), label: "The Howl" },
          gates: FULL_GATES,
          ragnarokActive: false,
        })}
      />,
    );
    expect(screen.getByRole("tab").textContent).toContain("The Howl");
  });
});

describe("DashboardTabButton — click and keyboard handlers", () => {
  it("calls onClick when button is clicked", () => {
    const onClick = vi.fn();
    render(<DashboardTabButton {...defaultProps({ onClick })} />);
    fireEvent.click(screen.getByRole("tab"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("calls onKeyDown when a key is pressed", () => {
    const onKeyDown = vi.fn();
    render(<DashboardTabButton {...defaultProps({ onKeyDown })} />);
    fireEvent.keyDown(screen.getByRole("tab"), { key: "ArrowRight" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});
