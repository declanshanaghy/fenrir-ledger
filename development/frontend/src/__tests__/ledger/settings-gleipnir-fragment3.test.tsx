/**
 * Settings page — Fragment #3 trigger integration tests (Issue #1024)
 *
 * Validates that the RestoreTabGuides component inside settings/page.tsx
 * correctly wires the "Restore the Guides" button to useGleipnirFragment3().
 *
 * These tests exercise the acceptance criteria from issue #1024:
 *   - Clicking "Restore the Guides" sets egg:gleipnir-3 in localStorage (first time only)
 *   - Button is disabled when no tab guides are dismissed
 *   - Button is enabled when at least one guide is dismissed
 *   - Repeat clicks do not re-trigger the fragment
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsPage from "@/app/ledger/settings/page";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));

// Stub heavy sub-components that are unrelated to this acceptance criteria
vi.mock("@/components/entitlement/StripeSettings", () => ({
  StripeSettings: () => <div data-testid="stripe-settings" />,
}));

vi.mock("@/components/trial/TrialSettingsSection", () => ({
  TrialSettingsSection: () => <div data-testid="trial-section" />,
}));

vi.mock("@/components/household/HouseholdSettingsSection", () => ({
  HouseholdSettingsSection: () => <div data-testid="household-section" />,
}));

// Stub EasterEggModal — we verify the trigger side-effect (localStorage) not the modal UI
vi.mock("@/components/easter-eggs/EasterEggModal", () => ({
  EasterEggModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="easter-egg-modal" /> : null,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const TAB_GUIDE_KEY = "fenrir:tab-header-dismissed:all";

function dismissOneGuide() {
  localStorage.setItem(TAB_GUIDE_KEY, "true");
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("SettingsPage — RestoreTabGuides → Fragment #3 trigger", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("Restore button is disabled when no tab guides are dismissed", () => {
    render(<SettingsPage />);
    const btn = screen.getByRole("button", { name: /Restore the Guides/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("Restore button is enabled when at least one guide is dismissed", () => {
    dismissOneGuide();
    render(<SettingsPage />);
    const btn = screen.getByRole("button", { name: /Restore the Guides/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("clicking Restore sets egg:gleipnir-3 in localStorage on first restore", () => {
    dismissOneGuide();
    render(<SettingsPage />);
    const btn = screen.getByRole("button", { name: /Restore the Guides/i });
    fireEvent.click(btn);
    expect(localStorage.getItem("egg:gleipnir-3")).toBe("1");
  });

  it("clicking Restore clears tab guide keys from localStorage", () => {
    dismissOneGuide();
    render(<SettingsPage />);
    const btn = screen.getByRole("button", { name: /Restore the Guides/i });
    fireEvent.click(btn);
    expect(localStorage.getItem(TAB_GUIDE_KEY)).toBeNull();
  });

  it("clicking Restore a second time does NOT reset egg:gleipnir-3 (trigger is no-op after first)", () => {
    // First restore: fragment discovered, key written
    dismissOneGuide();
    const { unmount } = render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Restore the Guides/i }));
    expect(localStorage.getItem("egg:gleipnir-3")).toBe("1");
    unmount();

    // Simulate a second visit to settings after dismissing a guide again
    dismissOneGuide();
    render(<SettingsPage />);
    const btn = screen.getByRole("button", { name: /Restore the Guides/i });
    fireEvent.click(btn);
    // Fragment key is still "1" — no change (trigger was a no-op)
    expect(localStorage.getItem("egg:gleipnir-3")).toBe("1");
  });
});
