/**
 * Unit tests for lib/auth/refresh-session.ts — Fenrir Ledger
 *
 * Tests silent token refresh utilities:
 *   - isTokenStale: null session, expired session, JWT exp check, fresh session
 *   - refreshSession: no session, no refresh_token, fetch failure, success
 *   - ensureFreshToken: no session, fresh token, stale+refresh, stale+no refresh_token
 *
 * All external I/O (fetch, localStorage) is mocked.
 *
 * @see src/lib/auth/refresh-session.ts
 * @ref #1848
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { FenrirSession } from "@/lib/types";

// ─── localStorage mock ────────────────────────────────────────────────────────

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
};
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// ─── session mock ─────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
}));

// ─── fetch mock ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn<typeof fetch>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Build a minimal JWT with an exp claim (numeric). */
function makeJwt(exp: number): string {
  const header = btoa(JSON.stringify({ alg: "RS256" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payload = btoa(JSON.stringify({
    sub: "user123",
    email: "odin@fenrir.dev",
    name: "Odin",
    picture: "https://example.com/pic.jpg",
    exp,
  })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${header}.${payload}.fake_sig`;
}

function makeSession(overrides: Partial<FenrirSession> = {}): FenrirSession {
  const exp = Math.floor((Date.now() + 3600 * 1000) / 1000);
  return {
    access_token: "ya29.access",
    id_token: makeJwt(exp),
    refresh_token: "1//refresh",
    expires_at: Date.now() + 3600 * 1000,
    user: {
      sub: "user123",
      email: "odin@fenrir.dev",
      name: "Odin Allfather",
      picture: "https://example.com/pic.jpg",
    },
    ...overrides,
  };
}

function makeTokenResponse(expiresIn = 3600) {
  const newExp = Math.floor((Date.now() + expiresIn * 1000) / 1000);
  return {
    access_token: "ya29.new_access",
    id_token: makeJwt(newExp),
    expires_in: expiresIn,
  };
}

// ─── isTokenStale ─────────────────────────────────────────────────────────────

describe("isTokenStale", () => {
  it("returns true when session is null", async () => {
    const { isTokenStale } = await import("@/lib/auth/refresh-session");
    expect(isTokenStale(null)).toBe(true);
  });

  it("returns true when expires_at is in the past", async () => {
    const { isTokenStale } = await import("@/lib/auth/refresh-session");
    const session = makeSession({ expires_at: Date.now() - 1000 });
    expect(isTokenStale(session)).toBe(true);
  });

  it("returns true when expires_at is within the 5-minute refresh buffer", async () => {
    const { isTokenStale } = await import("@/lib/auth/refresh-session");
    const session = makeSession({
      expires_at: Date.now() + REFRESH_BUFFER_MS - 1000, // within buffer
    });
    expect(isTokenStale(session)).toBe(true);
  });

  it("returns false when expires_at is well in the future and JWT exp is fresh", async () => {
    const { isTokenStale } = await import("@/lib/auth/refresh-session");
    const session = makeSession({
      expires_at: Date.now() + 3600 * 1000, // 1 hour out
    });
    expect(isTokenStale(session)).toBe(false);
  });

  it("returns true when JWT exp claim is within buffer (even if expires_at is fine)", async () => {
    const { isTokenStale } = await import("@/lib/auth/refresh-session");
    // expires_at is far in the future but JWT exp is near
    const nearExp = Math.floor((Date.now() + REFRESH_BUFFER_MS - 500) / 1000);
    const session = makeSession({
      expires_at: Date.now() + 3600 * 1000,
      id_token: makeJwt(nearExp),
    });
    expect(isTokenStale(session)).toBe(true);
  });

  it("returns true when id_token is malformed (cannot decode)", async () => {
    const { isTokenStale } = await import("@/lib/auth/refresh-session");
    const session = makeSession({ id_token: "not.a.valid.jwt.at.all" });
    expect(isTokenStale(session)).toBe(true);
  });
});

// ─── refreshSession ───────────────────────────────────────────────────────────

describe("refreshSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when getSession() returns null", async () => {
    const sessionModule = await import("@/lib/auth/session");
    vi.mocked(sessionModule.getSession).mockReturnValue(null);

    const { refreshSession } = await import("@/lib/auth/refresh-session");
    const result = await refreshSession();
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null when session has no refresh_token", async () => {
    const sessionModule = await import("@/lib/auth/session");
    const session = makeSession();
    const { refresh_token: _r, ...noRefresh } = session;
    vi.mocked(sessionModule.getSession).mockReturnValue(noRefresh as FenrirSession);

    const { refreshSession } = await import("@/lib/auth/refresh-session");
    const result = await refreshSession();
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null when fetch returns non-OK response", async () => {
    const sessionModule = await import("@/lib/auth/session");
    vi.mocked(sessionModule.getSession).mockReturnValue(makeSession());

    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "invalid_grant" }),
    } as Response);

    const { refreshSession } = await import("@/lib/auth/refresh-session");
    const result = await refreshSession();
    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    const sessionModule = await import("@/lib/auth/session");
    vi.mocked(sessionModule.getSession).mockReturnValue(makeSession());

    mockFetch.mockRejectedValue(new Error("Network error"));

    const { refreshSession } = await import("@/lib/auth/refresh-session");
    const result = await refreshSession();
    expect(result).toBeNull();
  });

  it("returns refreshed session and calls setSession on success", async () => {
    const sessionModule = await import("@/lib/auth/session");
    const originalSession = makeSession();
    vi.mocked(sessionModule.getSession).mockReturnValue(originalSession);

    const tokenResp = makeTokenResponse(3600);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => tokenResp,
    } as Response);

    const { refreshSession } = await import("@/lib/auth/refresh-session");
    const result = await refreshSession();

    expect(result).not.toBeNull();
    expect(result?.access_token).toBe("ya29.new_access");
    // refresh_token should be preserved from original session
    expect(result?.refresh_token).toBe(originalSession.refresh_token);
    expect(sessionModule.setSession).toHaveBeenCalledWith(result);
  });

  it("sends refresh_token in POST body to /api/auth/token", async () => {
    const sessionModule = await import("@/lib/auth/session");
    const session = makeSession({ refresh_token: "my_refresh_token_123" });
    vi.mocked(sessionModule.getSession).mockReturnValue(session);

    const tokenResp = makeTokenResponse();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => tokenResp,
    } as Response);

    const { refreshSession } = await import("@/lib/auth/refresh-session");
    await refreshSession();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ refresh_token: "my_refresh_token_123" }),
      })
    );
  });

  it("preserves original refresh_token in refreshed session (Google does not rotate)", async () => {
    const sessionModule = await import("@/lib/auth/session");
    const originalRefreshToken = "1//original_refresh_token";
    const session = makeSession({ refresh_token: originalRefreshToken });
    vi.mocked(sessionModule.getSession).mockReturnValue(session);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeTokenResponse(),
    } as Response);

    const { refreshSession } = await import("@/lib/auth/refresh-session");
    const result = await refreshSession();

    expect(result?.refresh_token).toBe(originalRefreshToken);
  });
});

// ─── ensureFreshToken ─────────────────────────────────────────────────────────

describe("ensureFreshToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no session exists", async () => {
    const sessionModule = await import("@/lib/auth/session");
    vi.mocked(sessionModule.getSession).mockReturnValue(null);

    const { ensureFreshToken } = await import("@/lib/auth/refresh-session");
    const token = await ensureFreshToken();
    expect(token).toBeNull();
  });

  it("returns current id_token when session is fresh (not stale)", async () => {
    const sessionModule = await import("@/lib/auth/session");
    const freshSession = makeSession({ expires_at: Date.now() + 3600 * 1000 });
    vi.mocked(sessionModule.getSession).mockReturnValue(freshSession);

    const { ensureFreshToken } = await import("@/lib/auth/refresh-session");
    const token = await ensureFreshToken();
    expect(token).toBe(freshSession.id_token);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("refreshes and returns new id_token when session is stale", async () => {
    const sessionModule = await import("@/lib/auth/session");
    // Stale session — expires_at is in the past
    const staleSession = makeSession({ expires_at: Date.now() - 60 * 1000 });
    vi.mocked(sessionModule.getSession).mockReturnValue(staleSession);

    const tokenResp = makeTokenResponse();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => tokenResp,
    } as Response);

    const { ensureFreshToken } = await import("@/lib/auth/refresh-session");
    const token = await ensureFreshToken();

    expect(token).toBe(tokenResp.id_token);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns null when session is stale and refresh fails", async () => {
    const sessionModule = await import("@/lib/auth/session");
    const staleSession = makeSession({ expires_at: Date.now() - 1000 });
    vi.mocked(sessionModule.getSession).mockReturnValue(staleSession);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_grant" }),
    } as Response);

    const { ensureFreshToken } = await import("@/lib/auth/refresh-session");
    const token = await ensureFreshToken();
    expect(token).toBeNull();
  });
});
