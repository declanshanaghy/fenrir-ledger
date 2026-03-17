/**
 * Loki QA — useCloudSync Issue #1239 acceptance tests
 *
 * Validates each acceptance criterion from Issue #1239:
 * "Sync push fires continuously on all pages — lock push to card create/edit only"
 *
 * AC-1: Page load/mount → zero POST /api/sync/push (no user action → no push)
 * AC-2: fenrir:cards-changed → exactly one POST /api/sync/push after 10s debounce
 * AC-3: Network reconnect (online event) → zero POST /api/sync/push
 * AC-4: Sync error → no auto-retry POST (retryIn stays null, no new fetch after 120s)
 * AC-5: Login (isKarl transition) → GET /api/sync/pull fires, zero POST /api/sync/push
 *
 * Gap analysis vs prior tests:
 * - No prior test explicitly asserts HTTP method + URL on mount (only that fetch was/wasn't
 *   called overall). These tests pin the exact endpoint to catch regressions.
 * - No prior test counts fetch calls before/after goOnline() with an active session.
 * - No prior test verifies the error-toast message references card-edit retry (not timer).
 *
 * Issue #1239
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSync, EVT_CARDS_CHANGED, AUTO_SYNC_DEBOUNCE_MS } from "@/hooks/useCloudSync";

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

// All tests simulate already-migrated users so handleLoginTransition → performPull (GET)
// not runMigration (which would try to POST). This prevents migration calls from
// consuming mock responses intended for the sync flows under test.
vi.mock("@/lib/sync/migration", () => ({
  hasMigrated: () => true,
  runMigration: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_SESSION = { id_token: "tok-1239-loki", user: { sub: "hh-1239" } };

function setSession() {
  localStorage.setItem("fenrir:auth", JSON.stringify(FAKE_SESSION));
}

function clearSession() {
  localStorage.removeItem("fenrir:auth");
  localStorage.removeItem("fenrir:first-sync-shown");
}

/** Response for performPull (GET /api/sync/pull) — expects { cards, activeCount } */
function pullResponse(activeCount = 0, cards: unknown[] = []) {
  return Promise.resolve(
    new Response(JSON.stringify({ cards, activeCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

/** Response for performSync (POST /api/sync/push) — expects { cards, syncedCount } */
function pushResponse(syncedCount = 0, cards: unknown[] = []) {
  return Promise.resolve(
    new Response(JSON.stringify({ cards, syncedCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

/** Failed sync response */
function errorResponse(errCode = "sync_error") {
  return Promise.resolve(
    new Response(
      JSON.stringify({ error: errCode, error_description: errCode }),
      { status: 500 }
    )
  );
}

/** Never-resolving fetch — keeps hook in "syncing" without consuming the mock */
function hangingFetch() {
  return new Promise<Response>(() => {});
}

/** Filter fetch calls to those that were POST requests */
function getPostCalls(mockFetch: ReturnType<typeof vi.fn>) {
  return (mockFetch.mock.calls as [string, RequestInit][]).filter(
    ([_url, init]) => init?.method === "POST"
  );
}

// ── AC-1: No POST /api/sync/push on page load / mount ─────────────────────────

describe("Issue #1239 AC-1 — No push on page load/mount (no user action)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
    localStorage.setItem("fenrir:first-sync-shown", "true");
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("mounting Karl hook with session → only GET /api/sync/pull fires, no POST", async () => {
    // Session set before renderHook → login transition fires → hasMigrated=true → performPull (GET)
    setSession();
    mockFetch.mockReturnValue(pullResponse(5));

    renderHook(() => useCloudSync());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Verify: GET /api/sync/pull was called exactly once
    const allCalls = mockFetch.mock.calls as [string, RequestInit][];
    expect(allCalls.length).toBe(1);
    expect(allCalls[0][0]).toContain("/api/sync/pull");
    expect(allCalls[0][1]?.method).toBe("GET");

    // Verify: no POST /api/sync/push
    expect(getPostCalls(mockFetch)).toHaveLength(0);
  });

  it("mounting Karl hook without session → zero fetch calls", async () => {
    // No session → both handleLoginTransition and performPull bail early
    clearSession();
    mockFetch.mockReturnValue(hangingFetch());

    renderHook(() => useCloudSync());
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("mounting Thrall hook → zero fetch calls regardless of session", async () => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    setSession();
    mockFetch.mockReturnValue(hangingFetch());

    renderHook(() => useCloudSync());
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("mounting Karl hook with loading auth → zero fetch calls (auth gate)", () => {
    // Auth in loading state → isKarl = false → no sync attempt
    mockAuthContext.status = "loading";
    setSession();

    renderHook(() => useCloudSync());

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── AC-2: Exactly one POST /api/sync/push on fenrir:cards-changed ─────────────

describe("Issue #1239 AC-2 — Push fires on fenrir:cards-changed (debounced 10s)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
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
    // No session on mount → login transition returns early → no fetch on mount
    mockFetch.mockReturnValue(hangingFetch());
    renderHook(() => useCloudSync());

    // Set session so the debounced push can acquire credentials
    setSession();
    mockFetch.mockReturnValue(pushResponse(3));

    // Dispatch cards-changed
    act(() => {
      window.dispatchEvent(new CustomEvent(EVT_CARDS_CHANGED));
    });

    // Before debounce interval: no fetch yet
    expect(mockFetch).not.toHaveBeenCalled();

    // Advance past AUTO_SYNC_DEBOUNCE_MS (10_000 ms)
    await act(async () => {
      vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS + 500);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Exactly one POST /api/sync/push
    const postCalls = getPostCalls(mockFetch);
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0][0]).toBe("/api/sync/push");
  });

  it("multiple rapid cards-changed events collapse to one POST (debounce reset)", async () => {
    mockFetch.mockReturnValue(hangingFetch());
    renderHook(() => useCloudSync());
    setSession();
    mockFetch.mockReturnValue(pushResponse(1));

    // Fire 5 rapid events — each resets the debounce timer
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

    // Only 1 POST despite 5 events
    expect(getPostCalls(mockFetch)).toHaveLength(1);
  });

  it("Thrall: fenrir:cards-changed does NOT trigger any fetch", async () => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    setSession();
    mockFetch.mockReturnValue(pushResponse(1));

    renderHook(() => useCloudSync());
    vi.clearAllMocks();

    act(() => {
      window.dispatchEvent(new CustomEvent(EVT_CARDS_CHANGED));
    });

    await act(async () => {
      vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS + 500);
      await Promise.resolve();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("cards-changed before debounce expires does not push; only after expiry", async () => {
    mockFetch.mockReturnValue(hangingFetch());
    renderHook(() => useCloudSync());
    setSession();
    mockFetch.mockReturnValue(pushResponse(2));

    act(() => {
      window.dispatchEvent(new CustomEvent(EVT_CARDS_CHANGED));
    });

    // Advance only half the debounce — no push yet
    act(() => {
      vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS / 2);
    });
    expect(mockFetch).not.toHaveBeenCalled();

    // Advance the remaining half + buffer — now push fires
    await act(async () => {
      vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS / 2 + 500);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getPostCalls(mockFetch)).toHaveLength(1);
  });
});

// ── AC-3: No POST /api/sync/push on network reconnect ─────────────────────────

describe("Issue #1239 AC-3 — Network reconnect does NOT trigger push", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
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

  it("online event after offline → status=idle, zero fetch calls", async () => {
    const { result } = renderHook(() => useCloudSync());

    // Confirm no mount-time fetch (no session set)
    expect(mockFetch).not.toHaveBeenCalled();

    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current.status).toBe("offline");

    act(() => window.dispatchEvent(new Event("online")));
    expect(result.current.status).toBe("idle");

    await act(async () => { await Promise.resolve(); });

    // No fetch was called — reconnect must NOT push
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("online event with active session → still no POST /api/sync/push", async () => {
    // Session present so any push would succeed, but online must not trigger push
    setSession();
    mockFetch.mockReturnValue(pullResponse(0)); // for the login-pull on mount

    const { result } = renderHook(() => useCloudSync());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const callsAfterMount = mockFetch.mock.calls.length;

    act(() => window.dispatchEvent(new Event("offline")));
    act(() => window.dispatchEvent(new Event("online")));

    await act(async () => { await Promise.resolve(); });

    // No new fetch calls after reconnect
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

// ── AC-4: No auto-retry POST after sync error ──────────────────────────────────

describe("Issue #1239 AC-4 — No auto-retry push after sync error", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockAuthContext.status = "authenticated";
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
    // Set session AFTER renderHook so login-pull on mount returns early
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("error");

    const callCountAfterError = mockFetch.mock.calls.length;

    // Advance 121 seconds — no auto-retry should fire (#1239 removed this behavior)
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
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.retryIn).toBeNull();

    // No countdown tick even after time passes
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.retryIn).toBeNull();

    act(() => vi.advanceTimersByTime(90_000));
    expect(result.current.retryIn).toBeNull();
  });

  it("error toast description directs user to edit a card (not wait for retry)", async () => {
    const { toast } = await import("sonner");
    mockFetch.mockReturnValue(errorResponse());
    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Sync failed",
      expect.objectContaining({
        // #1239: no auto-retry — user must edit a card to trigger next push
        description: "Your cards are safe locally. Retry by editing a card.",
      })
    );
  });

  it("next push only fires after fenrir:cards-changed (not automatically)", async () => {
    mockFetch.mockReturnValue(errorResponse("network_error"));
    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("error");

    // Dismiss error and then dispatch cards-changed — THAT is the only auto-push path
    act(() => result.current.dismissError());
    expect(result.current.status).toBe("idle");

    // Reset call history so we count only the POST triggered by cards-changed
    mockFetch.mockReset();
    mockFetch.mockReturnValue(pushResponse(1));
    act(() => {
      window.dispatchEvent(new CustomEvent(EVT_CARDS_CHANGED));
    });

    await act(async () => {
      vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS + 500);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Now a push fires — triggered by card change, not auto-retry
    expect(getPostCalls(mockFetch)).toHaveLength(1);
    expect(result.current.status).toBe("synced");
  });
});

// ── AC-5: Login transition → GET /api/sync/pull, NOT POST /api/sync/push ──────

describe("Issue #1239 AC-5 — Login fires GET /api/sync/pull, not POST /api/sync/push", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    // Start as unauthenticated so isKarl=false initially
    mockAuthContext.status = "loading";
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
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

    // No fetch while loading auth
    expect(mockFetch).not.toHaveBeenCalled();

    // Transition: set session and authenticate
    setSession();
    mockFetch.mockReturnValue(pullResponse(7));
    mockAuthContext.status = "authenticated";
    rerender();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Exactly one call made
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // It was GET to /api/sync/pull
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/sync/pull");
    expect(init?.method).toBe("GET");

    // No POST to /api/sync/push
    expect(getPostCalls(mockFetch)).toHaveLength(0);
  });

  it("pull-on-login sets status=synced and cardCount from activeCount", async () => {
    const { rerender, result } = renderHook(() => useCloudSync());

    setSession();
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
    // Auth stays in loading → isKarl never becomes true → no sync
    mockAuthContext.status = "loading";
    renderHook(() => useCloudSync());

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("pull-on-login fails gracefully → status returns to idle (non-critical)", async () => {
    const { rerender, result } = renderHook(() => useCloudSync());

    setSession();
    mockFetch.mockReturnValue(
      Promise.resolve(new Response("{}", { status: 503 }))
    );
    mockAuthContext.status = "authenticated";
    rerender();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Pull failure is non-critical: returns to idle rather than error
    expect(result.current.status).toBe("idle");
  });
});
