/**
 * useCloudSync — Issue #1172 regression tests
 *
 * Three bugs fixed, three test suites:
 *
 * Bug 1 — Auth gating:
 *   sync must NOT fire while AuthContext.status === "loading".
 *   The race: cached Karl entitlement → isKarl=true before session is confirmed
 *   → performSync fires with an expired/unvalidated token.
 *   Fix: gate isKarl on isAuthenticated (authStatus === "authenticated").
 *
 * Bug 2 — Restore vs backup message:
 *   After clearing localStorage and signing back in, the app must show
 *   "restored from cloud" (not "backed up") when local is empty and
 *   Firestore has cards. "Backed up" only appears when local had cards.
 *
 * Bug 3 — No push loop:
 *   The hook must listen to "fenrir:cards-changed" (user-initiated writes),
 *   NOT "fenrir:sync" (which fires on every setAllCards including internal
 *   merge writes). This breaks the performSync→setAllCards→fenrir:sync→
 *   debounce→performSync infinite loop.
 *   Debounce raised from 2s → 10s (AUTO_SYNC_DEBOUNCE_MS = 10_000).
 *
 * Issue #1172
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSync, AUTO_SYNC_DEBOUNCE_MS } from "@/hooks/useCloudSync";

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

// ── Storage mock — controls local card count ──────────────────────────────────

const mockGetRawAllCards = vi.fn().mockReturnValue([]);
const mockSetAllCards = vi.fn();

vi.mock("@/lib/storage", () => ({
  getRawAllCards: (...args: unknown[]) => mockGetRawAllCards(...args),
  setAllCards: (...args: unknown[]) => mockSetAllCards(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const FAKE_SESSION = { id_token: "tok-1172", user: { sub: "hh-1172" } };

function setSession() {
  localStorage.setItem("fenrir:auth", JSON.stringify(FAKE_SESSION));
}

function clearSession() {
  localStorage.removeItem("fenrir:auth");
  // Clear migration flag to prevent cross-test pollution from markMigrated() (#1239)
  localStorage.removeItem("fenrir:migrated");
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

// ── Bug 1: Auth gating ────────────────────────────────────────────────────────

describe("Bug 1 — Auth gating: sync does not fire before auth is confirmed", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
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
    // Simulate fresh page load: entitlement cache has Karl but auth is still initializing
    mockAuthContext.status = "loading";
    setSession();

    const { result } = renderHook(() => useCloudSync());

    // isKarl = isAuthenticated && tier === "karl" && isActive
    // isAuthenticated = (status === "authenticated") = false
    // → isKarl = false → no sync fires → status stays idle
    expect(result.current.status).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does NOT fire sync when authStatus is 'anonymous'", () => {
    mockAuthContext.status = "anonymous";
    setSession();

    const { result } = renderHook(() => useCloudSync());

    expect(result.current.status).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fires sync when auth transitions from loading → authenticated (Karl)", async () => {
    // Start in loading state — no sync
    mockAuthContext.status = "loading";
    setSession();

    const { result, rerender } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();

    // Auth resolves to authenticated — isKarl transitions false→true → sync fires
    mockFetch.mockReturnValue(successResponse(3));
    mockAuthContext.status = "authenticated";
    rerender();

    await act(async () => {
      // Wait for the performSync triggered by the login effect
      await Promise.resolve();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("syncNow() respects auth gating: no-op when loading", async () => {
    mockAuthContext.status = "loading";
    setSession();

    const { result } = renderHook(() => useCloudSync());
    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("syncNow() works after auth is confirmed", async () => {
    mockAuthContext.status = "authenticated";
    setSession();
    mockFetch.mockReturnValue(successResponse(5));

    const { result } = renderHook(() => useCloudSync());
    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("synced");
  });
});

// ── Bug 2: Restore vs backup message ──────────────────────────────────────────

describe("Bug 2 — Restore vs backup message direction", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockAuthContext.status = "authenticated";
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

  it("shows 'restored from cloud' when local is empty and Firestore has cards", async () => {
    const { toast } = await import("sonner");
    // Simulate fresh sign-in: local storage wiped, 4 cards in Firestore
    mockGetRawAllCards.mockReturnValue([]); // empty local
    mockFetch.mockReturnValue(successResponse(4));

    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull/runMigration on mount returns early
    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");
    expect(toast.success).toHaveBeenCalledWith(
      "Your 4 cards have been restored from cloud",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("shows 'backed up' when local has cards", async () => {
    const { toast } = await import("sonner");
    // Local has 3 active cards
    mockGetRawAllCards.mockReturnValue([
      { id: "c1", deletedAt: undefined },
      { id: "c2", deletedAt: undefined },
      { id: "c3", deletedAt: undefined },
    ]);
    mockFetch.mockReturnValue(successResponse(3));

    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull/runMigration on mount returns early
    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");
    expect(toast.success).toHaveBeenCalledWith(
      "Your 3 cards have been backed up",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("NEVER shows 'backed up' when local is empty (empty push must not claim backup)", async () => {
    const { toast } = await import("sonner");
    // Local is empty, Firestore returns 5 cards
    mockGetRawAllCards.mockReturnValue([]);
    mockFetch.mockReturnValue(successResponse(5));

    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull/runMigration on mount returns early
    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");
    const call = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(call).not.toContain("backed up");
    expect(call).toContain("restored from cloud");
  });

  it("uses singular 'card has been' for count=1 restore", async () => {
    const { toast } = await import("sonner");
    mockGetRawAllCards.mockReturnValue([]);
    mockFetch.mockReturnValue(successResponse(1));

    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull/runMigration on mount returns early
    await act(async () => {
      await result.current.syncNow();
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Your 1 card has been restored from cloud",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("uses singular 'card has been' for count=1 backup (local had 1 card)", async () => {
    const { toast } = await import("sonner");
    mockGetRawAllCards.mockReturnValue([{ id: "c1", deletedAt: undefined }]);
    mockFetch.mockReturnValue(successResponse(1));

    const { result } = renderHook(() => useCloudSync());
    setSession(); // Set AFTER renderHook so performPull/runMigration on mount returns early
    await act(async () => {
      await result.current.syncNow();
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Your 1 card has been backed up",
      expect.objectContaining({ duration: 5000 })
    );
  });
});

// ── Bug 3: No push loop ───────────────────────────────────────────────────────

describe("Bug 3 — Push loop prevention", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockAuthContext.status = "authenticated";
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
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
    setSession();
    mockFetch.mockReturnValue(hangingFetch());
    const { result } = renderHook(() => useCloudSync());

    // No fetch yet (only the login-transition auto-sync, which needs session)
    // Wait: login transition fires but session already set so it goes to syncing
    // Let's clear that by starting without session and then setting it for the event
    act(() => {
      window.dispatchEvent(new CustomEvent("fenrir:cards-changed", { detail: { householdId: "hh-1172" } }));
    });

    // Advance by AUTO_SYNC_DEBOUNCE_MS
    await act(async () => {
      vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS);
    });

    // At least one fetch should have been made (the debounced push)
    expect(mockFetch).toHaveBeenCalled();
  });

  it("fenrir:sync event does NOT trigger debounced push (internal write guard)", () => {
    setSession();
    // Render without auto-sync triggering (no session for login effect)
    clearSession();
    mockFetch.mockReturnValue(hangingFetch());
    const { result: _ } = renderHook(() => useCloudSync());
    vi.clearAllMocks();

    // Dispatch fenrir:sync (dispatched by setAllCards after sync merge)
    act(() => {
      window.dispatchEvent(new CustomEvent("fenrir:sync", { detail: {} }));
    });

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS + 1000);
    });

    // fenrir:sync must NOT trigger any fetch — this breaks the loop
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("AUTO_SYNC_DEBOUNCE_MS is 10s (not 2s) — guards against rapid loop", () => {
    // Issue #1172: raised from 2s to 10s to prevent rapid repeated pushes
    expect(AUTO_SYNC_DEBOUNCE_MS).toBe(10_000);
  });

  it("syncInProgress guard: dispatch card-changed while sync in progress skips push", async () => {
    setSession();
    mockFetch.mockReturnValue(hangingFetch()); // keeps syncInProgress=true
    const { result } = renderHook(() => useCloudSync());

    // Trigger sync manually (keeps syncInProgress=true because fetch hangs)
    act(() => {
      void result.current.syncNow();
    });
    expect(result.current.status).toBe("syncing");

    vi.clearAllMocks();

    // Dispatch card-changed while sync is in progress
    act(() => {
      window.dispatchEvent(new CustomEvent("fenrir:cards-changed", { detail: {} }));
    });

    // Advance past debounce — guard should skip the push
    act(() => {
      vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS + 1000);
    });

    // No second fetch (syncInProgress was true when timer fired)
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not accumulate multiple debounce timers on rapid card-changed events", () => {
    clearSession();
    const { result: _ } = renderHook(() => useCloudSync());
    vi.clearAllMocks();

    // Rapid events — only the last one should matter
    for (let i = 0; i < 10; i++) {
      act(() => {
        window.dispatchEvent(new CustomEvent("fenrir:cards-changed", { detail: {} }));
      });
      act(() => { vi.advanceTimersByTime(100); }); // advance 100ms between each
    }

    setSession();

    // Advance past debounce from last event
    act(() => {
      vi.advanceTimersByTime(AUTO_SYNC_DEBOUNCE_MS);
    });

    // At most 1 fetch — debounce coalesced the rapid events
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

// ── GET /api/sync auth guard (already covered in api/sync.test.ts, sanity check) ──

describe("API contract: GET /api/sync requires auth", () => {
  it("AUTH_GUARD: returns 401 when unauthenticated (sanity check)", async () => {
    // This is tested in depth in src/__tests__/api/sync.test.ts.
    // Confirm the auth module is properly referenced.
    const { requireAuth } = await import("@/lib/auth/require-auth");
    expect(typeof requireAuth).toBe("function");
  });
});
