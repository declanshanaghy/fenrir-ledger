/**
 * Loki QA tests for Issue #1707 / #1722 — Auth callback trial init
 *
 * Issue #1722 moved trial init from client-side to server-side (/api/auth/token).
 * These tests validate:
 *
 *  1. /api/trial/init is NOT called client-side (moved server-side in #1722)
 *  2. window.location.replace fires to the destination after successful token exchange
 *  3. console.error is called (non-fatal logging) when mergeAnonymousCards throws
 *  4. trial/init is NOT called when token exchange itself fails (no false positives)
 *
 * @ref Issue #1707, #1722
 */

import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AuthCallbackPage from "@/app/ledger/auth/callback/page";

// ── Module mocks ───────────────────────────────────────────────────────────────

const mockSearchParamsGet = vi.hoisted(() => vi.fn());
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

// ── Helpers ────────────────────────────────────────────────────────────────────

const FAKE_ACCESS_TOKEN = "fake-access-token-xyz";
const FAKE_ID_TOKEN = buildFakeIdToken("google-sub-1707", "qa@example.com", "QA User");

function buildFakeIdToken(sub: string, email: string, name: string): string {
  const encode = (obj: object) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  const header = encode({ alg: "RS256", typ: "JWT" });
  const payload = encode({ sub, email, name, picture: "", exp: 9_999_999_999 });
  return `${header}.${payload}.loki-sig`;
}

const PKCE_DATA = {
  verifier: "verifier-1707-qa",
  state: "state-1707-qa",
  callbackUrl: "/ledger",
};

function setupSearchParams() {
  mockSearchParamsGet.mockImplementation((key: string) => {
    if (key === "code") return "auth-code-1707";
    if (key === "state") return "state-1707-qa";
    return null;
  });
}

function setupPkce() {
  sessionStorage.setItem("fenrir:pkce", JSON.stringify(PKCE_DATA));
}

/**
 * Captures fetch calls while providing a successful token exchange response.
 * No /api/trial/init handler needed — the callback no longer calls it (Issue #1722).
 */
function spyFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/api/auth/token")) {
      return new Response(
        JSON.stringify({
          access_token: FAKE_ACCESS_TOKEN,
          id_token: FAKE_ID_TOKEN,
          expires_in: 3600,
          refresh_token: "rt-first-consent",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("", { status: 200 });
  });
}

/** Token exchange returns an HTTP error — no tokens issued. */
function spyFetchTokenFailure() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/api/auth/token")) {
      return new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("", { status: 200 });
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Issue #1707/#1722 Loki QA — auth callback trial init moved server-side", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let locationReplaceMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
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

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    sessionStorage.clear();
  });

  // ──────────────────────────────────────────────────────────────────────
  // AC: /api/trial/init is NOT called client-side (moved server-side #1722)
  // ──────────────────────────────────────────────────────────────────────

  it("does NOT call /api/trial/init client-side — trial init moved server-side (#1722)", async () => {
    fetchSpy = spyFetch();
    setupSearchParams();
    setupPkce();

    render(<AuthCallbackPage />);

    await waitFor(
      () => {
        expect(locationReplaceMock).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    const trialCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/api/trial/init")
    );
    expect(trialCalls).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────────────
  // AC: Redirect fires after successful token exchange (flow completes)
  // ──────────────────────────────────────────────────────────────────────

  it("redirects to /ledger after successful token exchange", async () => {
    fetchSpy = spyFetch();
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

  // ──────────────────────────────────────────────────────────────────────
  // AC: console.error logged when mergeAnonymousCards throws (issue #1707 non-fatal path)
  // ──────────────────────────────────────────────────────────────────────

  it("logs console.error with merge error message when mergeAnonymousCards throws", async () => {
    const { mergeAnonymousCards } = await import("@/lib/merge-anonymous");
    vi.mocked(mergeAnonymousCards).mockImplementationOnce(() => {
      throw new Error("Private browsing: localStorage blocked");
    });

    fetchSpy = spyFetch();
    setupSearchParams();
    setupPkce();

    render(<AuthCallbackPage />);

    await waitFor(
      () => {
        // Redirect means the full flow completed
        expect(locationReplaceMock).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    const errorCalls = consoleErrorSpy.mock.calls.filter((args) =>
      args.some((a) => typeof a === "string" && a.includes("merge"))
    );
    expect(errorCalls.length).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────────────────────────────
  // AC: trial/init NOT called when token exchange fails (no false positives)
  // ──────────────────────────────────────────────────────────────────────

  it("does NOT call /api/trial/init when token exchange returns 400", async () => {
    fetchSpy = spyFetchTokenFailure();
    setupSearchParams();
    setupPkce();

    render(<AuthCallbackPage />);

    // Give enough time for any spurious trial/init call to appear
    await new Promise((r) => setTimeout(r, 500));

    const trialCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/api/trial/init")
    );
    expect(trialCalls.length).toBe(0);
  });
});
