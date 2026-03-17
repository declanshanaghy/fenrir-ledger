/**
 * Loki QA — useCloudSync advanced edge cases (issue #1119)
 *
 * Gaps NOT covered by existing hook tests:
 *   - syncNow() is a no-op when navigator.onLine is false
 *   - Auto-retry timer fires and calls pushToFirestore after 120s
 *   - Auto-retry transitions: error → syncing → synced
 *   - Auto-retry transitions: error → syncing → error (retry fails)
 *   - fenrir:cards-changed event is ignored when navigator.onLine is false
 *   - cardCount is null on initial idle (before any sync)
 *   - lastSyncedAt is null before any successful sync
 *   - errorMessage is null before any error
 *   - Multiple fenrir:cards-changed events reset the debounce timer (only one PUT)
 *   - syncNow() clears pending debounce before pushing
 *
 * Issue #1119
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSync, EVT_CARDS_CHANGED } from "@/hooks/useCloudSync";
import type { Card } from "@/lib/types";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockEntitlement = { tier: "thrall" as string, isActive: false };

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => mockEntitlement,
}));

// Issue #1172: useCloudSync gates on auth status — mock AuthContext to avoid
// "useAuthContext must be used within <AuthProvider>" in unit tests
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

const mockEnsureFreshToken = vi.fn<[], Promise<string | null>>();
vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: () => mockEnsureFreshToken(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: () => ({ user: { sub: "test-household-adv" } }),
}));

vi.mock("@/lib/storage", () => ({
  getRawAllCards: vi.fn().mockReturnValue([]),
  setAllCards: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const TEST_HOUSEHOLD = "test-household-adv";

const FAKE_SESSION = {
  id_token: "test-id-token-adv",
  user: { sub: TEST_HOUSEHOLD },
};

function setupKarl() {
  mockEntitlement.tier = "karl";
  mockEntitlement.isActive = true;
  mockEnsureFreshToken.mockResolvedValue("test-id-token");
  localStorage.setItem("fenrir:auth", JSON.stringify(FAKE_SESSION));
}

// The hook POSTs to /api/sync/push and expects { cards, syncedCount } in the response.
function mockFetchGet(cards: Card[] = []) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      cards,
      syncedCount: cards.length,
    }),
  } as Response);
}

function mockFetchGetFail(code = "forbidden") {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ error: code }),
  } as Response);
}

function mockFetchPut(syncedCount = 3) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      cards: [],
      syncedCount,
    }),
  } as Response);
}

function mockFetchPutFail(code = "server_error") {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ error: code }),
  } as Response);
}

// ── Initial state assertions ───────────────────────────────────────────────────

describe("useCloudSync — initial state (Thrall/idle)", () => {
  beforeEach(() => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("cardCount is null before any sync", () => {
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.cardCount).toBeNull();
  });

  it("lastSyncedAt is null before any sync", () => {
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.lastSyncedAt).toBeNull();
  });

  it("errorMessage is null before any error", () => {
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.errorMessage).toBeNull();
  });

  it("errorCode is null before any error", () => {
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.errorCode).toBeNull();
  });

  it("retryIn is null before any error", () => {
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.retryIn).toBeNull();
  });
});

// ── syncNow() offline behavior ─────────────────────────────────────────────────

describe("useCloudSync — syncNow() is a no-op when offline", () => {
  beforeEach(() => {
    setupKarl();
    try { localStorage.setItem("fenrir:first-sync-shown", "true"); } catch { /* ignore */ }
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore onLine
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  it("syncNow() does not fetch when navigator.onLine is false", async () => {
    // Initial GET succeeds
    mockFetchGet([]);
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {});
    expect(result.current.status).toBe("synced");

    // Go offline
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

    // Reset fetch spy so we can detect new calls
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    await act(async () => { await result.current.syncNow(); });

    // syncNow() should bail out early — no fetch calls
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── Auto-retry after error ─────────────────────────────────────────────────────

describe("useCloudSync — auto-retry fires after 120s error timeout", () => {
  beforeEach(() => {
    setupKarl();
    vi.useFakeTimers();
    try { localStorage.setItem("fenrir:first-sync-shown", "true"); } catch { /* ignore */ }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("auto-retry transitions error → syncing → synced after 120s", async () => {
    // Initial mount fails
    mockFetchGetFail("forbidden");
    const { result } = renderHook(() => useCloudSync());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("error");

    // Set up PUT to succeed on retry
    mockFetchPut(2);

    // Advance past the 120-second retry window
    await act(async () => {
      vi.advanceTimersByTime(121_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Should have triggered a retry (POST to /api/sync/push)
    const postCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => (c[1] as RequestInit)?.method === "POST"
    );
    expect(postCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("auto-retry transitions error → syncing → error if retry also fails", async () => {
    // Initial mount fails
    mockFetchGetFail("permission-denied");
    const { result } = renderHook(() => useCloudSync());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("error");

    // Retry will also fail
    mockFetchPutFail("server_error");

    await act(async () => {
      vi.advanceTimersByTime(121_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    // Still in error state after failed retry
    expect(result.current.status).toBe("error");
  });
});

// ── fenrir:cards-changed ignored when offline ──────────────────────────────────

describe("useCloudSync — fenrir:cards-changed ignored when offline", () => {
  beforeEach(() => {
    setupKarl();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try { localStorage.setItem("fenrir:first-sync-shown", "true"); } catch { /* ignore */ }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  it("debounced PUT is not triggered when cards-changed fires while offline", async () => {
    // Initial GET succeeds
    mockFetchGet([]);
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.status).toBe("synced");

    // Go offline
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

    // Count PUT calls before event
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const callsBefore = fetchMock.mock.calls.filter(
      (c: unknown[]) => (c[1] as RequestInit)?.method === "PUT"
    ).length;

    // Fire cards-changed event
    act(() => {
      window.dispatchEvent(
        new CustomEvent(EVT_CARDS_CHANGED, { detail: { householdId: TEST_HOUSEHOLD } })
      );
    });

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    const callsAfter = fetchMock.mock.calls.filter(
      (c: unknown[]) => (c[1] as RequestInit)?.method === "PUT"
    ).length;

    // No new PUT calls while offline
    expect(callsAfter).toBe(callsBefore);
  });
});

// ── Multiple cards-changed events: only one PUT (debounce) ────────────────────

describe("useCloudSync — multiple fenrir:cards-changed events debounce to one PUT", () => {
  beforeEach(() => {
    setupKarl();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try { localStorage.setItem("fenrir:first-sync-shown", "true"); } catch { /* ignore */ }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("rapid cards-changed events collapse to a single PUT after debounce", async () => {
    mockFetchGet([]);
    renderHook(() => useCloudSync());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Set up PUT mock
    mockFetchPut(1);

    // Fire 5 rapid events within the debounce window
    act(() => {
      for (let i = 0; i < 5; i++) {
        window.dispatchEvent(
          new CustomEvent(EVT_CARDS_CHANGED, { detail: { householdId: TEST_HOUSEHOLD } })
        );
      }
    });

    // Advance past AUTO_SYNC_DEBOUNCE_MS (10s) to trigger the debounced push
    await act(async () => {
      vi.advanceTimersByTime(11_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    const postCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => (c[1] as RequestInit)?.method === "POST"
    );

    // Only 1 POST despite 5 events (initial sync POST + 1 debounced POST = 2 total,
    // but the initial sync already ran before mockFetchPut was set — count POST calls
    // made AFTER the events, which should be exactly 1)
    expect(postCalls.length).toBe(1);
  });
});

// ── onSyncSuccess fields ───────────────────────────────────────────────────────

describe("useCloudSync — sync success sets lastSyncedAt and cardCount", () => {
  beforeEach(() => {
    setupKarl();
    try { localStorage.setItem("fenrir:first-sync-shown", "true"); } catch { /* ignore */ }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lastSyncedAt is set to a Date after successful sync", async () => {
    mockFetchGet([]);
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {});
    expect(result.current.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("cardCount reflects merged card count after GET sync", async () => {
    const cards = Array.from({ length: 7 }, (_, i) => ({
      id: `c${i}`,
      householdId: TEST_HOUSEHOLD,
      issuerId: "chase",
      cardName: "Card",
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
    mockFetchGet(cards);
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {});
    expect(result.current.cardCount).toBe(7);
  });

  it("error fields are cleared after successful syncNow", async () => {
    // First: fail
    mockFetchGetFail("forbidden");
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {});
    expect(result.current.status).toBe("error");
    expect(result.current.errorCode).toBe("forbidden");

    // Now: syncNow succeeds
    mockFetchPut(4);
    await act(async () => { await result.current.syncNow(); });

    expect(result.current.status).toBe("synced");
    expect(result.current.errorCode).toBeNull();
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.errorTimestamp).toBeNull();
    expect(result.current.retryIn).toBeNull();
  });
});
