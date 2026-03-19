/**
 * Vitest tests for src/app/ledger/auth/callback/page.tsx
 *
 * Covers: default exchanging state, error param from Google, missing code/state,
 * PKCE state mismatch, corrupt PKCE data. Issue #1470
 */

import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AuthCallbackPage from "@/app/ledger/auth/callback/page";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockSearchParamsGet = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

vi.mock("@/lib/auth/session", () => ({
  setSession: vi.fn(),
}));

vi.mock("@/lib/auth/sign-in-url", () => ({
  validateReturnTo: vi.fn((url: string | null) => url ?? "/ledger"),
}));

vi.mock("@/lib/analytics/track", () => ({
  track: vi.fn(),
}));

vi.mock("@/lib/trial-utils", () => ({
  computeFingerprint: vi.fn().mockResolvedValue("fp-abc"),
  isValidFingerprint: vi.fn().mockReturnValue(false),
}));

vi.mock("@/hooks/useTrialStatus", () => ({
  clearTrialStatusCache: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupSearchParams({
  code = null,
  state = null,
  error = null,
}: {
  code?: string | null;
  state?: string | null;
  error?: string | null;
}) {
  mockSearchParamsGet.mockImplementation((key: string) => {
    if (key === "code") return code;
    if (key === "state") return state;
    if (key === "error") return error;
    return null;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AuthCallbackPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("renders the outer Suspense fallback / exchanging state", () => {
    setupSearchParams({ code: "abc", state: "xyz" });
    // No PKCE data in sessionStorage — will end up showing error after timeout,
    // but initially the exchanging state renders.
    render(<AuthCallbackPage />);
    expect(screen.getByText(/binding the oath/i)).toBeInTheDocument();
  });

  it("shows error when Google returns an error param", async () => {
    setupSearchParams({ error: "access_denied" });
    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText(/google returned/i)).toBeInTheDocument();
      expect(screen.getByText(/access_denied/i)).toBeInTheDocument();
    });
  });

  it("shows error when error param is present (any value)", async () => {
    setupSearchParams({ error: "interaction_required" });
    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText(/the bifröst trembled/i)).toBeInTheDocument();
    });
  });

  it("shows error when code is missing from URL", async () => {
    setupSearchParams({ code: null, state: "xyz" });
    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/missing code or state/i)
      ).toBeInTheDocument();
    });
  });

  it("shows error when state is missing from URL", async () => {
    setupSearchParams({ code: "abc", state: null });
    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/missing code or state/i)
      ).toBeInTheDocument();
    });
  });

  it("shows error on state mismatch (CSRF check)", async () => {
    setupSearchParams({ code: "abc", state: "state-from-url" });

    sessionStorage.setItem(
      "fenrir:pkce",
      JSON.stringify({
        verifier: "my-verifier",
        state: "DIFFERENT-STATE",
        callbackUrl: "/ledger",
      })
    );

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText(/state mismatch/i)).toBeInTheDocument();
    });
  });

  it("shows error when PKCE data is corrupt JSON", async () => {
    setupSearchParams({ code: "abc", state: "xyz" });
    sessionStorage.setItem("fenrir:pkce", "not-valid-json{{{");

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText(/corrupt pkce session data/i)).toBeInTheDocument();
    });
  });

  it("renders 'Return to the gate' link in error state", async () => {
    setupSearchParams({ error: "access_denied" });
    render(<AuthCallbackPage />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /return to the gate/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/ledger/sign-in");
    });
  });
});
