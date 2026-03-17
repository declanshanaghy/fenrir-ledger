/**
 * useCloudSync — Loki QA regression tests for Issue #1172
 *
 * Covers gaps NOT tested by FiremanDecko in use-cloud-sync-1172.test.ts:
 *
 * 1. setAllCards is called with merged server cards (not saveCard individually)
 *    The push-loop fix depends on this — only setAllCards dispatches fenrir:sync,
 *    individual saveCard calls dispatch fenrir:cards-changed and would re-trigger.
 *
 * 2. First-sync toast is suppressed on subsequent syncs (fenrir:first-sync-shown)
 *    Once LS_FIRST_SYNC_SHOWN="true", no toast on 2nd or later syncs.
 *
 * 3. Thrall ignores fenrir:cards-changed events (no debounced push attached)
 *    Non-Karl users must never attach the auto-sync listener — guards against
 *    accidental push loop risk if tier state is temporarily incorrect.
 *
 * 4. Authorization Bearer token from session is sent in the sync request
 *    Verifies the auth race fix: the id_token from the validated session is
 *    forwarded to /api/sync/push so server-side auth succeeds.
 *
 * 5. Sync fires on Karl login even when first-sync-shown is already set
 *    Users who sign out and sign back in must still trigger a sync pull — just
 *    without the first-sync toast.
 *
 * Issue #1172 — Loki QA validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSync } from "@/hooks/useCloudSync";

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

const mockGetRawAllCards = vi.fn().mockReturnValue([]);
const mockSetAllCards = vi.fn();

vi.mock("@/lib/storage", () => ({
  getRawAllCards: (...args: unknown[]) => mockGetRawAllCards(...args),
  setAllCards: (...args: unknown[]) => mockSetAllCards(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_SESSION = { id_token: "tok-loki-1172", user: { sub: "hh-loki" } };

function setSession() {
  localStorage.setItem("fenrir:auth", JSON.stringify(FAKE_SESSION));
}

function clearSession() {
  localStorage.removeItem("fenrir:auth");
}

function successResponse(syncedCount = 0, cards: unknown[] = []) {
  return Promise.resolve(
    new Response(JSON.stringify({ cards, syncedCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function hangingFetch() {
  return new Promise<Response>(() => {});
}

// ── 1. setAllCards called with merged server cards ────────────────────────────

describe("Bug 3 fix — setAllCards receives merged cards from server (not saveCard)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockAuthContext.status = "authenticated";
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
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
    setSession();
    mockFetch.mockReturnValue(successResponse(2, mergedCards));

    const { result } = renderHook(() => useCloudSync());
    await act(async () => {
      await result.current.syncNow();
    });

    // setAllCards must be called — not saveCard — to avoid triggering cards-changed
    expect(mockSetAllCards).toHaveBeenCalledTimes(1);
    // First arg is householdId from session.user.sub
    expect(mockSetAllCards).toHaveBeenCalledWith(
      FAKE_SESSION.user.sub,
      mergedCards
    );
  });

  it("setAllCards is NOT called when sync fails (no partial overwrite)", async () => {
    setSession();
    mockFetch.mockReturnValue(
      Promise.resolve(
        new Response(JSON.stringify({ error: "permission-denied", error_description: "Forbidden" }), {
          status: 403,
        })
      )
    );

    const { result } = renderHook(() => useCloudSync());
    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("error");
    // Merged cards must not be written on error
    expect(mockSetAllCards).not.toHaveBeenCalled();
  });
});

// ── 2. First-sync toast suppressed on subsequent syncs ────────────────────────

describe("Bug 2 fix — first-sync toast suppressed after fenrir:first-sync-shown is set", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockAuthContext.status = "authenticated";
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
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
    const { toast } = await import("sonner");
    setSession();
    mockFetch.mockReturnValue(successResponse(3));

    const { result } = renderHook(() => useCloudSync());

    // First sync — toast should appear
    await act(async () => {
      await result.current.syncNow();
    });
    expect(toast.success).toHaveBeenCalledTimes(1);

    // Reset call count; second sync must not toast
    vi.clearAllMocks();

    // Advance through SYNCED_DISPLAY_MS to return to idle
    await act(async () => {
      await result.current.syncNow();
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("second sync still updates status and cardCount even without toast", async () => {
    setSession();
    mockFetch.mockReturnValue(successResponse(5));

    const { result } = renderHook(() => useCloudSync());

    // First sync sets the flag
    await act(async () => {
      await result.current.syncNow();
    });
    expect(result.current.status).toBe("synced");
    expect(result.current.cardCount).toBe(5);

    // Force back to idle by re-setting: just re-invoke syncNow
    mockFetch.mockReturnValue(successResponse(7));
    await act(async () => {
      await result.current.syncNow();
    });

    // Status/cardCount still updated on 2nd sync
    expect(result.current.status).toBe("synced");
    expect(result.current.cardCount).toBe(7);
  });
});

// ── 3. Thrall ignores fenrir:cards-changed ────────────────────────────────────

describe("Bug 3 fix — Thrall does NOT attach fenrir:cards-changed auto-sync listener", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockAuthContext.status = "authenticated";
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
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

    // Advance well past any debounce
    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── 4. Authorization Bearer token sent in request ─────────────────────────────

describe("Auth race fix — Authorization Bearer token sent in sync request", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockAuthContext.status = "authenticated";
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
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
    setSession();
    mockFetch.mockReturnValue(successResponse(2));

    const { result } = renderHook(() => useCloudSync());
    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [_url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${FAKE_SESSION.id_token}`);
  });

  it("no request is made when session token is missing (prevents unauthenticated push)", async () => {
    // No session in localStorage — performSync should bail early
    clearSession();
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });
});

// ── 5. Login auto-sync fires even when first-sync-shown already set ───────────

describe("Sync on re-login — fires sync even when first-sync-shown already set", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    mockGetRawAllCards.mockReturnValue([]);
    // Mark first-sync as already shown (simulates returning user)
    localStorage.setItem("fenrir:first-sync-shown", "true");
    vi.stubGlobal("fetch", mockFetch);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
    localStorage.removeItem("fenrir:first-sync-shown");
  });

  it("re-login triggers sync pull without toast (returning user flow)", async () => {
    const { toast } = await import("sonner");
    // Start as not-karl (loading auth), then transition to authenticated Karl
    mockAuthContext.status = "loading";
    const { rerender, result } = renderHook(() => useCloudSync());

    expect(mockFetch).not.toHaveBeenCalled();

    mockFetch.mockReturnValue(successResponse(10));
    setSession();
    mockAuthContext.status = "authenticated";
    rerender();

    await act(async () => {
      await Promise.resolve();
    });

    // Sync should have fired
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // No toast because first-sync-shown is already set
    expect(toast.success).not.toHaveBeenCalled();
    expect(result.current.status).toBe("synced");
  });
});
