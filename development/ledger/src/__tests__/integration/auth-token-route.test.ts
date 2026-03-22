/**
 * /api/auth/token — API route handler integration tests
 *
 * Tests the token exchange proxy route against mock requests.
 * Validates input validation, rate limiting, and error handling
 * without hitting Google's actual token endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/token/route";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock the rate limiter to always allow (override per-test as needed)
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, remaining: 9 })),
}));

// Mock the logger
vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock global fetch for Google token endpoint
const mockFetch = vi.fn();

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:9653/api/auth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("/api/auth/token — Input validation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost:9653/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_request");
  });

  it("returns 400 for missing required fields in auth code flow", async () => {
    const req = makeRequest({ code: "test-code" });
    // Missing code_verifier and redirect_uri

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_request");
    expect(data.error_description).toContain("Missing required fields");
  });

  it("returns 400 for missing refresh_token in refresh flow", async () => {
    const req = makeRequest({ refresh_token: "" });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_request");
    expect(data.error_description).toContain("refresh_token");
  });

  it("returns 400 for non-whitelisted redirect_uri", async () => {
    const req = makeRequest({
      code: "test-code",
      code_verifier: "test-verifier",
      redirect_uri: "https://evil.com/callback",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_request");
    expect(data.error_description).toContain("redirect_uri");
  });

  it("accepts localhost redirect_uri as valid", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "tok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const req = makeRequest({
      code: "test-code",
      code_verifier: "test-verifier",
      redirect_uri: "http://localhost:9653/ledger/auth/callback",
    });

    const res = await POST(req);
    // Should reach the Google proxy step (200 from mock)
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

describe("/api/auth/token — Rate limiting", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    (rateLimit as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      success: false,
      remaining: 0,
    });

    const req = makeRequest({ refresh_token: "test-refresh" });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe("rate_limited");
  });
});

describe("/api/auth/token — Google proxy", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies refresh token request to Google and returns response", async () => {
    const googleResponse = {
      access_token: "new-access-token",
      id_token: "new-id-token",
      expires_in: 3600,
    };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(googleResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const req = makeRequest({ refresh_token: "valid-refresh-token" });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.access_token).toBe("new-access-token");
  });

  it("returns 502 when Google fetch fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const req = makeRequest({ refresh_token: "valid-refresh-token" });

    const res = await POST(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toBe("server_error");
  });
});
