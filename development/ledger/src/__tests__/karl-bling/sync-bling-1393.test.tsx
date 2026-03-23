/**
 * SyncSettingsSection — karl-bling-card class (Issue #1393)
 *
 * Validates that the Cloud Sync card carries the `karl-bling-card` class
 * across all three tier branches:
 *   - Thrall → ThrallUpsellCard with upgrade button (class was missing — fixed)
 *   - Trial  → ThrallUpsellCard without upgrade button (class was missing — fixed)
 *   - Karl   → SyncStatusCard (class was already present — regression guard)
 *
 * The CSS cascade in karl-bling.css reads `data-tier` on the document body:
 *   - `[data-tier="karl"]`  → full gold border + glow
 *   - `[data-tier="trial"]` → softer gold border + muted glow
 *   - `[data-tier="thrall"]` → no rules → no bling
 * Adding the class to all cards ensures the cascade can fire correctly.
 *
 * @see components/sync/SyncSettingsSection.tsx
 * @see Issue #1393
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SyncSettingsSection } from "@/components/sync/SyncSettingsSection";

// ── Mocks ─────────────────────────────────────────────────────────────────────

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
  SYNCED_DISPLAY_MS: 3000,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function setThrall() {
  mockEntitlement.tier = "thrall";
  mockTrialStatus.status = "none";
}

function setTrial() {
  mockEntitlement.tier = "thrall";
  mockTrialStatus.status = "active";
}

function setKarl() {
  mockEntitlement.tier = "karl";
  mockTrialStatus.status = "none";
}

// ── Tests: karl-bling-card class presence ─────────────────────────────────────

describe("SyncSettingsSection — karl-bling-card class (Issue #1393)", () => {
  beforeEach(() => {
    mockCloudSync.status = "idle";
    mockCloudSync.lastSyncedAt = null;
    mockCloudSync.cardCount = null;
    mockCloudSync.errorMessage = null;
    mockCloudSync.errorCode = null;
  });

  // AC: Thrall user — ThrallUpsellCard must have karl-bling-card class
  it("Thrall: Cloud Sync card section has karl-bling-card class", () => {
    setThrall();
    const { container } = render(<SyncSettingsSection />);
    const section = container.querySelector('section[aria-label="Cloud Sync"]');
    expect(section).not.toBeNull();
    expect(section!.className).toContain("karl-bling-card");
  });

  // AC: Trial user — ThrallUpsellCard (no upgrade button) must have karl-bling-card class
  it("Trial: Cloud Sync card section has karl-bling-card class", () => {
    setTrial();
    const { container } = render(<SyncSettingsSection />);
    const section = container.querySelector('section[aria-label="Cloud Sync"]');
    expect(section).not.toBeNull();
    expect(section!.className).toContain("karl-bling-card");
  });

  // Regression: Karl user — SyncStatusCard already had the class, must keep it
  it("Karl: Cloud Sync card section retains karl-bling-card class", () => {
    setKarl();
    const { container } = render(<SyncSettingsSection />);
    const section = container.querySelector('section[aria-label="Cloud Sync"]');
    expect(section).not.toBeNull();
    expect(section!.className).toContain("karl-bling-card");
  });

  // AC: Thrall sees upsell with upgrade button
  it("Thrall: shows 'Upgrade to Karl' button on upsell card", () => {
    setThrall();
    render(<SyncSettingsSection />);
    const btn = screen.queryByRole("button", {
      name: "Upgrade to Karl to unlock Cloud Sync",
    });
    expect(btn).not.toBeNull();
  });

  // AC: Trial sees upsell WITHOUT upgrade button (Subscription card handles it)
  it("Trial: upsell card omits upgrade button (Subscription card has it)", () => {
    setTrial();
    render(<SyncSettingsSection />);
    const btn = screen.queryByRole("button", {
      name: "Upgrade to Karl to unlock Cloud Sync",
    });
    expect(btn).toBeNull();
  });
});
