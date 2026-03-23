/**
 * SyncSettingsSection — Loki gap tests (issue #1686)
 *
 * Covers edge cases not tested by FiremanDecko:
 *   - Error block fallback copy (no errorMessage)
 *   - Error title variation (no errorCode → "Sync failed")
 *   - retryIn singular/plural rendering
 *   - Card count hidden in error state
 *   - "Last successful sync:" label vs "Last synced:" label
 *   - idle state: Sync Now enabled, no status-specific messages
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { SyncSettingsSection } from "@/components/sync/SyncSettingsSection";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEntitlement = {
  tier: "karl" as "thrall" | "karl",
  isActive: true,
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

function resetToKarl() {
  mockEntitlement.tier = "karl";
  mockEntitlement.isActive = true;
  mockTrialStatus.status = "none";
  mockCloudSync.status = "idle";
  mockCloudSync.lastSyncedAt = null;
  mockCloudSync.cardCount = null;
  mockCloudSync.errorMessage = null;
  mockCloudSync.errorCode = null;
  mockCloudSync.errorTimestamp = null;
  mockCloudSync.retryIn = null;
}

// ── Error block edge cases ───────────────────────────────────────────────────

describe("SyncSettingsSection — error block: no errorMessage", () => {
  beforeEach(() => {
    resetToKarl();
    mockCloudSync.status = "error";
    mockCloudSync.errorMessage = null;
    mockCloudSync.errorCode = null;
  });

  it("shows fallback 'Could not reach Yggdrasil' copy when no errorMessage", () => {
    render(<SyncSettingsSection />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Could not reach Yggdrasil");
  });

  it("shows 'Sync failed' title when no errorCode", () => {
    render(<SyncSettingsSection />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Sync failed");
    expect(alert.textContent).not.toContain("Last sync failed");
  });
});

describe("SyncSettingsSection — error block: with errorCode", () => {
  beforeEach(() => {
    resetToKarl();
    mockCloudSync.status = "error";
    mockCloudSync.errorMessage = "Write timeout";
    mockCloudSync.errorCode = "deadline-exceeded";
    mockCloudSync.errorTimestamp = null;
    mockCloudSync.retryIn = null;
  });

  it("shows 'Last sync failed' title when errorCode present", () => {
    render(<SyncSettingsSection />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Last sync failed");
  });

  it("shows errorMessage and errorCode in detail", () => {
    render(<SyncSettingsSection />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Write timeout");
    expect(alert.textContent).toContain("deadline-exceeded");
  });
});

// ── retryIn singular vs plural ───────────────────────────────────────────────

describe("SyncSettingsSection — error block: retryIn countdown", () => {
  beforeEach(() => {
    resetToKarl();
    mockCloudSync.status = "error";
    mockCloudSync.errorMessage = "Network error";
    mockCloudSync.errorCode = null;
    mockCloudSync.errorTimestamp = null;
  });

  it("shows singular 'second' when retryIn is 1", () => {
    mockCloudSync.retryIn = 1;
    render(<SyncSettingsSection />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Retrying in: 1 second");
    expect(alert.textContent).not.toContain("seconds");
  });

  it("shows plural 'seconds' when retryIn > 1", () => {
    mockCloudSync.retryIn = 30;
    render(<SyncSettingsSection />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Retrying in: 30 seconds");
  });

  it("does NOT show retry countdown when retryIn is 0", () => {
    mockCloudSync.retryIn = 0;
    render(<SyncSettingsSection />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).not.toContain("Retrying in:");
  });

  it("does NOT show retry countdown when retryIn is null", () => {
    mockCloudSync.retryIn = null;
    render(<SyncSettingsSection />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).not.toContain("Retrying in:");
  });
});

// ── Card count visibility ────────────────────────────────────────────────────

describe("SyncSettingsSection — card count visibility", () => {
  beforeEach(() => {
    resetToKarl();
    mockCloudSync.lastSyncedAt = new Date();
    mockCloudSync.cardCount = 12;
  });

  it("hides card count in error state even when cardCount is set", () => {
    mockCloudSync.status = "error";
    mockCloudSync.errorMessage = "Timeout";
    mockCloudSync.errorCode = "timeout";
    render(<SyncSettingsSection />);
    expect(screen.queryByText(/12 cards/)).toBeNull();
  });

  it("hides card count while syncing", () => {
    mockCloudSync.status = "syncing";
    render(<SyncSettingsSection />);
    expect(screen.queryByText(/12 cards/)).toBeNull();
  });

  it("shows card count in synced state", () => {
    mockCloudSync.status = "synced";
    render(<SyncSettingsSection />);
    expect(screen.getByText(/12 cards/)).toBeDefined();
  });
});

// ── Last synced label ────────────────────────────────────────────────────────

describe("SyncSettingsSection — last synced label", () => {
  beforeEach(() => {
    resetToKarl();
    mockCloudSync.lastSyncedAt = new Date();
    mockCloudSync.cardCount = 5;
  });

  it("shows 'Last successful sync:' in error state", () => {
    mockCloudSync.status = "error";
    mockCloudSync.errorMessage = "Timeout";
    mockCloudSync.errorCode = "timeout";
    render(<SyncSettingsSection />);
    expect(screen.getByText("Last successful sync:")).toBeDefined();
  });

  it("shows 'Last synced:' in synced state", () => {
    mockCloudSync.status = "synced";
    render(<SyncSettingsSection />);
    expect(screen.getByText("Last synced:")).toBeDefined();
  });

  it("hides last synced row while syncing", () => {
    mockCloudSync.status = "syncing";
    render(<SyncSettingsSection />);
    expect(screen.queryByText("Last synced:")).toBeNull();
    expect(screen.queryByText("Last successful sync:")).toBeNull();
  });
});

// ── Idle state ───────────────────────────────────────────────────────────────

describe("SyncSettingsSection — Karl: idle state", () => {
  beforeEach(() => {
    resetToKarl();
    mockCloudSync.status = "idle";
  });

  it("renders enabled Sync Now button in idle state", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Sync cards to cloud now" });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows no progress bar in idle state", () => {
    render(<SyncSettingsSection />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("shows no error alert in idle state", () => {
    render(<SyncSettingsSection />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows no offline message in idle state", () => {
    render(<SyncSettingsSection />);
    expect(screen.queryByText(/You're offline/)).toBeNull();
  });
});
