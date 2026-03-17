/**
 * useCloudSync — edge-case tests (issue #1119)
 *
 * Covers edge cases for the API-based sync hook:
 *   - Online/offline network events (Karl goes offline/back online)
 *   - Thrall ignores online/offline events
 *   - Tier switching without page reload (Thrall → Karl starts syncing)
 *   - retryIn countdown decrements every second, clears at 0
 *   - First-sync toast pluralization: singular "card" vs plural "cards"
 *   - First-sync toast suppressed when count is 0
 *   - Error state persists after toast (toast ≠ dismissError)
 *   - dismissError() is a no-op when not in error state
 *   - dismissError clears all error fields
 *
 * Issue #1119
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSync, SYNCED_DISPLAY_MS } from "@/hooks/useCloudSync";
import type { Card } from "@/lib/types";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockIsKarlOrTrial = { value: false };

vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => mockIsKarlOrTrial.value,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockEnsureFreshToken = vi.fn<[], Promise<string | null>>();
vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: () => mockEnsureFreshToken(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: () => ({ user: { sub: "test-household" } }),
}));

vi.mock("@/lib/storage", () => ({
  getCards: vi.fn().mockReturnValue([]),
  setAllCards: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function mockFetchGet(cards: Card[] = []) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      householdId: "test-household",
      cards,
      syncedAt: new Date().toISOString(),
    }),
  } as Response);
}

function mockFetchFail(code = "forbidden") {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ error: code }),
  } as Response);
}

function mockFetchPending() {
  global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
}

function goOffline() {
  window.dispatchEvent(new Event("offline"));
}

function goOnline() {
  window.dispatchEvent(new Event("online"));
}

// ── Online / Offline events ────────────────────────────────────────────────────

describe("useCloudSync — online/offline events (Karl)", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = true;
    mockEnsureFreshToken.mockResolvedValue("test-token");
    mockFetchPending(); // hang initial pull so we can test offline events
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("Karl goes offline on 'offline' window event", () => {
    mockFetchPending();
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("syncing");
    act(() => goOffline());
    expect(result.current.status).toBe("offline");
  });

  it("Karl returns to syncing on 'online' event when an active sync was interrupted", async () => {
    // Pending fetch = active sync in progress when offline occurs
    mockFetchPending();
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("syncing");
    act(() => goOffline());
    expect(result.current.status).toBe("offline");
    // Going online while isSyncingRef=true restores to "syncing"
    act(() => goOnline());
    expect(result.current.status).toBe("syncing");
  });

  it("Karl online → offline → online cycle restores to syncing (active sync)", () => {
    mockFetchPending();
    const { result } = renderHook(() => useCloudSync());
    act(() => goOffline());
    act(() => goOnline());
    act(() => goOffline());
    expect(result.current.status).toBe("offline");
    act(() => goOnline());
    expect(result.current.status).toBe("syncing");
  });
});

describe("useCloudSync — Thrall ignores online/offline events", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = false;
    global.fetch = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("Thrall stays idle on 'offline' event", () => {
    const { result } = renderHook(() => useCloudSync());
    act(() => goOffline());
    expect(result.current.status).toBe("idle");
  });

  it("Thrall stays idle on 'online' event", () => {
    const { result } = renderHook(() => useCloudSync());
    act(() => goOffline());
    act(() => goOnline());
    expect(result.current.status).toBe("idle");
  });
});

// ── Tier switching without page reload ────────────────────────────────────────

describe("useCloudSync — tier switching without page reload", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = false;
    mockEnsureFreshToken.mockResolvedValue("test-token");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("Thrall → Karl: starts syncing on tier upgrade", async () => {
    global.fetch = vi.fn(); // no fetch for Thrall
    const { result, rerender } = renderHook(() => useCloudSync());

    expect(result.current.status).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();

    // Upgrade to Karl
    mockIsKarlOrTrial.value = true;
    mockFetchGet([]);
    rerender();

    expect(result.current.status).toBe("syncing");
    await act(async () => {});
    expect(result.current.status).toBe("synced");
  });

  it("Karl → Thrall: stops processing syncs on tier downgrade", async () => {
    mockIsKarlOrTrial.value = true;
    mockFetchGet([]);
    const { result, rerender } = renderHook(() => useCloudSync());
    await act(async () => {});
    expect(result.current.status).toBe("synced");

    // Downgrade to Thrall
    mockIsKarlOrTrial.value = false;
    rerender();

    // Status stays as-is but no new syncs happen
    expect(result.current.status).not.toBe("syncing");
    const prevCallCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    await act(async () => {});
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(prevCallCount);
  });
});

// ── retryIn countdown ─────────────────────────────────────────────────────────

describe("useCloudSync — retryIn countdown", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = true;
    mockEnsureFreshToken.mockResolvedValue("test-token");
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("retryIn is set to ERROR_RETRY_SECONDS on error, then decrements", async () => {
    mockFetchFail("forbidden");
    const { result } = renderHook(() => useCloudSync());

    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.status).toBe("error");
    expect(result.current.retryIn).toBe(120);

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.retryIn).toBe(117);
  });

  it("retryIn clears to null after countdown reaches zero", async () => {
    mockFetchFail("forbidden");
    const { result } = renderHook(() => useCloudSync());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.retryIn).toBe(120);

    act(() => vi.advanceTimersByTime(121_000));
    expect(result.current.retryIn).toBeNull();
  });

  it("retryIn is null when no error has occurred", async () => {
    mockFetchGet([]);
    const { result } = renderHook(() => useCloudSync());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.retryIn).toBeNull();
  });
});

// ── First-sync toast pluralization ─────────────────────────────────────────────

describe("useCloudSync — first-sync toast pluralization", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = true;
    mockEnsureFreshToken.mockResolvedValue("test-token");
    try { localStorage.removeItem("fenrir:first-sync-shown"); } catch { /* ignore */ }
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses singular 'card' for count=1", async () => {
    const { toast } = await import("sonner");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ householdId: "test-household", cards: [{ id: "c1", updatedAt: "2025-01-01T00:00:00.000Z", householdId: "test-household", issuerId: "chase", cardName: "Test", openDate: "2025-01-01T00:00:00.000Z", creditLimit: 0, annualFee: 0, annualFeeDate: "", promoPeriodMonths: 0, signUpBonus: null, status: "active", notes: "", createdAt: "2025-01-01T00:00:00.000Z" }], syncedAt: new Date().toISOString() }),
    } as Response);

    renderHook(() => useCloudSync());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(toast.success).toHaveBeenCalledWith(
      "Your 1 card have been backed up",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("uses plural 'cards' for count=5", async () => {
    const { toast } = await import("sonner");
    const cards = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      householdId: "test-household",
      issuerId: "chase",
      cardName: "Test",
      openDate: "2025-01-01T00:00:00.000Z",
      creditLimit: 0,
      annualFee: 0,
      annualFeeDate: "",
      promoPeriodMonths: 0,
      signUpBonus: null,
      status: "active" as const,
      notes: "",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    }));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ householdId: "test-household", cards, syncedAt: new Date().toISOString() }),
    } as Response);

    renderHook(() => useCloudSync());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(toast.success).toHaveBeenCalledWith(
      "Your 5 cards have been backed up",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("suppresses first-sync toast when count is 0", async () => {
    const { toast } = await import("sonner");
    mockFetchGet([]); // 0 cards

    renderHook(() => useCloudSync());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(toast.success).not.toHaveBeenCalled();
  });
});

// ── Error persists after toast ────────────────────────────────────────────────

describe("useCloudSync — error persists after toast (toast ≠ dismissError)", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = true;
    mockEnsureFreshToken.mockResolvedValue("test-token");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("error status persists even after toast.error is called", async () => {
    const { toast } = await import("sonner");
    mockFetchFail("permission-denied");

    const { result } = renderHook(() => useCloudSync());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.status).toBe("error");

    // Toast was shown
    expect(toast.error).toHaveBeenCalledTimes(1);

    // Error state persists — toast dismissal is separate from dismissError()
    expect(result.current.status).toBe("error");
    expect(result.current.errorCode).toBe("permission-denied");
  });
});

// ── dismissError edge cases ────────────────────────────────────────────────────

describe("useCloudSync — dismissError edge cases", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = true;
    mockEnsureFreshToken.mockResolvedValue("test-token");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("dismissError is a no-op when status is syncing", () => {
    mockFetchPending();
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("syncing");
    act(() => result.current.dismissError());
    expect(result.current.status).toBe("syncing");
  });

  it("dismissError clears all error fields", async () => {
    mockFetchFail("quota-exceeded");

    const { result } = renderHook(() => useCloudSync());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.status).toBe("error");
    expect(result.current.errorMessage).not.toBeNull();
    expect(result.current.errorCode).toBe("quota-exceeded");
    expect(result.current.errorTimestamp).toBeInstanceOf(Date);
    expect(result.current.retryIn).toBe(120);

    act(() => result.current.dismissError());

    expect(result.current.status).toBe("idle");
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.errorCode).toBeNull();
    expect(result.current.errorTimestamp).toBeNull();
    expect(result.current.retryIn).toBeNull();
  });
});

// ── SYNCED_DISPLAY_MS export ───────────────────────────────────────────────────

describe("useCloudSync — SYNCED_DISPLAY_MS constant", () => {
  it("SYNCED_DISPLAY_MS is a positive number (≥ 1000ms)", () => {
    expect(SYNCED_DISPLAY_MS).toBeGreaterThanOrEqual(1000);
  });
});
