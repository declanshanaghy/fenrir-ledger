/**
 * useCloudSync — unit tests
 *
 * Tests the cloud sync hook state machine:
 *   - Thrall users always stay idle
 *   - Karl/trial users advance through cloud states via CustomEvents
 *   - syncNow() transitions to syncing
 *   - dismissError() clears error state → idle
 *   - First-sync toast guarded by localStorage key
 *   - Status stays idle for Thrall regardless of events
 *
 * Issue #1125
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSync, SYNCED_DISPLAY_MS } from "@/hooks/useCloudSync";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockIsKarlOrTrial = { value: false };

vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => mockIsKarlOrTrial.value,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function dispatchSyncStart() {
  window.dispatchEvent(new CustomEvent("fenrir:cloud-sync-start", { detail: {} }));
}

function dispatchSyncComplete(cardCount = 10) {
  window.dispatchEvent(
    new CustomEvent("fenrir:cloud-sync-complete", { detail: { cardCount } })
  );
}

function dispatchSyncError(errorMessage = "permission-denied", errorCode = "permission-denied") {
  window.dispatchEvent(
    new CustomEvent("fenrir:cloud-sync-error", {
      detail: { errorMessage, errorCode, retryIn: 120 },
    })
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useCloudSync — Thrall: always idle", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = false;
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("idle");
  });

  it("ignores sync events (stays idle)", () => {
    const { result } = renderHook(() => useCloudSync());
    act(() => dispatchSyncStart());
    expect(result.current.status).toBe("idle");
  });
});

describe("useCloudSync — Karl: state transitions", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = true;
    // Clean up localStorage before each test
    try {
      localStorage.removeItem("fenrir:first-sync-shown");
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("idle");
  });

  it("transitions idle → syncing on fenrir:cloud-sync-start", () => {
    const { result } = renderHook(() => useCloudSync());
    act(() => dispatchSyncStart());
    expect(result.current.status).toBe("syncing");
  });

  it("transitions syncing → synced on fenrir:cloud-sync-complete", () => {
    const { result } = renderHook(() => useCloudSync());
    act(() => dispatchSyncStart());
    act(() => dispatchSyncComplete(5));
    expect(result.current.status).toBe("synced");
    expect(result.current.cardCount).toBe(5);
    expect(result.current.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("transitions syncing → error on fenrir:cloud-sync-error", () => {
    const { result } = renderHook(() => useCloudSync());
    act(() => dispatchSyncStart());
    act(() => dispatchSyncError("Firestore write failed", "permission-denied"));
    expect(result.current.status).toBe("error");
    expect(result.current.errorCode).toBe("permission-denied");
    expect(result.current.errorTimestamp).toBeInstanceOf(Date);
    expect(result.current.retryIn).toBe(120);
  });

  it("dismissError clears error → idle", () => {
    const { result } = renderHook(() => useCloudSync());
    act(() => dispatchSyncStart());
    act(() => dispatchSyncError());
    expect(result.current.status).toBe("error");
    act(() => result.current.dismissError());
    expect(result.current.status).toBe("idle");
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.errorCode).toBeNull();
  });

  it("synced → idle auto-transition after SYNCED_DISPLAY_MS", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCloudSync());
    act(() => dispatchSyncStart());
    act(() => dispatchSyncComplete());
    expect(result.current.status).toBe("synced");
    act(() => vi.advanceTimersByTime(SYNCED_DISPLAY_MS + 100));
    expect(result.current.status).toBe("idle");
    vi.useRealTimers();
  });

  it("syncNow() transitions to syncing optimistically", async () => {
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("syncing");
  });

  it("syncNow() is a no-op when already syncing", async () => {
    const { result } = renderHook(() => useCloudSync());
    act(() => dispatchSyncStart());
    expect(result.current.status).toBe("syncing");
    // dispatch a second sync start via syncNow — should remain syncing, not throw
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("syncing");
  });
});

describe("useCloudSync — first-sync toast", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = true;
    try {
      localStorage.removeItem("fenrir:first-sync-shown");
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows first-sync toast on first synced transition", async () => {
    const { toast } = await import("sonner");
    const { result } = renderHook(() => useCloudSync());
    act(() => dispatchSyncStart());
    act(() => dispatchSyncComplete(12));
    expect(result.current.status).toBe("synced");
    expect(toast.success).toHaveBeenCalledWith(
      "Your 12 cards have been backed up",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("does not show toast on subsequent syncs (localStorage guard)", async () => {
    const { toast } = await import("sonner");
    try {
      localStorage.setItem("fenrir:first-sync-shown", "true");
    } catch {
      // ignore
    }
    const { result } = renderHook(() => useCloudSync());
    act(() => dispatchSyncStart());
    act(() => dispatchSyncComplete(12));
    expect(result.current.status).toBe("synced");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("useCloudSync — error toast", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows error toast on sync failure", async () => {
    const { toast } = await import("sonner");
    const { result } = renderHook(() => useCloudSync());
    act(() => dispatchSyncStart());
    act(() => dispatchSyncError());
    expect(result.current.status).toBe("error");
    expect(toast.error).toHaveBeenCalledWith(
      "Sync failed",
      expect.objectContaining({ description: "Your cards are safe locally. We'll retry shortly." })
    );
  });
});
