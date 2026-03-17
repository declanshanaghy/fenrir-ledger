/**
 * useCloudSync — Issue #1210 regression tests
 *
 * Two bugs fixed, two test suites:
 *
 * Bug 1 — Dual-instance login-transition double push (settings page):
 *   On /ledger/settings, both SyncIndicator (layout) and SyncStatusCard
 *   call useCloudSync(). Both independently fired handleLoginTransition()
 *   on the non-Karl → Karl transition, causing 2× POST /api/sync/push on
 *   every settings page visit — reported as a continuous loop.
 *   Fix: UseCloudSyncOptions.skipLoginSync. When true, the login-transition
 *   effect updates prevIsKarlRef but does NOT call handleLoginTransition().
 *   SyncStatusCard passes { skipLoginSync: true }; SyncIndicator (the layout
 *   instance) keeps the default (false) and owns the login-transition sync.
 *
 * Bug 2 — No cross-instance concurrent-sync guard:
 *   Each hook instance had its own syncInProgressRef. If two instances both
 *   received the same trigger simultaneously, both fired a push.
 *   Fix: module-level _syncGlobalInProgress flag. Shared across all instances
 *   on the page; whichever acquires it first blocks the other for the
 *   duration of the fetch.
 *
 * Issue #1210
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSync, _resetSyncGuardForTesting } from "@/hooks/useCloudSync";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEntitlement = { tier: "karl" as string, isActive: true };

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => mockEntitlement,
}));

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

// Post-migration: hasMigrated() → true so handleLoginTransition delegates
// straight to performSync, preventing migration API calls from consuming
// fetch mocks that are intended for sync flows under test.
vi.mock("@/lib/sync/migration", () => ({
  hasMigrated: () => true,
  runMigration: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_SESSION = { id_token: "tok-1210", user: { sub: "hh-1210" } };

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

// ── Bug 1: skipLoginSync prevents duplicate push on settings page ──────────

describe("Bug 1 — skipLoginSync: settings page hook does not auto-sync on login", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    _resetSyncGuardForTesting(); // clear module-level flag left by hanging fetches
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReturnValue(hangingFetch());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("default (skipLoginSync: false) fires login-transition sync on Karl mount", async () => {
    setSession();
    mockFetch.mockReturnValue(successResponse(3));

    const { result } = renderHook(() => useCloudSync());

    await act(async () => {
      await Promise.resolve();
    });

    // Default hook: sync fired on login transition
    expect(mockFetch).toHaveBeenCalledWith("/api/sync/push", expect.any(Object));
  });

  it("skipLoginSync: true does NOT fire on login transition (Karl already active)", async () => {
    setSession();
    mockFetch.mockReturnValue(successResponse(3));

    // Simulate auth already resolved to Karl before mount
    // (isKarl = true from initial render; prevIsKarlRef starts false)
    const { result } = renderHook(() => useCloudSync({ skipLoginSync: true }));

    await act(async () => {
      await Promise.resolve();
    });

    // skipLoginSync hook: NO auto-push on mount, even though isKarl is true
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("skipLoginSync: true still fires sync via explicit syncNow()", async () => {
    setSession();
    mockFetch.mockReturnValue(successResponse(5));

    const { result } = renderHook(() => useCloudSync({ skipLoginSync: true }));

    // No auto-sync yet
    expect(mockFetch).not.toHaveBeenCalled();

    // Explicit button click
    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("synced");
  });

  it("skipLoginSync: true still responds to fenrir:cards-changed event", async () => {
    setSession();
    mockFetch.mockReturnValue(hangingFetch());
    vi.useFakeTimers();

    const { result: _ } = renderHook(() => useCloudSync({ skipLoginSync: true }));

    act(() => {
      window.dispatchEvent(
        new CustomEvent("fenrir:cards-changed", { detail: { householdId: "hh-1210" } })
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(10_001);
    });

    // Card-changed debounce still fires (card-save auto-sync must not regress)
    expect(mockFetch).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("dual instance: layout (default) fires login sync; settings (skipLoginSync) does not", async () => {
    setSession();
    mockFetch.mockReturnValue(successResponse(2));

    // Simulate layout SyncIndicator (default — fires login sync on Karl mount)
    const { result: layoutResult } = renderHook(() => useCloudSync());

    await act(async () => {
      // Allow the async performSync fetch to resolve
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(layoutResult.current.status).toBe("synced");

    // _syncGlobalInProgress is now false (layout sync completed in finally)
    // Simulate settings SyncStatusCard (skipLoginSync — must NOT fire)
    vi.clearAllMocks();
    const { result: settingsResult } = renderHook(() =>
      useCloudSync({ skipLoginSync: true })
    );

    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    // Settings instance: no push on mount
    expect(mockFetch).not.toHaveBeenCalled();
    expect(settingsResult.current.status).toBe("idle");
  });
});

// ── Bug 2: Module-level guard prevents concurrent pushes ───────────────────

describe("Bug 2 — module-level guard: only one push at a time across instances", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    _resetSyncGuardForTesting(); // clear module-level flag left by hanging fetches
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReturnValue(hangingFetch()); // blocks first push
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearSession();
  });

  it("second syncNow() call is a no-op while first is in progress", async () => {
    setSession();
    mockFetch.mockReturnValue(hangingFetch());

    // skipLoginSync: true so only the explicit syncNow() call triggers a push
    const { result } = renderHook(() => useCloudSync({ skipLoginSync: true }));

    // Verify idle on mount (no auto-sync)
    expect(result.current.status).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();

    // First explicit sync — acquires module-level guard
    act(() => {
      void result.current.syncNow();
    });
    expect(result.current.status).toBe("syncing");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call while first is in flight — module-level guard blocks it
    await act(async () => {
      await result.current.syncNow();
    });

    // Still only 1 fetch — second was blocked by _syncGlobalInProgress
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fenrir:cards-changed on two concurrent instances fires only one push", async () => {
    setSession();
    mockFetch.mockReturnValue(hangingFetch());

    // Two hook instances (simulates layout + settings page co-mounted)
    const { result: a } = renderHook(() => useCloudSync({ skipLoginSync: true }));
    const { result: b } = renderHook(() => useCloudSync({ skipLoginSync: true }));

    // Both receive fenrir:cards-changed
    act(() => {
      window.dispatchEvent(
        new CustomEvent("fenrir:cards-changed", { detail: { householdId: "hh-1210" } })
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(10_001);
    });

    // Module-level guard: only 1 fetch regardless of 2 instances
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Use the results to avoid unused variable lint warning
    expect(a.current).toBeDefined();
    expect(b.current).toBeDefined();
  });
});

// ── Regression: existing Karl / login / card-save flows still work ─────────

describe("Regression — no regression to sync-on-save or auth-gating behavior", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    _resetSyncGuardForTesting(); // clear module-level flag left by hanging fetches
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("default hook: auth loading → authenticated transition fires sync", async () => {
    mockAuthContext.status = "loading";
    setSession();
    mockFetch.mockReturnValue(successResponse(4));

    const { result, rerender } = renderHook(() => useCloudSync());
    expect(mockFetch).not.toHaveBeenCalled();

    // Auth resolves
    mockAuthContext.status = "authenticated";
    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("synced");
  });

  it("skipLoginSync hook: auth loading → authenticated does NOT auto-sync", async () => {
    mockAuthContext.status = "loading";
    setSession();
    mockFetch.mockReturnValue(successResponse(4));

    const { result, rerender } = renderHook(() =>
      useCloudSync({ skipLoginSync: true })
    );
    expect(mockFetch).not.toHaveBeenCalled();

    mockAuthContext.status = "authenticated";
    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    // Still no auto-sync
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("Thrall user: skipLoginSync hook stays idle (no-op for non-Karl)", async () => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    setSession();

    const { result } = renderHook(() => useCloudSync({ skipLoginSync: true }));

    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });
});
