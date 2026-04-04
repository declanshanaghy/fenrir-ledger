/**
 * Unit tests for GET /api/openapi
 *
 * Tests:
 *   - Auth guard: 401 when no token
 *   - Auth guard: 401 when invalid token
 *   - Returns valid JSON spec when authenticated
 *   - Spec has correct openapi version, title, and paths
 *   - All 23 route paths are present in the spec
 *   - Cache-Control is no-store
 *
 * Issue #2057
 */

import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { openApiSpec } from "@/lib/openapi/spec";

// ── Mock requireAuth ──────────────────────────────────────────────────────────

const mockRequireAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (req: NextRequest) => mockRequireAuth(req),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { GET } from "@/app/api/openapi/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/openapi", { method: "GET" });
}

const MOCK_USER = { sub: "google-sub-123", email: "test@example.com", name: "Test", picture: "" };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/openapi", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "missing_token" }, { status: 401 }),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    mockRequireAuth.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "invalid_token" }, { status: 401 }),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 200 with JSON spec when authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce({ ok: true, user: MOCK_USER });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toBeDefined();
    expect(typeof body).toBe("object");
  });

  it("returns the correct openapi version", async () => {
    mockRequireAuth.mockResolvedValueOnce({ ok: true, user: MOCK_USER });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.openapi).toBe("3.1.0");
  });

  it("returns the correct API title", async () => {
    mockRequireAuth.mockResolvedValueOnce({ ok: true, user: MOCK_USER });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.info.title).toBe("Fenrir Ledger API");
  });

  it("includes all required API paths", async () => {
    mockRequireAuth.mockResolvedValueOnce({ ok: true, user: MOCK_USER });

    const res = await GET(makeRequest());
    const body = await res.json() as { paths: Record<string, unknown> };

    const expectedPaths = [
      "/api/admin/pack-status",
      "/api/auth/token",
      "/api/auth/session",
      "/api/config/picker",
      "/api/household/members",
      "/api/household/invite",
      "/api/household/invite/validate",
      "/api/household/join",
      "/api/household/leave",
      "/api/household/kick",
      "/api/sheets/import",
      "/api/stripe/checkout",
      "/api/stripe/membership",
      "/api/stripe/portal",
      "/api/stripe/unlink",
      "/api/stripe/webhook",
      "/api/sync",
      "/api/sync/push",
      "/api/sync/pull",
      "/api/sync/state",
      "/api/trial/init",
      "/api/trial/status",
      "/api/trial/convert",
    ];

    for (const path of expectedPaths) {
      expect(body.paths).toHaveProperty(path);
    }
  });

  it("has 23 documented paths", async () => {
    mockRequireAuth.mockResolvedValueOnce({ ok: true, user: MOCK_USER });

    const res = await GET(makeRequest());
    const body = await res.json() as { paths: Record<string, unknown> };
    expect(Object.keys(body.paths)).toHaveLength(23);
  });

  it("sets Cache-Control to no-store", async () => {
    mockRequireAuth.mockResolvedValueOnce({ ok: true, user: MOCK_USER });

    const res = await GET(makeRequest());
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("defines BearerAuth security scheme", async () => {
    mockRequireAuth.mockResolvedValueOnce({ ok: true, user: MOCK_USER });

    const res = await GET(makeRequest());
    const body = await res.json() as typeof openApiSpec;
    expect(body.components.securitySchemes).toHaveProperty("BearerAuth");
  });
});
