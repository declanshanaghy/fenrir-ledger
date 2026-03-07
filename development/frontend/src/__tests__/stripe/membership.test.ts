/**
 * Unit tests for membership route handlers
 */

import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/stripe/membership/route";

// Mock the dependencies
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/stripe/api", () => ({
  stripe: {
    checkout: {
      sessions: {
        retrieve: vi.fn(),
      },
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  },
}));

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: vi.fn(),
  setStripeEntitlement: vi.fn(),
  migrateStripeEntitlement: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockReturnValue({ success: true }),
}));

import { requireAuth } from "@/lib/auth/require-auth";
import { stripe } from "@/lib/stripe/api";
import {
  getStripeEntitlement,
  setStripeEntitlement,
  migrateStripeEntitlement,
} from "@/lib/kv/entitlement-store";

describe("GET /api/stripe/membership", () => {
  const mockGoogleSub = "google_123456789";
  const mockCustomerId = "cus_test123";
  const mockSubscriptionId = "sub_test456";
  const mockSessionId = "cs_test789";
  const mockPeriodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now
  const mockCancelAt = Math.floor(Date.now() / 1000) + 15 * 24 * 60 * 60; // 15 days from now

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));

    // Default auth success
    (requireAuth as Mock).mockResolvedValue({
      ok: true,
      user: {
        sub: mockGoogleSub,
        email: "test@example.com",
      },
    });
  });

  const createMockRequest = (params?: Record<string, string>): NextRequest => {
    const url = new URL("http://localhost:3000/api/stripe/membership");
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return new NextRequest(url, {
      method: "GET",
      headers: {
        Authorization: "Bearer test_token",
      },
    });
  };

  describe("No entitlement", () => {
    it("should return tier: 'thrall', active: false when no entitlement exists", async () => {
      (getStripeEntitlement as Mock).mockResolvedValue(null);

      const request = createMockRequest();
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toEqual({
        tier: "thrall",
        active: false,
        platform: "stripe",
        checkedAt: "2024-01-15T10:00:00.000Z",
      });
    });
  });

  describe("Backfill scenarios", () => {
    it("should backfill cancelAtPeriodEnd: true for subscription with cancel_at", async () => {
      const mockEntitlement = {
        tier: "karl",
        active: true,
        stripeCustomerId: mockCustomerId,
        stripeSubscriptionId: mockSubscriptionId,
        stripeStatus: "active",
        linkedAt: "2024-01-01T00:00:00Z",
        checkedAt: "2024-01-14T00:00:00Z",
        // Missing cancelAtPeriodEnd and currentPeriodEnd (pre-existing record)
      };

      const mockSubscription: any = {
        id: mockSubscriptionId,
        status: "active",
        cancel_at_period_end: false,
        cancel_at: mockCancelAt, // Set cancel_at
        items: {
          object: "list",
          data: [{
            id: "si_test",
            object: "subscription_item",
            subscription: mockSubscriptionId,
            current_period_end: mockPeriodEnd,
            current_period_start: Math.floor(Date.now() / 1000),
          }],
          has_more: false,
          url: "",
        },
      };

      (getStripeEntitlement as Mock).mockResolvedValue(mockEntitlement);
      (stripe.subscriptions.retrieve as Mock).mockResolvedValue(mockSubscription);

      const request = createMockRequest();
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(result.currentPeriodEnd).toBe(new Date(mockCancelAt * 1000).toISOString());

      expect(setStripeEntitlement).toHaveBeenCalledWith(
        mockGoogleSub,
        expect.objectContaining({
          ...mockEntitlement,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: new Date(mockCancelAt * 1000).toISOString(),
          stripeStatus: "active",
          checkedAt: "2024-01-15T10:00:00.000Z",
        })
      );
    });

    it("should backfill cancelAtPeriodEnd: true for subscription with cancel_at_period_end", async () => {
      const mockEntitlement = {
        tier: "karl",
        active: true,
        stripeCustomerId: mockCustomerId,
        stripeSubscriptionId: mockSubscriptionId,
        stripeStatus: "active",
        linkedAt: "2024-01-01T00:00:00Z",
        checkedAt: "2024-01-14T00:00:00Z",
      };

      const mockSubscription: any = {
        id: mockSubscriptionId,
        status: "active",
        cancel_at_period_end: true, // Set cancel_at_period_end
        cancel_at: null,
        items: {
          object: "list",
          data: [{
            id: "si_test",
            object: "subscription_item",
            subscription: mockSubscriptionId,
            current_period_end: mockPeriodEnd,
            current_period_start: Math.floor(Date.now() / 1000),
          }],
          has_more: false,
          url: "",
        },
      };

      (getStripeEntitlement as Mock).mockResolvedValue(mockEntitlement);
      (stripe.subscriptions.retrieve as Mock).mockResolvedValue(mockSubscription);

      const request = createMockRequest();
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(result.currentPeriodEnd).toBe(new Date(mockPeriodEnd * 1000).toISOString());
    });
  });

  describe("Migration scenarios", () => {
    it("should migrate anonymous entitlement to Google sub via session_id param", async () => {
      (getStripeEntitlement as Mock)
        .mockResolvedValueOnce(null) // First call: no entitlement
        .mockResolvedValueOnce({ // Second call after migration: entitlement exists
          tier: "karl",
          active: true,
          stripeCustomerId: mockCustomerId,
          stripeSubscriptionId: mockSubscriptionId,
          stripeStatus: "active",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: new Date(mockPeriodEnd * 1000).toISOString(),
          linkedAt: "2024-01-15T10:00:00.000Z",
          checkedAt: "2024-01-15T10:00:00.000Z",
        });

      (stripe.checkout.sessions.retrieve as Mock).mockResolvedValue({
        id: mockSessionId,
        customer: mockCustomerId,
      });

      (migrateStripeEntitlement as Mock).mockResolvedValue({
        migrated: true,
        from: `stripe:${mockCustomerId}`,
        to: mockGoogleSub,
      });

      const request = createMockRequest({ session_id: mockSessionId });
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.tier).toBe("karl");
      expect(result.active).toBe(true);

      expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith(mockSessionId);
      expect(migrateStripeEntitlement).toHaveBeenCalledWith(mockCustomerId, mockGoogleSub);
      expect(getStripeEntitlement).toHaveBeenCalledTimes(2);
    });

    it("should handle failed migration gracefully", async () => {
      (getStripeEntitlement as Mock).mockResolvedValue(null);
      (stripe.checkout.sessions.retrieve as Mock).mockRejectedValue(new Error("Session not found"));

      const request = createMockRequest({ session_id: "invalid_session" });
      const response = await GET(request);
      const result = await response.json();

      // Should still return thrall tier
      expect(response.status).toBe(200);
      expect(result).toEqual({
        tier: "thrall",
        active: false,
        platform: "stripe",
        checkedAt: "2024-01-15T10:00:00.000Z",
      });
    });
  });

  describe("Existing entitlement", () => {
    it("should return cached entitlement with all fields populated", async () => {
      const mockEntitlement = {
        tier: "karl" as const,
        active: true,
        stripeCustomerId: mockCustomerId,
        stripeSubscriptionId: mockSubscriptionId,
        stripeStatus: "active",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date(mockPeriodEnd * 1000).toISOString(),
        linkedAt: "2024-01-01T00:00:00Z",
        checkedAt: "2024-01-14T00:00:00Z",
      };

      (getStripeEntitlement as Mock).mockResolvedValue(mockEntitlement);

      const request = createMockRequest();
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result).toEqual({
        tier: "karl",
        active: true,
        platform: "stripe",
        checkedAt: "2024-01-14T00:00:00Z",
        customerId: mockCustomerId,
        linkedAt: "2024-01-01T00:00:00Z",
        stripeStatus: "active",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date(mockPeriodEnd * 1000).toISOString(),
      });

      // Should not attempt to backfill
      expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    });
  });

  describe("Authentication and rate limiting", () => {
    it("should return 401 when authentication fails", async () => {
      (requireAuth as Mock).mockResolvedValue({
        ok: false,
        response: NextResponse.json(
          { error: "unauthorized", error_description: "Invalid token" },
          { status: 401 }
        ),
      });

      const request = createMockRequest();
      const response = await GET(request);

      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result.error).toBe("unauthorized");
    });
  });
});