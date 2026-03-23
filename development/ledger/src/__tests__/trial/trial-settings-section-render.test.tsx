/**
 * Component render tests for TrialSettingsSection — Issue #1032, #1940
 *
 * Validates that the trial card renders correctly per tier + auth + trial-status:
 *   - Karl tier → never renders (no flash)
 *   - Loading → never renders (no flash)
 *   - Converted → hidden
 *   - Anonymous + none → sign-in CTA
 *   - Thrall authenticated + none → "trial over" upsell, no button
 *   - Thrall authenticated + expired → "trial over" upsell, no button
 *   - Thrall + active trial → trial progress, no subscribe button
 *
 * @see components/trial/TrialSettingsSection.tsx
 * @see Issue #1032
 * @see Issue #1940
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrialSettingsSection } from "@/components/trial/TrialSettingsSection";

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

const mockEntitlement = {
  tier: "thrall" as string,
  isLoading: false,
  subscribeStripe: vi.fn(),
};

const mockAuth = {
  status: "authenticated" as string,
};

vi.mock("@/hooks/useTrialStatus", () => ({
  useTrialStatus: () => mockTrialStatus,
}));

vi.mock("@/hooks/useTrialMetrics", () => ({
  useTrialMetrics: () => mockMetrics,
}));

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => mockEntitlement,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => mockAuth,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function setStatus(status: string, remainingDays = 15) {
  mockTrialStatus.status = status;
  mockTrialStatus.remainingDays = remainingDays;
  mockTrialStatus.isLoading = false;
}

function setTier(tier: string) {
  mockEntitlement.tier = tier;
  mockEntitlement.isLoading = false;
}

function setAuth(status: string) {
  mockAuth.status = status;
}

function renderSection() {
  return render(<TrialSettingsSection />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("TrialSettingsSection — Issue #1940: Karl tier + flash + upsell", () => {
  beforeEach(() => {
    mockTrialStatus.status = "active";
    mockTrialStatus.remainingDays = 15;
    mockTrialStatus.isLoading = false;
    mockEntitlement.tier = "thrall";
    mockEntitlement.isLoading = false;
    mockAuth.status = "authenticated";
  });

  // ── Karl tier: never render ────────────────────────────────────────────────

  it("renders nothing for Karl tier (active trial status)", () => {
    setTier("karl");
    setStatus("active");
    const { container } = renderSection();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for Karl tier (converted status)", () => {
    setTier("karl");
    setStatus("converted");
    const { container } = renderSection();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for Karl tier (none status)", () => {
    setTier("karl");
    setStatus("none");
    const { container } = renderSection();
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for Karl tier (expired status)", () => {
    setTier("karl");
    setStatus("expired", 0);
    const { container } = renderSection();
    expect(container.firstChild).toBeNull();
  });

  // ── Loading states: no flash ───────────────────────────────────────────────

  it("renders nothing while trial is loading", () => {
    mockTrialStatus.isLoading = true;
    mockTrialStatus.status = "active";
    const { container } = renderSection();
    expect(container.firstChild).toBeNull();
    mockTrialStatus.isLoading = false;
  });

  it("renders nothing while entitlement is loading", () => {
    mockEntitlement.isLoading = true;
    setStatus("active");
    const { container } = renderSection();
    expect(container.firstChild).toBeNull();
    mockEntitlement.isLoading = false;
  });

  it("renders nothing while auth is loading", () => {
    setAuth("loading");
    setStatus("active");
    const { container } = renderSection();
    expect(container.firstChild).toBeNull();
    setAuth("authenticated");
  });

  // ── Converted: hide ────────────────────────────────────────────────────────

  it("renders nothing for converted (paid Karl via trial flow) users", () => {
    setStatus("converted");
    const { container } = renderSection();
    expect(container.firstChild).toBeNull();
  });

  // ── Anonymous + none: sign-in CTA ─────────────────────────────────────────

  it("shows sign-in CTA for anonymous user with no trial", () => {
    setAuth("anonymous");
    setStatus("none");
    renderSection();

    const cta = screen.getByRole("link", { name: /sign in with google to begin thy karl trial/i });
    expect(cta).toBeDefined();
  });

  it("shows 'not yet begun' copy for anonymous user", () => {
    setAuth("anonymous");
    setStatus("none");
    const { container } = renderSection();
    expect(container.textContent).toContain("Thy trial hath not yet begun");
  });

  it("does not show subscribe button for anonymous user", () => {
    setAuth("anonymous");
    setStatus("none");
    renderSection();
    const btn = screen.queryByRole("button", { name: /upgrade to karl/i });
    expect(btn).toBeNull();
  });

  // ── Thrall authenticated + none: upsell, no button ────────────────────────

  it("shows 'trial over' upsell for authenticated Thrall with no trial", () => {
    setAuth("authenticated");
    setStatus("none");
    const { container } = renderSection();
    expect(container.textContent).toContain("Thy trial hath ended");
  });

  it("shows Karl upsell copy for authenticated Thrall with no trial", () => {
    setAuth("authenticated");
    setStatus("none");
    const { container } = renderSection();
    expect(container.textContent).toContain("Ascend to Karl");
  });

  it("does not show sign-in link for authenticated Thrall with no trial", () => {
    setAuth("authenticated");
    setStatus("none");
    renderSection();
    const link = screen.queryByRole("link", { name: /sign in/i });
    expect(link).toBeNull();
  });

  it("does not show subscribe button for authenticated Thrall with no trial", () => {
    setAuth("authenticated");
    setStatus("none");
    renderSection();
    const btn = screen.queryByRole("button");
    expect(btn).toBeNull();
  });

  // ── Thrall authenticated + expired: upsell, no button ─────────────────────

  it("shows 'trial over' upsell for Thrall with expired trial", () => {
    setStatus("expired", 0);
    const { container } = renderSection();
    expect(container.textContent).toContain("Thy trial hath ended");
  });

  it("shows Karl upsell copy for Thrall with expired trial", () => {
    setStatus("expired", 0);
    const { container } = renderSection();
    expect(container.textContent).toContain("Ascend to Karl");
  });

  it("does not show subscribe button for expired trial (Subscription card has one)", () => {
    setStatus("expired", 0);
    renderSection();
    const btn = screen.queryByRole("button");
    expect(btn).toBeNull();
  });

  it("renders Trial Status section heading for expired Thrall", () => {
    setStatus("expired", 0);
    renderSection();
    const section = screen.getByRole("region", { name: "Trial Status" });
    expect(section).toBeDefined();
  });

  // ── Thrall + active trial: progress, no subscribe button ──────────────────

  it("renders Trial Status section for active trial", () => {
    setStatus("active");
    renderSection();
    const section = screen.getByRole("region", { name: "Trial Status" });
    expect(section).toBeDefined();
  });

  it("shows remaining days in plan label for active trial", () => {
    setStatus("active", 15);
    const { container } = renderSection();
    expect(container.textContent).toContain("15 days remaining");
  });

  it("does not show subscribe button during active trial", () => {
    setStatus("active");
    renderSection();
    const btn = screen.queryByRole("button", { name: /upgrade to karl/i });
    expect(btn).toBeNull();
  });

  it("shows trial start and end dates during active trial", () => {
    setStatus("active", 15);
    const { container } = renderSection();
    expect(container.textContent).toContain("Trial started");
    expect(container.textContent).toContain("Trial ends");
  });

  it("shows cards tracked metric during active trial", () => {
    setStatus("active");
    renderSection();
    expect(screen.getByText("3")).toBeDefined();
  });
});
