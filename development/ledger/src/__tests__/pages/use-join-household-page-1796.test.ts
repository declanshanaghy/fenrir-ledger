/**
 * Issue #1796 — localStorage migration on household join.
 *
 * Tests that handleConfirmJoin, on a successful join response:
 *   1. Clears the old solo household's localStorage keys (cards + household).
 *   2. Stores the new householdId in "fenrir:householdId".
 *
 * On failure it must NOT clear any keys (user's cards stay intact).
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useJoinHouseholdPage } from "@/app/ledger/join/useJoinHouseholdPage";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn().mockResolvedValue("mock-token"),
}));

const SOLO_SUB = "user-solo-google-sub";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(() => ({
    id_token: "mock-id-token",
    access_token: "mock-access-token",
    expires_at: Date.now() + 3600_000,
    user: { sub: SOLO_SUB, email: "solo@example.com", name: "Solo", picture: "" },
  })),
}));

const mockClearHouseholdLocalStorage = vi.hoisted(() => vi.fn());
const mockSetStoredHouseholdId = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage", () => ({
  clearHouseholdLocalStorage: (...args: unknown[]) => mockClearHouseholdLocalStorage(...args),
  setStoredHouseholdId: (...args: unknown[]) => mockSetStoredHouseholdId(...args),
  // Unused by this hook but imported transitively — provide no-ops.
  getEffectiveHouseholdId: (fallback: string) => fallback,
  getRawAllCards: () => [],
  setAllCards: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const mockPreview = {
  householdId: "hh-target",
  householdName: "Valhalla",
  memberCount: 1,
  members: [{ displayName: "Odin", email: "odin@asgard.com", role: "owner" }],
  userCardCount: 2,
  targetHouseholdCardCount: 4,
};

function fillChars(
  result: ReturnType<typeof renderHook<ReturnType<typeof useJoinHouseholdPage>, unknown>>["result"]
) {
  for (let i = 0; i < 6; i++) {
    act(() => {
      result.current.handleCharChange(i, "A");
    });
  }
}

async function setupWithPreview() {
  global.fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => mockPreview });

  const { result } = renderHook(() => useJoinHouseholdPage());
  fillChars(result);
  await waitFor(() => expect(result.current.validationStatus).toBe("valid"));
  return result;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useJoinHouseholdPage — localStorage migration on join (#1796)", () => {
  it("clears old solo storage after successful join", async () => {
    const result = await setupWithPreview();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        householdId: "hh-target",
        householdName: "Valhalla",
        movedCardCount: 3,
      }),
    });

    await act(async () => {
      await result.current.handleConfirmJoin();
    });

    expect(mockClearHouseholdLocalStorage).toHaveBeenCalledOnce();
    expect(mockClearHouseholdLocalStorage).toHaveBeenCalledWith(SOLO_SUB);
  });

  it("stores the new householdId after successful join", async () => {
    const result = await setupWithPreview();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        householdId: "hh-target",
        householdName: "Valhalla",
        movedCardCount: 3,
      }),
    });

    await act(async () => {
      await result.current.handleConfirmJoin();
    });

    expect(mockSetStoredHouseholdId).toHaveBeenCalledOnce();
    expect(mockSetStoredHouseholdId).toHaveBeenCalledWith("hh-target");
  });

  it("does NOT clear storage on join failure (cards remain safe)", async () => {
    const result = await setupWithPreview();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await act(async () => {
      await result.current.handleConfirmJoin();
    });

    expect(mockClearHouseholdLocalStorage).not.toHaveBeenCalled();
    expect(mockSetStoredHouseholdId).not.toHaveBeenCalled();
  });

  it("does NOT clear storage on network error", async () => {
    const result = await setupWithPreview();

    global.fetch = vi.fn().mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await result.current.handleConfirmJoin();
    });

    expect(mockClearHouseholdLocalStorage).not.toHaveBeenCalled();
    expect(mockSetStoredHouseholdId).not.toHaveBeenCalled();
  });

  it("does NOT clear storage on 409 race condition", async () => {
    const result = await setupWithPreview();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({}),
    });

    await act(async () => {
      await result.current.handleConfirmJoin();
    });

    expect(mockClearHouseholdLocalStorage).not.toHaveBeenCalled();
    expect(mockSetStoredHouseholdId).not.toHaveBeenCalled();
  });
});
