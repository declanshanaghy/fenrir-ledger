/**
 * Vitest tests for src/app/ledger/sign-in/page.tsx
 *
 * Covers: renders sign-in form, redirects when session valid, card-count
 * variant copy, "Continue without signing in" button. Issue #1470
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SignInPage from "@/app/ledger/sign-in/page";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  useSearchParams: () => ({ get: () => null }),
}));

let mockSessionValid = false;
vi.mock("@/lib/auth/session", () => ({
  isSessionValid: () => mockSessionValid,
}));

vi.mock("@/lib/auth/sign-in-url", () => ({
  validateReturnTo: vi.fn((url: string | null) => url ?? "/ledger"),
}));

vi.mock("@/lib/auth/household", () => ({
  getAnonHouseholdId: vi.fn().mockReturnValue("anon-id"),
}));

let mockCards: unknown[] = [];
vi.mock("@/lib/storage", () => ({
  getCards: vi.fn(() => mockCards),
}));

vi.mock("@/lib/auth/pkce", () => ({
  generateCodeVerifier: vi.fn().mockReturnValue("verifier-abc"),
  generateCodeChallenge: vi.fn().mockResolvedValue("challenge-xyz"),
  generateState: vi.fn().mockReturnValue("state-123"),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SignInPage", () => {
  beforeEach(() => {
    mockSessionValid = false;
    mockCards = [];
    sessionStorage.clear();
  });

  it("renders 'Sign in to Google' button", async () => {
    render(<SignInPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /sign in to google/i })
      ).toBeInTheDocument();
    });
  });

  it("renders 'Continue without signing in' button", async () => {
    render(<SignInPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /continue without signing in/i })
      ).toBeInTheDocument();
    });
  });

  it("shows no-cards variant copy when user has no local cards", async () => {
    mockCards = [];
    render(<SignInPage />);
    await waitFor(() => {
      expect(screen.getByText(/name the wolf/i)).toBeInTheDocument();
    });
  });

  it("shows cards variant heading when user has local cards", async () => {
    mockCards = [{ id: "1" }, { id: "2" }];
    render(<SignInPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/your chains are already here/i)
      ).toBeInTheDocument();
    });
  });

  it("shows card count in subheading when user has local cards", async () => {
    mockCards = [{ id: "1" }, { id: "2" }, { id: "3" }];
    render(<SignInPage />);
    await waitFor(() => {
      expect(screen.getByText(/3 local cards/i)).toBeInTheDocument();
    });
  });

  it("renders 'Crossing the Bifröst...' and redirects when already authed", async () => {
    mockSessionValid = true;
    render(<SignInPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/ledger");
    });
  });

  it("shows privacy policy link", async () => {
    render(<SignInPage />);
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /privacy policy/i });
      expect(link).toHaveAttribute("href", "/privacy");
    });
  });

  it("shows terms of service link", async () => {
    render(<SignInPage />);
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /terms of service/i });
      expect(link).toHaveAttribute("href", "/terms");
    });
  });
});
