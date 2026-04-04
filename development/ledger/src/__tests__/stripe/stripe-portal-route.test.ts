/**
 * Unit tests for POST /api/stripe/portal route handler
 *
 * Covers: rate limiting, auth, missing entitlement, success paths,
 * custom returnPath, and Stripe API errors.
 *
 * Issue: #2046
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { StripeEntitlement } from "@/lib/kv/entitlement-store";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockBillingPortalCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe/api", () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: (...args: unknown[]) => mockBillingPortalCreate(...args),
      },
    },
  },
}));

const mockGetEntitlement = vi.hoisted(() => vi.fn<() => Promise<StripeEntitlement | null>>());

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: (...args: unknown[]) => mockGetEntitlement(...args),
  setStripeEntitlement: vi.fn(),
}));

const mockRequireAuthz = vi.hoisted(() => vi.fn().mockResolvedValue({
  ok: true,
  user: { sub: "google-sub-123", email: "test@example.com", name: "Test User", picture: "" },
  firestoreUser: {
    userId: "google-sub-123",
    email: "test@example.com",
    displayName: "Test User",
    householdId: "hh-test",
    role: "owner" as const,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
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

function makeRequest(body?: object, ip = "1.2.3.4"): NextRequest {
  return new NextRequest("http://localhost/api/stripe/portal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const baseEntitlement: StripeEntitlement = {
  tier: "karl",
  active: true,
  stripeCustomerId: "cus_test123",
  stripeSubscriptionId: "sub_test456",
  stripeStatus: "active",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  linkedAt: "2024-01-01T00:00:00Z",
  checkedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/stripe/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockReturnValue({ success: true });
    mockRequireAuthz.mockResolvedValue({
      ok: true,
      user: { sub: "google-sub-123" },
    });
    mockGetEntitlement.mockResolvedValue(baseEntitlement);
    mockBillingPortalCreate.mockResolvedValue({ url: "https://billing.stripe.com/session/abc" });
  });

  it("returns 429 when rate limit exceeded", async () => {
    mockRateLimit.mockReturnValue({ success: false });
    const { POST } = await import("@/app/api/stripe/portal/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("rate_limited");
  });

  it("returns auth response when requireAuthz fails", async () => {
    const authResponse = new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    mockRequireAuthz.mockResolvedValue({ ok: false, response: authResponse });
    const { POST } = await import("@/app/api/stripe/portal/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 when no entitlement found", async () => {
    mockGetEntitlement.mockResolvedValue(null);
    const { POST } = await import("@/app/api/stripe/portal/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("not_subscribed");
  });

  it("returns 200 with portal URL on success (default returnPath)", async () => {
    const { POST } = await import("@/app/api/stripe/portal/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://billing.stripe.com/session/abc");
    expect(mockBillingPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_test123" })
    );
  });

  it("uses default /ledger/settings returnPath when no body provided", async () => {
    const req = new NextRequest("http://localhost/api/stripe/portal", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    const { POST } = await import("@/app/api/stripe/portal/route");
    await POST(req);
    const callArg = mockBillingPortalCreate.mock.calls[0]?.[0] as { return_url: string };
    expect(callArg.return_url).toContain("/ledger/settings");
  });

  it("uses custom returnPath from request body", async () => {
    const { POST } = await import("@/app/api/stripe/portal/route");
    await POST(makeRequest({ returnPath: "/ledger/billing" }));
    const callArg = mockBillingPortalCreate.mock.calls[0]?.[0] as { return_url: string };
    expect(callArg.return_url).toContain("/ledger/billing");
  });

  it("ignores invalid returnPath that does not start with /", async () => {
    const { POST } = await import("@/app/api/stripe/portal/route");
    await POST(makeRequest({ returnPath: "http://evil.com/steal" }));
    const callArg = mockBillingPortalCreate.mock.calls[0]?.[0] as { return_url: string };
    // Falls back to default path
    expect(callArg.return_url).toContain("/ledger/settings");
  });

  it("returns 500 when Stripe session creation throws", async () => {
    mockBillingPortalCreate.mockRejectedValue(new Error("Stripe unavailable"));
    const { POST } = await import("@/app/api/stripe/portal/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("portal_error");
  });
});
