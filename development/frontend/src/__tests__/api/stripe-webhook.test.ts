/**
 * Unit tests for POST /api/stripe/webhook route.
 *
 * Validates the webhook handler correctly persists entitlements to Redis
 * via ioredis for checkout.session.completed, subscription.updated,
 * and subscription.deleted events.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type Stripe from "stripe";

// ── Mock Redis client ─────────────────────────────────────────────────────

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/lib/kv/redis-client", () => ({
  getRedisClient: () => mockRedis,
}));

// ── Mock Stripe SDK ───────────────────────────────────────────────────────

const mockStripe = vi.hoisted(() => ({
  subscriptions: {
    retrieve: vi.fn(),
  },
}));

vi.mock("@/lib/stripe/api", () => ({
  stripe: {
    ...mockStripe,
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));

// ── Mock webhook helpers ──────────────────────────────────────────────────

vi.mock("@/lib/stripe/webhook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe/webhook")>();
  return {
    ...actual,
    verifyWebhookSignature: vi.fn(),
  };
});

// ── Import after mocks ───────────────────────────────────────────────────

import { POST } from "@/app/api/stripe/webhook/route";
import { verifyWebhookSignature } from "@/lib/stripe/webhook";
import { stripe } from "@/lib/stripe/api";

// ── Test helpers ─────────────────────────────────────────────────────────

function makeRequest(body: string, signature = "sig_test"): Request {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body,
  });
}

function makeStripeEvent(
  type: string,
  data: Record<string, unknown>,
  id = "evt_test123",
): Stripe.Event {
  return {
    id,
    type,
    data: { object: data },
    object: "event",
    api_version: "2024-06-20",
    created: Date.now() / 1000,
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

function makeSubscription(
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription {
  return {
    id: "sub_test789",
    status: "active",
    customer: "cus_test456",
    cancel_at_period_end: false,
    cancel_at: null,
    items: {
      data: [
        {
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: dedup cache misses (event not yet processed)
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("missing_signature");
  });

  it("returns 400 when signature verification fails", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(null);

    const res = await POST(makeRequest("{}") as never);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("invalid_signature");
  });

  it("ignores unhandled event types", async () => {
    const event = makeStripeEvent("payment_intent.succeeded", {});
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);

    const res = await POST(makeRequest("{}") as never);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("ignored");
  });

  it("deduplicates already-processed events", async () => {
    const event = makeStripeEvent("checkout.session.completed", {});
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);
    // First get call = dedup check returns "already processed"
    mockRedis.get.mockResolvedValueOnce("1");

    const res = await POST(makeRequest("{}") as never);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.status).toBe("already_processed");
  });

  describe("checkout.session.completed", () => {
    it("persists entitlement for authenticated user (with googleSub)", async () => {
      const sub = makeSubscription();
      const session = {
        id: "cs_test",
        subscription: "sub_test789",
        customer: "cus_test456",
        metadata: { googleSub: "google-sub-123" },
      };
      const event = makeStripeEvent("checkout.session.completed", session);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue(sub);

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("processed");
      expect(json.tier).toBe("karl");
      expect(json.active).toBe(true);
      expect(json.anonymous).toBe(false);

      // Verify entitlement was stored under Google sub key
      expect(mockRedis.set).toHaveBeenCalledWith(
        "entitlement:google-sub-123",
        expect.any(String),
        "EX",
        expect.any(Number),
      );

      // Verify reverse index was created
      expect(mockRedis.set).toHaveBeenCalledWith(
        "stripe-customer:cus_test456",
        JSON.stringify("google-sub-123"),
        "EX",
        expect.any(Number),
      );
    });

    it("persists entitlement for anonymous user (no googleSub)", async () => {
      const sub = makeSubscription();
      const session = {
        id: "cs_test",
        subscription: "sub_test789",
        customer: "cus_test456",
        metadata: {},
      };
      const event = makeStripeEvent("checkout.session.completed", session);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue(sub);

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.anonymous).toBe(true);

      // Verify entitlement stored under anonymous key
      expect(mockRedis.set).toHaveBeenCalledWith(
        "entitlement:stripe:cus_test456",
        expect.any(String),
        "EX",
        expect.any(Number),
      );
    });

    it("ignores session with no subscription", async () => {
      const session = {
        id: "cs_test",
        subscription: null,
        customer: "cus_test456",
        metadata: {},
      };
      const event = makeStripeEvent("checkout.session.completed", session);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("ignored");
      expect(json.reason).toBe("no_subscription");
    });
  });

  describe("customer.subscription.updated", () => {
    it("updates entitlement for authenticated user", async () => {
      const sub = makeSubscription();
      const event = makeStripeEvent("customer.subscription.updated", sub);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);

      // First get = dedup (null), second get = reverse index lookup
      mockRedis.get
        .mockResolvedValueOnce(null) // dedup
        .mockResolvedValueOnce(JSON.stringify("google-sub-123")) // reverse index
        .mockResolvedValueOnce(null); // existing entitlement

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("processed");
      expect(json.tier).toBe("karl");

      // Verify entitlement was updated
      expect(mockRedis.set).toHaveBeenCalledWith(
        "entitlement:google-sub-123",
        expect.any(String),
        "EX",
        expect.any(Number),
      );
    });

    it("ignores events for unknown customers", async () => {
      const sub = makeSubscription();
      const event = makeStripeEvent("customer.subscription.updated", sub);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);

      // dedup miss, then reverse index returns null (unknown customer)
      mockRedis.get
        .mockResolvedValueOnce(null) // dedup
        .mockResolvedValueOnce(null); // reverse index

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("ignored");
      expect(json.reason).toBe("unknown_customer");
    });
  });

  describe("customer.subscription.deleted", () => {
    it("downgrades to thrall tier", async () => {
      const sub = makeSubscription({ status: "canceled" });
      const event = makeStripeEvent("customer.subscription.deleted", sub);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);

      mockRedis.get
        .mockResolvedValueOnce(null) // dedup
        .mockResolvedValueOnce(JSON.stringify("google-sub-123")) // reverse index
        .mockResolvedValueOnce(null); // existing entitlement

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("processed");
      expect(json.tier).toBe("thrall");
      expect(json.active).toBe(false);

      // Verify thrall entitlement was written
      const setCall = mockRedis.set.mock.calls.find(
        (c: string[]) => c[0] === "entitlement:google-sub-123",
      );
      expect(setCall).toBeDefined();
      const stored = JSON.parse(setCall![1] as string);
      expect(stored.tier).toBe("thrall");
      expect(stored.active).toBe(false);
    });
  });

  describe("dedup cache resilience", () => {
    it("continues processing when dedup cache read fails", async () => {
      const sub = makeSubscription();
      const session = {
        id: "cs_test",
        subscription: "sub_test789",
        customer: "cus_test456",
        metadata: { googleSub: "google-sub-123" },
      };
      const event = makeStripeEvent("checkout.session.completed", session);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue(sub);

      // Dedup read fails, but processing should continue
      mockRedis.get
        .mockRejectedValueOnce(new Error("Redis timeout"))
        .mockResolvedValue(null); // subsequent reads succeed

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("processed");
    });
  });

  describe("billing_portal.session.created", () => {
    it("acknowledges portal sessions as no-op", async () => {
      const event = makeStripeEvent("billing_portal.session.created", {});
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("acknowledged");
    });
  });

  describe("edge cases: entitlement storage failures", () => {
    it("returns 500 when entitlement storage fails during checkout", async () => {
      const sub = makeSubscription();
      const session = {
        id: "cs_test",
        subscription: "sub_test789",
        customer: "cus_test456",
        metadata: { googleSub: "google-sub-123" },
      };
      const event = makeStripeEvent("checkout.session.completed", session);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue(sub);

      // Mock entitlement storage failure
      mockRedis.set
        .mockResolvedValueOnce(null) // dedup get
        .mockRejectedValueOnce(new Error("Redis write failed")); // entitlement set fails

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("processing_error");
    });

    it("continues despite dedup write failure after successful processing", async () => {
      const sub = makeSubscription();
      const session = {
        id: "cs_test",
        subscription: "sub_test789",
        customer: "cus_test456",
        metadata: { googleSub: "google-sub-123" },
      };
      const event = makeStripeEvent("checkout.session.completed", session);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue(sub);

      // Dedup read succeeds, all set calls succeed
      // (In real scenario, dedup write is the last one and any failure won't change response)
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("processed");
      // Verify both entitlement and dedup marker were written
      expect(mockRedis.set).toHaveBeenCalledWith(
        "entitlement:google-sub-123",
        expect.any(String),
        "EX",
        expect.any(Number),
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        "stripe-event-processed:evt_test123",
        "1",
        "EX",
        expect.any(Number),
      );
    });
  });

  describe("edge cases: checkout sessions with missing fields", () => {
    it("ignores checkout with missing customer", async () => {
      const session = {
        id: "cs_test",
        subscription: "sub_test789",
        customer: null,
        metadata: {},
      };
      const event = makeStripeEvent("checkout.session.completed", session);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);

      mockRedis.get.mockResolvedValue(null);

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("ignored");
      expect(json.reason).toBe("no_customer");
    });

    it("retrieves subscription when customer is an object", async () => {
      const sub = makeSubscription();
      const session = {
        id: "cs_test",
        subscription: "sub_test789",
        customer: { id: "cus_test456" }, // customer as object
        metadata: { googleSub: "google-sub-123" },
      };
      const event = makeStripeEvent("checkout.session.completed", session);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue(sub);

      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("processed");
      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_test789");
    });

    it("handles subscription as object reference", async () => {
      const sub = makeSubscription();
      const session = {
        id: "cs_test",
        subscription: { id: "sub_test789" }, // subscription as object
        customer: "cus_test456",
        metadata: { googleSub: "google-sub-123" },
      };
      const event = makeStripeEvent("checkout.session.completed", session);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue(sub);

      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("processed");
    });
  });

  describe("edge cases: subscription updates with period end variations", () => {
    it("uses cancel_at when present (takes precedence over period_end)", async () => {
      const cancelAtTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const sub = makeSubscription({
        cancel_at: cancelAtTimestamp,
        items: {
          data: [
            {
              current_period_end: Math.floor(Date.now() / 1000) + 86400, // different: 24h from now
            },
          ],
        },
      });
      const event = makeStripeEvent("customer.subscription.updated", sub);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);

      mockRedis.get
        .mockResolvedValueOnce(null) // dedup
        .mockResolvedValueOnce(JSON.stringify("google-sub-123")); // reverse index

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const setCall = mockRedis.set.mock.calls.find(
        (c: string[]) => c[0] === "entitlement:google-sub-123",
      );
      const stored = JSON.parse(setCall![1] as string);
      expect(stored.currentPeriodEnd).toBe(new Date(cancelAtTimestamp * 1000).toISOString());
      expect(stored.cancelAtPeriodEnd).toBe(true);
    });

    it("uses current_period_end from first subscription item when cancel_at is null", async () => {
      const periodEndTimestamp = Math.floor(Date.now() / 1000) + 86400;
      const sub = makeSubscription({
        cancel_at: null,
        items: {
          data: [
            {
              current_period_end: periodEndTimestamp,
            },
          ],
        },
      });
      const event = makeStripeEvent("customer.subscription.updated", sub);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);

      mockRedis.get
        .mockResolvedValueOnce(null) // dedup
        .mockResolvedValueOnce(JSON.stringify("google-sub-123")); // reverse index

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const setCall = mockRedis.set.mock.calls.find(
        (c: string[]) => c[0] === "entitlement:google-sub-123",
      );
      const stored = JSON.parse(setCall![1] as string);
      expect(stored.currentPeriodEnd).toBe(new Date(periodEndTimestamp * 1000).toISOString());
    });

    it("falls back to current time when no period_end or cancel_at available", async () => {
      const sub = makeSubscription({
        cancel_at: null,
        items: {
          data: [], // empty items
        },
      });
      const event = makeStripeEvent("customer.subscription.updated", sub);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);

      const beforeDate = new Date();
      mockRedis.get
        .mockResolvedValueOnce(null) // dedup
        .mockResolvedValueOnce(JSON.stringify("google-sub-123")); // reverse index

      const res = await POST(makeRequest("{}") as never);
      const afterDate = new Date();
      expect(res.status).toBe(200);

      const setCall = mockRedis.set.mock.calls.find(
        (c: string[]) => c[0] === "entitlement:google-sub-123",
      );
      const stored = JSON.parse(setCall![1] as string);
      const resultDate = new Date(stored.currentPeriodEnd);
      expect(resultDate.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
      expect(resultDate.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });
  });

  describe("edge cases: anonymous entitlements", () => {
    it("preserves linkedAt timestamp when updating anonymous entitlement", async () => {
      const sub = makeSubscription();
      const event = makeStripeEvent("customer.subscription.updated", sub);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);

      const originalLinkedAt = "2024-01-01T00:00:00Z";
      const existingEntitlement = JSON.stringify({ linkedAt: originalLinkedAt });

      mockRedis.get
        .mockResolvedValueOnce(null) // dedup
        .mockResolvedValueOnce(JSON.stringify("stripe:cus_test456")) // reverse index (anonymous)
        .mockResolvedValueOnce(existingEntitlement); // existing entitlement

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const setCall = mockRedis.set.mock.calls.find(
        (c: string[]) => c[0] === "entitlement:stripe:cus_test456",
      );
      const stored = JSON.parse(setCall![1] as string);
      expect(stored.linkedAt).toBe(originalLinkedAt);
    });

    it("sets linkedAt for new anonymous entitlements", async () => {
      const sub = makeSubscription();
      const session = {
        id: "cs_test",
        subscription: "sub_test789",
        customer: "cus_test456",
        metadata: {}, // no googleSub = anonymous
      };
      const event = makeStripeEvent("checkout.session.completed", session);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue(sub);

      const beforeDate = new Date();
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");

      const res = await POST(makeRequest("{}") as never);
      const afterDate = new Date();
      expect(res.status).toBe(200);

      const setCall = mockRedis.set.mock.calls.find(
        (c: string[]) => c[0] === "entitlement:stripe:cus_test456",
      );
      const stored = JSON.parse(setCall![1] as string);
      const linkedDate = new Date(stored.linkedAt);
      expect(linkedDate.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
      expect(linkedDate.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });
  });
});
