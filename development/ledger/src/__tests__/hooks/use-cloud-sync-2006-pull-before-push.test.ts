/**
 * useCloudSync — Issue #2006: pull-before-push orchestration
 *
 * Tests for:
 *   1. CloudSyncStatus includes "needs-upload" and "needs-download"
 *   2. status → needs-upload immediately on fenrir:cards-changed (before debounce)
 *   3. status → needs-upload immediately on fenrir:cards-bulk-changed
 *   4. status → needs-upload on mount when getNeedsUpload() is true
 *   5. online reconnect → needs-upload when getNeedsUpload flag is set
 *   6. online reconnect → idle when no pending upload
 *   7. pull-before-push: GET /api/sync/state called before POST /api/sync/push
 *   8. pull-before-push: pulls first when needsDownload=true
 *   9. pull-before-push: pulls first when lastSyncedVersion < syncVersion
 *  10. graceful degradation: state check failure → push proceeds
 *  11. 409 handling: push returns 409 → pull → retry push → synced
 *  12. syncVersion tracked in state after successful push
 *  13. syncVersion tracked in state after performPull (login transition)
 *  14. syncVersion returned in CloudSyncState interface
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSync } from "@/hooks/useCloudSync";

// ── Shared mocks ───────────────────────────────────────────────────────────────

const mockEntitlement = { tier: "thrall" as string, isActive: false };

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

const mockGetNeedsUpload = vi.hoisted(() => vi.fn<() => boolean>().mockReturnValue(false));
const mockClearNeedsUpload = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage", () => ({
  getRawAllCards: vi.fn().mockReturnValue([]),
  setAllCards: vi.fn(),
  getEffectiveHouseholdId: (fallback: string) => fallback,
  getNeedsUpload: () => mockGetNeedsUpload(),
  clearNeedsUpload: () => mockClearNeedsUpload(),
}));

vi.mock("@/lib/sync/migration", () => ({
  hasMigrated: vi.fn().mockReturnValue(true),
  runMigration: vi.fn().mockResolvedValue({ ran: false, cardCount: 0, direction: "empty" }),
  MIGRATION_FLAG: "fenrir:migrated",
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn(async () => {
    try {
      const raw = localStorage.getItem("fenrir:auth");
      if (!raw) return null;
      return (JSON.parse(raw) as { id_token?: string })?.id_token ?? null;
    } catch { return null; }
  }),
  refreshSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth/auth-fetch", () => ({
  authFetch: vi.fn(async (url: string, opts?: RequestInit) => {
    const raw = localStorage.getItem("fenrir:auth");
    const token = raw ? (JSON.parse(raw) as { id_token?: string })?.id_token : null;
    const merged: RequestInit = {
      ...opts,
      headers: {
        ...(opts?.headers as Record<string, string> ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    return globalThis.fetch(url, merged);
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_SESSION = { id_token: "tok-test", user: { sub: "hh-test" } };

function setSession() {
  localStorage.setItem("fenrir:auth", JSON.stringify(FAKE_SESSION));
}

function clearSession() {
  localStorage.removeItem("fenrir:auth");
  localStorage.removeItem("fenrir:migrated");
}

function pushSuccessResponse(syncedCount = 1, cards: unknown[] = [], syncVersion = 5) {
  return Promise.resolve(
    new Response(JSON.stringify({ cards, syncedCount, syncVersion }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function pullSuccessResponse(cards: unknown[] = [], activeCount = 1, syncVersion = 4) {
  return Promise.resolve(
    new Response(JSON.stringify({ cards, activeCount, syncVersion }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function stateResponse(syncVersion = 5, lastSyncedVersion = 4, needsDownload = false) {
  return Promise.resolve(
    new Response(JSON.stringify({ syncVersion, lastSyncedVersion, needsDownload }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function conflictResponse(syncVersion = 6) {
  return Promise.resolve(
    new Response(JSON.stringify({ error: "sync_conflict", syncVersion }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function errorResponse(status = 500) {
  return Promise.resolve(
    new Response(JSON.stringify({ error: "internal_error", error_description: "Server error." }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function hangingFetch() {
  return new Promise<Response>(() => {});
}

// ── Type tests ─────────────────────────────────────────────────────────────────

describe("useCloudSync — Issue #2006: CloudSyncStatus type", () => {
  it("includes needs-upload and needs-download in the status type", () => {
    // TypeScript compile-time check — if these are missing, the file won't compile.
    // Runtime check: verify the hook returns a valid status initially.
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    const { result } = renderHook(() => useCloudSync());
    // Status is one of the valid values
    const validStatuses = ["idle", "needs-upload", "needs-download", "syncing", "synced", "offline", "error"];
    expect(validStatuses).toContain(result.current.status);
  });

  it("returns syncVersion in CloudSyncState interface (null before any sync)", () => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    const { result } = renderHook(() => useCloudSync());
    expect("syncVersion" in result.current).toBe(true);
    expect(result.current.syncVersion).toBeNull();
  });
});

// ── needs-upload status ────────────────────────────────────────────────────────

describe("useCloudSync — Issue #2006: needs-upload status transitions", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockGetNeedsUpload.mockReturnValue(false);
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReturnValue(hangingFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
    mockGetNeedsUpload.mockReturnValue(false);
    vi.useRealTimers();
  });

  it("sets status to needs-upload immediately on fenrir:cards-changed (before debounce)", async () => {
    vi.useFakeTimers();
    // Render WITHOUT session so login transition returns early (no lock contention).
    const { result } = renderHook(() => useCloudSync());
    setSession(); // set session after mount

    // Dispatch cards-changed — status should go to needs-upload before debounce fires
    act(() => {
      window.dispatchEvent(new CustomEvent("fenrir:cards-changed"));
    });

    // Status is needs-upload before the debounce fires
    expect(result.current.status).toBe("needs-upload");

    // The debounce timer is still pending — fetch not called yet
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sets status to needs-upload immediately on fenrir:cards-bulk-changed", async () => {
    // Render WITHOUT session so login transition returns early (no lock contention).
    const { result } = renderHook(() => useCloudSync());
    setSession();

    act(() => {
      window.dispatchEvent(new CustomEvent("fenrir:cards-bulk-changed"));
    });

    // Status transitions: needs-upload (set first) → syncing (set by performSync)
    // Since performSync is async and fetch is hanging, it gets to syncing quickly
    expect(["needs-upload", "syncing"]).toContain(result.current.status);
  });

  it("sets status to needs-upload on mount when getNeedsUpload() is true", async () => {
    // Render WITHOUT session so login transition returns early (no lock contention).
    mockGetNeedsUpload.mockReturnValue(true);
    const { result } = renderHook(() => useCloudSync());
    setSession();

    // After mount effect runs, status should be needs-upload or syncing
    await act(async () => {});

    expect(["needs-upload", "syncing"]).toContain(result.current.status);
  });

  it("does NOT set needs-upload on mount when getNeedsUpload() is false", () => {
    mockGetNeedsUpload.mockReturnValue(false);
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── Online reconnect ───────────────────────────────────────────────────────────

describe("useCloudSync — Issue #2006: online reconnect status", () => {
  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockGetNeedsUpload.mockReturnValue(false);
  });

  afterEach(() => {
    clearSession();
    mockGetNeedsUpload.mockReturnValue(false);
    // Restore online state
    vi.stubGlobal("navigator", { onLine: true });
    vi.unstubAllGlobals();
  });

  it("restores to needs-upload on reconnect when getNeedsUpload() is true", async () => {
    mockGetNeedsUpload.mockReturnValue(true);
    // Start offline
    vi.stubGlobal("navigator", { onLine: false });
    const { result } = renderHook(() => useCloudSync());

    await act(async () => {});
    expect(result.current.status).toBe("offline");

    // Reconnect
    act(() => {
      vi.stubGlobal("navigator", { onLine: true });
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current.status).toBe("needs-upload");
  });

  it("restores to idle on reconnect when no pending upload", async () => {
    mockGetNeedsUpload.mockReturnValue(false);
    vi.stubGlobal("navigator", { onLine: false });
    const { result } = renderHook(() => useCloudSync());

    await act(async () => {});
    expect(result.current.status).toBe("offline");

    act(() => {
      vi.stubGlobal("navigator", { onLine: true });
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current.status).toBe("idle");
  });
});

// ── Pull-before-push ───────────────────────────────────────────────────────────

describe("useCloudSync — Issue #2006: pull-before-push flow", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockGetNeedsUpload.mockReturnValue(false);
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
    mockGetNeedsUpload.mockReturnValue(false);
  });

  it("calls GET /api/sync/state before POST /api/sync/push", async () => {
    // State check: up-to-date (no pull needed)
    // Push: success
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sync/state")) return stateResponse(5, 5, false);
      if (url.includes("/api/sync/push")) return pushSuccessResponse(1, [], 6);
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession(); // set session after mount so login transition returns early

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");

    const calls = mockFetch.mock.calls.map((c) => c[0] as string);
    const stateIdx = calls.findIndex((u) => u.includes("/api/sync/state"));
    const pushIdx = calls.findIndex((u) => u.includes("/api/sync/push"));

    expect(stateIdx).toBeGreaterThanOrEqual(0);
    expect(pushIdx).toBeGreaterThanOrEqual(0);
    expect(stateIdx).toBeLessThan(pushIdx);
  });

  it("pulls first when state check returns needsDownload=true", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sync/state")) return stateResponse(6, 5, true);
      if (url.includes("/api/sync/pull")) return pullSuccessResponse([], 0, 6);
      if (url.includes("/api/sync/push")) return pushSuccessResponse(1, [], 7);
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession(); // after mount

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");

    const calls = mockFetch.mock.calls.map((c) => c[0] as string);
    const pullIdx = calls.findIndex((u) => u.includes("/api/sync/pull"));
    const pushIdx = calls.findIndex((u) => u.includes("/api/sync/push"));

    // Pull must happen before push
    expect(pullIdx).toBeGreaterThanOrEqual(0);
    expect(pushIdx).toBeGreaterThanOrEqual(0);
    expect(pullIdx).toBeLessThan(pushIdx);
  });

  it("pulls first when lastSyncedVersion < syncVersion", async () => {
    // lastSyncedVersion=3, syncVersion=6 → stale, pull first
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sync/state")) return stateResponse(6, 3, false);
      if (url.includes("/api/sync/pull")) return pullSuccessResponse([], 0, 6);
      if (url.includes("/api/sync/push")) return pushSuccessResponse(1, [], 7);
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");

    const calls = mockFetch.mock.calls.map((c) => c[0] as string);
    const pullIdx = calls.findIndex((u) => u.includes("/api/sync/pull"));
    const pushIdx = calls.findIndex((u) => u.includes("/api/sync/push"));
    expect(pullIdx).toBeGreaterThanOrEqual(0);
    expect(pullIdx).toBeLessThan(pushIdx);
  });

  it("does NOT pull when state is up-to-date", async () => {
    // lastSyncedVersion=5, syncVersion=5 → no pull needed
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sync/state")) return stateResponse(5, 5, false);
      if (url.includes("/api/sync/push")) return pushSuccessResponse(1, [], 6);
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");

    const calls = mockFetch.mock.calls.map((c) => c[0] as string);
    const pullCalls = calls.filter((u) => u.includes("/api/sync/pull"));
    expect(pullCalls).toHaveLength(0);
  });

  it("degrades gracefully when state check fails — pushes directly", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sync/state")) return errorResponse(500);
      if (url.includes("/api/sync/push")) return pushSuccessResponse(2, [], 5);
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });

    // Should still succeed (graceful degradation)
    expect(result.current.status).toBe("synced");

    const calls = mockFetch.mock.calls.map((c) => c[0] as string);
    const pushCalls = calls.filter((u) => u.includes("/api/sync/push"));
    expect(pushCalls.length).toBeGreaterThan(0);
  });

  it("degrades gracefully when state check throws — pushes directly", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sync/state")) throw new Error("network error");
      if (url.includes("/api/sync/push")) return pushSuccessResponse(2, [], 5);
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");
  });

  it("passes clientSyncVersion from state check to push body", async () => {
    const capturedBodies: unknown[] = [];

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes("/api/sync/state")) return stateResponse(7, 7, false);
      if (url.includes("/api/sync/push")) {
        if (opts?.body) capturedBodies.push(JSON.parse(opts.body as string));
        return pushSuccessResponse(1, [], 8);
      }
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");
    expect(capturedBodies[0]).toMatchObject({ clientSyncVersion: 7 });
  });
});

// ── 409 handling ───────────────────────────────────────────────────────────────

describe("useCloudSync — Issue #2006: 409 conflict handling", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockGetNeedsUpload.mockReturnValue(false);
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("pulls and retries push on 409 → succeeds", async () => {
    let pushCallCount = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sync/state")) return stateResponse(5, 5, false);
      if (url.includes("/api/sync/pull")) return pullSuccessResponse([], 0, 5);
      if (url.includes("/api/sync/push")) {
        pushCallCount++;
        // First push returns 409, retry succeeds
        if (pushCallCount === 1) return conflictResponse(6);
        return pushSuccessResponse(1, [], 7);
      }
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");
    // Push was called twice (initial + retry)
    expect(pushCallCount).toBe(2);

    // A pull call happened between the two pushes
    const calls = mockFetch.mock.calls.map((c) => c[0] as string);
    const pullCalls = calls.filter((u) => u.includes("/api/sync/pull"));
    expect(pullCalls.length).toBeGreaterThan(0);
  });

  it("goes to error if retry push also fails", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sync/state")) return stateResponse(5, 5, false);
      if (url.includes("/api/sync/pull")) return pullSuccessResponse([], 0, 5);
      if (url.includes("/api/sync/push")) return conflictResponse(6);
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("error");
  });

  it("updates syncVersion from pull response during 409 handling", async () => {
    let pushCallCount = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sync/state")) return stateResponse(5, 5, false);
      if (url.includes("/api/sync/pull")) return pullSuccessResponse([], 0, 6);
      if (url.includes("/api/sync/push")) {
        pushCallCount++;
        if (pushCallCount === 1) return conflictResponse(6);
        return pushSuccessResponse(1, [], 7);
      }
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");
    // syncVersion should be updated from the final push response
    expect(result.current.syncVersion).toBe(7);
  });
});

// ── syncVersion tracking ───────────────────────────────────────────────────────

describe("useCloudSync — Issue #2006: syncVersion tracking", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockGetNeedsUpload.mockReturnValue(false);
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("tracks syncVersion from push response in hook state", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sync/state")) return stateResponse(4, 4, false);
      if (url.includes("/api/sync/push")) return pushSuccessResponse(2, [], 5);
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession();

    expect(result.current.syncVersion).toBeNull();

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");
    expect(result.current.syncVersion).toBe(5);
  });

  it("tracks syncVersion from pull response (login transition)", async () => {
    // hasMigrated returns true (module-level mock) → performPull fires on login transition
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sync/pull")) return pullSuccessResponse([], 0, 9);
      return errorResponse();
    });

    // Start as Thrall so the initial render doesn't trigger login transition
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;

    const { result, rerender } = renderHook(() => useCloudSync());

    expect(result.current.syncVersion).toBeNull();

    // Set session before transitioning to Karl so performPull can find it
    setSession();

    // Transition to Karl → triggers login transition → performPull fires
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;

    await act(async () => {
      rerender();
    });

    // Wait for async pull to complete
    await act(async () => {});

    expect(result.current.syncVersion).toBe(9);
  });

  it("syncVersion is null for Thrall users (no sync)", () => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.syncVersion).toBeNull();
  });
});

// ── Loki augmentation: edge case coverage ─────────────────────────────────────

describe("useCloudSync — Issue #2006 (Loki): clientSyncVersion body edge cases", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockGetNeedsUpload.mockReturnValue(false);
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("omits clientSyncVersion from push body when state check fails (first sync, no version)", async () => {
    const capturedBodies: unknown[] = [];

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes("/api/sync/state")) return errorResponse(500);
      if (url.includes("/api/sync/push")) {
        if (opts?.body) capturedBodies.push(JSON.parse(opts.body as string));
        return pushSuccessResponse(1, [], 5);
      }
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");
    // clientSyncVersion should be absent — syncVersionRef starts null, state returned null
    expect(capturedBodies[0]).not.toHaveProperty("clientSyncVersion");
  });

  it("uses pull syncVersion as clientSyncVersion in the subsequent push (pre-push pull flow)", async () => {
    const capturedBodies: unknown[] = [];

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes("/api/sync/state")) return stateResponse(8, 3, false); // stale, pull needed
      if (url.includes("/api/sync/pull")) return pullSuccessResponse([], 0, 8);
      if (url.includes("/api/sync/push")) {
        if (opts?.body) capturedBodies.push(JSON.parse(opts.body as string));
        return pushSuccessResponse(1, [], 9);
      }
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");
    // After pre-push pull (syncVersion=8), push should send clientSyncVersion=8
    expect(capturedBodies[0]).toMatchObject({ clientSyncVersion: 8 });
  });

  it("re-entrancy guard: concurrent syncNow calls do not double-push", async () => {
    let pushCallCount = 0;

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sync/state")) return stateResponse(5, 5, false);
      if (url.includes("/api/sync/push")) {
        pushCallCount++;
        return pushSuccessResponse(1, [], 6);
      }
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession();

    // Fire two concurrent syncNow calls
    await act(async () => {
      await Promise.all([result.current.syncNow(), result.current.syncNow()]);
    });

    expect(result.current.status).toBe("synced");
    // Second call should be a no-op due to re-entrancy guard
    expect(pushCallCount).toBe(1);
  });

  it("updates syncVersion state after pre-push pull + push (end-to-end version tracking)", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/sync/state")) return stateResponse(10, 7, true);
      if (url.includes("/api/sync/pull")) return pullSuccessResponse([], 0, 10);
      if (url.includes("/api/sync/push")) return pushSuccessResponse(3, [], 11);
      return errorResponse();
    });

    const { result } = renderHook(() => useCloudSync());
    setSession();

    expect(result.current.syncVersion).toBeNull();

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");
    // Final syncVersion comes from the push response (11)
    expect(result.current.syncVersion).toBe(11);
  });
});
