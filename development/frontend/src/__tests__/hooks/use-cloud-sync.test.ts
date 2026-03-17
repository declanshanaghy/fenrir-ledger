/**
 * useCloudSync — unit tests
 *
 * Tests the cloud sync hook state machine with real API calls:
 *   - Thrall users always stay idle (no API calls)
 *   - Karl users pull from Firestore on mount
 *   - syncNow() pushes to Firestore
 *   - Background sync on fenrir:cards-changed (debounced)
 *   - Error state + dismissError → idle
 *   - First-sync toast guarded by localStorage key
 *
 * Issue #1119
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSync, SYNCED_DISPLAY_MS, EVT_CARDS_CHANGED } from "@/hooks/useCloudSync";
import type { Card } from "@/lib/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

const mockGetSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getSession: () => mockGetSession(),
}));

const mockGetCards = vi.fn<[string], Card[]>();
const mockSetAllCards = vi.fn();
vi.mock("@/lib/storage", () => ({
  getCards: (hid: string) => mockGetCards(hid),
  setAllCards: (hid: string, cards: Card[]) => mockSetAllCards(hid, cards),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_HOUSEHOLD = "test-household-id";

function mockFetchGet(cards: Card[] = []) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      householdId: TEST_HOUSEHOLD,
      cards,
      syncedAt: new Date().toISOString(),
    }),
  } as Response);
}

function mockFetchGetError(errorCode = "forbidden") {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ error: errorCode }),
  } as Response);
}

function mockFetchPut(written = 5) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      householdId: TEST_HOUSEHOLD,
      written,
      skipped: 0,
      syncedAt: new Date().toISOString(),
    }),
  } as Response);
}

function makeTestCard(id: string, updatedAt?: string): Card {
  return {
    id,
    householdId: TEST_HOUSEHOLD,
    issuerId: "chase",
    cardName: "Test Card",
    openDate: "2025-01-01T00:00:00.000Z",
    creditLimit: 500000,
    annualFee: 9500,
    annualFeeDate: "2026-01-01T00:00:00.000Z",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: updatedAt ?? "2025-01-01T00:00:00.000Z",
  };
}

function setupKarlDefaults() {
  mockEnsureFreshToken.mockResolvedValue("test-id-token");
  mockGetSession.mockReturnValue({ user: { sub: TEST_HOUSEHOLD } });
  mockGetCards.mockReturnValue([]);
  mockSetAllCards.mockReturnValue(undefined);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useCloudSync — Thrall: always idle", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = false;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("idle");
  });

  it("never calls fetch (no sync for Thrall)", async () => {
    renderHook(() => useCloudSync());
    await act(async () => {});
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("syncNow() is a no-op for Thrall", async () => {
    const { result } = renderHook(() => useCloudSync());
    await act(async () => { await result.current.syncNow(); });
    expect(result.current.status).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("ignores fenrir:cards-changed event", async () => {
    vi.useFakeTimers();
    renderHook(() => useCloudSync());
    act(() => {
      window.dispatchEvent(
        new CustomEvent(EVT_CARDS_CHANGED, { detail: { householdId: TEST_HOUSEHOLD } })
      );
    });
    act(() => vi.advanceTimersByTime(3000));
    expect(global.fetch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("useCloudSync — Karl: on-mount pull from Firestore", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = true;
    setupKarlDefaults();
    try { localStorage.removeItem("fenrir:first-sync-shown"); } catch { /* ignore */ }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls GET /api/sync on mount and transitions to synced", async () => {
    const firestoreCards = [makeTestCard("card-1")];
    mockFetchGet(firestoreCards);

    const { result } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("syncing");

    await act(async () => {});
    expect(result.current.status).toBe("synced");
    expect(result.current.cardCount).toBe(1);
    expect(result.current.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("calls GET /api/sync with correct Authorization header", async () => {
    mockFetchGet([]);
    renderHook(() => useCloudSync());
    await act(async () => {});

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/sync",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-id-token",
        }),
      })
    );
  });

  it("merges Firestore cards with localStorage (last-write-wins)", async () => {
    const older = makeTestCard("shared-card", "2025-01-01T00:00:00.000Z");
    const newer = makeTestCard("shared-card", "2025-06-01T00:00:00.000Z");
    const localOnly = makeTestCard("local-only");

    // Firestore has an older version; local has the newer version + a local-only card
    mockFetchGet([older]);
    mockGetCards.mockReturnValue([newer, localOnly]);

    const { result } = renderHook(() => useCloudSync());
    await act(async () => {});

    expect(result.current.status).toBe("synced");
    // setAllCards should be called with the merged result
    expect(mockSetAllCards).toHaveBeenCalledWith(
      TEST_HOUSEHOLD,
      expect.arrayContaining([
        expect.objectContaining({ id: "shared-card", updatedAt: "2025-06-01T00:00:00.000Z" }),
        expect.objectContaining({ id: "local-only" }),
      ])
    );
  });

  it("transitions to error state when GET /api/sync fails", async () => {
    mockFetchGetError("forbidden");
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {});

    expect(result.current.status).toBe("error");
    expect(result.current.errorCode).toBe("forbidden");
    expect(result.current.errorTimestamp).toBeInstanceOf(Date);
  });

  it("transitions to error when no auth token available", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {});

    expect(result.current.status).toBe("error");
  });

  it("shows first-sync toast on successful initial sync with cards", async () => {
    const { toast } = await import("sonner");
    mockFetchGet([makeTestCard("c1"), makeTestCard("c2")]);

    const { result } = renderHook(() => useCloudSync());
    await act(async () => {});

    expect(result.current.status).toBe("synced");
    expect(toast.success).toHaveBeenCalledWith(
      "Your 2 cards have been backed up",
      expect.objectContaining({ duration: 5000 })
    );
  });

  it("does not show first-sync toast if already shown before", async () => {
    const { toast } = await import("sonner");
    try { localStorage.setItem("fenrir:first-sync-shown", "true"); } catch { /* ignore */ }
    mockFetchGet([makeTestCard("c1")]);

    renderHook(() => useCloudSync());
    await act(async () => {});

    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("useCloudSync — Karl: syncNow()", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = true;
    setupKarlDefaults();
    try { localStorage.removeItem("fenrir:first-sync-shown"); } catch { /* ignore */ }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("syncNow() calls PUT /api/sync and transitions to synced", async () => {
    // Initial mount: GET fails (don't care about it for this test)
    mockFetchGetError();
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {});
    expect(result.current.status).toBe("error");

    // Now test syncNow() with a working PUT
    mockFetchPut(3);
    await act(async () => { await result.current.syncNow(); });
    expect(result.current.status).toBe("synced");
    expect(result.current.cardCount).toBe(3);
  });

  it("syncNow() sends cards from localStorage in PUT body", async () => {
    mockFetchGetError();
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {});

    const localCards = [makeTestCard("card-a"), makeTestCard("card-b")];
    mockGetCards.mockReturnValue(localCards);
    mockFetchPut(2);

    await act(async () => { await result.current.syncNow(); });

    const putCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[1] as RequestInit)?.method === "PUT"
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall![1] as RequestInit).body as string) as { cards: Card[] };
    expect(body.cards).toHaveLength(2);
  });

  it("syncNow() while syncing does not change status away from syncing", async () => {
    // Use a fetch that never resolves so isSyncingRef stays true
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useCloudSync());
    expect(result.current.status).toBe("syncing");
    // Calling syncNow while already syncing should not error and status stays syncing
    await act(async () => { await result.current.syncNow(); });
    expect(result.current.status).toBe("syncing");
  });

  it("syncNow() sets error state when PUT fails", async () => {
    mockFetchGetError();
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {});

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "server_error" }),
    } as Response);

    await act(async () => { await result.current.syncNow(); });
    expect(result.current.status).toBe("error");
  });
});

describe("useCloudSync — Karl: error + dismissError", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = true;
    setupKarlDefaults();
    mockFetchGetError("forbidden");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("dismissError() clears error → idle", async () => {
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {});
    expect(result.current.status).toBe("error");

    act(() => result.current.dismissError());
    expect(result.current.status).toBe("idle");
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.errorCode).toBeNull();
    expect(result.current.errorTimestamp).toBeNull();
  });

  it("dismissError() is no-op when not in error state", async () => {
    mockFetchGet([]);
    const { result } = renderHook(() => useCloudSync());
    await act(async () => {});
    expect(result.current.status).toBe("synced");

    act(() => result.current.dismissError());
    expect(result.current.status).toBe("synced");
  });
});

describe("useCloudSync — synced → idle auto-transition", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = true;
    setupKarlDefaults();
    mockFetchGet([]);
    try { localStorage.setItem("fenrir:first-sync-shown", "true"); } catch { /* ignore */ }
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("transitions synced → idle after SYNCED_DISPLAY_MS", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useCloudSync());

    // Resolve the pending fetch
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.status).toBe("synced");

    act(() => vi.advanceTimersByTime(SYNCED_DISPLAY_MS + 100));
    expect(result.current.status).toBe("idle");
  });
});

describe("useCloudSync — background sync on card changes", () => {
  beforeEach(() => {
    mockIsKarlOrTrial.value = true;
    setupKarlDefaults();
    // Initial mount GET
    mockFetchGet([]);
    try { localStorage.setItem("fenrir:first-sync-shown", "true"); } catch { /* ignore */ }
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("debounces PUT after fenrir:cards-changed event", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetchGet([]);
    const { result } = renderHook(() => useCloudSync());

    // Wait for initial mount GET to settle
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    // Set up PUT mock
    mockFetchPut(2);

    act(() => {
      window.dispatchEvent(
        new CustomEvent(EVT_CARDS_CHANGED, { detail: { householdId: TEST_HOUSEHOLD } })
      );
    });

    // Before debounce fires, no PUT yet
    expect(result.current.status).not.toBe("syncing");

    // Advance past the 2-second debounce
    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
    });

    // Should have called PUT
    const putCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => (c[1] as RequestInit)?.method === "PUT"
    );
    expect(putCalls.length).toBeGreaterThanOrEqual(1);
  });
});
