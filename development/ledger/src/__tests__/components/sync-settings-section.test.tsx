/**
 * SyncSettingsSection — component tests
 *
 * Verifies tier-gated rendering:
 *   - Thrall: upsell card, "KARL" badge, "Upgrade to Karl" button
 *   - Trial: upsell card, "KARL" badge, NO upgrade button (Subscription card has one)
 *   - Karl: full sync controls, rune corners, no badge
 *
 * Verifies per-status rendering for Karl:
 *   - synced: last synced timestamp + "Sync Now" enabled
 *   - syncing: progress bar + "Sync Now" disabled
 *   - offline: offline message + "Sync Now" disabled
 *   - error: error block + "Retry Now" + "Dismiss Error"
 *
 * Issue #1125, #1336
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  SyncSettingsSection,
  formatTimestamp,
  getSyncStatusDotClass,
} from "@/components/sync/SyncSettingsSection";

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
  status: "idle" as "idle" | "needs-upload" | "needs-download" | "syncing" | "synced" | "offline" | "error",
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function setThrall() {
  mockEntitlement.tier = "thrall";
  mockEntitlement.isActive = false;
  mockTrialStatus.status = "none";
}

function setTrial() {
  mockEntitlement.tier = "thrall";
  mockEntitlement.isActive = false;
  mockTrialStatus.status = "active";
}

function setKarl() {
  mockEntitlement.tier = "karl";
  mockEntitlement.isActive = true;
  mockTrialStatus.status = "none";
}

function setStatus(s: typeof mockCloudSync.status) {
  mockCloudSync.status = s;
  mockCloudSync.syncNow.mockClear();
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("SyncSettingsSection — Thrall: upsell card", () => {
  beforeEach(() => {
    setThrall();
  });

  it("renders Cloud Sync section with KARL badge", () => {
    render(<SyncSettingsSection />);
    const section = screen.getByRole("region", { name: "Cloud Sync" });
    expect(section).toBeDefined();
    expect(section.textContent).toContain("KARL");
  });

  it("renders 'Upgrade to Karl' CTA button", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", {
      name: "Upgrade to Karl to unlock Cloud Sync",
    });
    expect(btn).toBeDefined();
  });

  it("does NOT render Sync Now button", () => {
    render(<SyncSettingsSection />);
    expect(screen.queryByRole("button", { name: /sync now/i })).toBeNull();
  });

  it("calls subscribeStripe on Upgrade click", () => {
    mockEntitlement.subscribeStripe.mockResolvedValue(undefined);
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", {
      name: "Upgrade to Karl to unlock Cloud Sync",
    });
    act(() => fireEvent.click(btn));
    expect(mockEntitlement.subscribeStripe).toHaveBeenCalledWith("/ledger/settings");
  });

  it("renders upsell copy", () => {
    render(<SyncSettingsSection />);
    const section = screen.getByRole("region", { name: "Cloud Sync" });
    expect(section.textContent).toContain("Back up your ledger to Yggdrasil");
  });
});

describe("SyncSettingsSection — Trial: upsell card (no upgrade button)", () => {
  beforeEach(() => {
    setTrial();
  });

  it("renders Cloud Sync section with KARL badge (not TRIAL)", () => {
    render(<SyncSettingsSection />);
    const section = screen.getByRole("region", { name: "Cloud Sync" });
    expect(section).toBeDefined();
    expect(section.textContent).toContain("KARL");
    expect(section.textContent).not.toContain("TRIAL");
  });

  it("does NOT show 'Cloud Sync is active' message", () => {
    render(<SyncSettingsSection />);
    expect(screen.queryByText(/Cloud Sync is active during your trial/)).toBeNull();
  });

  it("renders upsell copy explaining local-only storage", () => {
    render(<SyncSettingsSection />);
    const section = screen.getByRole("region", { name: "Cloud Sync" });
    expect(section.textContent).toContain("Back up your ledger to Yggdrasil");
    expect(section.textContent).toContain("Cloud Sync is a Karl feature");
  });

  it("does NOT render 'Upgrade to Karl' button (Subscription card has one)", () => {
    render(<SyncSettingsSection />);
    expect(
      screen.queryByRole("button", { name: "Upgrade to Karl to unlock Cloud Sync" })
    ).toBeNull();
  });

  it("does NOT render Sync Now button", () => {
    render(<SyncSettingsSection />);
    expect(screen.queryByRole("button", { name: /sync now/i })).toBeNull();
  });
});

describe("SyncSettingsSection — Karl: synced state", () => {
  beforeEach(() => {
    setKarl();
    setStatus("synced");
    mockCloudSync.lastSyncedAt = new Date();
    mockCloudSync.cardCount = 47;
  });

  it("renders no tier badge for Karl", () => {
    render(<SyncSettingsSection />);
    const section = screen.getByRole("region", { name: "Cloud Sync" });
    expect(section.textContent).not.toContain("KARL");
    expect(section.textContent).not.toContain("TRIAL");
  });

  it("renders card count", () => {
    render(<SyncSettingsSection />);
    expect(screen.getByText(/47 cards/)).toBeDefined();
  });

  it("renders enabled Sync Now button", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Sync cards to cloud now" });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("calls syncNow on button click", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Sync cards to cloud now" });
    act(() => fireEvent.click(btn));
    expect(mockCloudSync.syncNow).toHaveBeenCalledTimes(1);
  });
});

describe("SyncSettingsSection — Karl: syncing state", () => {
  beforeEach(() => {
    setKarl();
    setStatus("syncing");
  });

  it("renders progress bar", () => {
    render(<SyncSettingsSection />);
    const progressbar = screen.getByRole("progressbar", {
      name: "Sync in progress",
    });
    expect(progressbar).toBeDefined();
  });

  it("renders Sync Now disabled during syncing", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Sync in progress" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("SyncSettingsSection — Karl: offline state", () => {
  beforeEach(() => {
    setKarl();
    setStatus("offline");
  });

  it("renders offline message", () => {
    render(<SyncSettingsSection />);
    expect(screen.getByText(/You're offline/)).toBeDefined();
  });

  it("renders Sync Now disabled when offline", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", {
      name: "Sync unavailable \u2014 offline",
    });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("formatTimestamp", () => {
  it("returns 'Today at HH:MM' for a date matching today", () => {
    const now = new Date();
    const result = formatTimestamp(now);
    expect(result).toMatch(/^Today at /);
  });

  it("returns 'Yesterday at HH:MM' for a date not matching today", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const result = formatTimestamp(yesterday);
    expect(result).toMatch(/^Yesterday at /);
  });
});

describe("getSyncStatusDotClass", () => {
  it.each([
    ["idle", "bg-[hsl(var(--egg-border))]"],
    ["syncing", "bg-[hsl(var(--egg-accent))]"],
    ["synced", "bg-emerald-500"],
    ["offline", "opacity-40"],
    ["error", "bg-destructive"],
    ["needs-upload", "bg-amber-400"],
    ["needs-download", "bg-cyan-500"],
  ] as const)("returns correct class for status=%s", (status, expected) => {
    expect(getSyncStatusDotClass(status)).toContain(expected);
  });
});

describe("SyncSettingsSection — Karl: error state", () => {
  beforeEach(() => {
    setKarl();
    setStatus("error");
    mockCloudSync.errorMessage = "Firestore write failed";
    mockCloudSync.errorCode = "permission-denied";
    mockCloudSync.errorTimestamp = new Date();
    mockCloudSync.retryIn = 120;
    mockCloudSync.lastSyncedAt = new Date();
  });

  it("renders error block with role=alert", () => {
    render(<SyncSettingsSection />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain("Last sync failed");
  });

  it("renders Retry Now button", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Retry cloud sync now" });
    expect(btn).toBeDefined();
  });

  it("renders Dismiss Error button", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Dismiss sync error" });
    expect(btn).toBeDefined();
  });

  it("calls syncNow on Retry Now click", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Retry cloud sync now" });
    act(() => fireEvent.click(btn));
    expect(mockCloudSync.syncNow).toHaveBeenCalledTimes(1);
  });

  it("calls dismissError on Dismiss Error click", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Dismiss sync error" });
    act(() => fireEvent.click(btn));
    expect(mockCloudSync.dismissError).toHaveBeenCalledTimes(1);
  });
});

describe("SyncSettingsSection — Karl: needs-upload state", () => {
  beforeEach(() => {
    setKarl();
    setStatus("needs-upload");
  });

  it("renders 'Local changes waiting to sync' message", () => {
    render(<SyncSettingsSection />);
    expect(screen.getByText(/Local changes waiting to sync/)).toBeDefined();
  });

  it("renders enabled Sync Now button", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Sync cards to cloud now" });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("auto-triggers syncNow on mount", () => {
    act(() => {
      render(<SyncSettingsSection />);
    });
    expect(mockCloudSync.syncNow).toHaveBeenCalledTimes(1);
  });

  it("dot has amber class (gold accent)", () => {
    expect(getSyncStatusDotClass("needs-upload")).toContain("bg-amber-400");
  });
});

describe("SyncSettingsSection — Karl: needs-download state", () => {
  beforeEach(() => {
    setKarl();
    setStatus("needs-download");
  });

  it("renders 'New changes from household available' message", () => {
    render(<SyncSettingsSection />);
    expect(screen.getByText(/New changes from household available/)).toBeDefined();
  });

  it("renders enabled Sync Now button", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Sync cards to cloud now" });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("auto-triggers syncNow on mount", () => {
    act(() => {
      render(<SyncSettingsSection />);
    });
    expect(mockCloudSync.syncNow).toHaveBeenCalledTimes(1);
  });

  it("dot has cyan class (contrasting blue)", () => {
    expect(getSyncStatusDotClass("needs-download")).toContain("bg-cyan-500");
  });
});

describe("SyncSettingsSection — Karl: no auto-sync for non-dirty states", () => {
  it("does NOT call syncNow on mount when status is idle", () => {
    setKarl();
    setStatus("idle");
    act(() => {
      render(<SyncSettingsSection />);
    });
    expect(mockCloudSync.syncNow).not.toHaveBeenCalled();
  });

  it("does NOT call syncNow on mount when status is synced", () => {
    setKarl();
    setStatus("synced");
    mockCloudSync.lastSyncedAt = new Date();
    act(() => {
      render(<SyncSettingsSection />);
    });
    expect(mockCloudSync.syncNow).not.toHaveBeenCalled();
  });
});
