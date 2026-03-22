/**
 * Settings page — tab style parity with My Cards screen (Issue #1747)
 *
 * Validates that Settings screen tabs exactly match My Cards (Dashboard) tab
 * styling: border-b-[3px], uppercase, px-4 py-3, border-gold active state,
 * and no native <select> dropdown on mobile.
 *
 * @see app/ledger/settings/page.tsx
 * @see components/dashboard/DashboardTabButton.tsx
 * @see Issue #1747
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsPage from "@/app/ledger/settings/page";

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Settings page — tab style parity with My Cards (Issue #1747)", () => {
  it("no native <select> dropdown is rendered (replaced by horizontal tab bar)", () => {
    render(<SettingsPage />);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("tab bar container is always rendered (not hidden on mobile)", () => {
    render(<SettingsPage />);
    const tablist = screen.getByRole("tablist");
    // Not hidden — flex on all viewports via CSS
    expect(tablist.className).not.toContain("hidden");
  });

  it("active tab uses border-gold (3px border matching Dashboard)", () => {
    render(<SettingsPage />);
    const activeTab = screen.getByRole("tab", { name: /^Account$/i });
    expect(activeTab.getAttribute("aria-selected")).toBe("true");
    expect(activeTab.className).toContain("border-gold");
    expect(activeTab.className).toContain("border-b-[3px]");
  });

  it("inactive tabs use border-transparent (matching Dashboard inactive state)", () => {
    render(<SettingsPage />);
    const householdTab = screen.getByRole("tab", { name: /^Household$/i });
    expect(householdTab.getAttribute("aria-selected")).toBe("false");
    expect(householdTab.className).toContain("border-transparent");
    expect(householdTab.className).toContain("border-b-[3px]");
  });

  it("all tabs use uppercase text (matching Dashboard tab treatment)", () => {
    render(<SettingsPage />);
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.className).toContain("uppercase");
    }
  });

  it("all tabs use px-4 py-3 padding (matching Dashboard tab padding)", () => {
    render(<SettingsPage />);
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.className).toContain("px-4");
      expect(tab.className).toContain("py-3");
    }
  });

  it("all tabs use min-h-[44px] for touch accessibility (matching Dashboard)", () => {
    render(<SettingsPage />);
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.className).toContain("min-h-[44px]");
    }
  });

  it("switching tabs updates active style from inactive to active", () => {
    render(<SettingsPage />);
    const householdTab = screen.getByRole("tab", { name: /^Household$/i });
    fireEvent.click(householdTab);
    expect(householdTab.className).toContain("border-gold");
    expect(householdTab.className).toContain("text-gold");
    const accountTab = screen.getByRole("tab", { name: /^Account$/i });
    expect(accountTab.className).toContain("border-transparent");
  });
});
