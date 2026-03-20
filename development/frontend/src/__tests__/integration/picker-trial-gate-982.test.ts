/**
 * Loki QA augmentation tests — issue #982
 *
 * Regression guard: /api/config/picker MUST use requireAuthz with tier: karl-or-trial,
 * not requireKarl. Trial users must receive 200, not 402.
 *
 * Gaps covered beyond FiremanDecko's existing tests:
 *  1. Hook returns null + no key when route returns 402 (trial-blocked user)
 *  2. Route calls requireAuthz with { tier: "karl-or-trial" } (regression guard)
 *  3. Empty-string GOOGLE_PICKER_API_KEY is treated as unconfigured (500)
 *  4. Trial user receives the actual pickerApiKey value in the response body
 *  5. Karl user response body contains pickerApiKey (not just status 200)
 *
 * @ref #982
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { renderHook, waitFor } from "@testing-library/react";

// ── Route handler mocks ──────────────────────────────────────────────────────

// requireAuthz is the CORRECT guard — it must be called with tier: "karl-or-trial"
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

// ── Hook mocks ────────────────────────────────────────────────────────────────

let mockAuthStatus = "authenticated";
vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => ({
    status: mockAuthStatus,
    session: null,
    householdId: "test-household",
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn().mockResolvedValue("mock-bearer-token"),
}));

const mockFetch = vi.fn();

// ── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_USER = { sub: "user-trial-456", email: "trial@fenrir.dev" };
const PICKER_KEY = "test-picker-api-key-loki";

function makeRouteRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:9653/api/config/picker", {
    method: "GET",
    headers,
  });
}

let GET: typeof import("@/app/api/config/picker/route").GET;

// ── Setup ────────────────────────────────────────────────────────────────────

const MOCK_FIRESTORE_USER = { userId: MOCK_USER.sub, email: MOCK_USER.email, displayName: "Trial User", householdId: "hh-trial", role: "owner" as const, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" };

beforeEach(async () => {
  // Default: authenticated + Karl-or-trial passes
  mockRequireAuthz.mockResolvedValue({ ok: true, user: MOCK_USER, firestoreUser: MOCK_FIRESTORE_USER });
  process.env.GOOGLE_PICKER_API_KEY = PICKER_KEY;

  const mod = await import("@/app/api/config/picker/route");
  GET = mod.GET;

  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  mockAuthStatus = "authenticated";
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_PICKER_API_KEY;
});

// ── Regression guard ─────────────────────────────────────────────────────────

describe("Regression guard — picker route MUST use requireAuthz with tier: karl-or-trial (#982, ADR-015)", () => {
  it("calls requireAuthz with { tier: 'karl-or-trial' } for every request", async () => {
    await GET(makeRouteRequest());

    expect(mockRequireAuthz).toHaveBeenCalledOnce();
    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.anything(),
      { tier: "karl-or-trial" },
    );
  });

  it("returns 401 when auth fails", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireAuthz.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const res = await GET(makeRouteRequest());
    expect(res.status).toBe(401);
  });
});

// ── Trial user path ───────────────────────────────────────────────────────────

describe("Trial user — route returns 200 + pickerApiKey (#982 core fix)", () => {
  it("returns pickerApiKey value (not just 200) for active trial user", async () => {
    // Default beforeEach mock: requireAuthz returns ok:true (trial user passes karl-or-trial)
    const res = await GET(
      makeRouteRequest({ "x-trial-fingerprint": "abc123fingerprint456" }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pickerApiKey).toBe(PICKER_KEY);
    expect(typeof body.pickerApiKey).toBe("string");
    expect(body.pickerApiKey.length).toBeGreaterThan(0);
  });

  it("request headers are forwarded to requireAuthz (tier gate can inspect fingerprint)", async () => {
    const fingerprint = "trial-fingerprint-xyz789";

    await GET(makeRouteRequest({ "x-trial-fingerprint": fingerprint }));

    // requireAuthz receives the full request object so the tier gate can read headers
    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.anything() }),
      { tier: "karl-or-trial" },
    );
  });
});

// ── Karl user path ────────────────────────────────────────────────────────────

describe("Karl subscriber — existing behavior preserved", () => {
  it("returns pickerApiKey value (not just 200) for Karl subscriber", async () => {
    // Default beforeEach mock: requireAuthz returns ok:true (Karl passes karl-or-trial)
    const res = await GET(makeRouteRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pickerApiKey).toBe(PICKER_KEY);
  });
});

// ── Free-tier / no-trial path ─────────────────────────────────────────────────

describe("Free-tier user (no trial) — blocked with 402", () => {
  it("returns 402 with subscription_required error body for free-tier user", async () => {
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

    const res = await GET(makeRouteRequest());

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("subscription_required");
    expect(body.required_tier).toBe("karl");
    expect(body.current_tier).toBe("thrall");
    expect(typeof body.message).toBe("string");
  });
});

// ── Edge case: empty-string GOOGLE_PICKER_API_KEY ────────────────────────────

describe("API key configuration edge cases", () => {
  it("returns 500 when GOOGLE_PICKER_API_KEY is empty string (misconfiguration)", async () => {
    // Empty string is falsy in JS — should be treated as not configured
    process.env.GOOGLE_PICKER_API_KEY = "";

    const res = await GET(makeRouteRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("not_configured");
  });
});

// ── Hook: 402 graceful degradation ───────────────────────────────────────────

describe("usePickerConfig hook — 402 graceful degradation for trial-blocked users", () => {
  it("returns null pickerApiKey when route returns 402 (trial blocked)", async () => {
    const { usePickerConfig } = await import("@/hooks/usePickerConfig");

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "subscription_required",
          required_tier: "karl",
          current_tier: "thrall",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { result } = renderHook(() => usePickerConfig());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.pickerApiKey).toBeNull();
  });

  it("returns null pickerApiKey when route returns 402 (expired trial)", async () => {
    const { usePickerConfig } = await import("@/hooks/usePickerConfig");

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "subscription_required" }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { result } = renderHook(() => usePickerConfig());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.pickerApiKey).toBeNull();
  });
});
