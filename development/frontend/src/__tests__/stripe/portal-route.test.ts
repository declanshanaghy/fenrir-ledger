/**
 * Unit tests for POST /api/stripe/portal route handler
 *
 * Covers: auth, rate limiting, portal session creation, redirect URL generation,
 * missing entitlement, and error handling.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/stripe/portal/route";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/stripe/api", () => ({
  stripe: {
    billingPortal: { sessions: { create: vi.fn() } },
  },
}));

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockReturnValue({ success: true }),
}));

import { requireAuth } from "@/lib/auth/require-auth";
import { stripe } from "@/lib/stripe/api";
import { getStripeEntitlement } from "@/lib/kv/entitlement-store";
import { rateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_GOOGLE_SUB = "google_123456789";
const MOCK_CUSTOMER_ID = "cus_test123";
const MOCK_PORTAL_URL = "https://billing.stripe.com/p/session/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRequest(body?: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/stripe/portal", {
    method: "POST",
    headers: {
      Authorization: "Bearer test_token",
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/stripe/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: auth succeeds
    (requireAuth as Mock).mockResolvedValue({
      ok: true,
      user: { sub: MOCK_GOOGLE_SUB, email: "test@example.com" },
    });

    // Default: rate limit allows
    (rateLimit as Mock).mockReturnValue({ success: true });

    // Default env
    process.env.APP_BASE_URL = "https://fenrir-ledger.vercel.app";
  });

  // =========================================================================
  // Authentication
  // =========================================================================

  describe("Authentication", () => {
    it("should return 401 when auth fails", async () => {
      (requireAuth as Mock).mockResolvedValue({
        ok: false,
        response: NextResponse.json(
          { error: "unauthorized", error_description: "Invalid token" },
          { status: 401 },
        ),
      });

      const response = await POST(createMockRequest());
      expect(response.status).toBe(401);
    });
  });

  // =========================================================================
  // Rate limiting
  // =========================================================================

  describe("Rate limiting", () => {
    it("should return 429 when rate limited", async () => {
      (rateLimit as Mock).mockReturnValue({ success: false });

      const response = await POST(createMockRequest());
      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe("rate_limited");
    });
  });

  // =========================================================================
  // Missing entitlement
  // =========================================================================

  describe("No entitlement", () => {
    it("should return 404 when user has no entitlement", async () => {
      (getStripeEntitlement as Mock).mockResolvedValue(null);

      const response = await POST(createMockRequest());
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("not_subscribed");
    });
  });

  // =========================================================================
  // Successful portal session
  // =========================================================================

  describe("Portal session creation", () => {
    it("should create portal session and return URL", async () => {
      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
        stripeSubscriptionId: "sub_test",
        tier: "karl",
        active: true,
      });

      (stripe.billingPortal.sessions.create as Mock).mockResolvedValue({
        url: MOCK_PORTAL_URL,
      });

      const response = await POST(createMockRequest());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.url).toBe(MOCK_PORTAL_URL);

      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: MOCK_CUSTOMER_ID,
          return_url: expect.stringContaining("/ledger/settings"),
        }),
      );
    });

    it("should use custom returnPath when provided", async () => {
      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
      });

      (stripe.billingPortal.sessions.create as Mock).mockResolvedValue({
        url: MOCK_PORTAL_URL,
      });

      const response = await POST(createMockRequest({ returnPath: "/ledger" }));
      expect(response.status).toBe(200);

      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          return_url: expect.stringContaining("/ledger?stripe=portal_return"),
        }),
      );
    });

    it("should use default returnPath when body is invalid", async () => {
      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
      });

      (stripe.billingPortal.sessions.create as Mock).mockResolvedValue({
        url: MOCK_PORTAL_URL,
      });

      const response = await POST(createMockRequest());
      expect(response.status).toBe(200);

      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          return_url: expect.stringContaining("/ledger/settings?stripe=portal_return"),
        }),
      );
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe("Error handling", () => {
    it("should return 500 when Stripe portal creation throws", async () => {
      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
      });

      (stripe.billingPortal.sessions.create as Mock).mockRejectedValue(
        new Error("Stripe API error"),
      );

      const response = await POST(createMockRequest());
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("portal_error");
    });
  });
});
