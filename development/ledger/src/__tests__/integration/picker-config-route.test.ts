/**
 * /api/config/picker — API route handler integration tests
 *
 * Validates auth, Karl-or-trial gating, and API key response.
 * Covers fix for issue #982: trial users must receive 200, not 402.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireAuthz = vi.fn();
vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: (...args: unknown[]) => mockRequireAuthz(...args),
}));

vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:9653/api/config/picker", {
    method: "GET",
    headers,
  });
}

const MOCK_USER = { sub: "user-123", email: "test@test.com", name: "Test User", picture: "" };
const MOCK_FIRESTORE_USER = {
  userId: "user-123",
  email: "test@test.com",
  displayName: "Test User",
  householdId: "hh-test",
  role: "owner" as const,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

let GET: typeof import("@/app/api/config/picker/route").GET;

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  mockRequireAuthz.mockResolvedValue({ ok: true, user: MOCK_USER, firestoreUser: MOCK_FIRESTORE_USER });
  process.env.GOOGLE_PICKER_API_KEY = "test-picker-key-abc";

  const mod = await import("@/app/api/config/picker/route");
  GET = mod.GET;
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.GOOGLE_PICKER_API_KEY;
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("/api/config/picker — Auth & tier gating", () => {
  it("returns 401 when auth fails", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireAuthz.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { error: "missing_token", error_description: "Missing auth token" },
        { status: 401 },
      ),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 402 when Karl/trial check fails (Thrall user, no trial)", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireAuthz.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        {
          error: "subscription_required",
          required_tier: "karl",
          current_tier: "thrall",
          message: "Upgrade to Karl or start a free trial to access this feature.",
        },
        { status: 402 },
      ),
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.error).toBe("subscription_required");
  });

  it("returns 402 when trial has expired", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireAuthz.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        {
          error: "subscription_required",
          required_tier: "karl",
          current_tier: "thrall",
          message: "Upgrade to Karl or start a free trial to access this feature.",
        },
        { status: 402 },
      ),
    });

    const res = await GET(makeRequest({ "x-trial-fingerprint": "expired-fingerprint" }));
    expect(res.status).toBe(402);
  });

  it("returns 200 for trial user with active trial (#982)", async () => {
    // requireAuthz returns ok:true for active trial users
    mockRequireAuthz.mockResolvedValueOnce({ ok: true, user: MOCK_USER, firestoreUser: MOCK_FIRESTORE_USER });

    const res = await GET(makeRequest({ "x-trial-fingerprint": "valid-fingerprint-abc123" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pickerApiKey).toBe("test-picker-key-abc");
  });

  it("returns 200 for Karl-tier user", async () => {
    mockRequireAuthz.mockResolvedValueOnce({ ok: true, user: MOCK_USER, firestoreUser: MOCK_FIRESTORE_USER });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pickerApiKey).toBe("test-picker-key-abc");
  });

  it("calls requireAuthz with tier: karl-or-trial so trial header is readable", async () => {
    const req = makeRequest({ "x-trial-fingerprint": "fp-xyz" });

    await GET(req);

    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.anything(),
      { tier: "karl-or-trial" },
    );
  });
});

describe("/api/config/picker — API key handling", () => {
  it("returns 500 when GOOGLE_PICKER_API_KEY is not set", async () => {
    delete process.env.GOOGLE_PICKER_API_KEY;

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("not_configured");
  });

  it("returns pickerApiKey in body with no-store cache header", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pickerApiKey).toBe("test-picker-key-abc");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
