/**
 * Unit tests for POST /api/stripe/unlink route handler
 *
 * Covers: auth, rate limiting, successful unlink, missing subscription,
 * subscription already cancelled, customer ID preservation, and error handling.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/stripe/unlink/route";

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
    subscriptions: { cancel: vi.fn() },
  },
}));

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: vi.fn(),
  setStripeEntitlement: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockReturnValue({ success: true }),
}));

import { requireAuth } from "@/lib/auth/require-auth";
import { stripe } from "@/lib/stripe/api";
import {
  getStripeEntitlement,
  setStripeEntitlement,
} from "@/lib/kv/entitlement-store";
import { rateLimit } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_GOOGLE_SUB = "google_123456789";
const MOCK_CUSTOMER_ID = "cus_test123";
const MOCK_SUBSCRIPTION_ID = "sub_test456";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/stripe/unlink", {
    method: "POST",
    headers: {
      Authorization: "Bearer test_token",
      "x-forwarded-for": "127.0.0.1",
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/stripe/unlink", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: auth succeeds
    (requireAuth as Mock).mockResolvedValue({
      ok: true,
      user: { sub: MOCK_GOOGLE_SUB, email: "test@example.com" },
    });

    // Default: rate limit allows
    (rateLimit as Mock).mockReturnValue({ success: true });
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
  // Successful unlink
  // =========================================================================

  describe("Successful unlink", () => {
    it("should cancel subscription and write canceled entitlement preserving customer ID", async () => {
      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
        stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
        stripeStatus: "active",
        tier: "karl",
        active: true,
        currentPeriodEnd: "2024-02-15T10:00:00.000Z",
        linkedAt: "2024-01-01T00:00:00Z",
      });

      (stripe.subscriptions.cancel as Mock).mockResolvedValue({
        id: MOCK_SUBSCRIPTION_ID,
        status: "canceled",
      });

      const response = await POST(createMockRequest());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Must cancel at Stripe
      expect(stripe.subscriptions.cancel).toHaveBeenCalledWith(MOCK_SUBSCRIPTION_ID);

      // Must preserve customer ID in KV (Ref #545)
      expect(setStripeEntitlement).toHaveBeenCalledWith(
        MOCK_GOOGLE_SUB,
        expect.objectContaining({
          tier: "thrall",
          active: false,
          stripeCustomerId: MOCK_CUSTOMER_ID,
          stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
          stripeStatus: "canceled",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: "2024-02-15T10:00:00.000Z",
          linkedAt: "2024-01-01T00:00:00Z",
        }),
      );
    });

    it("should set Cache-Control: no-store header", async () => {
      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
        stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
        linkedAt: "2024-01-01T00:00:00Z",
        currentPeriodEnd: "2024-02-15T10:00:00.000Z",
      });

      (stripe.subscriptions.cancel as Mock).mockResolvedValue({});

      const response = await POST(createMockRequest());
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });
  });

  // =========================================================================
  // Missing subscription
  // =========================================================================

  describe("Missing subscription", () => {
    it("should return success when no entitlement exists (idempotent)", async () => {
      (getStripeEntitlement as Mock).mockResolvedValue(null);

      const response = await POST(createMockRequest());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
      expect(setStripeEntitlement).not.toHaveBeenCalled();
    });

    it("should return success when entitlement has no subscription ID", async () => {
      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
        // No stripeSubscriptionId
      });

      const response = await POST(createMockRequest());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Already cancelled subscription
  // =========================================================================

  describe("Already cancelled subscription", () => {
    it("should handle Stripe cancel failure gracefully (subscription already cancelled)", async () => {
      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
        stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
        currentPeriodEnd: "2024-02-15T10:00:00.000Z",
        linkedAt: "2024-01-01T00:00:00Z",
      });

      (stripe.subscriptions.cancel as Mock).mockRejectedValue(
        new Error("No such subscription: sub_test456"),
      );

      const response = await POST(createMockRequest());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Should still write canceled entitlement preserving customer ID
      expect(setStripeEntitlement).toHaveBeenCalledWith(
        MOCK_GOOGLE_SUB,
        expect.objectContaining({
          tier: "thrall",
          active: false,
          stripeCustomerId: MOCK_CUSTOMER_ID,
        }),
      );
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe("Error handling", () => {
    it("should return 500 when getStripeEntitlement throws", async () => {
      (getStripeEntitlement as Mock).mockRejectedValue(
        new Error("KV connection failed"),
      );

      const response = await POST(createMockRequest());
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("unlink_failed");
    });
  });
});
