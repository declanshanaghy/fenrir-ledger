/**
 * Integration tests for Stripe webhook handlers with mocked Stripe SDK
 */

import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/stripe/webhook/route";
import type Stripe from "stripe";

// Mock the modules
vi.mock("@/lib/stripe/api", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  },
}));

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: vi.fn(),
  setStripeEntitlement: vi.fn(),
  getGoogleSubByStripeCustomerId: vi.fn(),
  setAnonymousStripeEntitlement: vi.fn(),
  getAnonymousStripeEntitlement: vi.fn(),
  isAnonymousStripeReverseIndex: vi.fn(),
  extractStripeCustomerIdFromReverseIndex: vi.fn(),
}));

import { stripe } from "@/lib/stripe/api";
import {
  setStripeEntitlement,
  setAnonymousStripeEntitlement,
  getGoogleSubByStripeCustomerId,
  getStripeEntitlement,
  isAnonymousStripeReverseIndex,
} from "@/lib/kv/entitlement-store";

describe("Stripe Webhook Integration", () => {
  const mockCustomerId = "cus_test123";
  const mockSubscriptionId = "sub_test456";
  const mockSessionId = "cs_test789";
  const mockGoogleSub = "google_123456789";
  const mockSignature = "stripe_signature_test";
  const mockPeriodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now
  const mockCancelAt = Math.floor(Date.now() / 1000) + 15 * 24 * 60 * 60; // 15 days from now

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_secret");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));
  });

  const createMockRequest = (body: object, signature: string = mockSignature): NextRequest => {
    const rawBody = JSON.stringify(body);
    return new NextRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: {
        "stripe-signature": signature,
        "content-type": "application/json",
      },
      body: rawBody,
    });
  };

  const createMockSubscription = (overrides?: any): any => ({
    id: mockSubscriptionId,
    object: "subscription",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    customer: mockCustomerId,
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
    ...overrides,
  });

  describe("checkout.session.completed", () => {
    it("should create entitlement under Google sub when googleSub metadata is present", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_test",
        object: "event",
        api_version: "2026-02-25.clover",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: mockSessionId,
            object: "checkout.session",
            customer: mockCustomerId,
            subscription: mockSubscriptionId,
            metadata: { googleSub: mockGoogleSub },
          } as any,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
        type: "checkout.session.completed",
      };

      const mockSubscription = createMockSubscription();

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(mockEvent);
      (stripe.subscriptions.retrieve as Mock).mockResolvedValue(mockSubscription);

      const request = createMockRequest(mockEvent);
      const response = await POST(request);
      const result = await response.json();

      expect(result.status).toBe("processed");
      expect(result.eventType).toBe("checkout.session.completed");
      expect(result.tier).toBe("karl");
      expect(result.active).toBe(true);
      expect(result.anonymous).toBe(false);

      expect(setStripeEntitlement).toHaveBeenCalledWith(
        mockGoogleSub,
        expect.objectContaining({
          tier: "karl",
          active: true,
          stripeCustomerId: mockCustomerId,
          stripeSubscriptionId: mockSubscriptionId,
          stripeStatus: "active",
          cancelAtPeriodEnd: false,
        })
      );

      expect(setAnonymousStripeEntitlement).not.toHaveBeenCalled();
    });

    it("should create anonymous entitlement when googleSub metadata is absent", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_test",
        object: "event",
        api_version: "2026-02-25.clover",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: mockSessionId,
            object: "checkout.session",
            customer: mockCustomerId,
            subscription: mockSubscriptionId,
            metadata: {}, // No googleSub
          } as any,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
        type: "checkout.session.completed",
      };

      const mockSubscription = createMockSubscription();

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(mockEvent);
      (stripe.subscriptions.retrieve as Mock).mockResolvedValue(mockSubscription);

      const request = createMockRequest(mockEvent);
      const response = await POST(request);
      const result = await response.json();

      expect(result.status).toBe("processed");
      expect(result.eventType).toBe("checkout.session.completed");
      expect(result.tier).toBe("karl");
      expect(result.active).toBe(true);
      expect(result.anonymous).toBe(true);

      expect(setAnonymousStripeEntitlement).toHaveBeenCalledWith(
        mockCustomerId,
        expect.objectContaining({
          tier: "karl",
          active: true,
          stripeCustomerId: mockCustomerId,
          stripeSubscriptionId: mockSubscriptionId,
          stripeStatus: "active",
          cancelAtPeriodEnd: false,
        })
      );

      expect(setStripeEntitlement).not.toHaveBeenCalled();
    });
  });

  describe("customer.subscription.updated", () => {
    it("should update entitlement with cancel_at setting cancelAtPeriodEnd: true", async () => {
      const mockSubscription = createMockSubscription({
        status: "active",
        cancel_at: mockCancelAt,
      });

      const mockEvent: Stripe.Event = {
        id: "evt_test",
        object: "event",
        api_version: "2026-02-25.clover",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: mockSubscription,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
        type: "customer.subscription.updated",
      };

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(mockEvent);
      (getGoogleSubByStripeCustomerId as Mock).mockResolvedValue(mockGoogleSub);
      (isAnonymousStripeReverseIndex as Mock).mockReturnValue(false);
      (getStripeEntitlement as Mock).mockResolvedValue({
        linkedAt: "2024-01-01T00:00:00Z",
      });

      const request = createMockRequest(mockEvent);
      const response = await POST(request);
      const result = await response.json();

      expect(result.status).toBe("processed");
      expect(result.eventType).toBe("customer.subscription.updated");
      expect(result.tier).toBe("karl");
      expect(result.active).toBe(true);

      expect(setStripeEntitlement).toHaveBeenCalledWith(
        mockGoogleSub,
        expect.objectContaining({
          tier: "karl",
          active: true,
          stripeCustomerId: mockCustomerId,
          stripeSubscriptionId: mockSubscriptionId,
          stripeStatus: "active",
          cancelAtPeriodEnd: true,
          currentPeriodEnd: new Date(mockCancelAt * 1000).toISOString(),
        })
      );
    });

    it("should update entitlement with status active storing tier: 'karl', active: true", async () => {
      const mockSubscription = createMockSubscription({
        status: "active",
      });

      const mockEvent: Stripe.Event = {
        id: "evt_test",
        object: "event",
        api_version: "2026-02-25.clover",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: mockSubscription,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
        type: "customer.subscription.updated",
      };

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(mockEvent);
      (getGoogleSubByStripeCustomerId as Mock).mockResolvedValue(mockGoogleSub);
      (isAnonymousStripeReverseIndex as Mock).mockReturnValue(false);
      (getStripeEntitlement as Mock).mockResolvedValue({
        linkedAt: "2024-01-01T00:00:00Z",
      });

      const request = createMockRequest(mockEvent);
      const response = await POST(request);
      const result = await response.json();

      expect(result.status).toBe("processed");
      expect(result.tier).toBe("karl");
      expect(result.active).toBe(true);

      expect(setStripeEntitlement).toHaveBeenCalledWith(
        mockGoogleSub,
        expect.objectContaining({
          tier: "karl",
          active: true,
          stripeStatus: "active",
        })
      );
    });
  });

  describe("customer.subscription.deleted", () => {
    it("should store tier: 'thrall', active: false when subscription is deleted", async () => {
      const mockSubscription = createMockSubscription({
        status: "canceled",
      });

      const mockEvent: Stripe.Event = {
        id: "evt_test",
        object: "event",
        api_version: "2026-02-25.clover",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: mockSubscription,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
        type: "customer.subscription.deleted",
      };

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(mockEvent);
      (getGoogleSubByStripeCustomerId as Mock).mockResolvedValue(mockGoogleSub);
      (isAnonymousStripeReverseIndex as Mock).mockReturnValue(false);
      (getStripeEntitlement as Mock).mockResolvedValue({
        linkedAt: "2024-01-01T00:00:00Z",
      });

      const request = createMockRequest(mockEvent);
      const response = await POST(request);
      const result = await response.json();

      expect(result.status).toBe("processed");
      expect(result.eventType).toBe("customer.subscription.deleted");
      expect(result.tier).toBe("thrall");
      expect(result.active).toBe(false);

      expect(setStripeEntitlement).toHaveBeenCalledWith(
        mockGoogleSub,
        expect.objectContaining({
          tier: "thrall",
          active: false,
          stripeCustomerId: mockCustomerId,
          stripeSubscriptionId: mockSubscriptionId,
          stripeStatus: "canceled",
          cancelAtPeriodEnd: false,
        })
      );
    });
  });

  describe("Unknown event type", () => {
    it("should return status: 'ignored' for unknown event type", async () => {
      const mockEvent: Stripe.Event = {
        id: "evt_test",
        object: "event",
        api_version: "2026-02-25.clover",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {} as any,
        },
        livemode: false,
        pending_webhooks: 0,
        request: null,
        type: "invoice.payment_succeeded" as any, // Not handled
      };

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(mockEvent);

      const request = createMockRequest(mockEvent);
      const response = await POST(request);
      const result = await response.json();

      expect(result.status).toBe("ignored");
      expect(result.eventType).toBe("invoice.payment_succeeded");
    });
  });

  describe("Webhook HMAC verification", () => {
    it("should return 400 error when signature is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe("missing_signature");
      expect(result.error_description).toBe("Missing stripe-signature header.");
    });

    it("should return 400 error when signature validation fails", async () => {
      (stripe.webhooks.constructEvent as Mock).mockImplementation(() => {
        throw new Error("Webhook signature verification failed");
      });

      const request = createMockRequest({});
      const response = await POST(request);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe("invalid_signature");
      expect(result.error_description).toBe("Webhook signature validation failed.");
    });
  });
});