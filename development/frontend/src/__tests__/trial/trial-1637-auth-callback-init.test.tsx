/**
 * Tests for Issue #1637 — Trial starts on Google login
 *
 * Validates that AuthCallbackPage calls /api/trial/init after a successful
 * token exchange and handles the 409 (trial expired) response by showing
 * the "trial-expired" state with a "Continue to the ledger" link.
 *
 * @ref Issue #1637
 */

import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/lib/auth/household", () => ({
  getAnonHouseholdId: vi.fn(() => null),
}));

vi.mock("@/lib/merge-anonymous", () => ({
  mergeAnonymousCards: vi.fn(() => ({ merged: 0 })),
  isMergeComplete: vi.fn(() => true),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a minimal base64url-encoded JWT id_token for testing.
 * Not cryptographically valid but passes the format check in decodeIdToken.
 */
function makeFakeIdToken(sub: string, email: string, name: string): string {
  const encode = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  const header = encode({ alg: "RS256", typ: "JWT" });
  const payload = encode({ sub, email, name, picture: "", exp: 9_999_999_999 });
  return `${header}.${payload}.fake-signature`;
}

const PKCE_DATA = {
  verifier: "test-verifier-1637",
  state: "test-state-1637",
  callbackUrl: "/ledger",
};

const FAKE_ID_TOKEN = makeFakeIdToken(
  "google-sub-1637",
  "user@example.com",
  "Test User"
);

function setupSearchParams() {
  mockSearchParamsGet.mockImplementation((key: string) => {
    if (key === "code") return "auth-code-1637";
    if (key === "state") return "test-state-1637";
    return null;
  });
}

function setupPkce() {
  sessionStorage.setItem("fenrir:pkce", JSON.stringify(PKCE_DATA));
}

/** Returns a mock fetch that handles token exchange and trial init separately. */
function mockFetchForTrialInit(trialInitStatus: number) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/api/auth/token")) {
      return new Response(
        JSON.stringify({
          access_token: "fake-at",
          id_token: FAKE_ID_TOKEN,
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.includes("/api/trial/init")) {
      return new Response(
        JSON.stringify(
          trialInitStatus === 409
            ? { error: "trial_expired", message: "Contact customer service" }
            : { startDate: new Date().toISOString(), expiresAt: new Date().toISOString(), isNew: true }
        ),
        { status: trialInitStatus, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("", { status: 200 });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Issue #1637 — AuthCallbackPage trial init after Google login", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let locationReplaceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    // Prevent actual navigation in JSDOM
    locationReplaceMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: {
        origin: "http://localhost",
        replace: locationReplaceMock,
        href: "http://localhost/ledger/auth/callback",
      },
      writable: true,
    });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    sessionStorage.clear();
  });

  it("calls /api/trial/init after successful token exchange", async () => {
    fetchSpy = mockFetchForTrialInit(200);
    setupSearchParams();
    setupPkce();

    render(<AuthCallbackPage />);

    await waitFor(
      () => {
        const trialInitCalls = fetchSpy.mock.calls.filter(([url]) =>
          String(url).includes("/api/trial/init")
        );
        expect(trialInitCalls.length).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );
  });

  it("shows trial-expired state with contact message when /api/trial/init returns 409", async () => {
    fetchSpy = mockFetchForTrialInit(409);
    setupSearchParams();
    setupPkce();

    render(<AuthCallbackPage />);

    await waitFor(
      () => {
        expect(screen.getByText(/trial ended/i)).toBeInTheDocument();
        expect(
          screen.getByText(/your free trial has ended/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/contact customer service/i)
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("shows 'Continue to the ledger' link on trial-expired state (not 'Return to the gate')", async () => {
    fetchSpy = mockFetchForTrialInit(409);
    setupSearchParams();
    setupPkce();

    render(<AuthCallbackPage />);

    await waitFor(
      () => {
        const continueLink = screen.queryByRole("link", {
          name: /continue to the ledger/i,
        });
        expect(continueLink).toBeInTheDocument();
        expect(continueLink).toHaveAttribute("href", "/ledger");

        // "Return to the gate" should NOT be shown (that's for auth errors)
        const returnLink = screen.queryByRole("link", {
          name: /return to the gate/i,
        });
        expect(returnLink).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("does NOT show 'The Bifröst trembled' error heading on trial-expired (409)", async () => {
    fetchSpy = mockFetchForTrialInit(409);
    setupSearchParams();
    setupPkce();

    render(<AuthCallbackPage />);

    await waitFor(
      () => {
        expect(screen.getByText(/trial ended/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.queryByText(/the bifröst trembled/i)).not.toBeInTheDocument();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Issue #1707 — trial init must run even when mergeAnonymousCards throws
  // ═══════════════════════════════════════════════════════════════════════

  it("calls /api/trial/init even when mergeAnonymousCards throws (issue #1707)", async () => {
    const { mergeAnonymousCards } = await import("@/lib/merge-anonymous");
    vi.mocked(mergeAnonymousCards).mockImplementationOnce(() => {
      throw new Error("localStorage unavailable in private browsing");
    });

    fetchSpy = mockFetchForTrialInit(200);
    setupSearchParams();
    setupPkce();

    render(<AuthCallbackPage />);

    await waitFor(
      () => {
        const trialInitCalls = fetchSpy.mock.calls.filter(([url]) =>
          String(url).includes("/api/trial/init")
        );
        expect(trialInitCalls.length).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );
  });

  it("does NOT redirect to destination when trial init returns 409 (user stays on trial-expired page)", async () => {
    fetchSpy = mockFetchForTrialInit(409);
    setupSearchParams();
    setupPkce();

    render(<AuthCallbackPage />);

    await waitFor(
      () => {
        expect(screen.getByText(/trial ended/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(locationReplaceMock).not.toHaveBeenCalled();
  });
});
