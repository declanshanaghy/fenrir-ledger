/**
 * Unit tests for lib/auth/auth-fetch.ts — Fenrir Ledger (issue #2060)
 *
 * Tests the authFetch authenticated fetch wrapper (Fenrir JWT edition):
 *   - Returns null when no session / fenrir_token available
 *   - Injects Authorization: Bearer <fenrir_token> header
 *   - Detects X-Fenrir-Token header and swaps token via swapFenrirToken
 *   - Returns 401 response when JWT is expired (no retry — must re-auth)
 *   - Redirects to sign-in on auth failure when signOutOnFailure=true
 *
 * @ref issue #2060
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGetSession = vi.hoisted(() => vi.fn());
const mockSetSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  getSession: mockGetSession,
  setSession: mockSetSession,
}));

const mockFetch = vi.fn<typeof fetch>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

// ─── window.location mock ─────────────────────────────────────────────────────

let locationHref = "";
Object.defineProperty(globalThis, "window", {
  value: {
    location: {
      get href() { return locationHref; },
      set href(v: string) { locationHref = v; },
      pathname: "/ledger/settings",
    },
  },
  writable: true,
  configurable: true,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResponse(status: number, body: unknown = {}, headers: Record<string, string> = {}): Response {
  const responseHeaders = new Headers(headers);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: responseHeaders,
    redirected: false,
    statusText: String(status),
    type: "basic",
    url: "",
    clone: function() { return this; },
  } as unknown as Response;
}

function makeSession(fenrirToken = "fenrir-jwt-abc") {
  return {
    fenrir_token: fenrirToken,
    access_token: "ya29.access",
    refresh_token: "1//refresh",
    expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000,
    user: { sub: "u1", email: "odin@fenrir.dev", name: "Odin", picture: "" },
  };
}

/** Minimal mock Fenrir JWT for testing sliding window swap */
function makeMockJwt(expOffsetS = 30 * 24 * 60 * 60): string {
  const header = btoa(JSON.stringify({ alg: "HS256" })).replace(/[=+/]/g, (c) => ({ "=": "", "+": "-", "/": "_" })[c]!);
  const exp = Math.floor(Date.now() / 1000) + expOffsetS;
  const payload = btoa(JSON.stringify({ sub: "u1", email: "odin@fenrir.dev", householdId: "u1", exp }))
    .replace(/[=+/]/g, (c) => ({ "=": "", "+": "-", "/": "_" })[c]!);
  return `${header}.${payload}.fakesig`;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("authFetch (Fenrir JWT — issue #2060)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationHref = "";
  });

  // ── No session ──────────────────────────────────────────────────────────────

  it("returns null when getSession returns null (no session)", async () => {
    mockGetSession.mockReturnValue(null);
    const { authFetch } = await import("@/lib/auth/auth-fetch");

    const result = await authFetch("/api/sync/push", { method: "POST" });

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null when session has no fenrir_token", async () => {
    mockGetSession.mockReturnValue({ ...makeSession(), fenrir_token: undefined });
    const { authFetch } = await import("@/lib/auth/auth-fetch");

    const result = await authFetch("/api/sync/push", { method: "POST" });

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Authorization header ──────────────────────────────────────────────────

  it("injects Authorization: Bearer <fenrir_token> header", async () => {
    const session = makeSession("my-fenrir-token-xyz");
    mockGetSession.mockReturnValue(session);
    mockFetch.mockResolvedValue(makeResponse(200));

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    await authFetch("/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, opts] = mockFetch.mock.calls[0]!;
    const headers = opts?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer my-fenrir-token-xyz");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("returns successful response directly", async () => {
    mockGetSession.mockReturnValue(makeSession("good-token"));
    const successResponse = makeResponse(200, { ok: true });
    mockFetch.mockResolvedValue(successResponse);

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    const result = await authFetch("/api/household/members");

    expect(result).toBe(successResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // ── 401 handling ─────────────────────────────────────────────────────────

  it("returns 401 response when Fenrir JWT is expired (no retry)", async () => {
    mockGetSession.mockReturnValue(makeSession("expired-token"));
    mockFetch.mockResolvedValue(makeResponse(401));

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    const result = await authFetch("/api/sync/push", { method: "POST" });

    // No retry — must re-auth with Google
    expect(result?.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("redirects to sign-in when signOutOnFailure=true and no session", async () => {
    mockGetSession.mockReturnValue(null);

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    await authFetch("/api/sync/push", { signOutOnFailure: true });

    expect(locationHref).toContain("/ledger/sign-in");
    expect(locationHref).toContain("returnTo=");
  });

  it("redirects to sign-in when signOutOnFailure=true and 401 response", async () => {
    mockGetSession.mockReturnValue(makeSession("expired-token"));
    mockFetch.mockResolvedValue(makeResponse(401));

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    await authFetch("/api/sync/push", { signOutOnFailure: true });

    expect(locationHref).toContain("/ledger/sign-in");
  });

  it("does NOT redirect when signOutOnFailure=false (default) and auth fails", async () => {
    mockGetSession.mockReturnValue(null);

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    await authFetch("/api/sync/push");

    expect(locationHref).toBe("");
  });

  it("passes through non-401 responses without retry", async () => {
    mockGetSession.mockReturnValue(makeSession("good-token"));
    mockFetch.mockResolvedValue(makeResponse(500, { error: "internal_server_error" }));

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    const result = await authFetch("/api/sync/push");

    expect(result?.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // ── Sliding window refresh ─────────────────────────────────────────────────

  it("swaps stored token when X-Fenrir-Token header is present in response", async () => {
    const oldSession = makeSession("old-fenrir-token");
    mockGetSession.mockReturnValue(oldSession);
    const newToken = makeMockJwt(); // valid JWT with exp claim
    mockFetch.mockResolvedValue(makeResponse(200, { ok: true }, { "X-Fenrir-Token": newToken }));

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    await authFetch("/api/sync/push");

    // setSession should have been called with the new fenrir_token
    expect(mockSetSession).toHaveBeenCalledTimes(1);
    const savedSession = mockSetSession.mock.calls[0]![0];
    expect(savedSession.fenrir_token).toBe(newToken);
  });

  it("does not call setSession when no X-Fenrir-Token header", async () => {
    mockGetSession.mockReturnValue(makeSession("current-token"));
    mockFetch.mockResolvedValue(makeResponse(200, { ok: true }));

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    await authFetch("/api/sync/push");

    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it("updates expires_at from JWT exp when swapping token", async () => {
    const oldSession = makeSession("old-token");
    mockGetSession.mockReturnValue(oldSession);
    const expOffsetS = 29 * 24 * 60 * 60; // 29 days
    const newToken = makeMockJwt(expOffsetS);
    mockFetch.mockResolvedValue(makeResponse(200, {}, { "X-Fenrir-Token": newToken }));

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    await authFetch("/api/sync/push");

    const savedSession = mockSetSession.mock.calls[0]![0];
    const expectedExpMs = (Math.floor(Date.now() / 1000) + expOffsetS) * 1000;
    // expires_at should be approximately exp * 1000 (within 5 seconds)
    expect(savedSession.expires_at).toBeGreaterThan(expectedExpMs - 5000);
    expect(savedSession.expires_at).toBeLessThan(expectedExpMs + 5000);
  });
});
