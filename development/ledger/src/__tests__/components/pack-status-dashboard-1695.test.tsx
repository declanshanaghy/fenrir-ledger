/**
 * PackStatusDashboard — unit tests for issue #1695.
 *
 * Covers: loading state, error state (fetch fails), data rendering,
 * section headings, refresh button, retry button.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { PackStatusDashboard } from "@/components/admin/PackStatusDashboard";
import type { PackStatusResult } from "@/lib/admin/pack-status";

// ── Module mocks ───────────────────────────────────────────────────────────

let mockAuthData: { fenrir_token: string } | null = { fenrir_token: "mock-fenrir-token-xyz" };

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    data: mockAuthData,
    status: mockAuthData ? "authenticated" : "loading",
    householdId: "hh-1",
    signOut: vi.fn(),
    ensureHouseholdId: vi.fn(),
  }),
}));

// ── Fixture data ───────────────────────────────────────────────────────────

const MOCK_PACK_STATUS: PackStatusResult = {
  in_flight: [
    {
      issue: 100,
      title: "Fix something",
      type: "bug",
      chain: "Luna → FiremanDecko → Loki",
      position: "FiremanDecko",
      pr: 200,
      ci: "pass",
      verdict: "PASS",
      command: "gh pr merge 200 --squash",
      next_action: "merge",
    },
  ],
  verdicts: {
    pass: [100],
    fail: [],
    awaiting_loki: [],
    awaiting_decko: [],
    no_response: [],
    research_review: [],
  },
  up_next: [
    {
      num: 101,
      title: "Next feature",
      priority: "high",
      type: "enhancement",
      chain: "Luna → FiremanDecko → Loki",
    },
  ],
  actions: [
    {
      issue: 100,
      command: "gh pr merge 200 --squash",
      reason: "ready to merge",
    },
  ],
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PackStatusDashboard — loading state", () => {
  beforeEach(() => {
    mockAuthData = { fenrir_token: "mock-fenrir-token-xyz" };
    // fetch never resolves = perpetual loading
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllTimers();
  });

  it("renders loading state while fetch is in flight", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      expect(screen.getByLabelText("Loading pack status")).toBeDefined();
    });
  });

  it("shows 'The wolves report...' loading message", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/the wolves report/i)).toBeDefined();
    });
  });
});

describe("PackStatusDashboard — error state", () => {
  beforeEach(() => {
    mockAuthData = { fenrir_token: "mock-fenrir-token-xyz" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ error_description: "Unauthorized access" }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllTimers();
  });

  it("renders error state when fetch fails", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      expect(screen.getByLabelText("Pack status error")).toBeDefined();
    });
  });

  it("shows the error message from response", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Unauthorized access")).toBeDefined();
    });
  });

  it("shows 'The ravens return empty-handed.' in error state", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/ravens return empty-handed/i)).toBeDefined();
    });
  });

  it("renders a Retry button in error state", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
    });
  });
});

describe("PackStatusDashboard — data loaded", () => {
  beforeEach(() => {
    mockAuthData = { fenrir_token: "mock-fenrir-token-xyz" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_PACK_STATUS),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllTimers();
  });

  it("renders the Pack Status heading", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Pack Status")).toBeDefined();
    });
  });

  it("renders the Refresh button", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Refresh pack status" }),
      ).toBeDefined();
    });
  });

  it("renders 'The Wolves Hunt' section", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      expect(screen.getByLabelText("The Wolves Hunt")).toBeDefined();
    });
  });

  it("renders 'The Norns Speak' section", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      expect(screen.getByLabelText("The Norns Speak")).toBeDefined();
    });
  });

  it("renders 'Chains Yet Forged' section", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      expect(screen.getByLabelText("Chains Yet Forged")).toBeDefined();
    });
  });

  it("renders 'The Howl Commands' section", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      expect(screen.getByLabelText("The Howl Commands")).toBeDefined();
    });
  });

  it("renders in-flight chain issue link", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      // Issue #100 appears in multiple sections (Wolves Hunt + Norns Speak)
      expect(screen.getAllByText("#100").length).toBeGreaterThan(0);
    });
  });

  it("renders up-next item title", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      expect(screen.getByText("Next feature")).toBeDefined();
    });
  });

  it("renders the command action in The Howl Commands section", async () => {
    render(<PackStatusDashboard />);
    await waitFor(() => {
      expect(
        screen.getByText("gh pr merge 200 --squash"),
      ).toBeDefined();
    });
  });
});

describe("PackStatusDashboard — no session", () => {
  afterEach(() => {
    mockAuthData = { fenrir_token: "mock-fenrir-token-xyz" };
    vi.unstubAllGlobals();
    vi.clearAllTimers();
  });

  it("does not fetch when there is no fenrir_token", async () => {
    mockAuthData = null;

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_PACK_STATUS),
    });
    vi.stubGlobal("fetch", fetchSpy);

    render(<PackStatusDashboard />);

    // Give some time for any potential fetch to fire
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // With no fenrir_token the fetchData guard returns early
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
