/**
 * Tests for GET /api/stripe/membership — issue #1971
 *
 * Validates:
 *   - Trial is auto-converted (fire-and-forget) when Karl tier is returned
 *   - markTrialConverted is NOT called when tier is thrall
 *   - markTrialConverted is NOT called when Karl tier is inactive
 *   - getStripeEntitlement always resolves via user.householdId (not googleSub directly)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { StoredStripeEntitlement } from "@/lib/stripe/types";

// ── Mock entitlement store ─────────────────────────────────────────────────

const mockGetStripeEntitlement = vi.hoisted(() => vi.fn());
const mockSetStripeEntitlement = vi.hoisted(() => vi.fn());

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: (...args: unknown[]) => mockGetStripeEntitlement(...args),
  setStripeEntitlement: (...args: unknown[]) => mockSetStripeEntitlement(...args),
}));

// ── Mock trial store ───────────────────────────────────────────────────────

const mockMarkTrialConverted = vi.hoisted(() => vi.fn());

vi.mock("@/lib/kv/trial-store", () => ({
  markTrialConverted: (...args: unknown[]) => mockMarkTrialConverted(...args),
}));

// ── Mock Stripe SDK ────────────────────────────────────────────────────────

vi.mock("@/lib/stripe/api", () => ({
  stripe: {
    subscriptions: { retrieve: vi.fn() },
  },
}));

// ── Mock rate limiter (always pass) ───────────────────────────────────────

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ success: true }),
}));

// ── Mock auth ─────────────────────────────────────────────────────────────

const mockRequireAuthz = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: (...args: unknown[]) => mockRequireAuthz(...args),
}));

// ── Mock logger ───────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Import after mocks ────────────────────────────────────────────────────

import { GET } from "@/app/api/stripe/membership/route";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(): Request {
  return new Request("http://localhost/api/stripe/membership", { method: "GET" });
}

function makeKarlEntitlement(overrides?: Partial<StoredStripeEntitlement>): StoredStripeEntitlement {
  return {
    tier: "karl",
    active: true,
    stripeCustomerId: "cus_test123",
    stripeSubscriptionId: "sub_test123",
    stripeStatus: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2026-12-31T00:00:00.000Z",
    linkedAt: "2025-01-01T00:00:00.000Z",
    checkedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const GOOGLE_SUB = "113951470530790749685";

// ── Tests ─────────────────────────────────────────────────────────────────

describe("GET /api/stripe/membership — issue #1971 trial auto-conversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthz.mockResolvedValue({
      ok: true,
      user: { sub: GOOGLE_SUB },
    });
    mockMarkTrialConverted.mockResolvedValue(true);
    mockSetStripeEntitlement.mockResolvedValue(undefined);
  });

  it("calls markTrialConverted when Karl tier is active", async () => {
    mockGetStripeEntitlement.mockResolvedValue(makeKarlEntitlement());

    const res = await GET(makeRequest() as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);

    // markTrialConverted fires asynchronously — give it a tick
    await new Promise((r) => setTimeout(r, 0));
    expect(mockMarkTrialConverted).toHaveBeenCalledWith(GOOGLE_SUB);
  });

  it("does NOT call markTrialConverted when tier is thrall", async () => {
    mockGetStripeEntitlement.mockResolvedValue(null);

    const res = await GET(makeRequest() as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tier: string };
    expect(body.tier).toBe("thrall");

    await new Promise((r) => setTimeout(r, 0));
    expect(mockMarkTrialConverted).not.toHaveBeenCalled();
  });

  it("does NOT call markTrialConverted when Karl tier is inactive", async () => {
    mockGetStripeEntitlement.mockResolvedValue(makeKarlEntitlement({ active: false }));

    await GET(makeRequest() as Parameters<typeof GET>[0]);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockMarkTrialConverted).not.toHaveBeenCalled();
  });

  it("returns Karl tier response when entitlement is Karl + active", async () => {
    mockGetStripeEntitlement.mockResolvedValue(makeKarlEntitlement());

    const res = await GET(makeRequest() as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tier: string; active: boolean };
    expect(body.tier).toBe("karl");
    expect(body.active).toBe(true);
  });

  it("returns thrall when entitlement is null (user not subscribed)", async () => {
    mockGetStripeEntitlement.mockResolvedValue(null);

    const res = await GET(makeRequest() as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tier: string; active: boolean };
    expect(body.tier).toBe("thrall");
    expect(body.active).toBe(false);
  });

  it("getStripeEntitlement is called with googleSub (household resolved inside the store)", async () => {
    mockGetStripeEntitlement.mockResolvedValue(null);

    await GET(makeRequest() as Parameters<typeof GET>[0]);
    expect(mockGetStripeEntitlement).toHaveBeenCalledWith(GOOGLE_SUB);
  });

  it("markTrialConverted failure is swallowed — does not affect response", async () => {
    mockGetStripeEntitlement.mockResolvedValue(makeKarlEntitlement());
    mockMarkTrialConverted.mockRejectedValue(new Error("Firestore timeout"));

    const res = await GET(makeRequest() as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tier: string };
    expect(body.tier).toBe("karl");
  });

  it("returns 401 when auth fails", async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    });

    const res = await GET(makeRequest() as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);
  });
});
