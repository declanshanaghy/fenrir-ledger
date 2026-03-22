/**
 * Settings page tabs — selected tab visual indicator (Issue #1698, #1747)
 *
 * Validates that the selected tab uses `border-gold` and `text-gold` classes,
 * matching the My Cards (Dashboard) screen tab styling.
 *
 * For Karl/trial users, karl-bling.css further overrides the border with
 * a gold value via `[data-tier="karl"] .karl-bling-tab[aria-selected="true"]`.
 * For Thrall users, `border-gold` / `text-gold` CSS variables provide the
 * visible underline indicator.
 *
 * @see app/ledger/settings/page.tsx  — tab buttons
 * @see app/karl-bling.css  — .karl-bling-tab rules for karl/trial
 * @see Issue #1698, #1747
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

describe("Settings page tabs — selected tab visual indicator (Issue #1698, #1747)", () => {
  it("selected tab has border-gold class (matches My Cards screen active tab)", () => {
    render(<SettingsPage />);
    const accountTab = screen.getByRole("tab", { name: /^Account$/i });
    expect(accountTab.getAttribute("aria-selected")).toBe("true");
    expect(accountTab.className).toContain("border-gold");
  });

  it("selected tab has text-gold class (matches My Cards screen active tab)", () => {
    render(<SettingsPage />);
    const accountTab = screen.getByRole("tab", { name: /^Account$/i });
    expect(accountTab.getAttribute("aria-selected")).toBe("true");
    expect(accountTab.className).toContain("text-gold");
  });

  it("unselected tabs have border-transparent (not border-gold)", () => {
    render(<SettingsPage />);
    const householdTab = screen.getByRole("tab", { name: /^Household$/i });
    const settingsTab = screen.getByRole("tab", { name: /^Settings$/i });
    expect(householdTab.getAttribute("aria-selected")).toBe("false");
    expect(settingsTab.getAttribute("aria-selected")).toBe("false");
    expect(householdTab.className).toContain("border-transparent");
    expect(settingsTab.className).toContain("border-transparent");
  });

  it("switching tabs moves border-gold to the newly selected tab", () => {
    render(<SettingsPage />);
    const householdTab = screen.getByRole("tab", { name: /^Household$/i });
    fireEvent.click(householdTab);
    expect(householdTab.getAttribute("aria-selected")).toBe("true");
    expect(householdTab.className).toContain("border-gold");
    const accountTab = screen.getByRole("tab", { name: /^Account$/i });
    expect(accountTab.getAttribute("aria-selected")).toBe("false");
    expect(accountTab.className).toContain("border-transparent");
  });

  it("all tab buttons use border-b-[3px] (matches My Cards 3px border width)", () => {
    render(<SettingsPage />);
    const tabs = screen.getAllByRole("tab");
    for (const tab of tabs) {
      expect(tab.className).toContain("border-b-[3px]");
    }
  });

  it("all tab buttons use uppercase text treatment (matches My Cards tabs)", () => {
    render(<SettingsPage />);
    const tabs = screen.getAllByRole("tab");
    for (const tab of tabs) {
      expect(tab.className).toContain("uppercase");
    }
  });
});
