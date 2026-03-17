/**
 * Integration tests for GET /api/admin/pack-status route
 *
 * Tests auth requirements, admin whitelist gating, and response shape.
 *
 * @see src/app/api/admin/pack-status/route.ts
 * @ref #654
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRequireAuthz = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: mockRequireAuthz,
}));

vi.mock("@/lib/admin/auth", () => ({
  isAdmin: vi.fn(),
}));

vi.mock("@/lib/admin/pack-status", () => ({
  getPackStatus: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn() },
}));

import { isAdmin } from "@/lib/admin/auth";
import { getPackStatus } from "@/lib/admin/pack-status";
import { GET } from "@/app/api/admin/pack-status/route";
import { NextResponse } from "next/server";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/admin/pack-status", {
    method: "GET",
    headers: { authorization: "Bearer valid-token" },
  });
}

const ADMIN_USER = {
  sub: "google-sub-123",
  email: "odin@fenrir.dev",
  name: "Odin Allfather",
  picture: "https://example.com/odin.jpg",
};

const MOCK_PACK_STATUS = {
  in_flight: [],
  in_flight_count: 0,
  up_next_count: 0,
  up_next: [],
  open_prs: [],
  verdicts: {
    pass: [],
    fail: [],
    awaiting_loki: [],
    awaiting_decko: [],
    no_response: [],
    research_review: [],
  },
  actions: [],
  fetched_at: "2025-01-01T00:00:00.000Z",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/admin/pack-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Auth required
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 401 when not authenticated", async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: false,
      response: NextResponse.json(
        { error: "missing_token", error_description: "Not authenticated" },
        { status: 401 },
      ),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Admin required
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 403 when authenticated but not admin", async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: true,
      user: { ...ADMIN_USER, email: "loki@fenrir.dev" },
      firestoreUser: { clerkUserId: ADMIN_USER.sub, email: "loki@fenrir.dev", displayName: "Loki", householdId: "hh-1", role: "owner" as const, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    });
    vi.mocked(isAdmin).mockReturnValue(false);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("forbidden");
    expect(body.error_description).toContain("Allfather");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Success
  // ═══════════════════════════════════════════════════════════════════════

  it("returns pack status data for admin user", async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: true,
      user: ADMIN_USER,
      firestoreUser: { clerkUserId: ADMIN_USER.sub, email: ADMIN_USER.email, displayName: ADMIN_USER.name, householdId: "hh-admin", role: "owner" as const, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    });
    vi.mocked(isAdmin).mockReturnValue(true);
    vi.mocked(getPackStatus).mockResolvedValue(MOCK_PACK_STATUS);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.in_flight).toBeDefined();
    expect(body.verdicts).toBeDefined();
    expect(body.actions).toBeDefined();
    expect(body.fetched_at).toBeDefined();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Error handling
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 500 when getPackStatus throws", async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: true,
      user: ADMIN_USER,
      firestoreUser: { clerkUserId: ADMIN_USER.sub, email: ADMIN_USER.email, displayName: ADMIN_USER.name, householdId: "hh-admin", role: "owner" as const, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    });
    vi.mocked(isAdmin).mockReturnValue(true);
    vi.mocked(getPackStatus).mockRejectedValue(new Error("GitHub API down"));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("internal_error");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Response shape
  // ═══════════════════════════════════════════════════════════════════════

  it("returns correct JSON structure", async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: true,
      user: ADMIN_USER,
      firestoreUser: { clerkUserId: ADMIN_USER.sub, email: ADMIN_USER.email, displayName: ADMIN_USER.name, householdId: "hh-admin", role: "owner" as const, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    });
    vi.mocked(isAdmin).mockReturnValue(true);
    vi.mocked(getPackStatus).mockResolvedValue(MOCK_PACK_STATUS);

    const res = await GET(makeRequest());
    const body = await res.json();

    // Verify top-level keys
    expect(body).toHaveProperty("in_flight");
    expect(body).toHaveProperty("in_flight_count");
    expect(body).toHaveProperty("up_next_count");
    expect(body).toHaveProperty("up_next");
    expect(body).toHaveProperty("open_prs");
    expect(body).toHaveProperty("verdicts");
    expect(body).toHaveProperty("actions");
    expect(body).toHaveProperty("fetched_at");

    // Verify verdicts shape
    expect(body.verdicts).toHaveProperty("pass");
    expect(body.verdicts).toHaveProperty("fail");
    expect(body.verdicts).toHaveProperty("awaiting_loki");
    expect(body.verdicts).toHaveProperty("awaiting_decko");
    expect(body.verdicts).toHaveProperty("no_response");
    expect(body.verdicts).toHaveProperty("research_review");
  });
});
