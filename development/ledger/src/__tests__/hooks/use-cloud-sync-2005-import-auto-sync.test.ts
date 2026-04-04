/**
 * useCloudSync — Issue #2005: Import auto-sync
 *
 * Tests for:
 *   1. fenrir:cards-bulk-changed listener → immediate performSync (no debounce)
 *   2. On-mount needs-upload check → sync if flag is set when isKarl becomes true
 *   3. clearNeedsUpload() called after successful push
 *   4. AUTO_SYNC_DEBOUNCE_MS reduced to 2_000 (from 10_000)
 *   5. EVT_CARDS_BULK_CHANGED constant exported
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useCloudSync,
  AUTO_SYNC_DEBOUNCE_MS,
  EVT_CARDS_BULK_CHANGED,
} from "@/hooks/useCloudSync";

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

// Controllable getNeedsUpload so individual tests can simulate a pending upload
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useCloudSync — Issue #2005: AUTO_SYNC_DEBOUNCE_MS", () => {
  it("is 2_000 (reduced from 10_000)", () => {
    expect(AUTO_SYNC_DEBOUNCE_MS).toBe(2_000);
  });

  it("EVT_CARDS_BULK_CHANGED is 'fenrir:cards-bulk-changed'", () => {
    expect(EVT_CARDS_BULK_CHANGED).toBe("fenrir:cards-bulk-changed");
  });
});

describe("useCloudSync — Issue #2005: fenrir:cards-bulk-changed listener", () => {
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
  });

  it("dispatching fenrir:cards-bulk-changed triggers immediate performSync", async () => {
    setSession();
    mockFetch.mockReturnValue(successResponse(3));
    const { result } = renderHook(() => useCloudSync());

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("fenrir:cards-bulk-changed", { detail: { householdId: "hh-test" } })
      );
    });

    expect(result.current.status).toBe("synced");
    expect(mockFetch).toHaveBeenCalled();
  });

  it("bulk-changed cancels pending debounced sync and fires immediately", async () => {
    vi.useFakeTimers();
    setSession();
    mockFetch.mockReturnValue(successResponse(1));
    const { result } = renderHook(() => useCloudSync());

    // Trigger a regular debounced change
    act(() => {
      window.dispatchEvent(new CustomEvent("fenrir:cards-changed", { detail: { householdId: "hh-test" } }));
    });

    // Before the 2s debounce fires, fire bulk-changed (should cancel debounce + sync now)
    await act(async () => {
      window.dispatchEvent(new CustomEvent("fenrir:cards-bulk-changed", { detail: { householdId: "hh-test" } }));
    });

    expect(result.current.status).toBe("synced");
    // Only one fetch call — debounce was cancelled
    expect(mockFetch).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("bulk-changed is no-op for Thrall users", async () => {
    mockEntitlement.tier = "thrall";
    mockEntitlement.isActive = false;
    setSession();
    const { result } = renderHook(() => useCloudSync());

    await act(async () => {
      window.dispatchEvent(new CustomEvent("fenrir:cards-bulk-changed", { detail: { householdId: "hh-test" } }));
    });

    expect(result.current.status).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("useCloudSync — Issue #2005: on-mount needs-upload check", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockEntitlement.tier = "karl";
    mockEntitlement.isActive = true;
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReturnValue(hangingFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
    mockGetNeedsUpload.mockReturnValue(false);
  });

  it("triggers sync on mount when getNeedsUpload() is true", async () => {
    setSession();
    mockGetNeedsUpload.mockReturnValue(true);
    mockFetch.mockReturnValue(successResponse(2));

    const { result } = renderHook(() => useCloudSync());
    // Wait for the mount effect to fire
    await act(async () => {});

    expect(result.current.status).toBe("synced");
    expect(mockFetch).toHaveBeenCalled();
  });

  it("does NOT trigger sync on mount when getNeedsUpload() is false", () => {
    mockGetNeedsUpload.mockReturnValue(false);
    // No session — if performSync is called anyway, it returns early at session check,
    // but fetch should NOT have been called at all.
    renderHook(() => useCloudSync());
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("useCloudSync — Issue #2005: clearNeedsUpload after successful push", () => {
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
    mockClearNeedsUpload.mockClear();
  });

  it("calls clearNeedsUpload after a successful sync", async () => {
    mockFetch.mockReturnValue(successResponse(4));
    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("synced");
    expect(mockClearNeedsUpload).toHaveBeenCalled();
  });

  it("does NOT call clearNeedsUpload on sync failure", async () => {
    mockFetch.mockReturnValue(
      Promise.resolve(
        new Response(JSON.stringify({ error: "err", error_description: "err" }), { status: 500 })
      )
    );
    const { result } = renderHook(() => useCloudSync());
    setSession();

    await act(async () => {
      await result.current.syncNow();
    });

    expect(result.current.status).toBe("error");
    expect(mockClearNeedsUpload).not.toHaveBeenCalled();
  });
});
