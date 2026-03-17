/**
 * useCloudSync — unit tests
 *
 * Tests the cloud sync hook state machine:
 *   - Thrall users always stay idle
 *   - Karl users advance through cloud states via syncNow() + fetch mocks
 *   - syncNow() transitions to syncing (optimistic), then synced/error
 *   - dismissError() clears error state → idle
 *   - First-sync toast guarded by localStorage key
 *   - Status stays idle for Thrall regardless of calls
 *
 * Root cause of prior failures: tests mocked useIsKarlOrTrial but the hook
 * uses useEntitlement. Also, tests dispatched custom events (fenrir:cloud-sync-start
 * etc.) but the hook is NOT an event listener — it drives state internally via
 * performSync(). Fixed: mock useEntitlement + drive state via syncNow() + fetch.
 *
 * Issue #1122
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSync, SYNCED_DISPLAY_MS } from "@/hooks/useCloudSync";

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_SESSION = { id_token: "tok-test", user: { sub: "hh-test" } };

/** Set a valid session so performSync() doesn't return early at session check */
function setSession() {
  localStorage.setItem("fenrir:auth", JSON.stringify(FAKE_SESSION));
}

function clearSession() {
  localStorage.removeItem("fenrir:auth");
  // Clear migration flag to prevent cross-test pollution from markMigrated() (#1239)
  localStorage.removeItem("fenrir:migrated");
}

/** A fetch that never resolves — keeps the hook in "syncing" state */
function hangingFetch() {
  return new Promise<Response>(() => {});
}

/** A successful sync response */
function successResponse(syncedCount = 0, cards: unknown[] = []) {
  return Promise.resolve(
    new Response(JSON.stringify({ cards, syncedCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

/** A failed sync response (HTTP 500) */
function errorResponse(errCode = "sync_error") {
  return Promise.resolve(
    new Response(
      JSON.stringify({ error: errCode, error_description: errCode }),
      { status: 500 }
    )
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useCloudSync — Thrall: always idle", () => {
  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("idle");
  });

  it("syncNow is a no-op (stays idle)", async () => {
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("idle");
  });
});

describe("useCloudSync — Karl: state transitions", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    localStorage.removeItem("fenrir:first-sync-shown");
    vi.stubGlobal("fetch", mockFetch);
    // Default: hanging fetch. Without a session set, auto-sync on mount returns
    // early before ever calling fetch. Tests set session explicitly when needed.
    mockFetch.mockReturnValue(hangingFetch());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    clearSession();
  });

  it("starts in idle state", () => {
    // No session → auto-sync fires but returns early at session check → stays idle
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("idle");
  });

  it("transitions idle → syncing on syncNow()", () => {
    // Set session so syncNow() reaches the fetch call (which hangs → stays syncing)
    setSession();
    const { result } = renderHook(() => useCloudSync());
    act(() => {
      void result.current.syncNow();
    });
    expect(result.current.status).toBe("syncing");
  });

  it("transitions syncing → synced on successful fetch", async () => {
    setSession();
    mockFetch.mockReturnValue(successResponse(5));
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("synced");
    expect(result.current.cardCount).toBe(5);
    expect(result.current.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("transitions syncing → error on failed fetch", async () => {
    mockFetch.mockReturnValue(errorResponse("permission-denied"));
    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull on mount returns early (no session)
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("error");
    expect(result.current.errorCode).toBe("permission-denied");
    expect(result.current.errorTimestamp).toBeInstanceOf(Date);
    // retryIn is always null — auto-retry removed in Issue #1239
    expect(result.current.retryIn).toBeNull();
  });

  it("dismissError clears error → idle", async () => {
    mockFetch.mockReturnValue(errorResponse());
    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull on mount returns early (no session)
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("error");
    act(() => result.current.dismissError());
    expect(result.current.status).toBe("idle");
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.errorCode).toBeNull();
  });

  it("synced → idle auto-transition after SYNCED_DISPLAY_MS", async () => {
    vi.useFakeTimers();
    setSession();
    mockFetch.mockReturnValue(successResponse());
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("synced");
    act(() => vi.advanceTimersByTime(SYNCED_DISPLAY_MS + 100));
    expect(result.current.status).toBe("idle");
    vi.useRealTimers();
  });

  it("syncNow() transitions to syncing optimistically", () => {
    setSession();
    const { result } = renderHook(() => useCloudSync());
    // Fire-and-forget: fetch is pending so status stays syncing
    act(() => {
      void result.current.syncNow();
    });
    expect(result.current.status).toBe("syncing");
  });

  it("syncNow() is a no-op when already syncing (re-entrant guard)", () => {
    setSession();
    const { result } = renderHook(() => useCloudSync());
    act(() => {
      void result.current.syncNow();
    });
    expect(result.current.status).toBe("syncing");
    // Second call should be ignored (syncInProgressRef blocks re-entry)
    act(() => {
      void result.current.syncNow();
    });
    expect(result.current.status).toBe("syncing");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("useCloudSync — first-sync toast", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    localStorage.removeItem("fenrir:first-sync-shown");
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    clearSession();
  });

  it("shows first-sync toast on first synced transition", async () => {
    const { toast } = await import("sonner");
    mockFetch.mockReturnValue(successResponse(12));
    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull on mount returns early (no session)
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("synced");
    // Local was empty (getRawAllCards returns []), cloud had 12 cards → restore direction
    expect(toast.success).toHaveBeenCalledWith(
      "Your 12 cards have been restored from cloud",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("does not show toast on subsequent syncs (localStorage guard)", async () => {
    const { toast } = await import("sonner");
    localStorage.setItem("fenrir:first-sync-shown", "true");
    mockFetch.mockReturnValue(successResponse(12));
    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull/runMigration on mount returns early
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("synced");
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("useCloudSync — error toast", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    clearSession();
  });

  it("shows error toast on sync failure", async () => {
    const { toast } = await import("sonner");
    mockFetch.mockReturnValue(errorResponse());
    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull on mount returns early (no session)
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("error");
    expect(toast.error).toHaveBeenCalledWith(
      "Sync failed",
      expect.objectContaining({
        // Issue #1239: message updated — no auto-retry, user must edit a card
        description: "Your cards are safe locally. Retry by editing a card.",
      })
    );
  });
});
