/**
 * Unit tests for lib/auth/auth-fetch.ts — Fenrir Ledger
 *
 * Tests the authFetch authenticated fetch wrapper:
 *   - Returns null when no token available
 *   - Injects Authorization header before request
 *   - Retries with fresh token on 401 response
 *   - Returns 401 response when retry also fails
 *   - Redirects to sign-in on auth failure when signOutOnFailure=true
 *
 * @ref #1925
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockEnsureFreshToken = vi.hoisted(() => vi.fn<() => Promise<string | null>>());
const mockRefreshSession = vi.hoisted(() => vi.fn<() => Promise<unknown>>());

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: mockEnsureFreshToken,
  refreshSession: mockRefreshSession,
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

function makeResponse(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers(),
    redirected: false,
    statusText: String(status),
    type: "basic",
    url: "",
    clone: function() { return this; },
  } as unknown as Response;
}

function makeSession(idToken = "new_id_token_456") {
  return {
    id_token: idToken,
    access_token: "ya29.new",
    refresh_token: "1//refresh",
    expires_at: Date.now() + 3600 * 1000,
    user: { sub: "u1", email: "odin@fenrir.dev", name: "Odin", picture: "" },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("authFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationHref = "";
  });

  it("returns null when ensureFreshToken returns null (no session)", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);
    const { authFetch } = await import("@/lib/auth/auth-fetch");

    const result = await authFetch("/api/sync/push", { method: "POST" });

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("injects Authorization: Bearer header from ensureFreshToken", async () => {
    mockEnsureFreshToken.mockResolvedValue("id_token_abc");
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
    expect(headers.get("Authorization")).toBe("Bearer id_token_abc");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("returns successful response directly (no retry needed)", async () => {
    mockEnsureFreshToken.mockResolvedValue("good_token");
    const successResponse = makeResponse(200, { ok: true });
    mockFetch.mockResolvedValue(successResponse);

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    const result = await authFetch("/api/household/members");

    expect(result).toBe(successResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it("retries with refreshed token on 401 response", async () => {
    mockEnsureFreshToken.mockResolvedValue("stale_token");
    mockRefreshSession.mockResolvedValue(makeSession("fresh_token_after_retry"));
    mockFetch
      .mockResolvedValueOnce(makeResponse(401))    // first call: 401
      .mockResolvedValueOnce(makeResponse(200, { synced: true })); // retry: success

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    const result = await authFetch("/api/sync/push", { method: "POST", body: "{}" });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(result?.ok).toBe(true);

    // Second call should use the new token
    const [, retryOpts] = mockFetch.mock.calls[1]!;
    const retryHeaders = retryOpts?.headers as Headers;
    expect(retryHeaders.get("Authorization")).toBe("Bearer fresh_token_after_retry");
  });

  it("returns 401 response when retry also returns 401 (refresh failed)", async () => {
    mockEnsureFreshToken.mockResolvedValue("expired_token");
    mockRefreshSession.mockResolvedValue(null); // refresh failed
    mockFetch.mockResolvedValue(makeResponse(401));

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    const result = await authFetch("/api/sync/push", { method: "POST" });

    // Should return the 401 response (caller decides how to handle)
    expect(result?.status).toBe(401);
  });

  it("returns 401 response when refreshSession returns session but retry is still 401", async () => {
    mockEnsureFreshToken.mockResolvedValue("stale_token");
    mockRefreshSession.mockResolvedValue(makeSession("new_token_still_rejected"));
    mockFetch
      .mockResolvedValueOnce(makeResponse(401))  // first: 401
      .mockResolvedValueOnce(makeResponse(401)); // retry: still 401

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    const result = await authFetch("/api/sync/push");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result?.status).toBe(401);
  });

  it("redirects to sign-in when signOutOnFailure=true and no token", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    await authFetch("/api/sync/push", { signOutOnFailure: true });

    expect(locationHref).toContain("/ledger/sign-in");
    expect(locationHref).toContain("returnTo=");
  });

  it("redirects to sign-in when signOutOnFailure=true and retry still 401", async () => {
    mockEnsureFreshToken.mockResolvedValue("stale_token");
    mockRefreshSession.mockResolvedValue(null); // refresh failed
    mockFetch.mockResolvedValue(makeResponse(401));

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    await authFetch("/api/sync/push", { signOutOnFailure: true });

    expect(locationHref).toContain("/ledger/sign-in");
  });

  it("does NOT redirect when signOutOnFailure=false (default) and auth fails", async () => {
    mockEnsureFreshToken.mockResolvedValue(null);

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    await authFetch("/api/sync/push");

    expect(locationHref).toBe("");
  });

  it("passes through non-401 error responses without retry", async () => {
    mockEnsureFreshToken.mockResolvedValue("good_token");
    mockFetch.mockResolvedValue(makeResponse(500, { error: "internal_server_error" }));

    const { authFetch } = await import("@/lib/auth/auth-fetch");
    const result = await authFetch("/api/sync/push");

    expect(result?.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });
});

// ─── Singleton refresh race prevention ───────────────────────────────────────

describe("refreshSession singleton deduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("concurrent refreshSession() calls only issue one fetch request", async () => {
    // Reset the module to clear the in-flight singleton
    vi.resetModules();

    const sessionModuleMock = { getSession: vi.fn(), setSession: vi.fn() };
    vi.mock("@/lib/auth/session", () => sessionModuleMock);

    const newFreshExp = Math.floor((Date.now() + 3600 * 1000) / 1000);
    const header = btoa(JSON.stringify({ alg: "RS256" }));
    const payload = btoa(JSON.stringify({ sub: "u1", email: "t@t.com", name: "T", picture: "", exp: newFreshExp }));
    const newToken = `${header}.${payload}.sig`;

    const session = {
      access_token: "ya29.old",
      id_token: "old.token.here",
      refresh_token: "1//refresh",
      expires_at: Date.now() - 1000,
      user: { sub: "u1", email: "t@t.com", name: "T", picture: "" },
    };
    sessionModuleMock.getSession.mockReturnValue(session);

    let resolveFetch!: (v: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    mockFetch.mockReturnValue(fetchPromise);

    const { refreshSession } = await import("@/lib/auth/refresh-session");

    // Fire three concurrent refresh calls
    const [r1, r2, r3] = await Promise.all([
      refreshSession(),
      refreshSession(),
      refreshSession(),
      // Resolve the fetch mid-flight
      Promise.resolve().then(() => resolveFetch({
        ok: true,
        json: async () => ({ access_token: "ya29.new", id_token: newToken, expires_in: 3600 }),
      } as Response)),
    ]).then(([a, b, c]) => [a, b, c]);

    // Only one fetch should have been made
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // All three should get the same refreshed result
    expect(r1?.access_token).toBe("ya29.new");
    expect(r2?.access_token).toBe("ya29.new");
    expect(r3?.access_token).toBe("ya29.new");
  });
});
