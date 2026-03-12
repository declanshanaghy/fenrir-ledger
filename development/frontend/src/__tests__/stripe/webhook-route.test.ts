/**
 * Unit tests for POST /api/stripe/webhook route handler
 *
 * Covers: signature validation, event routing, deduplication, each event handler
 * (checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted, billing_portal.session.created),
 * anonymous vs authenticated paths, and error handling.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/stripe/webhook/route";
import type Stripe from "stripe";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@vercel/kv", () => ({
  kv: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
  },
}));

vi.mock("@/lib/stripe/api", () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
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

import { kv } from "@vercel/kv";
import { stripe } from "@/lib/stripe/api";
import {
  setStripeEntitlement,
  setAnonymousStripeEntitlement,
  getGoogleSubByStripeCustomerId,
  getStripeEntitlement,
  getAnonymousStripeEntitlement,
  isAnonymousStripeReverseIndex,
  extractStripeCustomerIdFromReverseIndex,
} from "@/lib/kv/entitlement-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_CUSTOMER_ID = "cus_test123";
const MOCK_SUBSCRIPTION_ID = "sub_test456";
const MOCK_SESSION_ID = "cs_test789";
const MOCK_GOOGLE_SUB = "google_123456789";
const MOCK_SIGNATURE = "stripe_sig_test";
const MOCK_PERIOD_END = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRequest(body: object, signature: string = MOCK_SIGNATURE): NextRequest {
  return new NextRequest("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers: {
      "stripe-signature": signature,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function createMockSubscription(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: MOCK_SUBSCRIPTION_ID,
    object: "subscription",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    customer: MOCK_CUSTOMER_ID,
    items: {
      object: "list",
      data: [
        {
          id: "si_test",
          object: "subscription_item",
          subscription: MOCK_SUBSCRIPTION_ID,
          current_period_end: MOCK_PERIOD_END,
          current_period_start: Math.floor(Date.now() / 1000),
        },
      ],
      has_more: false,
      url: "/v1/subscription_items",
    },
    ...overrides,
  };
}

function createMockEvent(
  type: string,
  dataObject: unknown,
  eventId = "evt_test",
): Stripe.Event {
  return {
    id: eventId,
    object: "event",
    api_version: "2026-02-25.clover",
    created: Math.floor(Date.now() / 1000),
    data: { object: dataObject as Stripe.Event.Data.Object },
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type,
  } as Stripe.Event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_secret");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));
  });

  // =========================================================================
  // Signature validation
  // =========================================================================

  describe("Signature validation", () => {
    it("should return 400 when stripe-signature header is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/stripe/webhook", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("missing_signature");
    });

    it("should return 400 when signature verification fails", async () => {
      (stripe.webhooks.constructEvent as Mock).mockImplementation(() => {
        throw new Error("Webhook signature verification failed");
      });

      const response = await POST(createMockRequest({}));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("invalid_signature");
    });

    it("should return 400 when STRIPE_WEBHOOK_SECRET is not set", async () => {
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
      delete process.env.STRIPE_WEBHOOK_SECRET;

      // verifyWebhookSignature returns null when secret missing
      (stripe.webhooks.constructEvent as Mock).mockImplementation(() => {
        throw new Error("No webhook secret");
      });

      const response = await POST(createMockRequest({}));
      expect(response.status).toBe(400);
    });
  });

  // =========================================================================
  // Deduplication
  // =========================================================================

  describe("Event deduplication", () => {
    it("should return already_processed for duplicate events", async () => {
      const event = createMockEvent("checkout.session.completed", {});
      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);
      (kv.get as Mock).mockResolvedValue(true); // Already processed

      const response = await POST(createMockRequest({}));
      const data = await response.json();
      expect(data.status).toBe("already_processed");
      expect(data.eventId).toBe("evt_test");
    });

    it("should continue processing if dedup cache check fails", async () => {
      const event = createMockEvent("invoice.payment_succeeded", {});
      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);
      (kv.get as Mock).mockRejectedValue(new Error("KV down"));

      const response = await POST(createMockRequest({}));
      const data = await response.json();
      // Should still process (and ignore unhandled event type)
      expect(data.status).toBe("ignored");
    });
  });

  // =========================================================================
  // Unhandled event types
  // =========================================================================

  describe("Unhandled event types", () => {
    it("should return ignored for unhandled event type", async () => {
      const event = createMockEvent("invoice.payment_succeeded", {});
      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);

      const response = await POST(createMockRequest({}));
      const data = await response.json();
      expect(data.status).toBe("ignored");
      expect(data.eventType).toBe("invoice.payment_succeeded");
    });
  });

  // =========================================================================
  // checkout.session.completed
  // =========================================================================

  describe("checkout.session.completed", () => {
    it("should create entitlement for authenticated user (googleSub present)", async () => {
      const session = {
        id: MOCK_SESSION_ID,
        object: "checkout.session",
        customer: MOCK_CUSTOMER_ID,
        subscription: MOCK_SUBSCRIPTION_ID,
        metadata: { googleSub: MOCK_GOOGLE_SUB },
      };
      const event = createMockEvent("checkout.session.completed", session);
      const subscription = createMockSubscription();

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);
      (stripe.subscriptions.retrieve as Mock).mockResolvedValue(subscription);

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      expect(data.status).toBe("processed");
      expect(data.eventType).toBe("checkout.session.completed");
      expect(data.tier).toBe("karl");
      expect(data.active).toBe(true);
      expect(data.anonymous).toBe(false);

      expect(setStripeEntitlement).toHaveBeenCalledWith(
        MOCK_GOOGLE_SUB,
        expect.objectContaining({
          tier: "karl",
          active: true,
          stripeCustomerId: MOCK_CUSTOMER_ID,
          stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
        }),
      );
      expect(setAnonymousStripeEntitlement).not.toHaveBeenCalled();
    });

    it("should create anonymous entitlement when googleSub is missing", async () => {
      const session = {
        id: MOCK_SESSION_ID,
        object: "checkout.session",
        customer: MOCK_CUSTOMER_ID,
        subscription: MOCK_SUBSCRIPTION_ID,
        metadata: {},
      };
      const event = createMockEvent("checkout.session.completed", session);
      const subscription = createMockSubscription();

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);
      (stripe.subscriptions.retrieve as Mock).mockResolvedValue(subscription);

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      expect(data.status).toBe("processed");
      expect(data.anonymous).toBe(true);

      expect(setAnonymousStripeEntitlement).toHaveBeenCalledWith(
        MOCK_CUSTOMER_ID,
        expect.objectContaining({
          tier: "karl",
          active: true,
        }),
      );
      expect(setStripeEntitlement).not.toHaveBeenCalled();
    });

    it("should handle missing subscription ID in session", async () => {
      const session = {
        id: MOCK_SESSION_ID,
        object: "checkout.session",
        customer: MOCK_CUSTOMER_ID,
        subscription: null,
        metadata: { googleSub: MOCK_GOOGLE_SUB },
      };
      const event = createMockEvent("checkout.session.completed", session);
      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      expect(data.status).toBe("ignored");
      expect(data.reason).toBe("no_subscription");
    });

    it("should handle missing customer ID in session", async () => {
      const session = {
        id: MOCK_SESSION_ID,
        object: "checkout.session",
        customer: null,
        subscription: MOCK_SUBSCRIPTION_ID,
        metadata: { googleSub: MOCK_GOOGLE_SUB },
      };
      const event = createMockEvent("checkout.session.completed", session);
      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      expect(data.status).toBe("ignored");
      expect(data.reason).toBe("no_customer");
    });
  });

  // =========================================================================
  // customer.subscription.updated
  // =========================================================================

  describe("customer.subscription.updated", () => {
    it("should update entitlement for authenticated user", async () => {
      const subscription = createMockSubscription({ status: "active" });
      const event = createMockEvent("customer.subscription.updated", subscription);

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);
      (getGoogleSubByStripeCustomerId as Mock).mockResolvedValue(MOCK_GOOGLE_SUB);
      (isAnonymousStripeReverseIndex as Mock).mockReturnValue(false);
      (getStripeEntitlement as Mock).mockResolvedValue({
        linkedAt: "2024-01-01T00:00:00Z",
      });

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      expect(data.status).toBe("processed");
      expect(data.eventType).toBe("customer.subscription.updated");
      expect(data.tier).toBe("karl");
      expect(data.active).toBe(true);

      expect(setStripeEntitlement).toHaveBeenCalledWith(
        MOCK_GOOGLE_SUB,
        expect.objectContaining({
          tier: "karl",
          active: true,
          stripeStatus: "active",
          linkedAt: "2024-01-01T00:00:00Z",
        }),
      );
    });

    it("should update anonymous entitlement", async () => {
      const subscription = createMockSubscription({ status: "active" });
      const event = createMockEvent("customer.subscription.updated", subscription);

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);
      (getGoogleSubByStripeCustomerId as Mock).mockResolvedValue(`stripe:${MOCK_CUSTOMER_ID}`);
      (isAnonymousStripeReverseIndex as Mock).mockReturnValue(true);
      (extractStripeCustomerIdFromReverseIndex as Mock).mockReturnValue(MOCK_CUSTOMER_ID);
      (getAnonymousStripeEntitlement as Mock).mockResolvedValue({
        linkedAt: "2024-01-01T00:00:00Z",
      });

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      expect(data.status).toBe("processed");
      expect(data.tier).toBe("karl");

      expect(setAnonymousStripeEntitlement).toHaveBeenCalledWith(
        MOCK_CUSTOMER_ID,
        expect.objectContaining({
          tier: "karl",
          active: true,
          linkedAt: "2024-01-01T00:00:00Z",
        }),
      );
    });

    it("should set cancelAtPeriodEnd true when cancel_at is set", async () => {
      const cancelAt = Math.floor(Date.now() / 1000) + 15 * 24 * 60 * 60;
      const subscription = createMockSubscription({
        status: "active",
        cancel_at: cancelAt,
      });
      const event = createMockEvent("customer.subscription.updated", subscription);

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);
      (getGoogleSubByStripeCustomerId as Mock).mockResolvedValue(MOCK_GOOGLE_SUB);
      (isAnonymousStripeReverseIndex as Mock).mockReturnValue(false);
      (getStripeEntitlement as Mock).mockResolvedValue({ linkedAt: "2024-01-01T00:00:00Z" });

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      expect(data.tier).toBe("karl");
      expect(setStripeEntitlement).toHaveBeenCalledWith(
        MOCK_GOOGLE_SUB,
        expect.objectContaining({
          cancelAtPeriodEnd: true,
          currentPeriodEnd: new Date(cancelAt * 1000).toISOString(),
        }),
      );
    });

    it("should return ignored when customer identity is unknown", async () => {
      const subscription = createMockSubscription();
      const event = createMockEvent("customer.subscription.updated", subscription);

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);
      (getGoogleSubByStripeCustomerId as Mock).mockResolvedValue(null);

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      expect(data.status).toBe("ignored");
      expect(data.reason).toBe("unknown_customer");
    });

    it("should map canceled status to thrall tier", async () => {
      const subscription = createMockSubscription({ status: "canceled" });
      const event = createMockEvent("customer.subscription.updated", subscription);

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);
      (getGoogleSubByStripeCustomerId as Mock).mockResolvedValue(MOCK_GOOGLE_SUB);
      (isAnonymousStripeReverseIndex as Mock).mockReturnValue(false);
      (getStripeEntitlement as Mock).mockResolvedValue({ linkedAt: "2024-01-01T00:00:00Z" });

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      expect(data.tier).toBe("thrall");
      expect(data.active).toBe(false);
    });
  });

  // =========================================================================
  // customer.subscription.deleted
  // =========================================================================

  describe("customer.subscription.deleted", () => {
    it("should downgrade to thrall for authenticated user", async () => {
      const subscription = createMockSubscription({ status: "canceled" });
      const event = createMockEvent("customer.subscription.deleted", subscription);

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);
      (getGoogleSubByStripeCustomerId as Mock).mockResolvedValue(MOCK_GOOGLE_SUB);
      (isAnonymousStripeReverseIndex as Mock).mockReturnValue(false);
      (getStripeEntitlement as Mock).mockResolvedValue({ linkedAt: "2024-01-01T00:00:00Z" });

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      expect(data.status).toBe("processed");
      expect(data.eventType).toBe("customer.subscription.deleted");
      expect(data.tier).toBe("thrall");
      expect(data.active).toBe(false);

      expect(setStripeEntitlement).toHaveBeenCalledWith(
        MOCK_GOOGLE_SUB,
        expect.objectContaining({
          tier: "thrall",
          active: false,
          stripeStatus: "canceled",
          cancelAtPeriodEnd: false,
          linkedAt: "2024-01-01T00:00:00Z",
        }),
      );
    });

    it("should downgrade anonymous user to thrall", async () => {
      const subscription = createMockSubscription({ status: "canceled" });
      const event = createMockEvent("customer.subscription.deleted", subscription);

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);
      (getGoogleSubByStripeCustomerId as Mock).mockResolvedValue(`stripe:${MOCK_CUSTOMER_ID}`);
      (isAnonymousStripeReverseIndex as Mock).mockReturnValue(true);
      (extractStripeCustomerIdFromReverseIndex as Mock).mockReturnValue(MOCK_CUSTOMER_ID);
      (getAnonymousStripeEntitlement as Mock).mockResolvedValue({
        linkedAt: "2024-01-01T00:00:00Z",
      });

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      expect(data.tier).toBe("thrall");
      expect(data.active).toBe(false);

      expect(setAnonymousStripeEntitlement).toHaveBeenCalledWith(
        MOCK_CUSTOMER_ID,
        expect.objectContaining({
          tier: "thrall",
          active: false,
          linkedAt: "2024-01-01T00:00:00Z",
        }),
      );
    });

    it("should return ignored when customer identity is unknown", async () => {
      const subscription = createMockSubscription();
      const event = createMockEvent("customer.subscription.deleted", subscription);

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);
      (getGoogleSubByStripeCustomerId as Mock).mockResolvedValue(null);

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      expect(data.status).toBe("ignored");
      expect(data.reason).toBe("unknown_customer");
    });
  });

  // =========================================================================
  // billing_portal.session.created
  // =========================================================================

  describe("billing_portal.session.created", () => {
    it("should acknowledge portal session as no-op", async () => {
      const portalSession = {
        id: "bps_test",
        object: "billing_portal.session",
      };
      const event = createMockEvent("billing_portal.session.created", portalSession);

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      expect(data.status).toBe("acknowledged");
      expect(data.eventType).toBe("billing_portal.session.created");
    });
  });

  // =========================================================================
  // Processing errors
  // =========================================================================

  describe("Processing errors", () => {
    it("should return 500 when event handler throws", async () => {
      const session = {
        id: MOCK_SESSION_ID,
        object: "checkout.session",
        customer: MOCK_CUSTOMER_ID,
        subscription: MOCK_SUBSCRIPTION_ID,
        metadata: { googleSub: MOCK_GOOGLE_SUB },
      };
      const event = createMockEvent("checkout.session.completed", session);

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);
      (stripe.subscriptions.retrieve as Mock).mockRejectedValue(
        new Error("Stripe API error"),
      );

      const response = await POST(createMockRequest({}));
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("processing_error");
    });
  });

  // =========================================================================
  // Dedup cache write failure
  // =========================================================================

  describe("Dedup cache write", () => {
    it("should still return success even if dedup cache write fails", async () => {
      const portalSession = { id: "bps_test", object: "billing_portal.session" };
      const event = createMockEvent("billing_portal.session.created", portalSession);

      (stripe.webhooks.constructEvent as Mock).mockReturnValue(event);
      (kv.set as Mock).mockRejectedValue(new Error("KV write error"));

      const response = await POST(createMockRequest({}));
      const data = await response.json();

      // Should still succeed
      expect(data.status).toBe("acknowledged");
    });
  });
});
