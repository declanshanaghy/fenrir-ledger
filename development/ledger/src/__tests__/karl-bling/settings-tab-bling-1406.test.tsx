/**
 * Settings page tabs — karl-bling-tab class (Issue #1406)
 *
 * Validates that all Settings page tab buttons carry the `karl-bling-tab` CSS
 * class. The karl-bling.css cascade fires on this class:
 *
 *   [data-tier="karl"]  .karl-bling-tab[aria-selected="true"] { color: var(--karl-gold); ... }
 *   [data-tier="trial"] .karl-bling-tab[aria-selected="true"] { color: rgba(212,165,32,0.80); ... }
 *
 * This ensures active Settings tabs render gold text for Karl/trial users —
 * matching the Cards page (Dashboard) where active tabs use `text-gold`.
 *
 * @see app/karl-bling.css  — .karl-bling-tab rules
 * @see app/ledger/settings/page.tsx  — tab buttons
 * @see Issue #1406
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("Settings page tabs — karl-bling-tab class (Issue #1406)", () => {
  it("all tab buttons carry the karl-bling-tab class for Karl gold cascade", () => {
    render(<SettingsPage />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    for (const tab of tabs) {
      expect(tab.className).toContain("karl-bling-tab");
    }
  });

  it("active tab button has aria-selected=true and karl-bling-tab class", () => {
    render(<SettingsPage />);
    const accountTab = screen.getByRole("tab", { name: /^Account$/i });
    expect(accountTab.getAttribute("aria-selected")).toBe("true");
    expect(accountTab.className).toContain("karl-bling-tab");
  });

  it("inactive tab buttons carry karl-bling-tab class for hover bling", () => {
    render(<SettingsPage />);
    const householdTab = screen.getByRole("tab", { name: /^Household$/i });
    const settingsTab = screen.getByRole("tab", { name: /^Settings$/i });
    expect(householdTab.getAttribute("aria-selected")).toBe("false");
    expect(settingsTab.getAttribute("aria-selected")).toBe("false");
    expect(householdTab.className).toContain("karl-bling-tab");
    expect(settingsTab.className).toContain("karl-bling-tab");
  });
});
