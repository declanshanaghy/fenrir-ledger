/**
 * Vitest tests for src/app/ledger/join/page.tsx
 *
 * Covers: default render, code input count, button disabled state,
 * validation message helper, error states, merging state, success state.
 * Issue #1470
 */

import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import JoinHouseholdPage from "@/app/ledger/join/page";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/components/household/CodeCharInput", () => ({
  CodeCharInput: ({
    index,
    onChange,
    onBackspace,
    disabled,
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("JoinHouseholdPage — code entry step", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders the heading and description", () => {
    render(<JoinHouseholdPage />);
    expect(
      screen.getByRole("heading", { name: /join a household/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/enter the 6-character invite code/i)
    ).toBeInTheDocument();
  });

  it("renders exactly 6 code input boxes", () => {
    render(<JoinHouseholdPage />);
    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`code-input-${i}`)).toBeInTheDocument();
    }
  });

  it("renders 'Join Household' button disabled when no chars entered", () => {
    render(<JoinHouseholdPage />);
    const btn = screen.getByRole("button", { name: /join household/i });
    expect(btn).toBeDisabled();
  });

  it("renders invite code fieldset group with aria-label", () => {
    render(<JoinHouseholdPage />);
    expect(
      screen.getByRole("group", { name: /6-character invite code/i })
    ).toBeInTheDocument();
  });

  it("shows validation feedback alert on fetch error", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("network"));
    render(<JoinHouseholdPage />);

    // Fill all 6 inputs to trigger auto-validate
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        fireEvent.change(screen.getByTestId(`code-input-${i}`), {
          target: { value: "A" },
        });
      });
    }

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("shows invalid message on 404 response", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    render(<JoinHouseholdPage />);

    for (let i = 0; i < 6; i++) {
      await act(async () => {
        fireEvent.change(screen.getByTestId(`code-input-${i}`), {
          target: { value: "B" },
        });
      });
    }

    await waitFor(() => {
      expect(screen.getByText(/invalid invite code/i)).toBeInTheDocument();
    });
  });

  it("shows expired message on 410 response", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 410, json: async () => ({}) });
    render(<JoinHouseholdPage />);

    for (let i = 0; i < 6; i++) {
      await act(async () => {
        fireEvent.change(screen.getByTestId(`code-input-${i}`), {
          target: { value: "C" },
        });
      });
    }

    await waitFor(() => {
      expect(screen.getByText(/invite code has expired/i)).toBeInTheDocument();
    });
  });

  it("shows 'household is full' message on 409 full response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "household_full" }),
    });
    render(<JoinHouseholdPage />);

    for (let i = 0; i < 6; i++) {
      await act(async () => {
        fireEvent.change(screen.getByTestId(`code-input-${i}`), {
          target: { value: "D" },
        });
      });
    }

    await waitFor(() => {
      expect(screen.getByText(/household is full/i)).toBeInTheDocument();
    });
  });

  it("shows 'already in a household' message on 409 already_member response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "already_in_household" }),
    });
    render(<JoinHouseholdPage />);

    for (let i = 0; i < 6; i++) {
      await act(async () => {
        fireEvent.change(screen.getByTestId(`code-input-${i}`), {
          target: { value: "E" },
        });
      });
    }

    await waitFor(() => {
      // The component renders "You're already in a household" with &rsquo; (U+2019)
      expect(screen.getByText(/already in a household/i)).toBeInTheDocument();
    });
  });

  it("shows household preview and Continue button on valid code", async () => {
    const preview = {
      householdId: "hh-1",
      householdName: "The Ravens",
      memberCount: 2,
      members: [
        { displayName: "Odin", email: "odin@asgard.com", role: "owner" },
        { displayName: "Thor", email: "thor@asgard.com", role: "member" },
      ],
      userCardCount: 3,
      targetHouseholdCardCount: 7,
    };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => preview });
    render(<JoinHouseholdPage />);

    for (let i = 0; i < 6; i++) {
      await act(async () => {
        fireEvent.change(screen.getByTestId(`code-input-${i}`), {
          target: { value: "F" },
        });
      });
    }

    await waitFor(() => {
      // Multiple elements may contain "The Ravens" (validation msg + preview)
      expect(screen.getAllByText(/the ravens/i).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
