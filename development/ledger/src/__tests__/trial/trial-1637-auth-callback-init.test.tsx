/**
 * Tests for Issue #1722 — Trial init moved server-side
 *
 * Validates that AuthCallbackPage does NOT call /api/trial/init client-side.
 * Trial init now happens server-side in /api/auth/token after token exchange.
 *
 * @ref Issue #1722 (supersedes Issue #1637)
 */

import { render, waitFor } from "@testing-library/react";
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
  verifier: "test-verifier-1722",
  state: "test-state-1722",
  callbackUrl: "/ledger",
};

const FAKE_ID_TOKEN = makeFakeIdToken(
  "google-sub-1722",
  "user@example.com",
  "Test User"
);

function setupSearchParams() {
  mockSearchParamsGet.mockImplementation((key: string) => {
    if (key === "code") return "auth-code-1722";
    if (key === "state") return "test-state-1722";
    return null;
  });
}

function setupPkce() {
  sessionStorage.setItem("fenrir:pkce", JSON.stringify(PKCE_DATA));
}

function mockTokenExchange() {
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
    return new Response("", { status: 200 });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Issue #1722 — AuthCallbackPage no longer calls /api/trial/init client-side", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let locationReplaceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
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

  it("does NOT call /api/trial/init after successful token exchange (moved server-side)", async () => {
    fetchSpy = mockTokenExchange();
    setupSearchParams();
    setupPkce();

    render(<AuthCallbackPage />);

    // Wait for the redirect to happen (proves token exchange completed)
    await waitFor(
      () => {
        expect(locationReplaceMock).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    // Verify NO calls to /api/trial/init were made
    const trialInitCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/api/trial/init")
    );
    expect(trialInitCalls).toHaveLength(0);
  });

  it("redirects to destination after successful token exchange without trial init", async () => {
    fetchSpy = mockTokenExchange();
    setupSearchParams();
    setupPkce();

    render(<AuthCallbackPage />);

    await waitFor(
      () => {
        expect(locationReplaceMock).toHaveBeenCalledWith("/ledger");
      },
      { timeout: 3000 }
    );
  });
});
