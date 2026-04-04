/**
 * /api/auth/token — refactor coverage (Issue #2045)
 *
 * Tests for the extracted helper functions introduced during the
 * cyclomatic-complexity refactor: `initTrialFromAuthCode`, `buildAuthCodeParams`,
 * `buildRefreshParams`, and the APP_BASE_URL origin whitelist.
 *
 * Complements the base coverage in integration/auth-token-route.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, remaining: 9, retryAfter: undefined })),
}));

vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockInitTrialForUser = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));
vi.mock("@/lib/trial/init-trial", () => ({
  initTrialForUser: (...args: unknown[]) => mockInitTrialForUser(...args),
}));

const mockFetch = vi.hoisted(() => vi.fn());

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:9653/api/auth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "10.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Build a minimal valid JWT id_token with the given payload.
 * Three segments: header.payload.signature (base64url-encoded).
 */
function makeIdToken(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.fake-sig`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("/api/auth/token — missing env vars (issue #2045)", () => {
  let savedClientId: string | undefined;
  let savedClientSecret: string | undefined;

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    savedClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    savedClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = savedClientId;
    process.env.GOOGLE_CLIENT_SECRET = savedClientSecret;
    vi.restoreAllMocks();
  });

  it("returns 500 when GOOGLE_CLIENT_SECRET is absent", async () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    const { POST } = await import("@/app/api/auth/token/route");

    const req = makeRequest({ refresh_token: "tok" });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const data = await res.json() as { error: string };
    expect(data.error).toBe("server_error");
  });

  it("returns 500 when NEXT_PUBLIC_GOOGLE_CLIENT_ID is absent", async () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const { POST } = await import("@/app/api/auth/token/route");

    const req = makeRequest({ refresh_token: "tok" });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const data = await res.json() as { error: string };
    expect(data.error).toBe("server_error");
  });
});

describe("/api/auth/token — initTrialFromAuthCode (issue #2045)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls initTrialForUser with decoded claims on successful auth code exchange", async () => {
    const { POST } = await import("@/app/api/auth/token/route");

    const idToken = makeIdToken({
      sub: "google-sub-abc123",
      email: "user@example.com",
      name: "Test User",
    });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "at", id_token: idToken, expires_in: 3600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const req = makeRequest({
      code: "auth-code",
      code_verifier: "verifier",
      redirect_uri: "http://localhost:9653/ledger/auth/callback",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockInitTrialForUser).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "google-sub-abc123", email: "user@example.com" })
    );
  });

  it("does NOT call initTrialForUser on a refresh_token flow", async () => {
    const { POST } = await import("@/app/api/auth/token/route");

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "at", expires_in: 3600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const req = makeRequest({ refresh_token: "valid-refresh" });
    await POST(req);

    expect(mockInitTrialForUser).not.toHaveBeenCalled();
  });
});

describe("/api/auth/token — redirect_uri whitelist (issue #2045)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts APP_BASE_URL origin as a valid redirect_uri", async () => {
    const { POST } = await import("@/app/api/auth/token/route");

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "at" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    // APP_BASE_URL is set to https://fenrir-ledger.example.com in setup.ts
    const req = makeRequest({
      code: "auth-code",
      code_verifier: "verifier",
      redirect_uri: "https://fenrir-ledger.example.com/ledger/auth/callback",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("rejects an invalid (malformed) redirect_uri URL", async () => {
    const { POST } = await import("@/app/api/auth/token/route");

    const req = makeRequest({
      code: "auth-code",
      code_verifier: "verifier",
      redirect_uri: "not-a-valid-url",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toBe("invalid_request");
  });
});

describe("/api/auth/token — Google error forwarding (issue #2045)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards Google 400 error status and body unchanged", async () => {
    const { POST } = await import("@/app/api/auth/token/route");

    const googleError = { error: "invalid_grant", error_description: "Token has been expired." };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(googleError), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );

    const req = makeRequest({ refresh_token: "expired-refresh" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json() as typeof googleError;
    expect(data.error).toBe("invalid_grant");
  });
});
