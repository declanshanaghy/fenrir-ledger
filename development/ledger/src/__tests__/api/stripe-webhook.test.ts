/**
 * Unit tests for POST /api/stripe/webhook route.
 *
 * Validates the webhook handler correctly persists entitlements to Firestore
 * via entitlement-store for checkout.session.completed, subscription.updated,
 * and subscription.deleted events.
 *
 * Deduplication is handled via Firestore processedEvents/{eventId} — mocked here.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type Stripe from "stripe";
import type { StoredStripeEntitlement } from "@/lib/stripe/types";

// ── Mock Firestore dedup helpers ──────────────────────────────────────────────

const mockIsEventProcessed = vi.hoisted(() => vi.fn());
const mockMarkEventProcessed = vi.hoisted(() => vi.fn());

// ── Mock entitlement store ────────────────────────────────────────────────

const mockGetStripeEntitlement = vi.fn();
const mockSetStripeEntitlement = vi.fn();
const mockGetGoogleSubByStripeCustomerId = vi.fn();
const mockSetAnonymousStripeEntitlement = vi.fn();
const mockGetAnonymousStripeEntitlement = vi.fn();

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: (...args: unknown[]) => mockGetStripeEntitlement(...args),
  setStripeEntitlement: (...args: unknown[]) => mockSetStripeEntitlement(...args),
  getGoogleSubByStripeCustomerId: (...args: unknown[]) =>
    mockGetGoogleSubByStripeCustomerId(...args),
  setAnonymousStripeEntitlement: (...args: unknown[]) =>
    mockSetAnonymousStripeEntitlement(...args),
  getAnonymousStripeEntitlement: (...args: unknown[]) =>
    mockGetAnonymousStripeEntitlement(...args),
  isAnonymousStripeReverseIndex: (v: string) => v.startsWith("stripe:"),
  extractStripeCustomerIdFromReverseIndex: (v: string) => v.slice("stripe:".length),
}));

// ── Mock Firestore (dedup + syncHouseholdTierToFirestore) ─────────────────

const mockFirestoreUpdate = vi.fn().mockResolvedValue(undefined);
const mockFirestoreDoc = vi.fn().mockReturnValue({ update: mockFirestoreUpdate });
const mockGetUser = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/firebase/firestore")>();
  return {
    ...actual,
    getUser: (...args: unknown[]) => mockGetUser(...args),
    getFirestore: () => ({ doc: mockFirestoreDoc }),
    isEventProcessed: mockIsEventProcessed,
    markEventProcessed: mockMarkEventProcessed,
  };
});

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

// ── Mock logger ───────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

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
    // Default: event not yet processed (no duplicate)
    mockIsEventProcessed.mockResolvedValue(false);
    mockMarkEventProcessed.mockResolvedValue(undefined);
    // Default: entitlement store calls succeed
    mockSetStripeEntitlement.mockResolvedValue(undefined);
    mockSetAnonymousStripeEntitlement.mockResolvedValue(undefined);
    mockGetStripeEntitlement.mockResolvedValue(null);
    mockGetAnonymousStripeEntitlement.mockResolvedValue(null);
    mockGetGoogleSubByStripeCustomerId.mockResolvedValue(null);
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
    // Firestore dedup check returns "already processed"
    mockIsEventProcessed.mockResolvedValueOnce(true);

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

      // Verify entitlement was stored under Google sub
      expect(mockSetStripeEntitlement).toHaveBeenCalledWith(
        "google-sub-123",
        expect.objectContaining({
          tier: "karl",
          active: true,
          stripeCustomerId: "cus_test456",
          stripeSubscriptionId: "sub_test789",
        }),
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
      expect(mockSetAnonymousStripeEntitlement).toHaveBeenCalledWith(
        "cus_test456",
        expect.objectContaining({
          tier: "karl",
          active: true,
          stripeCustomerId: "cus_test456",
        }),
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

      // Reverse index lookup returns Google sub
      mockGetGoogleSubByStripeCustomerId.mockResolvedValueOnce("google-sub-123");
      mockGetStripeEntitlement.mockResolvedValueOnce(null); // no existing entitlement

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("processed");
      expect(json.tier).toBe("karl");

      // Verify entitlement was updated
      expect(mockSetStripeEntitlement).toHaveBeenCalledWith(
        "google-sub-123",
        expect.objectContaining({ tier: "karl" }),
      );
    });

    it("ignores events for unknown customers", async () => {
      const sub = makeSubscription();
      const event = makeStripeEvent("customer.subscription.updated", sub);
      vi.mocked(verifyWebhookSignature).mockReturnValue(event);

      // Reverse index returns null — unknown customer
      mockGetGoogleSubByStripeCustomerId.mockResolvedValueOnce(null);

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

      mockGetGoogleSubByStripeCustomerId.mockResolvedValueOnce("google-sub-123");
      mockGetStripeEntitlement.mockResolvedValueOnce(null); // no existing entitlement

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("processed");
      expect(json.tier).toBe("thrall");
      expect(json.active).toBe(false);

      // Verify thrall entitlement was written
      expect(mockSetStripeEntitlement).toHaveBeenCalledWith(
        "google-sub-123",
        expect.objectContaining({ tier: "thrall", active: false }),
      );
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

      // Firestore dedup read fails — processing should continue
      mockIsEventProcessed.mockRejectedValueOnce(new Error("Firestore timeout"));

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

      // Entitlement store throws
      mockSetStripeEntitlement.mockRejectedValueOnce(new Error("Firestore write failed"));

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

      // Dedup write fails but response should still be 200
      mockMarkEventProcessed.mockRejectedValueOnce(new Error("Firestore write failed"));

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe("processed");
      // Verify entitlement was written to Firestore
      expect(mockSetStripeEntitlement).toHaveBeenCalledWith(
        "google-sub-123",
        expect.objectContaining({ tier: "karl" }),
      );
      // Verify dedup marker was attempted
      expect(mockMarkEventProcessed).toHaveBeenCalledWith("evt_test123");
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

      mockGetGoogleSubByStripeCustomerId.mockResolvedValueOnce("google-sub-123");

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const storedEntitlement = mockSetStripeEntitlement.mock.calls.find(
        (c: unknown[]) => c[0] === "google-sub-123",
      )?.[1] as StoredStripeEntitlement | undefined;
      expect(storedEntitlement?.currentPeriodEnd).toBe(
        new Date(cancelAtTimestamp * 1000).toISOString(),
      );
      expect(storedEntitlement?.cancelAtPeriodEnd).toBe(true);
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

      mockGetGoogleSubByStripeCustomerId.mockResolvedValueOnce("google-sub-123");

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const storedEntitlement = mockSetStripeEntitlement.mock.calls.find(
        (c: unknown[]) => c[0] === "google-sub-123",
      )?.[1] as StoredStripeEntitlement | undefined;
      expect(storedEntitlement?.currentPeriodEnd).toBe(
        new Date(periodEndTimestamp * 1000).toISOString(),
      );
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
      mockGetGoogleSubByStripeCustomerId.mockResolvedValueOnce("google-sub-123");

      const res = await POST(makeRequest("{}") as never);
      const afterDate = new Date();
      expect(res.status).toBe(200);

      const storedEntitlement = mockSetStripeEntitlement.mock.calls.find(
        (c: unknown[]) => c[0] === "google-sub-123",
      )?.[1] as StoredStripeEntitlement | undefined;
      const resultDate = new Date(storedEntitlement?.currentPeriodEnd ?? "");
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

      // Reverse index returns anonymous identity
      mockGetGoogleSubByStripeCustomerId.mockResolvedValueOnce("stripe:cus_test456");
      // Existing anonymous entitlement with originalLinkedAt
      mockGetAnonymousStripeEntitlement.mockResolvedValueOnce({
        tier: "karl",
        active: true,
        stripeCustomerId: "cus_test456",
        stripeSubscriptionId: "sub_test789",
        stripeStatus: "active",
        linkedAt: originalLinkedAt,
        checkedAt: "2024-06-01T00:00:00Z",
      } satisfies StoredStripeEntitlement);

      const res = await POST(makeRequest("{}") as never);
      expect(res.status).toBe(200);

      const storedEntitlement = mockSetAnonymousStripeEntitlement.mock.calls.find(
        (c: unknown[]) => c[0] === "cus_test456",
      )?.[1] as StoredStripeEntitlement | undefined;
      expect(storedEntitlement?.linkedAt).toBe(originalLinkedAt);
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

      const res = await POST(makeRequest("{}") as never);
      const afterDate = new Date();
      expect(res.status).toBe(200);

      const storedEntitlement = mockSetAnonymousStripeEntitlement.mock.calls.find(
        (c: unknown[]) => c[0] === "cus_test456",
      )?.[1] as StoredStripeEntitlement | undefined;
      const linkedDate = new Date(storedEntitlement?.linkedAt ?? "");
      expect(linkedDate.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
      expect(linkedDate.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });
  });
});
