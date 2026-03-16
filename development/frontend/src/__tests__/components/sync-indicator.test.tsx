/**
 * SyncIndicator — component tests (Loki QA — issue #1125)
 *
 * Validates:
 *   - aria-label updates correctly for all 4 cloud states + idle/Thrall
 *   - ping ring: present only in syncing state, has motion-reduce:hidden class
 *   - Gleipnir Fragment 1 trigger fires on ALL states (easter egg never suppressed)
 *   - SR live region: empty for idle, announces cloud state changes
 *   - Thrall fenrir:sync local event: brief syncing pulse then idle
 *   - Karl ignores fenrir:sync (uses cloud state only)
 *
 * Issue #1125
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SyncIndicator } from "@/components/layout/SyncIndicator";

// ── Mocks ──────────────────────────────────────────────────────────────────────

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

const mockIsKarlOrTrial = { value: false };
vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => mockIsKarlOrTrial.value,
}));

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

vi.mock("@/hooks/useCloudSync", () => ({
  useCloudSync: () => mockCloudSync,
  SYNCED_DISPLAY_MS: 3000,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function setThrall() {
  mockIsKarlOrTrial.value = false;
  mockCloudSync.status = "idle";
  mockCloudSync.lastSyncedAt = null;
}

function setKarl(status: typeof mockCloudSync.status = "idle") {
  mockIsKarlOrTrial.value = true;
  mockCloudSync.status = status;
}

// ── aria-label per state ───────────────────────────────────────────────────────

describe("SyncIndicator — aria-label per state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Thrall/idle: aria-label is 'Background sync'", () => {
    setThrall();
    render(<SyncIndicator />);
    expect(screen.getByRole("button", { name: "Background sync" })).toBeDefined();
  });

  it("Karl syncing: aria-label is 'Syncing to cloud'", () => {
    setKarl("syncing");
    render(<SyncIndicator />);
    expect(screen.getByRole("button", { name: "Syncing to cloud" })).toBeDefined();
  });

  it("Karl synced: aria-label is 'Cloud sync complete'", () => {
    setKarl("synced");
    mockCloudSync.lastSyncedAt = new Date();
    render(<SyncIndicator />);
    expect(screen.getByRole("button", { name: "Cloud sync complete" })).toBeDefined();
  });

  it("Karl offline: aria-label is 'Cloud sync offline'", () => {
    setKarl("offline");
    render(<SyncIndicator />);
    expect(screen.getByRole("button", { name: "Cloud sync offline" })).toBeDefined();
  });

  it("Karl error: aria-label is 'Cloud sync failed'", () => {
    setKarl("error");
    render(<SyncIndicator />);
    expect(screen.getByRole("button", { name: "Cloud sync failed" })).toBeDefined();
  });

  it("Karl + idle: aria-label falls back to 'Background sync'", () => {
    setKarl("idle");
    render(<SyncIndicator />);
    expect(screen.getByRole("button", { name: "Background sync" })).toBeDefined();
  });
});

// ── Ping ring presence ─────────────────────────────────────────────────────────

describe("SyncIndicator — ping ring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ping ring present in syncing state for Karl", () => {
    setKarl("syncing");
    const { container } = render(<SyncIndicator />);
    expect(container.querySelector(".sync-ping-ring")).not.toBeNull();
  });

  it("ping ring absent in idle state (Thrall)", () => {
    setThrall();
    const { container } = render(<SyncIndicator />);
    expect(container.querySelector(".sync-ping-ring")).toBeNull();
  });

  it("ping ring absent in error state for Karl", () => {
    setKarl("error");
    const { container } = render(<SyncIndicator />);
    expect(container.querySelector(".sync-ping-ring")).toBeNull();
  });

  it("ping ring absent in offline state for Karl", () => {
    setKarl("offline");
    const { container } = render(<SyncIndicator />);
    expect(container.querySelector(".sync-ping-ring")).toBeNull();
  });

  it("ping ring absent in synced state for Karl", () => {
    setKarl("synced");
    mockCloudSync.lastSyncedAt = new Date();
    const { container } = render(<SyncIndicator />);
    expect(container.querySelector(".sync-ping-ring")).toBeNull();
  });

  it("ping ring has motion-reduce:hidden class (reduced-motion compliance)", () => {
    setKarl("syncing");
    const { container } = render(<SyncIndicator />);
    const ring = container.querySelector(".sync-ping-ring");
    expect(ring?.className).toContain("motion-reduce:hidden");
  });
});

// ── Gleipnir Fragment 1 fires on ALL states ────────────────────────────────────

describe("SyncIndicator — Gleipnir Fragment 1 fires on ALL states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Fragment 1 trigger fires: Thrall/idle dot clicked", () => {
    setThrall();
    render(<SyncIndicator />);
    fireEvent.click(screen.getByRole("button", { name: "Background sync" }));
    expect(mockTrigger).toHaveBeenCalledTimes(1);
  });

  it("Fragment 1 trigger fires: Karl syncing dot clicked", () => {
    setKarl("syncing");
    render(<SyncIndicator />);
    fireEvent.click(screen.getByRole("button", { name: "Syncing to cloud" }));
    expect(mockTrigger).toHaveBeenCalledTimes(1);
  });

  it("Fragment 1 trigger fires: Karl error dot clicked", () => {
    setKarl("error");
    render(<SyncIndicator />);
    fireEvent.click(screen.getByRole("button", { name: "Cloud sync failed" }));
    expect(mockTrigger).toHaveBeenCalledTimes(1);
  });

  it("Fragment 1 trigger fires: Karl offline dot clicked", () => {
    setKarl("offline");
    render(<SyncIndicator />);
    fireEvent.click(screen.getByRole("button", { name: "Cloud sync offline" }));
    expect(mockTrigger).toHaveBeenCalledTimes(1);
  });

  it("Fragment 1 trigger fires: Karl synced dot clicked", () => {
    setKarl("synced");
    mockCloudSync.lastSyncedAt = new Date();
    render(<SyncIndicator />);
    fireEvent.click(screen.getByRole("button", { name: "Cloud sync complete" }));
    expect(mockTrigger).toHaveBeenCalledTimes(1);
  });
});

// ── SR live region ─────────────────────────────────────────────────────────────

describe("SyncIndicator — SR live region", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("SR live region is empty for Thrall/idle", () => {
    setThrall();
    const { container } = render(<SyncIndicator />);
    const sr = container.querySelector('[aria-live="polite"]');
    expect(sr?.textContent).toBe("");
  });

  it("SR live region is empty for Karl/idle", () => {
    setKarl("idle");
    const { container } = render(<SyncIndicator />);
    const sr = container.querySelector('[aria-live="polite"]');
    expect(sr?.textContent).toBe("");
  });

  it("SR live region announces 'Syncing to cloud' for Karl syncing", () => {
    setKarl("syncing");
    const { container } = render(<SyncIndicator />);
    const sr = container.querySelector('[aria-live="polite"]');
    expect(sr?.textContent).toBe("Syncing to cloud");
  });

  it("SR live region announces 'Cloud sync complete' for Karl synced", () => {
    setKarl("synced");
    mockCloudSync.lastSyncedAt = new Date();
    const { container } = render(<SyncIndicator />);
    const sr = container.querySelector('[aria-live="polite"]');
    expect(sr?.textContent).toBe("Cloud sync complete");
  });

  it("SR live region announces 'Cloud sync failed' for Karl error", () => {
    setKarl("error");
    const { container } = render(<SyncIndicator />);
    const sr = container.querySelector('[aria-live="polite"]');
    expect(sr?.textContent).toBe("Cloud sync failed");
  });

  it("SR live region announces 'Cloud sync offline' for Karl offline", () => {
    setKarl("offline");
    const { container } = render(<SyncIndicator />);
    const sr = container.querySelector('[aria-live="polite"]');
    expect(sr?.textContent).toBe("Cloud sync offline");
  });

  it("SR live region has aria-atomic=true", () => {
    setThrall();
    const { container } = render(<SyncIndicator />);
    const sr = container.querySelector('[aria-live="polite"]');
    expect(sr?.getAttribute("aria-atomic")).toBe("true");
  });
});

// ── Thrall local fenrir:sync event ─────────────────────────────────────────────

describe("SyncIndicator — Thrall local fenrir:sync event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Thrall shows brief syncing (ping ring) on fenrir:sync event, then clears", () => {
    setThrall();
    const { container } = render(<SyncIndicator />);

    // No ping ring initially
    expect(container.querySelector(".sync-ping-ring")).toBeNull();

    // Dispatch local sync event
    act(() => {
      window.dispatchEvent(new CustomEvent("fenrir:sync"));
    });

    // Ping ring appears (localSyncing = true)
    expect(container.querySelector(".sync-ping-ring")).not.toBeNull();

    // After 1500ms the local sync clears
    act(() => vi.advanceTimersByTime(1600));
    expect(container.querySelector(".sync-ping-ring")).toBeNull();
  });

  it("Karl ignores fenrir:sync event — no ping ring added when cloud state is idle", () => {
    setKarl("idle");
    const { container } = render(<SyncIndicator />);

    act(() => {
      window.dispatchEvent(new CustomEvent("fenrir:sync"));
    });

    // Karl in idle: no ping ring (localSyncing is suppressed for Karl)
    expect(container.querySelector(".sync-ping-ring")).toBeNull();
  });
});

// ── Dot CSS classes ────────────────────────────────────────────────────────────

describe("SyncIndicator — dot CSS state classes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("error state: dot has bg-destructive class", () => {
    setKarl("error");
    const { container } = render(<SyncIndicator />);
    const dot = container.querySelector(".sync-dot");
    expect(dot?.className).toContain("bg-destructive");
  });

  it("synced state: dot has emerald class", () => {
    setKarl("synced");
    mockCloudSync.lastSyncedAt = new Date();
    const { container } = render(<SyncIndicator />);
    const dot = container.querySelector(".sync-dot");
    expect(dot?.className).toContain("bg-emerald-500");
  });

  it("dot has motion-reduce:transition-none class for smooth-less reduced-motion", () => {
    setThrall();
    const { container } = render(<SyncIndicator />);
    const dot = container.querySelector(".sync-dot");
    expect(dot?.className).toContain("motion-reduce:transition-none");
  });
});
