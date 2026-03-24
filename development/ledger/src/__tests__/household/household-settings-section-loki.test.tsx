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

const mockEnsureFreshToken = vi.hoisted(() => vi.fn());
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
  isKarl: false,
  inviteCode: "ABC123",
  inviteCodeExpiresAt: "2026-04-01T00:00:00.000Z",
  members: [
    {
      userId: "u_me",
      displayName: "Björn",
      email: "bjorn@saga.com",
      role: "owner" as const,
      isCurrentUser: true,
    },
  ],
};

// Solo Karl owner fixture — issue #1780
const soloKarlHouseholdData = {
  ...soloHouseholdData,
  isKarl: true,
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

// ── Tests: solo Karl owner (issue #1780) ─────────────────────────────────────

describe("HouseholdSettingsSection — solo Karl owner (issue #1780)", () => {
  beforeEach(() => {
    mockEnsureFreshToken.mockResolvedValue("valid-token");
  });

  it("solo Karl owner sees invite code", async () => {
    mockFetchSuccess(soloKarlHouseholdData);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      // InviteCodeDisplay renders the raw invite code value as text
      expect(screen.getByText("ABC123")).toBeDefined();
    });
  });

  it("solo Karl owner sees Copy invite code button", async () => {
    mockFetchSuccess(soloKarlHouseholdData);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copy invite code/i })).toBeDefined();
    });
  });

  it("solo Karl owner sees Regenerate Code button", async () => {
    mockFetchSuccess(soloKarlHouseholdData);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /regenerate code/i })).toBeDefined();
    });
  });

  it("solo Karl owner sees members list with themselves as owner", async () => {
    mockFetchSuccess(soloKarlHouseholdData);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      // MembersList renders with aria-label "Household members"
      const list = screen.getByRole("list", { name: /household members/i });
      expect(list).toBeDefined();
      // Their own name should appear
      expect(screen.getByText("Björn")).toBeDefined();
    });
  });

  it("solo Karl owner does NOT see Join a Household button (issue #1945)", async () => {
    mockFetchSuccess(soloKarlHouseholdData);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /join a household/i })).toBeNull();
    });
  });

  it("solo Karl owner does NOT see the primary solo CTA region", async () => {
    mockFetchSuccess(soloKarlHouseholdData);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      // The primary solo region has aria-label "Join a household" (the dashed box)
      // Karl owners should not see the primary full-width solo CTA
      expect(screen.queryByText("You are currently managing cards solo.")).toBeNull();
    });
  });

  it("Thrall solo owner does NOT see invite code", async () => {
    mockFetchSuccess(soloHouseholdData); // isKarl: false

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      // Solo CTA is shown
      expect(screen.getByText("You are currently managing cards solo.")).toBeDefined();
      // No invite code displayed
      expect(screen.queryByLabelText(/invite code/i)).toBeNull();
    });
  });

  it("Thrall solo user sees primary Join a Household button", async () => {
    mockFetchSuccess(soloHouseholdData); // isKarl: false

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /join a household/i })).toBeDefined();
    });
  });
});

// ── Tests: issue #1945 — Join a Household visibility ─────────────────────────

const memberHouseholdData = {
  householdId: "hh_multi",
  householdName: "Multi Saga",
  ownerId: "u_owner",
  memberCount: 2,
  maxMembers: 3,
  isSolo: false,
  isFull: false,
  isOwner: false,
  isKarl: true,
  inviteCode: undefined,
  inviteCodeExpiresAt: undefined,
  members: [
    {
      userId: "u_owner",
      displayName: "Odin",
      email: "odin@saga.com",
      role: "owner" as const,
      isCurrentUser: false,
    },
    {
      userId: "u_member",
      displayName: "Loki",
      email: "loki@saga.com",
      role: "member" as const,
      isCurrentUser: true,
    },
  ],
};

const karlMultiOwnerData = {
  householdId: "hh_karlmulti",
  householdName: "Karl Multi Saga",
  ownerId: "u_me",
  memberCount: 2,
  maxMembers: 3,
  isSolo: false,
  isFull: false,
  isOwner: true,
  isKarl: true,
  inviteCode: "XYZ789",
  inviteCodeExpiresAt: "2026-04-01T00:00:00.000Z",
  members: [
    {
      userId: "u_me",
      displayName: "Björn",
      email: "bjorn@saga.com",
      role: "owner" as const,
      isCurrentUser: true,
    },
    {
      userId: "u_other",
      displayName: "Sigrid",
      email: "sigrid@saga.com",
      role: "member" as const,
      isCurrentUser: false,
    },
  ],
};

describe("HouseholdSettingsSection — Join a Household visibility (issue #1945)", () => {
  beforeEach(() => {
    mockEnsureFreshToken.mockResolvedValue("valid-token");
  });

  it("household member (non-owner) does NOT see Join a Household button", async () => {
    mockFetchSuccess(memberHouseholdData);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /join a household/i })).toBeNull();
    });
  });

  it("household member sees Leave Household button instead", async () => {
    mockFetchSuccess(memberHouseholdData);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /leave this household/i })).toBeDefined();
    });
  });

  it("Karl multi-member owner does NOT see Join a Household button", async () => {
    mockFetchSuccess(karlMultiOwnerData);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /join a household/i })).toBeNull();
    });
  });

  it("Karl multi-member owner sees invite code", async () => {
    mockFetchSuccess(karlMultiOwnerData);

    render(<HouseholdSettingsSection />);

    await waitFor(() => {
      expect(screen.getByText("XYZ789")).toBeDefined();
    });
  });
});
