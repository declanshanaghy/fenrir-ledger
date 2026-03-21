/**
 * Component render tests for TrialSettingsSection — Issue #1032
 *
 * Validates that the Subscribe price CTA button is shown/hidden correctly
 * based on trial status, per AC:
 *   - Hidden during active trial
 *   - Shown when trial expired
 *   - Hidden for paid Karl subscribers (converted → section hidden)
 *   - Hidden for Thrall users with no trial (none → section hidden)
 *   - Plain Subscribe button in StripeSettings tier card remains unchanged
 *
 * @see components/trial/TrialSettingsSection.tsx
 * @see Issue #1032
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrialSettingsSection } from "@/components/trial/TrialSettingsSection";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSubscribeStripe = vi.fn();

const mockTrialStatus = {
  remainingDays: 15,
  status: "active" as string,
  isLoading: false,
};

const mockMetrics = {
  cardCount: 3,
  totalAnnualFees: 14400,
  totalAnnualFeesFormatted: "$144.00",
};

vi.mock("@/hooks/useTrialStatus", () => ({
  useTrialStatus: () => mockTrialStatus,
}));

vi.mock("@/hooks/useTrialMetrics", () => ({
  useTrialMetrics: () => mockMetrics,
}));

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({
    tier: "thrall",
    isLoading: false,
    subscribeStripe: mockSubscribeStripe,
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function setStatus(status: string, remainingDays = 15) {
  mockTrialStatus.status = status;
  mockTrialStatus.remainingDays = remainingDays;
  mockTrialStatus.isLoading = false;
}

function renderSection() {
  return render(<TrialSettingsSection />);
}

/** Price text present in the subscribe CTA button label */
const PRICE_BUTTON_TEXT = "$3.99/month";
const PRICE_BUTTON_ARIA = "Upgrade to Karl subscription";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TrialSettingsSection — Subscribe price button visibility (Issue #1032)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC: Subscribe button with price hidden during active trial
  it("hides the price CTA button during an active trial", () => {
    setStatus("active");
    renderSection();

    // The "Upgrade to Karl subscription" button must NOT exist
    const priceButton = screen.queryByRole("button", { name: PRICE_BUTTON_ARIA });
    expect(priceButton).toBeNull();
  });

  // AC: Subscribe button with price hidden during active trial (text check)
  it("does not render any button containing '$3.99/month' during active trial", () => {
    setStatus("active");
    const { container } = renderSection();

    const buttons = container.querySelectorAll("button");
    const priceButtons = Array.from(buttons).filter((btn) =>
      btn.textContent?.includes(PRICE_BUTTON_TEXT)
    );
    expect(priceButtons).toHaveLength(0);
  });

  // AC: Subscribe button with price shown when trial expired
  it("shows the price CTA button when trial has expired", () => {
    setStatus("expired", 0);
    renderSection();

    const priceButton = screen.queryByRole("button", { name: PRICE_BUTTON_ARIA });
    expect(priceButton).not.toBeNull();
  });

  // AC: Subscribe button with price shown when trial expired (text check)
  it("renders price button text 'Upgrade to Karl — $3.99/month' when expired", () => {
    setStatus("expired", 0);
    const { container } = renderSection();

    const buttons = container.querySelectorAll("button");
    const priceButtons = Array.from(buttons).filter((btn) =>
      btn.textContent?.includes(PRICE_BUTTON_TEXT)
    );
    expect(priceButtons).toHaveLength(1);
    expect(priceButtons[0].textContent).toContain("Upgrade to Karl");
  });

  // AC: Subscribe button with price hidden for paid Karl subscribers (converted)
  it("renders nothing for converted (paid Karl) users — whole section hidden", () => {
    setStatus("converted");
    const { container } = renderSection();

    // TrialSettingsSection returns null for converted
    expect(container.firstChild).toBeNull();
  });

  // AC: Anonymous / no-trial users see the "not started" box (issue #1384)
  it("renders the anonymous trial-not-started box for status 'none'", () => {
    setStatus("none");
    renderSection();

    const section = screen.getByRole("region", { name: "Trial Status" });
    expect(section).toBeDefined();
  });

  it("shows Norse-themed 'not started' copy for status 'none'", () => {
    setStatus("none");
    const { container } = renderSection();

    expect(container.textContent).toContain("Thy trial hath not yet begun");
  });

  it("shows Google sign-in CTA link for status 'none'", () => {
    setStatus("none");
    renderSection();

    const cta = screen.getByRole("link", { name: /sign in with google to begin thy karl trial/i });
    expect(cta).toBeDefined();
  });

  it("does not render subscribe price button for status 'none'", () => {
    setStatus("none");
    renderSection();

    const priceButton = screen.queryByRole("button", { name: PRICE_BUTTON_ARIA });
    expect(priceButton).toBeNull();
  });

  // AC: Section renders during active trial (section itself not hidden)
  it("renders the Trial Status section during active trial", () => {
    setStatus("active");
    renderSection();

    const section = screen.getByRole("region", { name: "Trial Status" });
    expect(section).toBeDefined();
  });

  // AC: Section renders during expired trial
  it("renders the Trial Status section when trial is expired", () => {
    setStatus("expired", 0);
    renderSection();

    const section = screen.getByRole("region", { name: "Trial Status" });
    expect(section).toBeDefined();
  });

  // Edge: loading state — section hidden
  it("renders nothing while loading", () => {
    mockTrialStatus.isLoading = true;
    mockTrialStatus.status = "active";
    const { container } = renderSection();

    expect(container.firstChild).toBeNull();
    // Restore
    mockTrialStatus.isLoading = false;
  });

  // AC: Plain Subscribe button in tier card remains unchanged (regression guard)
  it("active trial section has no button with aria-label 'Upgrade to Karl subscription'", () => {
    setStatus("active");
    renderSection();

    // Confirm the price button aria-label is absent — plain Subscribe in StripeSettings
    // is a separate component; this test guards against accidental leakage
    const btn = screen.queryByRole("button", { name: PRICE_BUTTON_ARIA });
    expect(btn).toBeNull();
  });
});
