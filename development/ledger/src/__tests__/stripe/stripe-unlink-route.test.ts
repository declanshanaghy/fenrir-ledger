/**
 * Unit tests for POST /api/stripe/unlink route handler
 *
 * Covers: rate limiting, auth, idempotent success with no entitlement,
 * subscription cancellation, KV write with preserved customer ID,
 * Stripe cancel error resilience, and outer 500 error.
 *
 * Issue: #2046
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { StripeEntitlement } from "@/lib/kv/entitlement-store";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSubscriptionsCancel = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe/api", () => ({
  stripe: {
    subscriptions: {
      cancel: (...args: unknown[]) => mockSubscriptionsCancel(...args),
    },
  },
}));

const mockGetEntitlement = vi.hoisted(() => vi.fn<() => Promise<StripeEntitlement | null>>());
const mockSetEntitlement = vi.hoisted(() => vi.fn());

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: (...args: unknown[]) => mockGetEntitlement(...args),
  setStripeEntitlement: (...args: unknown[]) => mockSetEntitlement(...args),
}));

const mockRequireAuthz = vi.hoisted(() => vi.fn().mockResolvedValue({
  ok: true,
  user: { sub: "google-sub-123" },
}));

vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: (...args: unknown[]) => mockRequireAuthz(...args),
}));

const mockRateLimit = vi.hoisted(() => vi.fn().mockReturnValue({ success: true }));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(ip = "1.2.3.4"): NextRequest {
  return new NextRequest("http://localhost/api/stripe/unlink", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

const baseEntitlement: StripeEntitlement = {
  tier: "karl",
  active: true,
  stripeCustomerId: "cus_abc",
  stripeSubscriptionId: "sub_def",
  stripeStatus: "active",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  linkedAt: "2024-01-01T00:00:00Z",
  checkedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/stripe/unlink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockReturnValue({ success: true });
    mockRequireAuthz.mockResolvedValue({ ok: true, user: { sub: "google-sub-123" } });
    mockGetEntitlement.mockResolvedValue(baseEntitlement);
    mockSubscriptionsCancel.mockResolvedValue({});
    mockSetEntitlement.mockResolvedValue(undefined);
  });

  it("returns 429 when rate limit exceeded", async () => {
    mockRateLimit.mockReturnValue({ success: false });
    const { POST } = await import("@/app/api/stripe/unlink/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("rate_limited");
  });

  it("returns auth response when requireAuthz fails", async () => {
    const authResponse = new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    mockRequireAuthz.mockResolvedValue({ ok: false, response: authResponse });
    const { POST } = await import("@/app/api/stripe/unlink/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 200 success when no entitlement exists (idempotent)", async () => {
    mockGetEntitlement.mockResolvedValue(null);
    const { POST } = await import("@/app/api/stripe/unlink/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockSubscriptionsCancel).not.toHaveBeenCalled();
    expect(mockSetEntitlement).not.toHaveBeenCalled();
  });

  it("cancels the subscription at Stripe and writes canceled entitlement", async () => {
    const { POST } = await import("@/app/api/stripe/unlink/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockSubscriptionsCancel).toHaveBeenCalledWith("sub_def");
    expect(mockSetEntitlement).toHaveBeenCalledWith(
      "google-sub-123",
      expect.objectContaining({
        tier: "thrall",
        active: false,
        stripeCustomerId: "cus_abc",
        stripeStatus: "canceled",
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("still writes canceled entitlement when Stripe cancel throws", async () => {
    mockSubscriptionsCancel.mockRejectedValue(new Error("already canceled"));
    const { POST } = await import("@/app/api/stripe/unlink/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    // KV write should still happen despite Stripe error
    expect(mockSetEntitlement).toHaveBeenCalledWith(
      "google-sub-123",
      expect.objectContaining({ tier: "thrall", active: false })
    );
  });

  it("returns 200 when entitlement has no subscriptionId (no cancel call)", async () => {
    mockGetEntitlement.mockResolvedValue({
      ...baseEntitlement,
      stripeSubscriptionId: undefined,
    });
    const { POST } = await import("@/app/api/stripe/unlink/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockSubscriptionsCancel).not.toHaveBeenCalled();
    // KV write still happens because stripeCustomerId exists
    expect(mockSetEntitlement).toHaveBeenCalled();
  });

  it("returns 500 when outer try/catch fires", async () => {
    mockGetEntitlement.mockRejectedValue(new Error("KV store down"));
    const { POST } = await import("@/app/api/stripe/unlink/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("unlink_failed");
  });
});
