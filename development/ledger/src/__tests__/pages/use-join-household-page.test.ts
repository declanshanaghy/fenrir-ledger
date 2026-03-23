/**
 * Vitest tests for useJoinHouseholdPage hook
 * (src/app/ledger/join/useJoinHouseholdPage.ts)
 *
 * Covers: initial state, validateCode branches, input handlers,
 * handleConfirmJoin branches.
 * Issue #1685
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useJoinHouseholdPage } from "@/app/ledger/join/useJoinHouseholdPage";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn().mockResolvedValue("mock-token"),
}));

const mockRefreshEntitlement = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({ refreshEntitlement: mockRefreshEntitlement }),
}));

const mockClearEntitlementCache = vi.hoisted(() => vi.fn());
vi.mock("@/lib/entitlement/cache", () => ({
  clearEntitlementCache: mockClearEntitlementCache,
}));

const mockPreview = {
  householdId: "hh-1",
  householdName: "Valhalla",
  memberCount: 1,
  members: [{ displayName: "Odin", email: "odin@asgard.com", role: "owner" }],
  userCardCount: 2,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fillChars(result: ReturnType<typeof renderHook<ReturnType<typeof useJoinHouseholdPage>, unknown>>["result"]) {
  for (let i = 0; i < 6; i++) {
    act(() => {
      result.current.handleCharChange(i, "A");
    });
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useJoinHouseholdPage — initial state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with empty chars and idle validation", () => {
    const { result } = renderHook(() => useJoinHouseholdPage());
    expect(result.current.chars).toHaveLength(6);
    expect(result.current.chars.every((c) => c === "")).toBe(true);
    expect(result.current.validationStatus).toBe("idle");
    expect(result.current.step).toBe("code");
    expect(result.current.preview).toBeNull();
  });

  it("isComplete is false when chars are empty", () => {
    const { result } = renderHook(() => useJoinHouseholdPage());
    expect(result.current.isComplete).toBe(false);
  });

  it("isComplete is true when all 6 chars are filled", () => {
    const { result } = renderHook(() => useJoinHouseholdPage());
    fillChars(result);
    expect(result.current.isComplete).toBe(true);
  });
});

describe("useJoinHouseholdPage — validateCode via handleCharChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  it("sets validationStatus to 'valid' on 200 response", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockPreview });

    const { result } = renderHook(() => useJoinHouseholdPage());
    fillChars(result);

    await waitFor(() => {
      expect(result.current.validationStatus).toBe("valid");
    });
    expect(result.current.preview).toEqual(mockPreview);
  });

  it("sets validationStatus to 'invalid' on 404", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });

    const { result } = renderHook(() => useJoinHouseholdPage());
    fillChars(result);

    await waitFor(() => {
      expect(result.current.validationStatus).toBe("invalid");
    });
  });

  it("sets validationStatus to 'expired' on 410", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 410, json: async () => ({}) });

    const { result } = renderHook(() => useJoinHouseholdPage());
    fillChars(result);

    await waitFor(() => {
      expect(result.current.validationStatus).toBe("expired");
    });
  });

  it("sets validationStatus to 'full' on 409 household_full", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "household_full" }),
    });

    const { result } = renderHook(() => useJoinHouseholdPage());
    fillChars(result);

    await waitFor(() => {
      expect(result.current.validationStatus).toBe("full");
    });
  });

  it("sets validationStatus to 'already_member' on 409 already_in_household", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "already_in_household" }),
    });

    const { result } = renderHook(() => useJoinHouseholdPage());
    fillChars(result);

    await waitFor(() => {
      expect(result.current.validationStatus).toBe("already_member");
    });
  });

  it("sets validationStatus to 'network_error' on fetch throw", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() => useJoinHouseholdPage());
    fillChars(result);

    await waitFor(() => {
      expect(result.current.validationStatus).toBe("network_error");
    });
  });

  it("sets validationStatus to 'network_error' when token is null", async () => {
    const { ensureFreshToken } = await import("@/lib/auth/refresh-session");
    vi.mocked(ensureFreshToken).mockResolvedValueOnce(null as unknown as string);

    const { result } = renderHook(() => useJoinHouseholdPage());
    fillChars(result);

    await waitFor(() => {
      expect(result.current.validationStatus).toBe("network_error");
    });
  });
});

describe("useJoinHouseholdPage — input handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handleCharChange advances focus and updates chars", () => {
    const { result } = renderHook(() => useJoinHouseholdPage());
    act(() => {
      result.current.handleCharChange(0, "X");
    });
    expect(result.current.chars[0]).toBe("X");
    expect(result.current.validationStatus).toBe("idle");
  });

  it("handleBackspace clears current char", () => {
    const { result } = renderHook(() => useJoinHouseholdPage());
    act(() => result.current.handleCharChange(0, "Z"));
    act(() => result.current.handleBackspace(0));
    expect(result.current.chars[0]).toBe("");
  });

  it("handlePaste fills chars from pasted text", () => {
    const { result } = renderHook(() => useJoinHouseholdPage());
    act(() => {
      result.current.handlePaste("ABC123");
    });
    expect(result.current.chars).toEqual(["A", "B", "C", "1", "2", "3"]);
  });

  it("handlePaste ignores non-alphanumeric characters", () => {
    const { result } = renderHook(() => useJoinHouseholdPage());
    act(() => {
      result.current.handlePaste("A-B-C-1-2-3");
    });
    expect(result.current.chars).toEqual(["A", "B", "C", "1", "2", "3"]);
  });

  it("handlePaste ignores empty strings", () => {
    const { result } = renderHook(() => useJoinHouseholdPage());
    act(() => {
      result.current.handlePaste("---");
    });
    expect(result.current.chars.every((c) => c === "")).toBe(true);
  });

  it("handleClearAndRetry resets chars and validation", () => {
    const { result } = renderHook(() => useJoinHouseholdPage());
    fillChars(result);
    act(() => result.current.handleClearAndRetry());
    expect(result.current.chars.every((c) => c === "")).toBe(true);
    expect(result.current.validationStatus).toBe("idle");
    expect(result.current.preview).toBeNull();
  });
});

describe("useJoinHouseholdPage — handleConfirmJoin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockRefreshEntitlement.mockResolvedValue(undefined);
    mockClearEntitlementCache.mockClear();
  });

  async function setupWithPreview() {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockPreview });

    const { result } = renderHook(() => useJoinHouseholdPage());
    fillChars(result);
    await waitFor(() => expect(result.current.validationStatus).toBe("valid"));
    return result;
  }

  it("transitions to 'success' on successful join", async () => {
    const result = await setupWithPreview();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        householdId: "hh-1",
        householdName: "Valhalla",
        movedCardCount: 2,
      }),
    });

    await act(async () => {
      await result.current.handleConfirmJoin();
    });

    expect(result.current.step).toBe("success");
    expect(result.current.cardsMerged).toBe(2);
    expect(result.current.householdName).toBe("Valhalla");
  });

  it("transitions to 'race_full' on 409 during join", async () => {
    const result = await setupWithPreview();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({}),
    });

    await act(async () => {
      await result.current.handleConfirmJoin();
    });

    expect(result.current.step).toBe("race_full");
  });

  it("transitions to 'merge_error' on non-409 failure", async () => {
    const result = await setupWithPreview();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await act(async () => {
      await result.current.handleConfirmJoin();
    });

    expect(result.current.step).toBe("merge_error");
    expect(result.current.mergeError).toMatch(/merge failed/i);
  });

  it("transitions to 'merge_error' on network throw", async () => {
    const result = await setupWithPreview();

    global.fetch = vi.fn().mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await result.current.handleConfirmJoin();
    });

    expect(result.current.step).toBe("merge_error");
    expect(result.current.mergeError).toMatch(/connection error/i);
  });

  it("transitions to 'merge_error' when token is null", async () => {
    const result = await setupWithPreview();

    const { ensureFreshToken } = await import("@/lib/auth/refresh-session");
    vi.mocked(ensureFreshToken).mockResolvedValueOnce(null as unknown as string);

    await act(async () => {
      await result.current.handleConfirmJoin();
    });

    expect(result.current.step).toBe("merge_error");
    expect(result.current.mergeError).toMatch(/authentication error/i);
  });
});

// Issue #1823 — stale isKarl after joining a Karl household
// After a successful join the entitlement cache must be cleared and
// refreshEntitlement() called so isKarl transitions true before the /ledger
// redirect fires (router.push is client-side; EntitlementContext stays mounted).
describe("useJoinHouseholdPage — entitlement refresh on join success (#1823)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
    mockRefreshEntitlement.mockResolvedValue(undefined);
    mockClearEntitlementCache.mockClear();
  });

  async function setupWithPreview() {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockPreview });

    const { result } = renderHook(() => useJoinHouseholdPage());
    fillChars(result);
    await waitFor(() => expect(result.current.validationStatus).toBe("valid"));
    return result;
  }

  it("clears entitlement cache after successful join", async () => {
    const result = await setupWithPreview();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        householdId: "hh-karl",
        householdName: "Valhalla",
        movedCardCount: 3,
      }),
    });

    await act(async () => {
      await result.current.handleConfirmJoin();
    });

    expect(result.current.step).toBe("success");
    expect(mockClearEntitlementCache).toHaveBeenCalledTimes(1);
  });

  it("calls refreshEntitlement after successful join", async () => {
    const result = await setupWithPreview();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        householdId: "hh-karl",
        householdName: "Valhalla",
        movedCardCount: 3,
      }),
    });

    await act(async () => {
      await result.current.handleConfirmJoin();
    });

    expect(result.current.step).toBe("success");
    expect(mockRefreshEntitlement).toHaveBeenCalledTimes(1);
  });

  it("does NOT refresh entitlement or clear cache on join failure (409)", async () => {
    const result = await setupWithPreview();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({}),
    });

    await act(async () => {
      await result.current.handleConfirmJoin();
    });

    expect(result.current.step).toBe("race_full");
    expect(mockClearEntitlementCache).not.toHaveBeenCalled();
    expect(mockRefreshEntitlement).not.toHaveBeenCalled();
  });

  it("does NOT refresh entitlement or clear cache on join failure (500)", async () => {
    const result = await setupWithPreview();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await act(async () => {
      await result.current.handleConfirmJoin();
    });

    expect(result.current.step).toBe("merge_error");
    expect(mockClearEntitlementCache).not.toHaveBeenCalled();
    expect(mockRefreshEntitlement).not.toHaveBeenCalled();
  });
});
