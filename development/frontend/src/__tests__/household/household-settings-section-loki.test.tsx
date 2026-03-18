/**
 * Loki QA — HouseholdSettingsSection unauthenticated state
 *
 * Issue #1346 — Household status box missing on Settings page for unauthenticated users
 *
 * Acceptance criteria:
 *   - Unauthenticated users see a locked/disabled state with sign-in prompt
 *   - No household actions (invite, leave, join) accessible when unauthenticated
 *   - Authenticated users still see the full household UI
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { HouseholdSettingsSection } from "@/components/household/HouseholdSettingsSection";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEnsureFreshToken = vi.fn();
vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const soloHouseholdData = {
  householdId: "hh_solo",
  householdName: "Solo Saga",
  ownerId: "u_me",
  memberCount: 1,
  maxMembers: 3,
  isSolo: true,
  isFull: false,
  isOwner: true,
  inviteCode: "ABC123",
  inviteCodeExpiresAt: "2026-04-01T00:00:00.000Z",
  members: [
    {
      clerkUserId: "u_me",
      displayName: "Björn",
      email: "bjorn@saga.com",
      role: "owner" as const,
      isCurrentUser: true,
    },
  ],
};

function mockFetchSuccess(data: object) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
  } as Response);
}

function mockFetchUnauthorized() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({}),
  } as Response);
}

// ── Tests: unauthenticated ─────────────────────────────────────────────────────

describe("HouseholdSettingsSection — unauthenticated state (issue #1346)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders locked card when ensureFreshToken returns null (no session)", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.getByTestId("household-locked")).toBeDefined();
    });
  });

  it("shows 'Household' heading in locked state", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Household" })).toBeDefined();
    });
  });

  it("shows 'Locked' badge in unauthenticated state", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.getByText("Locked")).toBeDefined();
    });
  });

  it("shows sign-in prompt text", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.getByText(/sign in to manage your household/i)).toBeDefined();
    });
  });

  it("shows 'Sign in to get started' link pointing to /ledger/sign-in", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      // aria-label is "Sign in to manage your household" — that's the accessible name
      const link = screen.getByRole("link", { name: /sign in to manage your household/i });
      expect(link).toBeDefined();
      expect((link as HTMLAnchorElement).href).toContain("/ledger/sign-in");
    });
  });

  it("renders locked state when API returns 401", async () => {
    mockEnsureFreshToken.mockResolvedValue("valid-token");
    mockFetchUnauthorized();

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.getByTestId("household-locked")).toBeDefined();
    });
  });

  it("does not render any household action buttons in locked state", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      // No join, leave, invite, regenerate actions
      expect(screen.queryByRole("button", { name: /join a household/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /regenerate code/i })).toBeNull();
    });
  });

  it("does not call fetch at all when there is no session token", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);
    global.fetch = vi.fn();

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.getByTestId("household-locked")).toBeDefined();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ── Tests: authenticated ───────────────────────────────────────────────────────

describe("HouseholdSettingsSection — authenticated state (regression, issue #1346)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders full UI (not locked) when authenticated with solo household", async () => {
    mockEnsureFreshToken.mockResolvedValue("valid-token");
    mockFetchSuccess(soloHouseholdData);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.queryByTestId("household-locked")).toBeNull();
      expect(screen.getByText("Solo")).toBeDefined();
    });
  });

  it("shows Join a Household button for solo authenticated user", async () => {
    mockEnsureFreshToken.mockResolvedValue("valid-token");
    mockFetchSuccess(soloHouseholdData);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /join a household/i })).toBeDefined();
    });
  });

  it("does not show sign-in link when authenticated", async () => {
    mockEnsureFreshToken.mockResolvedValue("valid-token");
    mockFetchSuccess(soloHouseholdData);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: /sign in to manage your household/i })).toBeNull();
    });
  });
});
