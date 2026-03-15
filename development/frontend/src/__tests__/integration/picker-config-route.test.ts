/**
 * /api/config/picker — API route handler integration tests
 *
 * Validates auth, Karl-or-trial gating, and API key response.
 * Covers fix for issue #982: trial users must receive 200, not 402.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockRequireKarlOrTrial = vi.fn();
vi.mock("@/lib/auth/require-karl-or-trial", () => ({
  requireKarlOrTrial: (...args: unknown[]) => mockRequireKarlOrTrial(...args),
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

const MOCK_USER = { sub: "user-123", email: "test@test.com" };

let GET: typeof import("@/app/api/config/picker/route").GET;

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  mockRequireAuth.mockResolvedValue({ ok: true, user: MOCK_USER });
  mockRequireKarlOrTrial.mockResolvedValue({ ok: true });
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
    mockRequireAuth.mockResolvedValueOnce({
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
    mockRequireKarlOrTrial.mockResolvedValueOnce({
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
    mockRequireKarlOrTrial.mockResolvedValueOnce({
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
    // requireKarlOrTrial returns ok:true for active trial users
    mockRequireKarlOrTrial.mockResolvedValueOnce({ ok: true });

    const res = await GET(makeRequest({ "x-trial-fingerprint": "valid-fingerprint-abc123" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pickerApiKey).toBe("test-picker-key-abc");
  });

  it("returns 200 for Karl-tier user", async () => {
    mockRequireKarlOrTrial.mockResolvedValueOnce({ ok: true });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pickerApiKey).toBe("test-picker-key-abc");
  });

  it("passes request to requireKarlOrTrial so trial header is readable", async () => {
    mockRequireKarlOrTrial.mockResolvedValueOnce({ ok: true });
    const req = makeRequest({ "x-trial-fingerprint": "fp-xyz" });

    await GET(req);

    expect(mockRequireKarlOrTrial).toHaveBeenCalledWith(
      MOCK_USER,
      expect.objectContaining({ headers: expect.anything() }),
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
