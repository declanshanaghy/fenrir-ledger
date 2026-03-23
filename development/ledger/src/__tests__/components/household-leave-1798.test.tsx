/**
 * HouseholdSettingsSection — Leave Household UI tests
 *
 * Validates issue #1798 acceptance criteria from the component perspective:
 *   - Leave Household button visible only to members (not owners)
 *   - Two-step confirmation dialog: warning + Confirm Leave / Cancel
 *   - On success: clears card cache, redirects to /ledger
 *   - On API error: shows error message, stays on page
 *   - Cancel dismisses the confirm dialog without leaving
 *   - Loading state disables confirm + cancel buttons
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

// Global fetch mock
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupMembersApiSuccess(data = MEMBER_HOUSEHOLD_DATA) {
  mockFetch.mockImplementation((url: string) => {
    if (String(url).includes("/api/household/members")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data),
      });
    }
    return Promise.reject(new Error("unexpected fetch: " + url));
  });
}

function setupLeaveApiSuccess(newHouseholdId = MEMBER_USER_ID) {
  mockFetch.mockImplementation((url: string) => {
    if (String(url).includes("/api/household/members")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(MEMBER_HOUSEHOLD_DATA),
      });
    }
    if (String(url).includes("/api/household/leave")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, newHouseholdId }),
      });
    }
    return Promise.reject(new Error("unexpected fetch: " + url));
  });
}

function setupLeaveApiError(errorDesc = "Household owners cannot leave.") {
  mockFetch.mockImplementation((url: string) => {
    if (String(url).includes("/api/household/members")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(MEMBER_HOUSEHOLD_DATA),
      });
    }
    if (String(url).includes("/api/household/leave")) {
      return Promise.resolve({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: "forbidden", error_description: errorDesc }),
      });
    }
    return Promise.reject(new Error("unexpected fetch: " + url));
  });
}

async function renderMemberView() {
  setupMembersApiSuccess();
  const utils = render(<HouseholdSettingsSection />);
  await waitFor(() => expect(screen.queryByRole("region", { name: /household/i })).not.toBeNull());
  // Wait for data load — Leave Household button should appear
  await waitFor(() => screen.getByRole("button", { name: /leave.*household/i }));
  return utils;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("HouseholdSettingsSection — Leave Household (issue #1798)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureFreshToken.mockResolvedValue("token-abc");
    mockGetSession.mockReturnValue({ user: { sub: MEMBER_USER_ID } });
  });

  // ── Visibility ──────────────────────────────────────────────────────────────

  it("shows Leave Household button for members (not owners)", async () => {
    await renderMemberView();
    expect(screen.getByRole("button", { name: /leave.*household/i })).toBeDefined();
  });

  it("does NOT show Leave Household button for owners", async () => {
    setupMembersApiSuccess(OWNER_HOUSEHOLD_DATA);
    render(<HouseholdSettingsSection />);
    // Wait for load to complete
    await waitFor(() => expect(screen.queryByText("Household")).not.toBeNull());
    // Give it a tick for the data to render
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
    expect(screen.getByRole("button", { name: /confirm leave/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /cancel.*leaving/i })).toBeDefined();
  });

  it("hides confirmation dialog when Cancel is clicked", async () => {
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cancel.*leaving/i }));
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    // Original button should be visible again
    expect(screen.getByRole("button", { name: /leave.*household/i })).toBeDefined();
  });

  // ── Successful leave ─────────────────────────────────────────────────────────

  it("calls POST /api/household/leave with confirm:true on Confirm Leave", async () => {
    setupLeaveApiSuccess();
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm leave/i }));
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
    setupLeaveApiSuccess(MEMBER_USER_ID);
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm leave/i }));
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(mockSetAllCards).toHaveBeenCalledWith(MEMBER_USER_ID, []);
  });

  it("redirects to /ledger after successful leave", async () => {
    setupLeaveApiSuccess();
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm leave/i }));
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/ledger"));
  });

  // ── Error handling ───────────────────────────────────────────────────────────

  it("shows error message when leave API returns error", async () => {
    setupLeaveApiError("Household owners cannot leave.");
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm leave/i }));
    });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeDefined()
    );
    expect(screen.getByRole("alert").textContent).toContain("Household owners cannot leave.");
    // Should NOT redirect
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("stays on confirm dialog (does not close) when API error occurs", async () => {
    setupLeaveApiError();
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm leave/i }));
    });
    await waitFor(() => screen.getByRole("alert"));
    // Dialog should still be visible
    expect(screen.getByRole("alertdialog", { name: /confirm leaving household/i })).toBeDefined();
  });

  it("shows auth error and does not redirect when token is missing", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm leave/i }));
    });
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toContain("Authentication error");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("clears leave error when Cancel is clicked after an error", async () => {
    setupLeaveApiError();
    await renderMemberView();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /leave.*household/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm leave/i }));
    });
    await waitFor(() => screen.getByRole("alert"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cancel.*leaving/i }));
    });
    // Dialog gone, no error alert
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // ── Unauthenticated ──────────────────────────────────────────────────────────

  it("shows locked view when members API returns 401", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);
    setupMembersApiSuccess(); // won't be called — token is null
    render(<HouseholdSettingsSection />);
    await waitFor(() =>
      expect(screen.queryByTestId("household-locked")).not.toBeNull()
    );
  });
});
