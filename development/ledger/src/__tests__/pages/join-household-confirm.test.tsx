/**
 * Join Household — confirm step and success screen UI
 *
 * Validates acceptance criteria from issue #1820:
 *   - 0-card user sees "Confirm: Join Household" heading (not "Merge Cards & …")
 *   - N-card user sees "Confirm: Merge Cards & Join Household" heading
 *   - Target household card count appears in the joining household box
 *   - "no existing cards to merge" shown when userCardCount === 0
 *   - Success screen shows card count only when movedCardCount > 0
 *   - No contradictory messaging (old bug: "cards will be imported" then "none exist")
 *
 * These tests exercise page.tsx render paths NOT covered by ledger-join-page.test.tsx
 * (which only tests the code-entry step) or use-join-household-page.test.ts
 * (which tests hook state transitions, not rendered markup).
 */

import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import JoinHouseholdPage from "@/app/ledger/join/page";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/components/household/CodeCharInput", () => ({
  CodeCharInput: ({
    index,
    onChange,
    disabled,
    onBackspace,
  }: {
    index: number;
    value: string;
    disabled?: boolean;
    hasError?: boolean;
    onChange: (i: number, v: string) => void;
    onBackspace: (i: number) => void;
    onPaste: (t: string) => void;
  }) => (
    <input
      data-testid={`code-input-${index}`}
      disabled={disabled}
      onChange={(e) => onChange(index, e.target.value.toUpperCase())}
      onKeyDown={(e) => {
        if (e.key === "Backspace") onBackspace(index);
      }}
      aria-label={`character ${index + 1}`}
    />
  ),
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(() => ({
    user: { sub: "user-solo-sub", email: "solo@example.com", name: "Solo", picture: "" },
  })),
}));

vi.mock("@/lib/storage", () => ({
  clearHouseholdLocalStorage: vi.fn(),
  setStoredHouseholdId: vi.fn(),
  getEffectiveHouseholdId: (fallback: string) => fallback,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

interface PreviewFixture {
  householdId: string;
  householdName: string;
  memberCount: number;
  members: Array<{ displayName: string; email: string; role: string }>;
  userCardCount: number;
  targetHouseholdCardCount: number;
}

async function fillCodeAndContinue(preview: PreviewFixture) {
  global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => preview });
  render(<JoinHouseholdPage />);

  for (let i = 0; i < 6; i++) {
    await act(async () => {
      fireEvent.change(screen.getByTestId(`code-input-${i}`), {
        target: { value: "A" },
      });
    });
  }

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  });
}

const ZERO_CARD_PREVIEW: PreviewFixture = {
  householdId: "hh-1",
  householdName: "Valhalla",
  memberCount: 1,
  members: [{ displayName: "Odin", email: "odin@asgard.com", role: "owner" }],
  userCardCount: 0,
  targetHouseholdCardCount: 9,
};

const FIVE_CARD_PREVIEW: PreviewFixture = {
  ...ZERO_CARD_PREVIEW,
  userCardCount: 5,
};

// ── Confirm step — 0-card user ────────────────────────────────────────────────

describe("JoinHouseholdPage confirm step — 0-card user", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("shows 'Confirm: Join Household' heading (no 'Merge Cards' in title)", async () => {
    await fillCodeAndContinue(ZERO_CARD_PREVIEW);
    await waitFor(() => {
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent("Confirm: Join Household");
      expect(heading).not.toHaveTextContent("Merge");
    });
  });

  it("shows 'no existing cards to merge' message", async () => {
    await fillCodeAndContinue(ZERO_CARD_PREVIEW);
    await waitFor(() => {
      expect(screen.getByText(/no existing cards to merge/i)).toBeInTheDocument();
    });
  });

  it("does not show a Merge-and-Join action button", async () => {
    await fillCodeAndContinue(ZERO_CARD_PREVIEW);
    await waitFor(() => {
      // Accessible name contains "merge" for N-card users — must be absent for 0-card users
      expect(screen.queryByRole("button", { name: /merge.*join/i })).not.toBeInTheDocument();
    });
  });

  it("shows target household card count in joining-household box", async () => {
    await fillCodeAndContinue(ZERO_CARD_PREVIEW);
    await waitFor(() => {
      // 9 cards from targetHouseholdCardCount
      expect(screen.getByText(/9 cards/i)).toBeInTheDocument();
    });
  });
});

// ── Confirm step — N-card user ────────────────────────────────────────────────

describe("JoinHouseholdPage confirm step — N-card user", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("shows 'Confirm: Merge Cards & Join Household' heading", async () => {
    await fillCodeAndContinue(FIVE_CARD_PREVIEW);
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        /Confirm: Merge Cards/i
      );
    });
  });

  it("shows Merge-and-Join button with card count in accessible name", async () => {
    await fillCodeAndContinue(FIVE_CARD_PREVIEW);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /merge 5 cards and join valhalla/i })
      ).toBeInTheDocument();
    });
  });
});

// ── Success screen ────────────────────────────────────────────────────────────

describe("JoinHouseholdPage success screen", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("shows 'Cards merged' counter matching movedCardCount when > 0", async () => {
    await fillCodeAndContinue(FIVE_CARD_PREVIEW);

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ householdId: "hh-1", householdName: "Valhalla", movedCardCount: 5 }),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /merge 5 cards and join valhalla/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/cards merged/i)).toBeInTheDocument();
      expect(screen.getByText(/5 cards/i)).toBeInTheDocument();
    });
  });

  it("omits 'Cards merged' counter and shows 'start adding cards' when movedCardCount is 0", async () => {
    await fillCodeAndContinue(ZERO_CARD_PREVIEW);

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ householdId: "hh-1", householdName: "Valhalla", movedCardCount: 0 }),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /join valhalla/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/start adding cards/i)).toBeInTheDocument();
      expect(screen.queryByText(/cards merged/i)).not.toBeInTheDocument();
    });
  });
});
