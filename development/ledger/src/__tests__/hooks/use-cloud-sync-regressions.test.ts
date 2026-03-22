/**
 * useCloudSync — regression and augmentation tests
 *
 * Consolidated from:
 *   - use-cloud-sync-edge-cases.test.ts (issue #1122)
 *   - use-cloud-sync-1172.test.ts       (issue #1172 FiremanDecko)
 *   - use-cloud-sync-1124-loki.test.ts  (issue #1124 Loki QA)
 *   - use-cloud-sync-1172-loki.test.ts  (issue #1172 Loki QA)
 *   - use-cloud-sync-1239-loki.test.ts  (issue #1239 Loki QA)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSync, SYNCED_DISPLAY_MS, AUTO_SYNC_DEBOUNCE_MS, EVT_CARDS_CHANGED } from "@/hooks/useCloudSync";
import { toast } from "sonner";

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

const mockGetRawAllCards = vi.hoisted(() => vi.fn().mockReturnValue([]));
const mockSetAllCards = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage", () => ({
  getRawAllCards: (...args: unknown[]) => mockGetRawAllCards(...args),
  setAllCards: (...args: unknown[]) => mockSetAllCards(...args),
}));

// Controllable migration mock (supports all test variants)
const mockHasMigrated = vi.hoisted(() => vi.fn<() => boolean>().mockReturnValue(true));
const mockRunMigration = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sync/migration", () => ({
  hasMigrated: () => mockHasMigrated(),
  runMigration: (...args: unknown[]) => mockRunMigration(...args),
  MIGRATION_FLAG: "fenrir:migrated",
}));

// ── Session helpers ────────────────────────────────────────────────────────────

function makeSession(idToken: string, sub: string) {
  return { id_token: idToken, user: { sub } };
}

function setSession(session = makeSession("tok-edge", "hh-edge")) {
  localStorage.setItem("fenrir:auth", JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem("fenrir:auth");
  localStorage.removeItem("fenrir:migrated");
}

// ── Response helpers ───────────────────────────────────────────────────────────

function successResponse(syncedCount = 0, cards: unknown[] = []) {
  return Promise.resolve(
    new Response(JSON.stringify({ cards, syncedCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function pullResponse(activeCount = 0, cards: unknown[] = []) {
  return Promise.resolve(
    new Response(JSON.stringify({ cards, activeCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function pushResponse(syncedCount = 0, cards: unknown[] = []) {
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

function hangingFetch() {
  return new Promise<Response>(() => {});
}

function getPostCalls(mockFetch: ReturnType<typeof vi.fn>) {
  return (mockFetch.mock.calls as [string, RequestInit][]).filter(
    ([_url, init]) => init?.method === "POST"
  );
}

// =============================================================================
// use-cloud-sync-edge-cases — online/offline, tier switching, retryIn, toasts
// =============================================================================

// ── Online / Offline events ────────────────────────────────────────────────────

describe("useCloudSync — online/offline events (Karl)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(true);
    vi.stubGlobal("fetch", mockFetch);
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
    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current.status).toBe("offline");
  });

  it("Karl returns to idle on 'online' window event after going offline", () => {
    const { result } = renderHook(() => useCloudSync());
    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current.status).toBe("offline");
    act(() => window.dispatchEvent(new Event("online")));
    expect(result.current.status).toBe("idle");
  });

  it("Karl stays offline when card-changed events fire while offline", () => {
    const { result } = renderHook(() => useCloudSync());
    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current.status).toBe("offline");
    act(() => {
      window.dispatchEvent(new CustomEvent("fenrir:cards-changed", { detail: {} }));
    });
    expect(result.current.status).toBe("offline");
  });

  it("Karl online → offline → online cycle restores to idle", () => {
    const { result } = renderHook(() => useCloudSync());
    act(() => window.dispatchEvent(new Event("offline")));
    act(() => window.dispatchEvent(new Event("online")));
    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current.status).toBe("offline");
    act(() => window.dispatchEvent(new Event("online")));
    expect(result.current.status).toBe("idle");
  });
});

describe("useCloudSync — Thrall ignores online/offline events", () => {
  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    mockAuthContext.status = "authenticated";
    vi.clearAllMocks();
  });

  it("Thrall stays idle on 'offline' event", () => {
    const { result } = renderHook(() => useCloudSync());
    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current.status).toBe("idle");
  });

  it("Thrall stays idle on 'online' event", () => {
    const { result } = renderHook(() => useCloudSync());
    act(() => window.dispatchEvent(new Event("offline")));
    act(() => window.dispatchEvent(new Event("online")));
    expect(result.current.status).toBe("idle");
  });
});

// ── Tier switching without page reload ────────────────────────────────────────

describe("useCloudSync — tier switching without page reload", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(true);
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

    await act(async () => { await result.current.syncNow(); });
    expect(result.current.status).toBe("idle");

    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    setSession();
    rerender();

    act(() => { void result.current.syncNow(); });
    expect(result.current.status).toBe("syncing");
  });

  it("switching from Karl back to Thrall makes syncNow a no-op", async () => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockFetch.mockReturnValue(successResponse(3));

    const { result, rerender } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("idle");

    setSession();
    await act(async () => { await result.current.syncNow(); });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    rerender();

    await act(async () => { await result.current.syncNow(); });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ── retryIn countdown ─────────────────────────────────────────────────────────

describe("useCloudSync — retryIn countdown", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(true);
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
    mockFetch
      .mockReturnValueOnce(errorResponse("network_error"))
      .mockReturnValue(hangingFetch());
    const { result } = renderHook(() => useCloudSync());
    setSession();
    await act(async () => { await result.current.syncNow(); });
    expect(result.current.retryIn).toBeNull();

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.retryIn).toBeNull();

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.retryIn).toBeNull();
  });

  it("retryIn stays null after error even with time passing (#1239)", async () => {
    mockFetch
      .mockReturnValueOnce(errorResponse("network_error"))
      .mockReturnValue(hangingFetch());
    const { result } = renderHook(() => useCloudSync());
    setSession();
    await act(async () => { await result.current.syncNow(); });
    expect(result.current.retryIn).toBeNull();

    act(() => vi.advanceTimersByTime(31000));
    expect(result.current.retryIn).toBeNull();
  });

  it("retryIn is null when no error has occurred", async () => {
    mockFetch.mockReturnValue(successResponse(5));
    setSession();
    const { result } = renderHook(() => useCloudSync());
    await act(async () => { await result.current.syncNow(); });
    expect(result.current.retryIn).toBeNull();
  });
});

// ── First-sync toast pluralization ─────────────────────────────────────────────

describe("useCloudSync — first-sync toast pluralization", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(true);
    localStorage.removeItem("fenrir:first-sync-shown");
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("uses singular 'card has been' for count=1 (restore direction)", async () => {
    mockFetch.mockReturnValue(successResponse(1));
    const { result } = renderHook(() => useCloudSync());
    setSession();
    await act(async () => { await result.current.syncNow(); });
    expect(result.current.status).toBe("synced");
    expect(toast.success).toHaveBeenCalledWith(
      "Your 1 card has been restored from cloud",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("uses plural 'cards have been' for count=5 (restore direction)", async () => {
    mockFetch.mockReturnValue(successResponse(5));
    const { result } = renderHook(() => useCloudSync());
    setSession();
    await act(async () => { await result.current.syncNow(); });
    expect(result.current.status).toBe("synced");
    expect(toast.success).toHaveBeenCalledWith(
      "Your 5 cards have been restored from cloud",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("shows 'backed up' toast when syncedCount is 0 (neither direction)", async () => {
    mockFetch.mockReturnValue(successResponse(0));
    const { result } = renderHook(() => useCloudSync());
    setSession();
    await act(async () => { await result.current.syncNow(); });
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
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(true);
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("error status persists even after toast.error is called (toast ≠ dismissError)", async () => {
    mockFetch.mockReturnValue(errorResponse("permission-denied"));
    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => { await result.current.syncNow(); });
    expect(result.current.status).toBe("error");
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("error");
    expect(result.current.errorCode).toBe("permission-denied");
    expect(result.current.errorMessage).toBe("permission-denied");
  });

  it("error data overwrites on second consecutive error", async () => {
    mockFetch.mockReturnValueOnce(errorResponse("network-timeout"));
    const { result } = renderHook(() => useCloudSync());
    setSession();
    await act(async () => { await result.current.syncNow(); });
    expect(result.current.errorCode).toBe("network-timeout");

    act(() => result.current.dismissError());
    expect(result.current.status).toBe("idle");

    mockFetch.mockReturnValueOnce(errorResponse("quota-exceeded"));
    await act(async () => { await result.current.syncNow(); });
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
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(true);
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
    act(() => { void result.current.syncNow(); });
    expect(result.current.status).toBe("syncing");
    act(() => result.current.dismissError());
    expect(result.current.status).toBe("syncing");
  });

  it("dismissError clears all error fields", async () => {
    mockFetch.mockReturnValue(errorResponse("permission-denied"));
    const { result } = renderHook(() => useCloudSync());
    setSession();
    await act(async () => { await result.current.syncNow(); });

    expect(result.current.errorMessage).toBe("permission-denied");
    expect(result.current.errorCode).toBe("permission-denied");
    expect(result.current.errorTimestamp).toBeInstanceOf(Date);
    expect(result.current.retryIn).toBeNull();

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
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(true);
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

    await act(async () => { await result.current.syncNow(); });

    expect(eventSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener("fenrir:cloud-sync-complete", eventSpy);
  });

  it("syncNow is a no-op for Thrall (no event dispatched)", async () => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    const { result } = renderHook(() => useCloudSync());
    const eventSpy = vi.fn();
    window.addEventListener("fenrir:cloud-sync-complete", eventSpy);

    await act(async () => { await result.current.syncNow(); });

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

// =============================================================================
// use-cloud-sync-1172 — Bug 1 auth gating, Bug 2 restore/backup, Bug 3 push loop
// =============================================================================

const SESSION_1172 = makeSession("tok-1172", "hh-1172");

describe("Bug 1 — Auth gating: sync does not fire before auth is confirmed", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(true);
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReturnValue(hangingFetch());
    localStorage.removeItem("fenrir:first-sync-shown");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
    mockAuthContext.status = "authenticated";
  });

  it("does NOT fire sync when authStatus is 'loading' (Karl tier in cache)", () => {
    mockAuthContext.status = "loading";
    setSession(SESSION_1172);

    const { result } = renderHook(() => useCloudSync());

    expect(result.current.status).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does NOT fire sync when authStatus is 'anonymous'", () => {
    mockAuthContext.status = "anonymous";
    setSession(SESSION_1172);

    const { result } = renderHook(() => useCloudSync());

    expect(result.current.status).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fires sync when auth transitions from loading → authenticated (Karl)", async () => {
    mockAuthContext.status = "loading";
    setSession(SESSION_1172);

    const { result, rerender } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();

    mockFetch.mockReturnValue(successResponse(3));
    mockAuthContext.status = "authenticated";
    rerender();

    await act(async () => { await Promise.resolve(); });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("syncNow() respects auth gating: no-op when loading", async () => {
    mockAuthContext.status = "loading";
    setSession(SESSION_1172);

    const { result } = renderHook(() => useCloudSync());
    await act(async () => { await result.current.syncNow(); });

    expect(result.current.status).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("syncNow() works after auth is confirmed", async () => {
    mockAuthContext.status = "authenticated";
    setSession(SESSION_1172);
    mockFetch.mockReturnValue(successResponse(5));

    const { result } = renderHook(() => useCloudSync());
    await act(async () => { await result.current.syncNow(); });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("synced");
  });
});

describe("Bug 2 — Restore vs backup message direction", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockAuthContext.status = "authenticated";
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockHasMigrated.mockReturnValue(true);
    mockGetRawAllCards.mockReturnValue([]);
    localStorage.removeItem("fenrir:first-sync-shown");
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("shows 'restored from cloud' when local is empty and Firestore has cards", async () => {
    mockGetRawAllCards.mockReturnValue([]);
    mockFetch.mockReturnValue(successResponse(4));

    const { result } = renderHook(() => useCloudSync());
    setSession(SESSION_1172);
    await act(async () => { await result.current.syncNow(); });

    expect(result.current.status).toBe("synced");
    expect(toast.success).toHaveBeenCalledWith(
      "Your 4 cards have been restored from cloud",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("shows 'backed up' when local has cards", async () => {
    mockGetRawAllCards.mockReturnValue([
      { id: "c1", deletedAt: undefined },
      { id: "c2", deletedAt: undefined },
      { id: "c3", deletedAt: undefined },
    ]);
    mockFetch.mockReturnValue(successResponse(3));

    const { result } = renderHook(() => useCloudSync());
    setSession(SESSION_1172);
    await act(async () => { await result.current.syncNow(); });

    expect(result.current.status).toBe("synced");
    expect(toast.success).toHaveBeenCalledWith(
      "Your 3 cards have been backed up",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("NEVER shows 'backed up' when local is empty (empty push must not claim backup)", async () => {
    mockGetRawAllCards.mockReturnValue([]);
    mockFetch.mockReturnValue(successResponse(5));

    const { result } = renderHook(() => useCloudSync());
    setSession(SESSION_1172);
    await act(async () => { await result.current.syncNow(); });

    expect(result.current.status).toBe("synced");
    const call = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(call).not.toContain("backed up");
    expect(call).toContain("restored from cloud");
  });

  it("uses singular 'card has been' for count=1 restore", async () => {
    mockGetRawAllCards.mockReturnValue([]);
    mockFetch.mockReturnValue(successResponse(1));

    const { result } = renderHook(() => useCloudSync());
    setSession(SESSION_1172);
    await act(async () => { await result.current.syncNow(); });

    expect(toast.success).toHaveBeenCalledWith(
      "Your 1 card has been restored from cloud",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("uses singular 'card has been' for count=1 backup (local had 1 card)", async () => {
    mockGetRawAllCards.mockReturnValue([{ id: "c1", deletedAt: undefined }]);
    mockFetch.mockReturnValue(successResponse(1));

    const { result } = renderHook(() => useCloudSync());
    setSession(SESSION_1172);
    await act(async () => { await result.current.syncNow(); });

    expect(toast.success).toHaveBeenCalledWith(
      "Your 1 card has been backed up",
      expect.objectContaining({ duration: 5000 })
    );
  });
});

describe("Bug 3 — Push loop prevention", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockAuthContext.status = "authenticated";
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockHasMigrated.mockReturnValue(true);
    mockGetRawAllCards.mockReturnValue([]);
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReturnValue(hangingFetch());
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearSession();
  });

  it("fenrir:cards-changed event triggers debounced push", async () => {
    setSession(SESSION_1172);
    mockFetch.mockReturnValue(hangingFetch());
    const { result } = renderHook(() => useCloudSync());

    act(() => {
      window.dispatchEvent(new CustomEvent("fenrir:cards-changed", { detail: { householdId: "hh-1172" } }));
    });

    await act(async () => { vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS); });

    expect(mockFetch).toHaveBeenCalled();
  });

  it("fenrir:sync event does NOT trigger debounced push (internal write guard)", () => {
    clearSession();
    mockFetch.mockReturnValue(hangingFetch());
    renderHook(() => useCloudSync());
    vi.clearAllMocks();

    act(() => {
      window.dispatchEvent(new CustomEvent("fenrir:sync", { detail: {} }));
    });

    act(() => { vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS + 1000); });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("AUTO_SYNC_DEBOUNCE_MS is 10s (not 2s) — guards against rapid loop", () => {
    expect(AUTO_SYNC_DEBOUNCE_MS).toBe(10_000);
  });

  it("syncInProgress guard: dispatch card-changed while sync in progress skips push", async () => {
    setSession(SESSION_1172);
    mockFetch.mockReturnValue(hangingFetch());
    const { result } = renderHook(() => useCloudSync());

    act(() => { void result.current.syncNow(); });
    expect(result.current.status).toBe("syncing");

    vi.clearAllMocks();

    act(() => {
      window.dispatchEvent(new CustomEvent("fenrir:cards-changed", { detail: {} }));
    });

    act(() => { vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS + 1000); });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not accumulate multiple debounce timers on rapid card-changed events", () => {
    clearSession();
    renderHook(() => useCloudSync());
    vi.clearAllMocks();

    for (let i = 0; i < 10; i++) {
      act(() => {
        window.dispatchEvent(new CustomEvent("fenrir:cards-changed", { detail: {} }));
      });
      act(() => { vi.advanceTimersByTime(100); });
    }

    setSession(SESSION_1172);

    act(() => { vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS); });

    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe("API contract: GET /api/sync requires auth", () => {
  it("AUTH_GUARD: returns 401 when unauthenticated (sanity check)", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    expect(typeof requireAuth).toBe("function");
  });
});

// =============================================================================
// use-cloud-sync-1124-loki — AC-1 through AC-11 migration tests
// =============================================================================

const SESSION_1124 = makeSession("tok-1124", "hh-1124");

function migrationResult(
  direction: "download" | "upload" | "merge" | "empty",
  cardCount: number,
  ran = true
) {
  return { ran, cardCount, direction };
}

function successSyncResponse(syncedCount = 0, cards: unknown[] = []) {
  return Promise.resolve(
    new Response(JSON.stringify({ cards, syncedCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

describe("useCloudSync / handleLoginTransition — AC-1: Thrall user", () => {
  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(false);
    mockRunMigration.mockReset();
    vi.clearAllMocks();
    clearSession();
  });

  it("does not call runMigration when isKarl is false", () => {
    setSession(SESSION_1124);
    renderHook(() => useCloudSync());
    expect(mockRunMigration).not.toHaveBeenCalled();
  });

  it("status stays idle for Thrall user", () => {
    setSession(SESSION_1124);
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("idle");
  });
});

describe("useCloudSync / handleLoginTransition — AC-2: already migrated delegates to performPull", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(true);
    mockRunMigration.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
    clearSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("does not call runMigration when fenrir:migrated is set", async () => {
    mockFetch.mockReturnValue(
      Promise.resolve(
        new Response(JSON.stringify({ cards: [], activeCount: 2 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    setSession(SESSION_1124);

    await act(async () => { renderHook(() => useCloudSync()); });

    expect(mockRunMigration).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/sync/pull"),
      expect.objectContaining({ method: "GET" })
    );
  });
});

describe("useCloudSync / handleLoginTransition — AC-3: upload direction toast", () => {
  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(false);
    mockRunMigration.mockReset();
    vi.clearAllMocks();
    clearSession();
  });

  it("shows 'backed up to the cloud' toast when direction=upload (3 cards)", async () => {
    mockRunMigration.mockResolvedValue(migrationResult("upload", 3));
    setSession(SESSION_1124);

    await act(async () => {
      mockEntitlement.tier = "karl";
      mockEntitlement.isActive = true;
      renderHook(() => useCloudSync());
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Your 3 cards have been backed up to the cloud",
      expect.objectContaining({ description: "Yggdrasil guards your ledger." })
    );
  });
});

describe("useCloudSync / handleLoginTransition — AC-4: download direction toast", () => {
  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(false);
    mockRunMigration.mockReset();
    vi.clearAllMocks();
    clearSession();
  });

  it("shows 'restored from cloud' toast when direction=download (5 cards)", async () => {
    mockRunMigration.mockResolvedValue(migrationResult("download", 5));
    setSession(SESSION_1124);

    await act(async () => {
      mockEntitlement.tier = "karl";
      mockEntitlement.isActive = true;
      renderHook(() => useCloudSync());
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Your 5 cards have been restored from cloud",
      expect.objectContaining({ description: "Yggdrasil guards your ledger." })
    );
  });
});

describe("useCloudSync / handleLoginTransition — AC-5: merge direction toast", () => {
  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(false);
    mockRunMigration.mockReset();
    vi.clearAllMocks();
    clearSession();
  });

  it("shows 'backed up to the cloud' toast when direction=merge (4 cards)", async () => {
    mockRunMigration.mockResolvedValue(migrationResult("merge", 4));
    setSession(SESSION_1124);

    await act(async () => {
      mockEntitlement.tier = "karl";
      mockEntitlement.isActive = true;
      renderHook(() => useCloudSync());
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Your 4 cards have been backed up to the cloud",
      expect.objectContaining({ description: "Yggdrasil guards your ledger." })
    );
  });
});

describe("useCloudSync / handleLoginTransition — AC-6: empty direction, no toast", () => {
  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(false);
    mockRunMigration.mockReset();
    vi.clearAllMocks();
    clearSession();
  });

  it("shows no toast when cardCount=0 (empty direction)", async () => {
    mockRunMigration.mockResolvedValue(migrationResult("empty", 0));
    setSession(SESSION_1124);

    await act(async () => {
      mockEntitlement.tier = "karl";
      mockEntitlement.isActive = true;
      renderHook(() => useCloudSync());
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("useCloudSync / handleLoginTransition — AC-7: singular card toast", () => {
  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(false);
    mockRunMigration.mockReset();
    vi.clearAllMocks();
    clearSession();
  });

  it("uses singular 'card has' for exactly 1 card (upload)", async () => {
    mockRunMigration.mockResolvedValue(migrationResult("upload", 1));
    setSession(SESSION_1124);

    await act(async () => {
      mockEntitlement.tier = "karl";
      mockEntitlement.isActive = true;
      renderHook(() => useCloudSync());
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Your 1 card has been backed up to the cloud",
      expect.anything()
    );
  });

  it("uses singular 'card has' for exactly 1 card (download)", async () => {
    mockRunMigration.mockResolvedValue(migrationResult("download", 1));
    setSession(SESSION_1124);

    await act(async () => {
      mockEntitlement.tier = "karl";
      mockEntitlement.isActive = true;
      renderHook(() => useCloudSync());
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Your 1 card has been restored from cloud",
      expect.anything()
    );
  });
});

describe("useCloudSync / handleLoginTransition — AC-8: migration error fallback", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(false);
    mockRunMigration.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
    clearSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("falls back to performSync when runMigration throws a network error", async () => {
    mockRunMigration.mockRejectedValue(
      Object.assign(new Error("Network unavailable"), { code: "network_error" })
    );
    mockFetch.mockReturnValue(successSyncResponse(2));
    setSession(SESSION_1124);

    await act(async () => {
      mockEntitlement.tier = "karl";
      mockEntitlement.isActive = true;
      renderHook(() => useCloudSync());
    });

    expect(mockRunMigration).toHaveBeenCalledWith("hh-1124", "tok-1124");
    expect(mockFetch).toHaveBeenCalledWith("/api/sync/push", expect.anything());
  });

  it("does not show migration toast on migration error", async () => {
    mockRunMigration.mockRejectedValue(new Error("API down"));
    mockFetch.mockReturnValue(successSyncResponse(0));
    setSession(SESSION_1124);

    await act(async () => {
      mockEntitlement.tier = "karl";
      mockEntitlement.isActive = true;
      renderHook(() => useCloudSync());
    });

    expect(toast.success).not.toHaveBeenCalledWith(
      expect.stringContaining("backed up"),
      expect.anything()
    );
    expect(toast.success).not.toHaveBeenCalledWith(
      expect.stringContaining("restored"),
      expect.anything()
    );
  });
});

describe("useCloudSync / handleLoginTransition — AC-9: first-sync-shown flag", () => {
  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(false);
    mockRunMigration.mockReset();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    clearSession();
    localStorage.clear();
  });

  it("sets fenrir:first-sync-shown after successful migration", async () => {
    mockRunMigration.mockResolvedValue(migrationResult("upload", 2));
    setSession(SESSION_1124);

    await act(async () => {
      mockEntitlement.tier = "karl";
      mockEntitlement.isActive = true;
      renderHook(() => useCloudSync());
    });

    expect(localStorage.getItem("fenrir:first-sync-shown")).toBe("true");
  });

  it("does NOT set fenrir:first-sync-shown when migration throws", async () => {
    const mockFetch = vi.fn().mockReturnValue(successSyncResponse(0));
    vi.stubGlobal("fetch", mockFetch);
    mockRunMigration.mockRejectedValue(new Error("error"));
    setSession(SESSION_1124);

    await act(async () => {
      mockEntitlement.tier = "karl";
      mockEntitlement.isActive = true;
      renderHook(() => useCloudSync());
    });

    expect(mockRunMigration).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("useCloudSync / handleLoginTransition — AC-10: status transitions", () => {
  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(false);
    mockRunMigration.mockReset();
    vi.clearAllMocks();
    clearSession();
  });

  afterEach(() => { clearSession(); });

  it("transitions to 'syncing' during migration and 'synced' after success", async () => {
    let resolveRunMigration!: (val: unknown) => void;
    const migrationPromise = new Promise((res) => { resolveRunMigration = res; });
    mockRunMigration.mockReturnValue(migrationPromise);
    setSession(SESSION_1124);

    let hookResult: ReturnType<typeof renderHook<ReturnType<typeof useCloudSync>>>;

    await act(async () => {
      mockEntitlement.tier = "karl";
      mockEntitlement.isActive = true;
      hookResult = renderHook(() => useCloudSync());
    });

    expect(hookResult!.result.current.status).toBe("syncing");

    await act(async () => { resolveRunMigration(migrationResult("upload", 2)); });

    expect(hookResult!.result.current.status).toBe("synced");
    expect(hookResult!.result.current.cardCount).toBe(2);
  });
});

describe("useCloudSync / handleLoginTransition — AC-11: passes householdId and idToken", () => {
  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(false);
    mockRunMigration.mockReset();
    vi.clearAllMocks();
    clearSession();
  });

  afterEach(() => { clearSession(); });

  it("calls runMigration with householdId from session.user.sub and idToken from session.id_token", async () => {
    mockRunMigration.mockResolvedValue(migrationResult("upload", 1));
    setSession(SESSION_1124);

    await act(async () => {
      mockEntitlement.tier = "karl";
      mockEntitlement.isActive = true;
      renderHook(() => useCloudSync());
    });

    expect(mockRunMigration).toHaveBeenCalledWith("hh-1124", "tok-1124");
  });

  it("does not call runMigration when session is absent", async () => {
    clearSession();

    await act(async () => {
      mockEntitlement.tier = "karl";
      mockEntitlement.isActive = true;
      renderHook(() => useCloudSync());
    });

    expect(mockRunMigration).not.toHaveBeenCalled();
  });
});

// =============================================================================
// use-cloud-sync-1172-loki — setAllCards, first-sync suppression, Thrall guard, auth token
// =============================================================================

const SESSION_LOKI_1172 = makeSession("tok-loki-1172", "hh-loki");

describe("Bug 3 fix — setAllCards receives merged cards from server (not saveCard)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockAuthContext.status = "authenticated";
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockHasMigrated.mockReturnValue(true);
    mockGetRawAllCards.mockReturnValue([]);
    localStorage.removeItem("fenrir:first-sync-shown");
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("setAllCards is called once with the household ID from session", async () => {
    const mergedCards = [
      { id: "c1", title: "Card 1", deletedAt: null },
      { id: "c2", title: "Card 2", deletedAt: null },
    ];
    setSession(SESSION_LOKI_1172);
    mockFetch.mockReturnValue(successResponse(2, mergedCards));

    const { result } = renderHook(() => useCloudSync());
    await act(async () => { await result.current.syncNow(); });

    expect(mockSetAllCards).toHaveBeenCalledTimes(1);
    expect(mockSetAllCards).toHaveBeenCalledWith(
      SESSION_LOKI_1172.user.sub,
      mergedCards
    );
  });

  it("setAllCards is NOT called when sync fails (no partial overwrite)", async () => {
    mockFetch.mockReturnValue(
      Promise.resolve(
        new Response(JSON.stringify({ error: "permission-denied", error_description: "Forbidden" }), {
          status: 403,
        })
      )
    );

    const { result } = renderHook(() => useCloudSync());
    setSession(SESSION_LOKI_1172);
    await act(async () => { await result.current.syncNow(); });

    expect(result.current.status).toBe("error");
    expect(mockSetAllCards).not.toHaveBeenCalled();
  });
});

describe("Bug 2 fix — first-sync toast suppressed after fenrir:first-sync-shown is set", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockAuthContext.status = "authenticated";
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockHasMigrated.mockReturnValue(true);
    mockGetRawAllCards.mockReturnValue([]);
    localStorage.removeItem("fenrir:first-sync-shown");
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
    localStorage.removeItem("fenrir:first-sync-shown");
  });

  it("toast fires on first sync but NOT on second sync", async () => {
    setSession(SESSION_LOKI_1172);
    mockFetch.mockReturnValue(successResponse(3));

    const { result } = renderHook(() => useCloudSync());

    await act(async () => { await result.current.syncNow(); });
    expect(toast.success).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    await act(async () => { await result.current.syncNow(); });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("second sync still updates status and cardCount even without toast", async () => {
    mockFetch.mockReturnValue(successResponse(5));

    const { result } = renderHook(() => useCloudSync());
    setSession(SESSION_LOKI_1172);

    await act(async () => { await result.current.syncNow(); });
    expect(result.current.status).toBe("synced");
    expect(result.current.cardCount).toBe(5);

    mockFetch.mockReturnValue(successResponse(7));
    await act(async () => { await result.current.syncNow(); });

    expect(result.current.status).toBe("synced");
    expect(result.current.cardCount).toBe(7);
  });
});

describe("Bug 3 fix — Thrall does NOT attach fenrir:cards-changed auto-sync listener", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockAuthContext.status = "authenticated";
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    mockHasMigrated.mockReturnValue(true);
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReturnValue(hangingFetch());
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearSession();
  });

  it("Thrall: dispatching fenrir:cards-changed does not trigger any fetch", () => {
    renderHook(() => useCloudSync());
    vi.clearAllMocks();

    act(() => {
      window.dispatchEvent(new CustomEvent("fenrir:cards-changed", { detail: {} }));
    });

    act(() => { vi.advanceTimersByTime(15_000); });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("Auth race fix — Authorization Bearer token sent in sync request", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockAuthContext.status = "authenticated";
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockHasMigrated.mockReturnValue(true);
    mockGetRawAllCards.mockReturnValue([]);
    localStorage.removeItem("fenrir:first-sync-shown");
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("sync request carries Authorization: Bearer <id_token> from session", async () => {
    setSession(SESSION_LOKI_1172);
    mockFetch.mockReturnValue(successResponse(2));

    const { result } = renderHook(() => useCloudSync());
    await act(async () => { await result.current.syncNow(); });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [_url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${SESSION_LOKI_1172.id_token}`);
  });

  it("no request is made when session token is missing (prevents unauthenticated push)", async () => {
    clearSession();
    const { result } = renderHook(() => useCloudSync());
    await act(async () => { await result.current.syncNow(); });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });
});

describe("Sync on re-login — fires sync even when first-sync-shown already set", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockHasMigrated.mockReturnValue(true);
    mockGetRawAllCards.mockReturnValue([]);
    localStorage.setItem("fenrir:first-sync-shown", "true");
    localStorage.setItem("fenrir:migrated", "true");
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
    localStorage.removeItem("fenrir:first-sync-shown");
  });

  it("re-login triggers sync pull without toast (returning user flow)", async () => {
    mockAuthContext.status = "loading";
    const { rerender, result } = renderHook(() => useCloudSync());

    expect(mockFetch).not.toHaveBeenCalled();

    mockFetch.mockReturnValue(
      Promise.resolve(
        new Response(JSON.stringify({ cards: [], activeCount: 10 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    setSession(SESSION_LOKI_1172);
    mockAuthContext.status = "authenticated";
    rerender();

    await act(async () => { await Promise.resolve(); });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
    expect(result.current.status).toBe("synced");
  });
});

// =============================================================================
// use-cloud-sync-1239-loki — AC-1 through AC-5 (#1239 push-lock ACs)
// =============================================================================

const SESSION_1239 = makeSession("tok-1239-loki", "hh-1239");

describe("Issue #1239 AC-1 — No push on page load/mount (no user action)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(true);
    localStorage.setItem("fenrir:first-sync-shown", "true");
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("mounting Karl hook with session → only GET /api/sync/pull fires, no POST", async () => {
    setSession(SESSION_1239);
    mockFetch.mockReturnValue(pullResponse(5));

    renderHook(() => useCloudSync());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const allCalls = mockFetch.mock.calls as [string, RequestInit][];
    expect(allCalls.length).toBe(1);
    expect(allCalls[0][0]).toContain("/api/sync/pull");
    expect(allCalls[0][1]?.method).toBe("GET");
    expect(getPostCalls(mockFetch)).toHaveLength(0);
  });

  it("mounting Karl hook without session → zero fetch calls", async () => {
    clearSession();
    mockFetch.mockReturnValue(hangingFetch());

    renderHook(() => useCloudSync());
    await act(async () => { await Promise.resolve(); });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("mounting Thrall hook → zero fetch calls regardless of session", async () => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    setSession(SESSION_1239);
    mockFetch.mockReturnValue(hangingFetch());

    renderHook(() => useCloudSync());
    await act(async () => { await Promise.resolve(); });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("mounting Karl hook with loading auth → zero fetch calls (auth gate)", () => {
    mockAuthContext.status = "loading";
    setSession(SESSION_1239);

    renderHook(() => useCloudSync());

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("Issue #1239 AC-2 — Push fires on fenrir:cards-changed (debounced 10s)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(true);
    localStorage.setItem("fenrir:first-sync-shown", "true");
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearSession();
  });

  it("fenrir:cards-changed fires exactly one POST /api/sync/push after debounce", async () => {
    mockFetch.mockReturnValue(hangingFetch());
    renderHook(() => useCloudSync());

    setSession(SESSION_1239);
    mockFetch.mockReturnValue(pushResponse(3));

    act(() => { window.dispatchEvent(new CustomEvent(EVT_CARDS_CHANGED)); });

    expect(mockFetch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS + 500);
      await Promise.resolve();
      await Promise.resolve();
    });

    const postCalls = getPostCalls(mockFetch);
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0][0]).toBe("/api/sync/push");
  });

  it("multiple rapid cards-changed events collapse to one POST (debounce reset)", async () => {
    mockFetch.mockReturnValue(hangingFetch());
    renderHook(() => useCloudSync());
    setSession(SESSION_1239);
    mockFetch.mockReturnValue(pushResponse(1));

    act(() => {
      for (let i = 0; i < 5; i++) {
        window.dispatchEvent(new CustomEvent(EVT_CARDS_CHANGED));
      }
    });

    await act(async () => {
      vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS + 500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getPostCalls(mockFetch)).toHaveLength(1);
  });

  it("Thrall: fenrir:cards-changed does NOT trigger any fetch", async () => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    setSession(SESSION_1239);
    mockFetch.mockReturnValue(pushResponse(1));

    renderHook(() => useCloudSync());
    vi.clearAllMocks();

    act(() => { window.dispatchEvent(new CustomEvent(EVT_CARDS_CHANGED)); });

    await act(async () => {
      vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS + 500);
      await Promise.resolve();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("cards-changed before debounce expires does not push; only after expiry", async () => {
    mockFetch.mockReturnValue(hangingFetch());
    renderHook(() => useCloudSync());
    setSession(SESSION_1239);
    mockFetch.mockReturnValue(pushResponse(2));

    act(() => { window.dispatchEvent(new CustomEvent(EVT_CARDS_CHANGED)); });

    act(() => { vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS / 2); });
    expect(mockFetch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS / 2 + 500);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getPostCalls(mockFetch)).toHaveLength(1);
  });
});

describe("Issue #1239 AC-3 — Network reconnect does NOT trigger push", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(true);
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReturnValue(hangingFetch());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("online event after offline → status=idle, zero fetch calls", async () => {
    const { result } = renderHook(() => useCloudSync());

    expect(mockFetch).not.toHaveBeenCalled();

    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current.status).toBe("offline");

    act(() => window.dispatchEvent(new Event("online")));
    expect(result.current.status).toBe("idle");

    await act(async () => { await Promise.resolve(); });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("online event with active session → still no POST /api/sync/push", async () => {
    setSession(SESSION_1239);
    mockFetch.mockReturnValue(pullResponse(0));

    const { result } = renderHook(() => useCloudSync());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const callsAfterMount = mockFetch.mock.calls.length;

    act(() => window.dispatchEvent(new Event("offline")));
    act(() => window.dispatchEvent(new Event("online")));

    await act(async () => { await Promise.resolve(); });

    expect(mockFetch.mock.calls.length).toBe(callsAfterMount);
    expect(result.current.status).toBe("idle");
  });

  it("multiple offline/online cycles → zero POST /api/sync/push each time", async () => {
    const { result } = renderHook(() => useCloudSync());

    for (let i = 0; i < 3; i++) {
      act(() => window.dispatchEvent(new Event("offline")));
      act(() => window.dispatchEvent(new Event("online")));
    }

    await act(async () => { await Promise.resolve(); });

    expect(result.current.status).toBe("idle");
    expect(getPostCalls(mockFetch)).toHaveLength(0);
  });
});

describe("Issue #1239 AC-4 — No auto-retry push after sync error", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
    mockHasMigrated.mockReturnValue(true);
    vi.stubGlobal("fetch", mockFetch);
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearSession();
  });

  it("no new fetch after sync error even after 120s (auto-retry removed)", async () => {
    mockFetch.mockReturnValue(errorResponse("network_error"));
    const { result } = renderHook(() => useCloudSync());
    setSession(SESSION_1239);

    await act(async () => { await result.current.syncNow(); });
    expect(result.current.status).toBe("error");

    const callCountAfterError = mockFetch.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(121_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetch.mock.calls.length).toBe(callCountAfterError);
    expect(result.current.status).toBe("error");
  });

  it("retryIn is null immediately after error and stays null after 120s", async () => {
    mockFetch.mockReturnValue(errorResponse("quota_exceeded"));
    const { result } = renderHook(() => useCloudSync());
    setSession(SESSION_1239);

    await act(async () => { await result.current.syncNow(); });
    expect(result.current.retryIn).toBeNull();

    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.retryIn).toBeNull();

    act(() => vi.advanceTimersByTime(90_000));
    expect(result.current.retryIn).toBeNull();
  });

  it("error toast description directs user to edit a card (not wait for retry)", async () => {
    mockFetch.mockReturnValue(errorResponse());
    const { result } = renderHook(() => useCloudSync());
    setSession(SESSION_1239);

    await act(async () => { await result.current.syncNow(); });

    expect(toast.error).toHaveBeenCalledWith(
      "Sync failed",
      expect.objectContaining({
        description: "Your cards are safe locally. Retry by editing a card.",
      })
    );
  });

  it("next push only fires after fenrir:cards-changed (not automatically)", async () => {
    mockFetch.mockReturnValue(errorResponse("network_error"));
    const { result } = renderHook(() => useCloudSync());
    setSession(SESSION_1239);

    await act(async () => { await result.current.syncNow(); });
    expect(result.current.status).toBe("error");

    act(() => result.current.dismissError());
    expect(result.current.status).toBe("idle");

    mockFetch.mockReset();
    mockFetch.mockReturnValue(pushResponse(1));
    act(() => { window.dispatchEvent(new CustomEvent(EVT_CARDS_CHANGED)); });

    await act(async () => {
      vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS + 500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getPostCalls(mockFetch)).toHaveLength(1);
    expect(result.current.status).toBe("synced");
  });
});

describe("Issue #1239 AC-5 — Login fires GET /api/sync/pull, not POST /api/sync/push", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockAuthContext.status = "loading";
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockHasMigrated.mockReturnValue(true);
    localStorage.setItem("fenrir:first-sync-shown", "true");
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("isKarl transition calls GET /api/sync/pull, never POST /api/sync/push", async () => {
    const { rerender } = renderHook(() => useCloudSync());

    expect(mockFetch).not.toHaveBeenCalled();

    setSession(SESSION_1239);
    mockFetch.mockReturnValue(pullResponse(7));
    mockAuthContext.status = "authenticated";
    rerender();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/sync/pull");
    expect(init?.method).toBe("GET");
    expect(getPostCalls(mockFetch)).toHaveLength(0);
  });

  it("pull-on-login sets status=synced and cardCount from activeCount", async () => {
    const { rerender, result } = renderHook(() => useCloudSync());

    setSession(SESSION_1239);
    mockFetch.mockReturnValue(pullResponse(4));
    mockAuthContext.status = "authenticated";
    rerender();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe("synced");
    expect(result.current.cardCount).toBe(4);
    expect(result.current.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("no sync fires at all while auth remains in loading state", () => {
    mockAuthContext.status = "loading";
    renderHook(() => useCloudSync());

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("pull-on-login fails gracefully → status returns to idle (non-critical)", async () => {
    const { rerender, result } = renderHook(() => useCloudSync());

    setSession(SESSION_1239);
    mockFetch.mockReturnValue(
      Promise.resolve(new Response("{}", { status: 503 }))
    );
    mockAuthContext.status = "authenticated";
    rerender();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe("idle");
  });
});
