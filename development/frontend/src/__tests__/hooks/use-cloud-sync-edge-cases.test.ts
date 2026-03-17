/**
 * useCloudSync — edge-case tests (Loki QA — issue #1122)
 *
 * Covers gaps not addressed by the 13 basic unit tests:
 *   - Online/offline network events (Karl goes offline/back online)
 *   - Thrall ignores online/offline events
 *   - Tier switching without page reload (Thrall → Karl starts syncing)
 *   - retryIn countdown decrements every second, clears at 0
 *   - First-sync toast pluralization: singular "card" vs plural "cards"
 *   - Error state persists after toast dismiss (toast ≠ dismissError)
 *   - dismissError() is a no-op when not in error state
 *   - Error data overwritten on second consecutive error
 *   - syncNow() dispatches fenrir:cloud-sync-complete on success
 *
 * Root cause of prior failures:
 *   1. Tests mocked useIsKarlOrTrial — hook uses useEntitlement.
 *   2. Tests dispatched fenrir:cloud-sync-start / fenrir:cloud-sync-complete /
 *      fenrir:cloud-sync-error events, but the hook does NOT listen for these —
 *      it DISPATCHES them. State is driven by performSync() internally.
 *   3. retryIn expected custom values from events, but hook hardcodes
 *      AUTO_RETRY_MS/1000 = 30 seconds.
 *
 * Issue #1122
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSync, SYNCED_DISPLAY_MS } from "@/hooks/useCloudSync";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockEntitlement = { tier: "thrall" as string, isActive: false };

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => mockEntitlement,
}));

// Issue #1172: useCloudSync now gates on auth status — mock AuthContext
const mockAuthContext = { status: "authenticated" as string };

vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => mockAuthContext,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/storage", () => ({
  getRawAllCards: vi.fn().mockReturnValue([]),
  setAllCards: vi.fn(),
}));

// Treat all tests in this file as post-migration: hasMigrated() returns true
// so handleLoginTransition delegates to regular performSync without attempting
// a migration API call. This prevents the migration from consuming mock fetch
// responses that are meant for the sync flows under test.
vi.mock("@/lib/sync/migration", () => ({
  hasMigrated: () => true,
  runMigration: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const FAKE_SESSION = { id_token: "tok-edge", user: { sub: "hh-edge" } };

function setSession() {
  localStorage.setItem("fenrir:auth", JSON.stringify(FAKE_SESSION));
}

function clearSession() {
  localStorage.removeItem("fenrir:auth");
}

function hangingFetch() {
  return new Promise<Response>(() => {});
}

function successResponse(syncedCount = 0, cards: unknown[] = []) {
  return Promise.resolve(
    new Response(JSON.stringify({ cards, syncedCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function errorResponse(errCode = "network_error") {
  return Promise.resolve(
    new Response(
      JSON.stringify({ error: errCode, error_description: errCode }),
      { status: 500 }
    )
  );
}

function goOffline() {
  window.dispatchEvent(new Event("offline"));
}

function goOnline() {
  window.dispatchEvent(new Event("online"));
}

// ── Online / Offline events ────────────────────────────────────────────────────

describe("useCloudSync — online/offline events (Karl)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    vi.stubGlobal("fetch", mockFetch);
    // Hanging fetch: auto-sync returns early (no session) and
    // goOnline() re-sync also returns early (no session) → stays idle
    mockFetch.mockReturnValue(hangingFetch());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("Karl goes offline on 'offline' window event", () => {
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("idle");
    act(() => goOffline());
    expect(result.current.status).toBe("offline");
  });

  it("Karl returns to idle on 'online' window event after going offline", () => {
    // No session → goOnline triggers performSync but it returns early → stays idle
    const { result } = renderHook(() => useCloudSync());
    act(() => goOffline());
    expect(result.current.status).toBe("offline");
    act(() => goOnline());
    expect(result.current.status).toBe("idle");
  });

  it("Karl stays offline when card-changed events fire while offline", () => {
    // Issue #1172: hook listens to "fenrir:cards-changed" (not "fenrir:sync").
    // Dispatching while offline schedules a debounce, but performSync checks
    // navigator.onLine and sets "offline" again — status stays offline.
    const { result } = renderHook(() => useCloudSync());
    act(() => goOffline());
    expect(result.current.status).toBe("offline");
    // Dispatch a card-changed event — hook debounces it but performSync will see offline
    act(() => {
      window.dispatchEvent(new CustomEvent("fenrir:cards-changed", { detail: {} }));
    });
    // Status remains offline
    expect(result.current.status).toBe("offline");
  });

  it("Karl online → offline → online cycle restores to idle", () => {
    const { result } = renderHook(() => useCloudSync());
    act(() => goOffline());
    act(() => goOnline());
    act(() => goOffline());
    expect(result.current.status).toBe("offline");
    act(() => goOnline());
    expect(result.current.status).toBe("idle");
  });
});

describe("useCloudSync — Thrall ignores online/offline events", () => {
  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
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
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReturnValue(hangingFetch());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("starts as Thrall (syncNow is no-op), then switching to Karl enables syncing", async () => {
    const { result, rerender } = renderHook(() => useCloudSync());

    // Thrall: syncNow is a no-op
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("idle");

    // Switch tier to Karl and set session
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    setSession();
    rerender();

    // Now Karl: syncNow() actually triggers a sync
    act(() => {
      void result.current.syncNow();
    });
    expect(result.current.status).toBe("syncing");
  });

  it("switching from Karl back to Thrall makes syncNow a no-op", async () => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    // Use success response so first sync completes cleanly
    mockFetch.mockReturnValue(successResponse(3));

    // Render WITHOUT session → auto-sync on mount is a no-op
    const { result, rerender } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("idle");

    // Set session and run one complete sync as Karl
    setSession();
    await act(async () => {
      await result.current.syncNow();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Downgrade to Thrall (subscription expired mid-session)
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    rerender();

    // After downgrade, syncNow is a no-op — no new fetch fires
    await act(async () => {
      await result.current.syncNow();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1); // still only the 1 original call
  });
});

// ── retryIn countdown ─────────────────────────────────────────────────────────

describe("useCloudSync — retryIn countdown", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearSession();
  });

  it("retryIn is null after sync error (auto-retry removed in #1239)", async () => {
    // Issue #1239: auto-retry was removed. retryIn is always null — no countdown.
    mockFetch
      .mockReturnValueOnce(errorResponse("network_error"))
      .mockReturnValue(hangingFetch());
    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull on mount returns early (no session)
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.retryIn).toBeNull();

    // Advancing time does not change retryIn — countdown was removed
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.retryIn).toBeNull();

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.retryIn).toBeNull();
  });

  it("retryIn stays null after error even with time passing (#1239)", async () => {
    // Issue #1239: no auto-retry timer means retryIn never counts down from 30.
    mockFetch
      .mockReturnValueOnce(errorResponse("network_error"))
      .mockReturnValue(hangingFetch());
    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull on mount returns early (no session)
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.retryIn).toBeNull();

    // No countdown — retryIn stays null permanently
    act(() => vi.advanceTimersByTime(31000));
    expect(result.current.retryIn).toBeNull();
  });

  it("retryIn is null when no error has occurred", async () => {
    mockFetch.mockReturnValue(successResponse(5));
    setSession();
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.retryIn).toBeNull();
  });
});

// ── First-sync toast pluralization ─────────────────────────────────────────────

describe("useCloudSync — first-sync toast pluralization", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    localStorage.removeItem("fenrir:first-sync-shown");
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("uses singular 'card has been' for count=1 (restore direction)", async () => {
    // getRawAllCards returns [] (empty local), syncedCount=1 → restore from cloud
    const { toast } = await import("sonner");
    mockFetch.mockReturnValue(successResponse(1));
    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull on mount returns early (no session)
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("synced");
    expect(toast.success).toHaveBeenCalledWith(
      "Your 1 card has been restored from cloud",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("uses plural 'cards have been' for count=5 (restore direction)", async () => {
    // getRawAllCards returns [] (empty local), syncedCount=5 → restore from cloud
    const { toast } = await import("sonner");
    mockFetch.mockReturnValue(successResponse(5));
    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull on mount returns early (no session)
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("synced");
    expect(toast.success).toHaveBeenCalledWith(
      "Your 5 cards have been restored from cloud",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("shows 'backed up' toast when syncedCount is 0 (neither direction)", async () => {
    // getRawAllCards returns [] (empty local), syncedCount=0 → no restore (nothing pulled)
    // Falls through to "backed up" since isRestoring = (0===0 && 0>0) = false
    const { toast } = await import("sonner");
    mockFetch.mockReturnValue(successResponse(0));
    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull on mount returns early (no session)
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("synced");
    expect(toast.success).toHaveBeenCalledWith(
      "Your 0 cards have been backed up",
      expect.objectContaining({ duration: 5000 })
    );
  });
});

// ── Error persists after toast dismiss ────────────────────────────────────────

describe("useCloudSync — error persists after toast dismiss (not dismissError)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("error status persists even after toast.error is called (toast ≠ dismissError)", async () => {
    const { toast } = await import("sonner");
    mockFetch.mockReturnValue(errorResponse("permission-denied"));
    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull on mount returns early (no session)

    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("error");

    // Verify error toast was shown
    expect(toast.error).toHaveBeenCalledTimes(1);

    // Simulating toast dismiss (Sonner's onDismiss) does NOT affect hook state
    // Error state persists until dismissError() is explicitly called
    expect(result.current.status).toBe("error");
    expect(result.current.errorCode).toBe("permission-denied");
    expect(result.current.errorMessage).toBe("permission-denied");
  });

  it("error data overwrites on second consecutive error", async () => {
    // First error
    mockFetch.mockReturnValueOnce(errorResponse("network-timeout"));
    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull on mount returns early (no session)
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.errorCode).toBe("network-timeout");

    // Reset re-entrant guard (simulate auto-retry completing)
    // Call dismissError to reset state, then trigger second error
    act(() => result.current.dismissError());
    expect(result.current.status).toBe("idle");

    // Second error with different code
    mockFetch.mockReturnValueOnce(errorResponse("quota-exceeded"));
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.errorCode).toBe("quota-exceeded");
    expect(result.current.errorMessage).toBe("quota-exceeded");
  });
});

// ── dismissError edge cases ────────────────────────────────────────────────────

describe("useCloudSync — dismissError edge cases", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReturnValue(hangingFetch());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("dismissError is a no-op when status is idle (no crash)", () => {
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("idle");
    act(() => result.current.dismissError());
    expect(result.current.status).toBe("idle");
  });

  it("dismissError is a no-op when status is syncing", () => {
    setSession();
    const { result } = renderHook(() => useCloudSync());
    act(() => {
      void result.current.syncNow();
    });
    expect(result.current.status).toBe("syncing");
    act(() => result.current.dismissError());
    // dismissError only acts when status === "error", so syncing is preserved
    expect(result.current.status).toBe("syncing");
  });

  it("dismissError clears all error fields", async () => {
    mockFetch.mockReturnValue(errorResponse("permission-denied"));
    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull on mount returns early (no session)
    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.errorMessage).toBe("permission-denied");
    expect(result.current.errorCode).toBe("permission-denied");
    expect(result.current.errorTimestamp).toBeInstanceOf(Date);
    expect(result.current.retryIn).toBeNull(); // auto-retry removed in #1239

    act(() => result.current.dismissError());

    expect(result.current.status).toBe("idle");
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.errorCode).toBeNull();
    expect(result.current.errorTimestamp).toBeNull();
    expect(result.current.retryIn).toBeNull();
  });
});

// ── syncNow dispatches cloud-sync-complete event ──────────────────────────────

describe("useCloudSync — syncNow dispatches fenrir:cloud-sync-complete", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("syncNow dispatches fenrir:cloud-sync-complete event on success", async () => {
    setSession();
    mockFetch.mockReturnValue(successResponse(3));
    const { result } = renderHook(() => useCloudSync());
    const eventSpy = vi.fn();
    window.addEventListener("fenrir:cloud-sync-complete", eventSpy);

    await act(async () => {
      await result.current.syncNow();
    });

    expect(eventSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener("fenrir:cloud-sync-complete", eventSpy);
  });

  it("syncNow is a no-op for Thrall (no event dispatched)", async () => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    const { result } = renderHook(() => useCloudSync());
    const eventSpy = vi.fn();
    window.addEventListener("fenrir:cloud-sync-complete", eventSpy);

    await act(async () => {
      await result.current.syncNow();
    });

    expect(eventSpy).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    window.removeEventListener("fenrir:cloud-sync-complete", eventSpy);
  });
});

// ── SYNCED_DISPLAY_MS export ───────────────────────────────────────────────────

describe("useCloudSync — SYNCED_DISPLAY_MS constant", () => {
  it("SYNCED_DISPLAY_MS is a positive number (≥ 1000ms)", () => {
    expect(SYNCED_DISPLAY_MS).toBeGreaterThanOrEqual(1000);
  });
});
