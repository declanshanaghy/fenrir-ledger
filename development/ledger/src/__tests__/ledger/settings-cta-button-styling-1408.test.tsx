/**
 * Issue #1408 — Settings CTA button gold styling
 *
 * Verifies that:
 *   - HouseholdSettingsSection "Sign in to get started" uses gold CTA classes
 *   - SyncSettingsSection "Upgrade to Karl" uses gold CTA classes
 *   - Neither button uses the old outline-only styling
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { HouseholdSettingsSection } from "@/components/household/HouseholdSettingsSection";
import { SyncSettingsSection } from "@/components/sync/SyncSettingsSection";

// ── HouseholdSettingsSection mocks ─────────────────────────────────────────────

const mockEnsureFreshToken = vi.fn();
vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ── SyncSettingsSection mocks ──────────────────────────────────────────────────

const mockEntitlement = {
  tier: "thrall" as "thrall" | "karl",
  isActive: false,
  subscribeStripe: vi.fn(),
};

const mockTrialStatus = {
  status: "none" as "none" | "active" | "expired" | "converted",
};

const mockCloudSync = {
  status: "idle" as "idle" | "syncing" | "synced" | "offline" | "error",
  lastSyncedAt: null as Date | null,
  cardCount: null as number | null,
  errorMessage: null as string | null,
  errorCode: null as string | null,
  errorTimestamp: null as Date | null,
  retryIn: null as number | null,
  syncNow: vi.fn().mockResolvedValue(undefined),
  dismissError: vi.fn(),
};

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => mockEntitlement,
}));

vi.mock("@/hooks/useTrialStatus", () => ({
  useTrialStatus: () => mockTrialStatus,
}));

vi.mock("@/hooks/useCloudSync", () => ({
  useCloudSync: () => mockCloudSync,
}));

// ── Tests: Household "Sign in to get started" gold CTA ─────────────────────────

describe("HouseholdSettingsSection — Sign in button gold CTA (issue #1408)", () => {
  beforeEach(() => {
    mockEnsureFreshToken.mockResolvedValue(null);
  });

  it("renders the Sign in to get started link", async () => {
    render(<HouseholdSettingsSection />);
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /sign in to manage your household/i });
      expect(link).toBeDefined();
    });
  });

  it("Sign in link has gold background CTA class", async () => {
    render(<HouseholdSettingsSection />);
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /sign in to manage your household/i });
      expect((link as HTMLElement).className).toContain("bg-gold");
    });
  });

  it("Sign in link has primary-foreground text class", async () => {
    render(<HouseholdSettingsSection />);
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /sign in to manage your household/i });
      expect((link as HTMLElement).className).toContain("text-primary-foreground");
    });
  });

  it("Sign in link does NOT use plain outline-only border-border styling", async () => {
    render(<HouseholdSettingsSection />);
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /sign in to manage your household/i });
      // Old styling: only border-border with no bg-gold. Border-gold is OK (part of new CTA).
      // Check class does NOT contain text-foreground without bg-gold (old pattern).
      const cls = (link as HTMLElement).className;
      expect(cls).toContain("bg-gold");
      expect(cls).not.toContain("hover:bg-muted");
    });
  });

  it("Sign in link preserves min-h-[44px] touch target", async () => {
    render(<HouseholdSettingsSection />);
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /sign in to manage your household/i });
      expect((link as HTMLElement).className).toContain("min-h-[44px]");
    });
  });
});

// ── Tests: SyncSettingsSection "Upgrade to Karl" gold CTA ─────────────────────

describe("SyncSettingsSection — Upgrade to Karl button gold CTA (issue #1408)", () => {
  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    mockTrialStatus.status = "none";
  });

  it("renders the Upgrade to Karl button for thrall tier", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Upgrade to Karl to unlock Cloud Sync" });
    expect(btn).toBeDefined();
  });

  it("Upgrade to Karl button has gold background CTA class", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Upgrade to Karl to unlock Cloud Sync" });
    expect((btn as HTMLElement).className).toContain("bg-gold");
  });

  it("Upgrade to Karl button has primary-foreground text class", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Upgrade to Karl to unlock Cloud Sync" });
    expect((btn as HTMLElement).className).toContain("text-primary-foreground");
  });

  it("Upgrade to Karl button does NOT use plain outline-only border-border styling", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Upgrade to Karl to unlock Cloud Sync" });
    const cls = (btn as HTMLElement).className;
    expect(cls).toContain("bg-gold");
    expect(cls).not.toContain("hover:bg-muted");
  });

  it("does NOT render Upgrade to Karl button for trial users", () => {
    // Trial users see the upsell card but without the upgrade button
    // (the Subscription card above has its own upgrade button)
    mockTrialStatus.status = "active";
    render(<SyncSettingsSection />);
    const btn = screen.queryByRole("button", { name: "Upgrade to Karl to unlock Cloud Sync" });
    expect(btn).toBeNull();
  });

  it("Upgrade to Karl button preserves min-h-[44px] touch target", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Upgrade to Karl to unlock Cloud Sync" });
    expect((btn as HTMLElement).className).toContain("min-h-[44px]");
  });
});
