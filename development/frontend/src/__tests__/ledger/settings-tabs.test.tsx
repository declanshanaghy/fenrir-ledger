/**
 * Settings page — 3-tab layout tests (Issue #1367)
 *
 * Tests:
 *   - Default tab is Account
 *   - URL hash initializes correct tab
 *   - Clicking tabs shows correct panel and updates hash
 *   - Dynamic subtitle updates per active tab
 *   - Mobile select changes active tab
 *   - WAI-ARIA roles and attributes
 *   - Keyboard navigation (ArrowLeft / ArrowRight / Home / End)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsPage from "@/app/ledger/settings/page";
import * as analytics from "@/lib/analytics/track";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));

vi.mock("@/components/entitlement/StripeSettings", () => ({
  StripeSettings: () => <div data-testid="stripe-settings" />,
}));

vi.mock("@/components/trial/TrialSettingsSection", () => ({
  TrialSettingsSection: () => <div data-testid="trial-section" />,
}));

vi.mock("@/components/household/HouseholdSettingsSection", () => ({
  HouseholdSettingsSection: () => <div data-testid="household-section" />,
}));

vi.mock("@/components/sync/SyncSettingsSection", () => ({
  SyncSettingsSection: () => <div data-testid="sync-section" />,
}));

vi.mock("@/components/easter-eggs/EasterEggModal", () => ({
  EasterEggModal: () => null,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTab(name: string) {
  return screen.getByRole("tab", { name: new RegExp(`^${name}$`, "i") });
}

function getPanel(id: string): HTMLElement | null {
  return document.getElementById(`settings-panel-${id}`);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("SettingsPage — 3-tab layout (issue #1367)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.location.hash = "";
  });

  // ── Default tab ────────────────────────────────────────────────────────────

  it("renders Account tab selected by default", () => {
    render(<SettingsPage />);
    const accountTab = getTab("Account");
    expect(accountTab.getAttribute("aria-selected")).toBe("true");
  });

  it("Account panel is visible by default, others hidden", () => {
    render(<SettingsPage />);
    expect(getPanel("account")?.hasAttribute("hidden")).toBe(false);
    expect(getPanel("household")?.hasAttribute("hidden")).toBe(true);
    expect(getPanel("settings")?.hasAttribute("hidden")).toBe(true);
  });

  it("shows Account subtitle by default", () => {
    render(<SettingsPage />);
    expect(
      screen.queryByText(/The wolf's chain awaits your command/i)
    ).not.toBeNull();
  });

  // ── Tab switching ──────────────────────────────────────────────────────────

  it("clicking Household tab selects it and shows household panel", () => {
    render(<SettingsPage />);
    fireEvent.click(getTab("Household"));
    expect(getTab("Household").getAttribute("aria-selected")).toBe("true");
    expect(getTab("Account").getAttribute("aria-selected")).toBe("false");
    expect(getPanel("household")?.hasAttribute("hidden")).toBe(false);
    expect(getPanel("account")?.hasAttribute("hidden")).toBe(true);
  });

  it("clicking Settings tab shows settings panel with RestoreTabGuides", () => {
    render(<SettingsPage />);
    fireEvent.click(getTab("Settings"));
    expect(getPanel("settings")?.hasAttribute("hidden")).toBe(false);
    expect(
      screen.queryByRole("button", { name: /Restore the Guides/i })
    ).not.toBeNull();
  });

  it("subtitle updates when switching tabs", () => {
    render(<SettingsPage />);
    fireEvent.click(getTab("Household"));
    expect(screen.queryByText(/Forge the bonds that bind/i)).not.toBeNull();

    fireEvent.click(getTab("Settings"));
    expect(screen.queryByText(/Shape the ledger to your will/i)).not.toBeNull();
  });

  // ── URL hash ───────────────────────────────────────────────────────────────

  it("clicking a tab updates URL hash via replaceState", () => {
    const spy = vi.spyOn(history, "replaceState");
    render(<SettingsPage />);
    fireEvent.click(getTab("Household"));
    expect(spy).toHaveBeenCalledWith(null, "", "#household");
    spy.mockRestore();
  });

  it("fires settings-tab-switch analytics event on tab click", () => {
    render(<SettingsPage />);
    fireEvent.click(getTab("Household"));
    expect(vi.mocked(analytics.track)).toHaveBeenCalledWith("settings-tab-switch", { tab: "household" });
  });

  // ── WAI-ARIA ───────────────────────────────────────────────────────────────

  it("tablist has correct role and aria-label", () => {
    render(<SettingsPage />);
    const tablist = screen.getByRole("tablist");
    expect(tablist.getAttribute("aria-label")).toBe("Settings tabs");
  });

  it("each tab has aria-controls pointing to its panel", () => {
    render(<SettingsPage />);
    expect(getTab("Account").getAttribute("aria-controls")).toBe("settings-panel-account");
    expect(getTab("Household").getAttribute("aria-controls")).toBe("settings-panel-household");
    expect(getTab("Settings").getAttribute("aria-controls")).toBe("settings-panel-settings");
  });

  it("each panel has aria-labelledby pointing to its tab", () => {
    render(<SettingsPage />);
    expect(getPanel("account")?.getAttribute("aria-labelledby")).toBe("settings-tab-account");
    expect(getPanel("household")?.getAttribute("aria-labelledby")).toBe("settings-tab-household");
    expect(getPanel("settings")?.getAttribute("aria-labelledby")).toBe("settings-tab-settings");
  });

  it("active tab has tabIndex 0, inactive tabs have tabIndex -1", () => {
    render(<SettingsPage />);
    expect(getTab("Account").getAttribute("tabindex")).toBe("0");
    expect(getTab("Household").getAttribute("tabindex")).toBe("-1");
    expect(getTab("Settings").getAttribute("tabindex")).toBe("-1");
  });

  it("subtitle has aria-live=polite", () => {
    render(<SettingsPage />);
    const subtitle = document.getElementById("settings-subtitle");
    expect(subtitle?.getAttribute("aria-live")).toBe("polite");
  });

  // ── Keyboard navigation ────────────────────────────────────────────────────

  it("ArrowRight moves focus to next tab", () => {
    render(<SettingsPage />);
    const accountTab = getTab("Account");
    fireEvent.keyDown(accountTab, { key: "ArrowRight" });
    expect(getTab("Household").getAttribute("aria-selected")).toBe("true");
  });

  it("ArrowRight wraps from last tab to first", () => {
    render(<SettingsPage />);
    fireEvent.click(getTab("Settings"));
    fireEvent.keyDown(getTab("Settings"), { key: "ArrowRight" });
    expect(getTab("Account").getAttribute("aria-selected")).toBe("true");
  });

  it("ArrowLeft moves focus to previous tab, wrapping from first to last", () => {
    render(<SettingsPage />);
    const accountTab = getTab("Account");
    fireEvent.keyDown(accountTab, { key: "ArrowLeft" });
    // Account is first, so wrap to last (Settings)
    expect(getTab("Settings").getAttribute("aria-selected")).toBe("true");
  });

  it("Home key activates the first tab", () => {
    render(<SettingsPage />);
    fireEvent.click(getTab("Settings"));
    fireEvent.keyDown(getTab("Settings"), { key: "Home" });
    expect(getTab("Account").getAttribute("aria-selected")).toBe("true");
  });

  it("End key activates the last tab", () => {
    render(<SettingsPage />);
    fireEvent.keyDown(getTab("Account"), { key: "End" });
    expect(getTab("Settings").getAttribute("aria-selected")).toBe("true");
  });

  // ── Mobile select ──────────────────────────────────────────────────────────

  it("mobile select renders with correct options", () => {
    render(<SettingsPage />);
    const select = screen.getByLabelText(/Settings section/i) as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.options).toHaveLength(3);
    expect(select.options[0].value).toBe("account");
    expect(select.options[1].value).toBe("household");
    expect(select.options[2].value).toBe("settings");
  });

  it("changing mobile select activates the selected tab", () => {
    render(<SettingsPage />);
    const select = screen.getByLabelText(/Settings section/i);
    fireEvent.change(select, { target: { value: "household" } });
    expect(getTab("Household").getAttribute("aria-selected")).toBe("true");
    expect(getPanel("household")?.hasAttribute("hidden")).toBe(false);
  });

  // ── Panel content ──────────────────────────────────────────────────────────

  it("Account panel renders StripeSettings and TrialSettingsSection", () => {
    render(<SettingsPage />);
    expect(screen.queryByTestId("stripe-settings")).not.toBeNull();
    expect(screen.queryByTestId("trial-section")).not.toBeNull();
  });

  it("Household panel renders HouseholdSettingsSection and SyncSettingsSection", () => {
    render(<SettingsPage />);
    fireEvent.click(getTab("Household"));
    expect(screen.queryByTestId("household-section")).not.toBeNull();
    expect(screen.queryByTestId("sync-section")).not.toBeNull();
  });
});
