/**
 * Unit tests for GET /api/auth/session
 *
 * Tests:
 *   - Auth guard: 401 when no token
 *   - Returns 200 with user claims when authenticated
 *   - Response shape: { ok, user: { sub, email, name, picture } }
 *   - Cache-Control is no-store
 *
 * Issue #2057
 */

import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mock requireAuth ──────────────────────────────────────────────────────────

const mockRequireAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (req: NextRequest) => mockRequireAuth(req),
}));

// ── Mock logger ───────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { GET } from "@/app/api/auth/session/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/auth/session", { method: "GET" });
}

const MOCK_USER = {
  sub: "google-sub-456",
  email: "viking@fenrirledger.com",
  name: "Fenrir Viking",
  picture: "https://lh3.googleusercontent.com/a/avatar",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/auth/session", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "missing_token" }, { status: 401 }),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 200 with user claims when authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce({ ok: true, user: MOCK_USER });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it("returns ok: true and user object", async () => {
    mockRequireAuth.mockResolvedValueOnce({ ok: true, user: MOCK_USER });

    const res = await GET(makeRequest());
    const body = await res.json() as { ok: boolean; user: typeof MOCK_USER };
    expect(body.ok).toBe(true);
    expect(body.user).toBeDefined();
  });

  it("returns correct user fields", async () => {
    mockRequireAuth.mockResolvedValueOnce({ ok: true, user: MOCK_USER });

    const res = await GET(makeRequest());
    const body = await res.json() as { ok: boolean; user: typeof MOCK_USER };
    expect(body.user.sub).toBe(MOCK_USER.sub);
    expect(body.user.email).toBe(MOCK_USER.email);
    expect(body.user.name).toBe(MOCK_USER.name);
    expect(body.user.picture).toBe(MOCK_USER.picture);
  });

  it("sets Cache-Control to no-store", async () => {
    mockRequireAuth.mockResolvedValueOnce({ ok: true, user: MOCK_USER });

    const res = await GET(makeRequest());
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
