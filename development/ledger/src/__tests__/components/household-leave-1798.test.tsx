/**
 * HouseholdSettingsSection — Leave Household UI tests
 *
 * Validates issue #1798 acceptance criteria from the component perspective:
 *   - Leave Household button visible only to members (not owners)
 *   - Two-step confirmation dialog: warning + Confirm Leave / Cancel
 *   - On success: clears card cache, redirects to /ledger
 *   - On API error: shows error message, stays on page
 *   - Cancel dismisses the confirm dialog without leaving
 *   - Unauthenticated state shows locked view
 *
 * Issue #1798 — Re-create solo household when member leaves a household
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { HouseholdSettingsSection } from "@/components/household/HouseholdSettingsSection";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockEnsureFreshToken = vi.fn();
vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
}));

const mockGetSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getSession: () => mockGetSession(),
}));

const mockSetAllCards = vi.fn();
vi.mock("@/lib/storage", () => ({
  setAllCards: (...args: unknown[]) => mockSetAllCards(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER_USER_ID = "user_member_111";
const OWNER_USER_ID = "user_owner_222";
const HOUSEHOLD_ID = "household_abc";

const MEMBER_HOUSEHOLD_DATA = {
  householdId: HOUSEHOLD_ID,
  householdName: "The Test Household",
  ownerId: OWNER_USER_ID,
  memberCount: 2,
  maxMembers: 3,
  isSolo: false,
  isFull: false,
  isOwner: false,
  isKarl: false,
  members: [
    {
      userId: OWNER_USER_ID,
      displayName: "Ragnar",
      email: "ragnar@example.com",
      role: "owner" as const,
      isCurrentUser: false,
    },
    {
      userId: MEMBER_USER_ID,
      displayName: "Sigrid",
      email: "sigrid@example.com",
      role: "member" as const,
      isCurrentUser: true,
    },
  ],
};

const OWNER_HOUSEHOLD_DATA = {
  ...MEMBER_HOUSEHOLD_DATA,
  isOwner: true,
  ownerId: OWNER_USER_ID,
};

// ── Fetch helpers ──────────────────────────────────────────────────────────────

/** Configure mockFetch to handle members endpoint with optional leave endpoint override */
function setupFetch({
  membersData = MEMBER_HOUSEHOLD_DATA,
  leaveOk = true,
  leaveStatus = 200,
  leaveBody = { success: true, newHouseholdId: MEMBER_USER_ID },
}: {
  membersData?: typeof MEMBER_HOUSEHOLD_DATA;
  leaveOk?: boolean;
  leaveStatus?: number;
  leaveBody?: Record<string, unknown>;
} = {}) {
  mockFetch.mockImplementation((url: string) => {
    if (String(url).includes("/api/household/members")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(membersData),
      });
    }
    if (String(url).includes("/api/household/leave")) {
      return Promise.resolve({
        ok: leaveOk,
        status: leaveStatus,
        json: () => Promise.resolve(leaveBody),
      });
    }
    return Promise.reject(new Error("unexpected fetch: " + url));
  });
}

// ── Render helpers ─────────────────────────────────────────────────────────────

/** Render the section and wait until the Leave Household button is visible */
async function renderMemberView() {
  const utils = render(<HouseholdSettingsSection />);
  await waitFor(() => screen.getByRole("button", { name: /leave.*household/i }));
  return utils;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("HouseholdSettingsSection — Leave Household (issue #1798)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureFreshToken.mockResolvedValue("token-abc");
    mockGetSession.mockReturnValue({ user: { sub: MEMBER_USER_ID } });
    // Default: member view, leave succeeds
    setupFetch();
  });

  // ── Visibility ──────────────────────────────────────────────────────────────

  it("shows Leave Household button for members (not owners)", async () => {
    await renderMemberView();
    expect(screen.getByRole("button", { name: /leave.*household/i })).toBeDefined();
  });

  it("does NOT show Leave Household button for owners", async () => {
    setupFetch({ membersData: OWNER_HOUSEHOLD_DATA });
    render(<HouseholdSettingsSection />);
    await waitFor(() => screen.getByText("Household"));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(screen.queryByRole("button", { name: /leave.*household/i })).toBeNull();
  });

  // ── Confirmation dialog ──────────────────────────────────────────────────────

  it("shows confirmation dialog when Leave Household button is clicked", async () => {
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    expect(screen.getByRole("alertdialog", { name: /confirm leaving household/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /confirm leaving/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /cancel leaving/i })).toBeDefined();
  });

  it("hides confirmation dialog when Cancel is clicked", async () => {
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cancel leaving/i }));
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("button", { name: /leave.*household/i })).toBeDefined();
  });

  // ── Successful leave ─────────────────────────────────────────────────────────

  it("calls POST /api/household/leave with confirm:true on Confirm Leave", async () => {
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm leaving/i }));
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/ledger"));

    const leaveCalls = mockFetch.mock.calls.filter((c) =>
      String(c[0]).includes("/api/household/leave")
    );
    expect(leaveCalls.length).toBe(1);
    const callOptions = leaveCalls[0][1] as RequestInit;
    expect(JSON.parse(callOptions.body as string)).toEqual({ confirm: true });
  });

  it("clears card cache with empty array on successful leave", async () => {
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm leaving/i }));
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(mockSetAllCards).toHaveBeenCalledWith(MEMBER_USER_ID, []);
  });

  it("redirects to /ledger after successful leave", async () => {
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm leaving/i }));
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/ledger"));
  });

  // ── Error handling ───────────────────────────────────────────────────────────

  it("shows error message when leave API returns error", async () => {
    setupFetch({
      leaveOk: false,
      leaveStatus: 403,
      leaveBody: {
        error: "forbidden",
        error_description: "Household owners cannot leave.",
      },
    });
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm leaving/i }));
    });
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toContain("Household owners cannot leave.");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("stays on confirm dialog (does not close) when API error occurs", async () => {
    setupFetch({
      leaveOk: false,
      leaveStatus: 403,
      leaveBody: { error: "forbidden", error_description: "Not a member." },
    });
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm leaving/i }));
    });
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alertdialog", { name: /confirm leaving household/i })).toBeDefined();
  });

  it("shows auth error and does not redirect when token is missing on leave", async () => {
    // Members API is called on mount — token valid then
    // But when Confirm Leave is clicked, token is null
    let callCount = 0;
    mockEnsureFreshToken.mockImplementation(() => {
      callCount++;
      // First call (members fetch on mount): return valid token
      // Second call (leave POST on confirm): return null
      return Promise.resolve(callCount === 1 ? "token-abc" : null);
    });

    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm leaving/i }));
    });
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toContain("Authentication error");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("clears leave error when Cancel is clicked after an error", async () => {
    setupFetch({
      leaveOk: false,
      leaveStatus: 403,
      leaveBody: { error: "forbidden", error_description: "Not a member." },
    });
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm leaving/i }));
    });
    await waitFor(() => screen.getByRole("alert"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cancel leaving/i }));
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // ── Unauthenticated ──────────────────────────────────────────────────────────

  it("shows locked view when token is null on initial load", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);
    render(<HouseholdSettingsSection />);
    await waitFor(() =>
      expect(screen.queryByTestId("household-locked")).not.toBeNull()
    );
  });
});
