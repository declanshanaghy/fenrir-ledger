/**
 * Issue #1796 — useCloudSync must use getEffectiveHouseholdId, not session.user.sub
 *
 * After a user joins a household, their session.user.sub remains their Google sub
 * but the effective householdId (stored in "fenrir:householdId") changes to the
 * owner's household ID. The sync hook MUST use the effective value so cards are
 * read/written under the correct localStorage key and the correct householdId is
 * sent in the push/pull request body.
 *
 * Gap not covered by existing tests: the other tests mock getEffectiveHouseholdId
 * to return the fallback (solo user path). These tests exercise the joined-user
 * path where getEffectiveHouseholdId returns a DIFFERENT value than session.user.sub.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloudSync } from "@/hooks/useCloudSync";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockEntitlement = { tier: "karl" as string, isActive: true };

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => mockEntitlement,
}));

const mockAuthContext = { status: "authenticated" as string };

vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => mockAuthContext,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Session sub is the user's Google sub — NOT the joined household ID.
const SOLO_SUB = "solo-user-sub-113951470530790749685";
const JOINED_HH_ID = "joined-household-id-110414050811994350775";

vi.mock("@/lib/auth/session", () => ({
  getSession: () => ({
    id_token: "tok-1796",
    user: { sub: SOLO_SUB },
  }),
}));

// getEffectiveHouseholdId returns JOINED_HH_ID — user has already joined.
// Note: mockReturnValue is set in beforeEach since JOINED_HH_ID is not available at hoist time.
const mockGetEffectiveHouseholdId = vi.hoisted(() => vi.fn<[string], string>());
const mockGetRawAllCards = vi.hoisted(() => vi.fn().mockReturnValue([]));
const mockSetAllCards = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage", () => ({
  getEffectiveHouseholdId: (fallback: string) => mockGetEffectiveHouseholdId(fallback),
  getRawAllCards: (...args: unknown[]) => mockGetRawAllCards(...args),
  setAllCards: (...args: unknown[]) => mockSetAllCards(...args),
  // Issue #2005: needs-upload flag helpers — no pending upload in base tests
  getNeedsUpload: vi.fn().mockReturnValue(false),
  clearNeedsUpload: vi.fn(),
}));

vi.mock("@/lib/sync/migration", () => ({
  hasMigrated: () => true,
  runMigration: vi.fn(),
  MIGRATION_FLAG: "fenrir:migrated",
}));

// Issue #1925: ensureFreshToken reads id_token from localStorage dynamically.
// authFetch mirrors real behavior — injects Authorization header from session token.
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function makePushResponse(cards: unknown[] = [], syncedCount = 0) {
  return Promise.resolve(
    new Response(JSON.stringify({ cards, syncedCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

/**
 * Set session AFTER hook renders to avoid the login-transition pull
 * acquiring the syncInProgressRef lock before syncNow() is called.
 * The same pattern is used in the regression tests (no session on mount,
 * session set only when the specific fetch is expected).
 */
function setSession() {
  localStorage.setItem(
    "fenrir:auth",
    JSON.stringify({ id_token: "tok-1796", user: { sub: SOLO_SUB } })
  );
  localStorage.setItem("fenrir:migrated", "true");
}

function clearSession() {
  localStorage.removeItem("fenrir:auth");
  localStorage.removeItem("fenrir:migrated");
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useCloudSync — uses getEffectiveHouseholdId after join (#1796)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    // No session set here — avoids login-transition pull holding the lock.
    // Session is written in each test just before syncNow() is called.
    vi.stubGlobal("fetch", mockFetch);
    // Use mockImplementation so each fetch call (state check + push) gets a fresh
    // Response with unconsumed body. (#2006 — performSync now pre-checks sync state)
    mockFetch.mockImplementation(() => makePushResponse());
    mockGetEffectiveHouseholdId.mockReturnValue(JOINED_HH_ID);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearSession();
  });

  it("calls getEffectiveHouseholdId with session.user.sub as fallback", async () => {
    const { result } = renderHook(() => useCloudSync());
    setSession(); // set AFTER render so login-transition doesn't hold the lock
    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockGetEffectiveHouseholdId).toHaveBeenCalledWith(SOLO_SUB);
  });

  it("sends the joined householdId (not the solo sub) in the push request body", async () => {
    const { result } = renderHook(() => useCloudSync());
    setSession();
    await act(async () => {
      await result.current.syncNow();
    });

    const postCalls = (mockFetch.mock.calls as [string, RequestInit][]).filter(
      ([_url, init]) => init?.method === "POST"
    );
    expect(postCalls.length).toBeGreaterThan(0);

    const [, init] = postCalls[0]!;
    const body = JSON.parse(init?.body as string) as { householdId: string };

    // Must be the joined household ID, NOT the solo sub
    expect(body.householdId).toBe(JOINED_HH_ID);
    expect(body.householdId).not.toBe(SOLO_SUB);
  });

  it("reads cards from the joined household localStorage key", async () => {
    const { result } = renderHook(() => useCloudSync());
    setSession();
    await act(async () => {
      await result.current.syncNow();
    });

    // getRawAllCards must be called with the joined household ID (not sub)
    expect(mockGetRawAllCards).toHaveBeenCalledWith(JOINED_HH_ID);
    expect(mockGetRawAllCards).not.toHaveBeenCalledWith(SOLO_SUB);
  });

  it("writes merged cards back to the joined household localStorage key", async () => {
    // Use mockImplementation so each fetch call (state check + push) gets a fresh
    // Response with an unconsumed body. (#2006 — performSync now calls state check first)
    mockFetch.mockImplementation(() =>
      makePushResponse([{ id: "card-1", householdId: JOINED_HH_ID }], 1)
    );

    const { result } = renderHook(() => useCloudSync());
    setSession();
    await act(async () => {
      await result.current.syncNow();
    });

    expect(mockSetAllCards).toHaveBeenCalledWith(
      JOINED_HH_ID,
      expect.any(Array)
    );
    // Must NOT write under the old solo sub key
    expect(mockSetAllCards).not.toHaveBeenCalledWith(
      SOLO_SUB,
      expect.any(Array)
    );
  });
});
