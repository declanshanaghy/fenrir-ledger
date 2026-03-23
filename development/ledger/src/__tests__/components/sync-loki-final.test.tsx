/**
 * Sync UX — Loki final gap tests (issue #1125, #1336)
 *
 * Fills gaps not addressed in prior test files:
 *   - SyncIndicator: offline dot opacity-40, syncing dot color, idle dot color
 *   - SyncSettingsSection: Trial always shows upsell card (not error block — issue #1336)
 *   - SyncSettingsSection: error with no errorMessage shows fallback text
 *   - SyncSettingsSection: error with retryIn=null — no countdown shown
 *   - SyncSettingsSection: error state label reads "Last successful sync:"
 *   - SyncSettingsSection: progress bar has motion-reduce:animate-none class
 *
 * Issue #1125, #1336
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { SyncIndicator } from "@/components/layout/SyncIndicator";
import { SyncSettingsSection } from "@/components/sync/SyncSettingsSection";

// ── SyncIndicator mocks ────────────────────────────────────────────────────────

const mockTrigger = vi.fn();
const mockDismiss = vi.fn();

vi.mock("@/components/cards/GleipnirCatFootfall", () => ({
  GleipnirCatFootfall: () => null,
  useGleipnirFragment1: () => ({
    open: false,
    trigger: mockTrigger,
    dismiss: mockDismiss,
  }),
}));

const mockIndicatorIsKarlOrTrial = { value: false };
vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => mockIndicatorIsKarlOrTrial.value,
}));

const mockIndicatorCloudSync = {
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

vi.mock("@/hooks/useCloudSync", () => ({
  useCloudSync: () => mockIndicatorCloudSync,
  SYNCED_DISPLAY_MS: 3000,
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

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => mockEntitlement,
}));

vi.mock("@/hooks/useTrialStatus", () => ({
  useTrialStatus: () => mockTrialStatus,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function setIndicatorKarl(status: typeof mockIndicatorCloudSync.status) {
  mockIndicatorIsKarlOrTrial.value = true;
  mockIndicatorCloudSync.status = status;
}

function setIndicatorThrall() {
  mockIndicatorIsKarlOrTrial.value = false;
  mockIndicatorCloudSync.status = "idle";
}

function setSettingsTrial() {
  mockEntitlement.tier = "thrall";
  mockEntitlement.isActive = false;
  mockTrialStatus.status = "active";
}

function setSettingsKarl() {
  mockEntitlement.tier = "karl";
  mockEntitlement.isActive = true;
  mockTrialStatus.status = "none";
}

function setSettingsError(retryIn: number | null = 120) {
  mockIndicatorCloudSync.status = "error";
  mockIndicatorCloudSync.errorMessage = "Firestore write failed";
  mockIndicatorCloudSync.errorCode = "permission-denied";
  mockIndicatorCloudSync.errorTimestamp = new Date();
  mockIndicatorCloudSync.retryIn = retryIn;
  mockIndicatorCloudSync.lastSyncedAt = new Date();
}

// ── SyncIndicator: dot CSS classes for remaining states ────────────────────────

describe("SyncIndicator — dot CSS classes (offline + syncing + idle)", () => {
  beforeEach(() => {
    mockIndicatorCloudSync.lastSyncedAt = null;
  });

  it("offline state: dot has opacity-40 class (visually dimmed)", () => {
    setIndicatorKarl("offline");
    const { container } = render(<SyncIndicator />);
    const dot = container.querySelector(".sync-dot");
    expect(dot?.className).toContain("opacity-40");
  });

  it("syncing state: dot has egg-accent color class", () => {
    setIndicatorKarl("syncing");
    const { container } = render(<SyncIndicator />);
    const dot = container.querySelector(".sync-dot");
    // The syncing dot uses --egg-accent CSS variable
    expect(dot?.className).toContain("bg-[hsl(var(--egg-accent))]");
  });

  it("idle/Thrall: dot has egg-border color class", () => {
    setIndicatorThrall();
    const { container } = render(<SyncIndicator />);
    const dot = container.querySelector(".sync-dot");
    expect(dot?.className).toContain("bg-[hsl(var(--egg-border))]");
  });
});

// ── SyncIndicator: tooltip is aria-hidden ─────────────────────────────────────

describe("SyncIndicator — tooltip aria-hidden", () => {
  it("tooltip wrapper has aria-hidden=true (decorative, not read by SR)", () => {
    setIndicatorThrall();
    const { container } = render(<SyncIndicator />);
    // The tooltip div is aria-hidden since the button aria-label carries the accessible name
    const tooltip = container.querySelector('[aria-hidden="true"]');
    expect(tooltip).not.toBeNull();
  });
});

// ── SyncSettingsSection: Trial always shows upsell (issue #1336) ───────────────

describe("SyncSettingsSection — Trial: always shows upsell (not sync controls)", () => {
  beforeEach(() => {
    setSettingsTrial();
    setSettingsError(60); // even with error state set, trial should see upsell
  });

  it("Trial shows upsell card, not error block", () => {
    render(<SyncSettingsSection />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Trial shows upsell card with KARL badge", () => {
    render(<SyncSettingsSection />);
    const section = screen.getByRole("region", { name: "Cloud Sync" });
    expect(section.textContent).toContain("KARL");
    expect(section.textContent).not.toContain("TRIAL");
  });

  it("Trial does not show Retry Now button", () => {
    render(<SyncSettingsSection />);
    expect(screen.queryByRole("button", { name: "Retry cloud sync now" })).toBeNull();
  });

  it("Trial does not show Dismiss Error button", () => {
    render(<SyncSettingsSection />);
    expect(screen.queryByRole("button", { name: "Dismiss sync error" })).toBeNull();
  });
});

// ── SyncSettingsSection: error with no errorMessage ───────────────────────────

describe("SyncSettingsSection — error: no errorMessage fallback text", () => {
  beforeEach(() => {
    setSettingsKarl();
    mockIndicatorCloudSync.status = "error";
    mockIndicatorCloudSync.errorMessage = null;
    mockIndicatorCloudSync.errorCode = null;
    mockIndicatorCloudSync.errorTimestamp = new Date();
    mockIndicatorCloudSync.retryIn = null;
    mockIndicatorCloudSync.lastSyncedAt = null;
  });

  it("shows fallback 'Could not reach Yggdrasil' when errorMessage is null", () => {
    render(<SyncSettingsSection />);
    expect(screen.getByText(/Could not reach Yggdrasil/)).toBeDefined();
  });

  it("error block title is 'Sync failed' (not 'Last sync failed') when no errorCode", () => {
    render(<SyncSettingsSection />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Sync failed");
  });
});

// ── SyncSettingsSection: error retryIn=null — no countdown ────────────────────

describe("SyncSettingsSection — error: retryIn=null hides countdown", () => {
  beforeEach(() => {
    setSettingsKarl();
    setSettingsError(null);
  });

  it("does NOT render 'Retrying in:' text when retryIn is null", () => {
    render(<SyncSettingsSection />);
    expect(screen.queryByText(/Retrying in:/)).toBeNull();
  });
});

// ── SyncSettingsSection: error state "Last successful sync:" label ─────────────

describe("SyncSettingsSection — error: timestamp label is 'Last successful sync:'", () => {
  beforeEach(() => {
    setSettingsKarl();
    setSettingsError(null);
  });

  it("shows 'Last successful sync:' label in error state", () => {
    render(<SyncSettingsSection />);
    expect(screen.getByText(/Last successful sync:/)).toBeDefined();
  });
});

// ── SyncSettingsSection: progress bar motion-reduce class ─────────────────────

describe("SyncSettingsSection — syncing: progress bar motion-reduce class", () => {
  beforeEach(() => {
    setSettingsKarl();
    mockIndicatorCloudSync.status = "syncing";
    mockIndicatorCloudSync.lastSyncedAt = null;
  });

  it("progress bar fill has motion-reduce:animate-none class", () => {
    const { container } = render(<SyncSettingsSection />);
    const fill = container.querySelector(".sync-progress-fill");
    expect(fill?.className).toContain("motion-reduce:animate-none");
  });

  it("progress bar fill has motion-reduce:w-1/2 (static partial-fill for reduced-motion)", () => {
    const { container } = render(<SyncSettingsSection />);
    const fill = container.querySelector(".sync-progress-fill");
    expect(fill?.className).toContain("motion-reduce:w-1/2");
  });
});

// ── SyncSettingsSection: Karl idle — no progress bar, sync button enabled ─────

describe("SyncSettingsSection — Karl: idle state renders cleanly", () => {
  beforeEach(() => {
    setSettingsKarl();
    mockIndicatorCloudSync.status = "idle";
    mockIndicatorCloudSync.lastSyncedAt = null;
    mockIndicatorCloudSync.cardCount = null;
    mockIndicatorCloudSync.errorMessage = null;
    mockIndicatorCloudSync.errorCode = null;
  });

  it("no progress bar in idle state", () => {
    render(<SyncSettingsSection />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("no error alert in idle state", () => {
    render(<SyncSettingsSection />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Sync Now button enabled in idle state", () => {
    render(<SyncSettingsSection />);
    const btn = screen.getByRole("button", { name: "Sync cards to cloud now" });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });
});
