/**
 * Settings page tabs — Thrall selected tab visual indicator (Issue #1698)
 *
 * Validates that the selected tab uses `border-b-foreground` (not
 * `border-b-background`) so Thrall users see a visible underline.
 *
 * For Karl/trial users, karl-bling.css overrides the border with gold via
 * the `[data-tier="karl"] .karl-bling-tab[aria-selected="true"]` rule.
 * For Thrall users, the Tailwind `border-b-foreground` class is the only
 * indicator, making this class critical for accessibility.
 *
 * @see app/ledger/settings/page.tsx  — tab buttons
 * @see app/karl-bling.css  — .karl-bling-tab rules for karl/trial
 * @see Issue #1698
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

describe("Settings page tabs — Thrall selected tab visual indicator (Issue #1698)", () => {
  it("selected tab has border-b-foreground class (visible underline for Thrall users)", () => {
    render(<SettingsPage />);
    const accountTab = screen.getByRole("tab", { name: /^Account$/i });
    expect(accountTab.getAttribute("aria-selected")).toBe("true");
    expect(accountTab.className).toContain("border-b-foreground");
  });

  it("selected tab does NOT have border-b-background (which would be invisible)", () => {
    render(<SettingsPage />);
    const accountTab = screen.getByRole("tab", { name: /^Account$/i });
    expect(accountTab.getAttribute("aria-selected")).toBe("true");
    expect(accountTab.className).not.toContain("border-b-background");
  });

  it("unselected tabs do not have border-b-foreground", () => {
    render(<SettingsPage />);
    const householdTab = screen.getByRole("tab", { name: /^Household$/i });
    const settingsTab = screen.getByRole("tab", { name: /^Settings$/i });
    expect(householdTab.getAttribute("aria-selected")).toBe("false");
    expect(settingsTab.getAttribute("aria-selected")).toBe("false");
    expect(householdTab.className).not.toContain("border-b-foreground");
    expect(settingsTab.className).not.toContain("border-b-foreground");
  });

  it("switching tabs moves border-b-foreground to the newly selected tab", () => {
    render(<SettingsPage />);
    const householdTab = screen.getByRole("tab", { name: /^Household$/i });
    fireEvent.click(householdTab);
    expect(householdTab.getAttribute("aria-selected")).toBe("true");
    expect(householdTab.className).toContain("border-b-foreground");
    const accountTab = screen.getByRole("tab", { name: /^Account$/i });
    expect(accountTab.getAttribute("aria-selected")).toBe("false");
    expect(accountTab.className).not.toContain("border-b-foreground");
  });
});
