/**
 * Unit tests for lib/auth/refresh-session.ts — Fenrir Ledger (issue #2060)
 *
 * After issue #2060: Fenrir JWTs (30-day HS256 tokens) are the session credential.
 * Sliding window refresh is server-side (X-Fenrir-Token response header).
 * No background timers or explicit refresh endpoints for session identity.
 *
 * Tests:
 *   - isTokenStale: null session, expired, within 5-min buffer, fresh
 *   - ensureFreshToken: returns fenrir_token directly (no fetch)
 *   - refreshSession: deprecated alias, returns session directly (no fetch)
 *   - refreshGoogleAccessToken: refreshes Google OAuth token for API calls only
 *
 * @ref Issue #2060
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { FenrirSession } from "@/lib/types";

// ─── session mock ─────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
}));

// ─── fetch mock ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn<typeof fetch>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STALE_BUFFER_MS = 5 * 60 * 1000;

function makeSession(overrides: Partial<FenrirSession> = {}): FenrirSession {
  return {
    fenrir_token: "fenrir-jwt-abc",
    access_token: "ya29.access",
    refresh_token: "1//refresh",
    expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    user: {
      sub: "user123",
      email: "odin@fenrir.dev",
      name: "Odin Allfather",
      picture: "https://example.com/pic.jpg",
    },
    ...overrides,
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
      expires_at: Date.now() + STALE_BUFFER_MS - 1000, // within buffer
    });
    expect(isTokenStale(session)).toBe(true);
  });

  it("returns false when expires_at is well in the future", async () => {
    const { isTokenStale } = await import("@/lib/auth/refresh-session");
    const session = makeSession({
      expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days out
    });
    expect(isTokenStale(session)).toBe(false);
  });

  it("returns false for a fresh 1-hour session", async () => {
    const { isTokenStale } = await import("@/lib/auth/refresh-session");
    const session = makeSession({
      expires_at: Date.now() + 3600 * 1000,
    });
    expect(isTokenStale(session)).toBe(false);
  });
});

// ─── ensureFreshToken ─────────────────────────────────────────────────────────

describe("ensureFreshToken (issue #2060 — no network call)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no session exists", async () => {
    const sessionModule = await import("@/lib/auth/session");
    vi.mocked(sessionModule.getSession).mockReturnValue(null);

    const { ensureFreshToken } = await import("@/lib/auth/refresh-session");
    const token = await ensureFreshToken();
    expect(token).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fenrir_token directly (no network call) for fresh session", async () => {
    const sessionModule = await import("@/lib/auth/session");
    const session = makeSession({ fenrir_token: "my-fenrir-jwt-xyz" });
    vi.mocked(sessionModule.getSession).mockReturnValue(session);

    const { ensureFreshToken } = await import("@/lib/auth/refresh-session");
    const token = await ensureFreshToken();

    expect(token).toBe("my-fenrir-jwt-xyz");
    // After #2060: no network call — sliding window is server-side
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns fenrir_token even for stale sessions (caller decides on re-auth)", async () => {
    const sessionModule = await import("@/lib/auth/session");
    const staleSession = makeSession({
      fenrir_token: "stale-fenrir-jwt",
      expires_at: Date.now() - 60 * 1000,
    });
    vi.mocked(sessionModule.getSession).mockReturnValue(staleSession);

    const { ensureFreshToken } = await import("@/lib/auth/refresh-session");
    const token = await ensureFreshToken();

    // Returns stored token — no network call for Fenrir JWT renewal
    expect(token).toBe("stale-fenrir-jwt");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── refreshSession (deprecated alias) ────────────────────────────────────────

describe("refreshSession (deprecated alias — issue #2060)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when getSession() returns null", async () => {
    const sessionModule = await import("@/lib/auth/session");
    vi.mocked(sessionModule.getSession).mockReturnValue(null);

    const { refreshSession } = await import("@/lib/auth/refresh-session");
    const result = await refreshSession();
    expect(result).toBeNull();
    // No fetch — session identity refresh is server-side after #2060
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns the stored session directly (no network call)", async () => {
    const sessionModule = await import("@/lib/auth/session");
    const session = makeSession({ fenrir_token: "stored-fenrir-jwt" });
    vi.mocked(sessionModule.getSession).mockReturnValue(session);

    const { refreshSession } = await import("@/lib/auth/refresh-session");
    const result = await refreshSession();

    expect(result).toBe(session);
    expect(result?.fenrir_token).toBe("stored-fenrir-jwt");
    // Deprecated alias does NOT call fetch — sliding window is server-side
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── refreshGoogleAccessToken ─────────────────────────────────────────────────

describe("refreshGoogleAccessToken (Google API calls only — not session identity)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when getSession() returns null", async () => {
    const sessionModule = await import("@/lib/auth/session");
    vi.mocked(sessionModule.getSession).mockReturnValue(null);

    const { refreshGoogleAccessToken } = await import("@/lib/auth/refresh-session");
    const result = await refreshGoogleAccessToken();
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null when session has no refresh_token", async () => {
    const sessionModule = await import("@/lib/auth/session");
    const { refresh_token: _r, ...noRefresh } = makeSession();
    vi.mocked(sessionModule.getSession).mockReturnValue(noRefresh as FenrirSession);

    const { refreshGoogleAccessToken } = await import("@/lib/auth/refresh-session");
    const result = await refreshGoogleAccessToken();
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

    const { refreshGoogleAccessToken } = await import("@/lib/auth/refresh-session");
    const result = await refreshGoogleAccessToken();
    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    const sessionModule = await import("@/lib/auth/session");
    vi.mocked(sessionModule.getSession).mockReturnValue(makeSession());

    mockFetch.mockRejectedValue(new Error("Network error"));

    const { refreshGoogleAccessToken } = await import("@/lib/auth/refresh-session");
    const result = await refreshGoogleAccessToken();
    expect(result).toBeNull();
  });

  it("returns new access_token on successful Google token refresh", async () => {
    const sessionModule = await import("@/lib/auth/session");
    vi.mocked(sessionModule.getSession).mockReturnValue(makeSession());

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "ya29.new_access_token" }),
    } as Response);

    const { refreshGoogleAccessToken } = await import("@/lib/auth/refresh-session");
    const result = await refreshGoogleAccessToken();

    expect(result).toBe("ya29.new_access_token");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("sends refresh_token in POST body to /api/auth/token", async () => {
    const sessionModule = await import("@/lib/auth/session");
    const session = makeSession({ refresh_token: "my_refresh_token_123" });
    vi.mocked(sessionModule.getSession).mockReturnValue(session);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "ya29.refreshed" }),
    } as Response);

    const { refreshGoogleAccessToken } = await import("@/lib/auth/refresh-session");
    await refreshGoogleAccessToken();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ refresh_token: "my_refresh_token_123" }),
      })
    );
  });

  it("concurrent calls issue only one fetch (singleton deduplication)", async () => {
    const sessionModule = await import("@/lib/auth/session");
    vi.mocked(sessionModule.getSession).mockReturnValue(makeSession());

    let resolveFetch!: (v: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    mockFetch.mockReturnValue(fetchPromise);

    const { refreshGoogleAccessToken } = await import("@/lib/auth/refresh-session");

    // Fire three concurrent calls before fetch resolves
    const p1 = refreshGoogleAccessToken();
    const p2 = refreshGoogleAccessToken();
    const p3 = refreshGoogleAccessToken();

    // Resolve the single in-flight fetch
    resolveFetch({
      ok: true,
      json: async () => ({ access_token: "ya29.new_access" }),
    } as Response);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    // Singleton: only one HTTP call despite three callers
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(r1).toBe("ya29.new_access");
    expect(r2).toBe("ya29.new_access");
    expect(r3).toBe("ya29.new_access");
  });
});
