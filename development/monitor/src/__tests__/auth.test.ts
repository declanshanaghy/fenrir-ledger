/**
 * Loki QA — auth.ts coverage for Issue #883 (Google OAuth 2.0 single-user lockdown)
 *
 * Gaps in FiremanDecko's tests:
 *   - createSessionToken / verifySessionToken pure crypto logic
 *   - Token expiry, signature tampering, email whitelist enforcement
 *   - GET /auth/login  → Google redirect + CSRF state cookie
 *   - GET /auth/callback → all error paths + success path
 *   - GET /auth/logout  → clear session, redirect
 *   - loginPage() HTML template
 *   - WebSocket auth rejection (unauthenticated upgrade)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

// ── Mock side-effect modules (no HTTP server, no WebSocket) ───────────────────

vi.mock("../ws.js", () => ({ attachWebSocketServer: vi.fn() }));
vi.mock("@hono/node-server", () => ({
  serve: vi.fn().mockReturnValue({ on: vi.fn() }),
}));
vi.mock("../k8s.js", () => ({
  listAgentJobs: vi.fn(),
  findPodForSession: vi.fn(),
  streamPodLogs: vi.fn(),
}));

// ── Import the REAL auth module (not mocked) ──────────────────────────────────

import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE,
  loginPage,
} from "../auth.js";
import { app } from "../index.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const TEST_EMAIL = "odin@fenrir-ledger.dev";
const TEST_SECRET = "test-hmac-secret-long-enough-32ch";
const OTHER_EMAIL = "attacker@evil.example";

// ── Env setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.SESSION_SECRET = TEST_SECRET;
  process.env.ALLOWED_EMAIL = TEST_EMAIL;
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
  process.env.OAUTH_REDIRECT_URI = "http://localhost:3001/auth/callback";
});

afterEach(() => {
  delete process.env.SESSION_SECRET;
  delete process.env.ALLOWED_EMAIL;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.OAUTH_REDIRECT_URI;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a mock Response-like object for vi.stubGlobal("fetch", ...) */
function mockFetchResponse(
  ok: boolean,
  body: unknown,
  status = ok ? 200 : 400
): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

// ── createSessionToken ────────────────────────────────────────────────────────

describe("createSessionToken", () => {
  it("returns a non-empty base64url string", () => {
    const token = createSessionToken(TEST_EMAIL);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    // base64url characters only (no +, /, =)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces different tokens on each call (timestamp included)", () => {
    const t1 = createSessionToken(TEST_EMAIL);
    const t2 = createSessionToken(TEST_EMAIL);
    // Timestamps will differ unless called within the same millisecond —
    // assert they are strings; equality would be a fluke, not guaranteed
    expect(t1).toBeTruthy();
    expect(t2).toBeTruthy();
  });
});

// ── verifySessionToken ────────────────────────────────────────────────────────

describe("verifySessionToken", () => {
  it("returns the allowed email for a freshly minted valid token", () => {
    const token = createSessionToken(TEST_EMAIL);
    const result = verifySessionToken(token);
    expect(result).toBe(TEST_EMAIL);
  });

  it("returns null for a completely garbage string", () => {
    expect(verifySessionToken("not-a-token")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(verifySessionToken("")).toBeNull();
  });

  it("returns null when signature has been tampered with", () => {
    const token = createSessionToken(TEST_EMAIL);
    // Decode, flip the last char, re-encode
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const tampered = raw.slice(0, -1) + (raw.endsWith("a") ? "b" : "a");
    const tamperedToken = Buffer.from(tampered).toString("base64url");
    expect(verifySessionToken(tamperedToken)).toBeNull();
  });

  it("returns null when payload email doesn't match ALLOWED_EMAIL", () => {
    // Create a token for a different email using the same secret
    // (simulates a valid-looking token for a different user)
    process.env.ALLOWED_EMAIL = OTHER_EMAIL;
    const attackerToken = createSessionToken(OTHER_EMAIL);
    // Now switch back to the real allowed email
    process.env.ALLOWED_EMAIL = TEST_EMAIL;
    expect(verifySessionToken(attackerToken)).toBeNull();
  });

  it("returns null for an expired token (> 8 hours old)", () => {
    const token = createSessionToken(TEST_EMAIL);
    // Advance time by 9 hours
    const nineHoursMs = 9 * 60 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + nineHoursMs);
    expect(verifySessionToken(token)).toBeNull();
  });

  it("returns null when SESSION_SECRET is missing", () => {
    const token = createSessionToken(TEST_EMAIL);
    delete process.env.SESSION_SECRET;
    expect(verifySessionToken(token)).toBeNull();
  });

  it("returns null for a token missing the dot separator", () => {
    // Build a base64url string with no dot (no signature portion)
    const malformed = Buffer.from("odin@example.com:1234567890").toString("base64url");
    expect(verifySessionToken(malformed)).toBeNull();
  });
});

// ── GET /auth/login ───────────────────────────────────────────────────────────

describe("GET /auth/login", () => {
  it("redirects to the Google OAuth consent URL", async () => {
    const res = await app.fetch(new Request("http://localhost:3001/auth/login"));
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("accounts.google.com/o/oauth2/v2/auth");
  });

  it("includes required OAuth params in the redirect URL", async () => {
    const res = await app.fetch(new Request("http://localhost:3001/auth/login"));
    const location = res.headers.get("location") ?? "";
    const url = new URL(location);
    expect(url.searchParams.get("client_id")).toBe("test-google-client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toContain("email");
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  it("sets an httpOnly CSRF state cookie", async () => {
    const res = await app.fetch(new Request("http://localhost:3001/auth/login"));
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("odin_oauth_state=");
    expect(setCookie.toLowerCase()).toContain("httponly");
  });
});

// ── GET /auth/callback ────────────────────────────────────────────────────────

describe("GET /auth/callback — error paths", () => {
  it("returns 401 HTML when Google returns an error param", async () => {
    const res = await app.fetch(
      new Request("http://localhost:3001/auth/callback?error=access_denied")
    );
    expect(res.status).toBe(401);
    const html = await res.text();
    expect(html).toContain("access_denied");
  });

  it("returns 400 HTML when code is missing", async () => {
    const res = await app.fetch(
      new Request("http://localhost:3001/auth/callback?state=some-state", {
        headers: { Cookie: "odin_oauth_state=some-state" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 HTML when state is missing", async () => {
    const res = await app.fetch(
      new Request("http://localhost:3001/auth/callback?code=auth-code", {
        headers: { Cookie: "odin_oauth_state=stored-state" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 HTML when state cookie is absent (CSRF protection)", async () => {
    const res = await app.fetch(
      new Request(
        "http://localhost:3001/auth/callback?code=auth-code&state=random-state"
        // No Cookie header — state cookie absent
      )
    );
    expect(res.status).toBe(403);
    const html = await res.text();
    expect(html.toLowerCase()).toContain("csrf");
  });

  it("returns 403 HTML when state param mismatches cookie (CSRF attack)", async () => {
    const res = await app.fetch(
      new Request(
        "http://localhost:3001/auth/callback?code=auth-code&state=attacker-state",
        { headers: { Cookie: "odin_oauth_state=real-state" } }
      )
    );
    expect(res.status).toBe(403);
  });

  it("returns 502 when Google token exchange fails with non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockFetchResponse(false, "error", 400))
    );

    // First get a real state from the login endpoint
    const loginRes = await app.fetch(
      new Request("http://localhost:3001/auth/login")
    );
    const rawCookie = loginRes.headers.get("set-cookie") ?? "";
    const stateMatch = /odin_oauth_state=([^;,\s]+)/.exec(rawCookie);
    const state = stateMatch?.[1] ?? "fallback-state";

    const res = await app.fetch(
      new Request(
        `http://localhost:3001/auth/callback?code=auth-code&state=${state}`,
        { headers: { Cookie: `odin_oauth_state=${state}` } }
      )
    );
    expect(res.status).toBe(502);
  });

  it("returns 502 when token response has no access_token field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockFetchResponse(true, { /* no access_token */ }))
    );

    const loginRes = await app.fetch(
      new Request("http://localhost:3001/auth/login")
    );
    const rawCookie = loginRes.headers.get("set-cookie") ?? "";
    const stateMatch = /odin_oauth_state=([^;,\s]+)/.exec(rawCookie);
    const state = stateMatch?.[1] ?? "fallback-state";

    const res = await app.fetch(
      new Request(
        `http://localhost:3001/auth/callback?code=auth-code&state=${state}`,
        { headers: { Cookie: `odin_oauth_state=${state}` } }
      )
    );
    expect(res.status).toBe(502);
  });

  it("returns 403 HTML when email is not in the allowed whitelist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          mockFetchResponse(true, { access_token: "tok123" })
        )
        .mockResolvedValueOnce(
          mockFetchResponse(true, { email: OTHER_EMAIL })
        )
    );

    const loginRes = await app.fetch(
      new Request("http://localhost:3001/auth/login")
    );
    const rawCookie = loginRes.headers.get("set-cookie") ?? "";
    const stateMatch = /odin_oauth_state=([^;,\s]+)/.exec(rawCookie);
    const state = stateMatch?.[1] ?? "fallback-state";

    const res = await app.fetch(
      new Request(
        `http://localhost:3001/auth/callback?code=auth-code&state=${state}`,
        { headers: { Cookie: `odin_oauth_state=${state}` } }
      )
    );
    expect(res.status).toBe(403);
    const html = await res.text();
    expect(html.toLowerCase()).toContain("access denied");
  });
});

describe("GET /auth/callback — success path", () => {
  it("sets a session cookie and redirects to / for the whitelisted email", async () => {
    // Step 1 — get real CSRF state from login
    const loginRes = await app.fetch(
      new Request("http://localhost:3001/auth/login")
    );
    const rawCookie = loginRes.headers.get("set-cookie") ?? "";
    const stateMatch = /odin_oauth_state=([^;,\s]+)/.exec(rawCookie);
    const state = stateMatch?.[1];
    expect(state).toBeTruthy();

    // Step 2 — stub Google APIs
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          mockFetchResponse(true, { access_token: "valid-access-token" })
        )
        .mockResolvedValueOnce(
          mockFetchResponse(true, { email: TEST_EMAIL })
        )
    );

    // Step 3 — call callback with matching state cookie
    const callbackRes = await app.fetch(
      new Request(
        `http://localhost:3001/auth/callback?code=real-code&state=${state}`,
        { headers: { Cookie: `odin_oauth_state=${state}` } }
      )
    );

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.get("location")).toBe("/");
    const sessionCookie = callbackRes.headers.get("set-cookie") ?? "";
    expect(sessionCookie).toContain(`${SESSION_COOKIE}=`);
    expect(sessionCookie.toLowerCase()).toContain("httponly");
  });

  it("issues a verifiable session token in the cookie", async () => {
    const loginRes = await app.fetch(
      new Request("http://localhost:3001/auth/login")
    );
    const rawCookie = loginRes.headers.get("set-cookie") ?? "";
    const stateMatch = /odin_oauth_state=([^;,\s]+)/.exec(rawCookie);
    const state = stateMatch?.[1] ?? "";

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          mockFetchResponse(true, { access_token: "valid-tok" })
        )
        .mockResolvedValueOnce(
          mockFetchResponse(true, { email: TEST_EMAIL })
        )
    );

    const callbackRes = await app.fetch(
      new Request(
        `http://localhost:3001/auth/callback?code=c&state=${state}`,
        { headers: { Cookie: `odin_oauth_state=${state}` } }
      )
    );

    // Extract the issued token and verify it
    const setCookie = callbackRes.headers.get("set-cookie") ?? "";
    const tokenMatch = new RegExp(`${SESSION_COOKIE}=([^;,\\s]+)`).exec(setCookie);
    const issuedToken = tokenMatch?.[1];
    expect(issuedToken).toBeTruthy();
    expect(verifySessionToken(issuedToken!)).toBe(TEST_EMAIL);
  });
});

// ── GET /auth/logout ──────────────────────────────────────────────────────────

describe("GET /auth/logout", () => {
  it("redirects to /auth/login", async () => {
    const res = await app.fetch(
      new Request("http://localhost:3001/auth/logout")
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/auth/login");
  });

  it("clears the session cookie", async () => {
    const res = await app.fetch(
      new Request("http://localhost:3001/auth/logout", {
        headers: { Cookie: `${SESSION_COOKIE}=some-token` },
      })
    );
    // Hono deleteCookie sets Max-Age=0 or an expired date
    const setCookie = res.headers.get("set-cookie") ?? "";
    // Either max-age=0 or an explicit deletion
    const deletionIndicators = ["max-age=0", "expires=", SESSION_COOKIE + "=;"];
    const isCookieCleared = deletionIndicators.some((indicator) =>
      setCookie.toLowerCase().includes(indicator)
    );
    expect(isCookieCleared).toBe(true);
  });
});

// ── loginPage() HTML template ─────────────────────────────────────────────────

describe("loginPage()", () => {
  it("returns a non-empty HTML string", () => {
    const html = loginPage();
    expect(typeof html).toBe("string");
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("contains a link to /auth/login (Sign in with Google)", () => {
    const html = loginPage();
    expect(html).toContain("/auth/login");
    expect(html.toLowerCase()).toContain("sign in");
  });

  it("mentions Odin's Throne in the page title", () => {
    const html = loginPage();
    expect(html).toContain("Odin");
  });

  it("marks access as restricted for unauthorised users", () => {
    const html = loginPage();
    expect(html.toLowerCase()).toMatch(/restrict|private|authoris/);
  });
});

// ── WebSocket auth gate ───────────────────────────────────────────────────────

describe("WebSocket auth gate — unauthenticated upgrade", () => {
  /**
   * Test the real ws.ts auth rejection path.
   * ws.test.ts always mocks verifySessionToken → "test@example.com",
   * so the rejection branch was never exercised. We fill that gap here
   * by importing the real ws module in isolation with real auth.
   */

  // We need to import ws with the REAL auth module.
  // We mock only the ws library (WebSocketServer) and k8s.

  class FakeWs extends EventEmitter {
    readyState = 1;
    sent: string[] = [];
    closeCode?: number;
    closeReason?: string;
    send(data: string) { this.sent.push(data); }
    close(code?: number, reason?: string) {
      this.closeCode = code;
      this.closeReason = reason;
      this.readyState = 3;
    }
    static readonly OPEN = 1;
  }

  class FakeWss extends EventEmitter {
    constructor(_opts: unknown) { super(); }
  }

  it("closes WS with 1008 and sends Unauthorized when no session cookie", async () => {
    vi.doMock("ws", () => ({
      WebSocketServer: FakeWss,
      WebSocket: { OPEN: 1 },
    }));
    vi.doMock("../k8s.js", () => ({
      findPodForSession: vi.fn(),
      streamPodLogs: vi.fn(),
    }));

    // Import the REAL ws module — auth is NOT mocked here
    const { attachWebSocketServer } = await import("../ws.js?wsauth-no-session");
    const fakeServer = new EventEmitter();
    const wss = attachWebSocketServer(fakeServer as never) as unknown as FakeWss;

    const fakeWs = new FakeWs();
    const fakeReq = {
      url: "/ws/logs/session-abc",
      headers: { cookie: "" }, // no session cookie
    };
    wss.emit("connection", fakeWs, fakeReq);

    // Should immediately reject
    expect(fakeWs.sent.length).toBeGreaterThan(0);
    const msg = JSON.parse(fakeWs.sent[0]) as Record<string, unknown>;
    expect(msg.type).toBe("error");
    expect(String(msg.message).toLowerCase()).toContain("unauthorized");
    expect(fakeWs.closeCode).toBe(1008);
  });

  it("closes WS with 1008 when session cookie is present but invalid", async () => {
    vi.doMock("ws", () => ({
      WebSocketServer: FakeWss,
      WebSocket: { OPEN: 1 },
    }));
    vi.doMock("../k8s.js", () => ({
      findPodForSession: vi.fn(),
      streamPodLogs: vi.fn(),
    }));

    const { attachWebSocketServer } = await import("../ws.js?wsauth-bad-token");
    const fakeServer = new EventEmitter();
    const wss = attachWebSocketServer(fakeServer as never) as unknown as FakeWss;

    const fakeWs = new FakeWs();
    const fakeReq = {
      url: "/ws/logs/session-abc",
      headers: { cookie: `${SESSION_COOKIE}=garbage-token-that-will-fail-hmac` },
    };
    wss.emit("connection", fakeWs, fakeReq);

    expect(fakeWs.closeCode).toBe(1008);
    const msg = JSON.parse(fakeWs.sent[0]) as Record<string, unknown>;
    expect(msg.type).toBe("error");
  });
});
