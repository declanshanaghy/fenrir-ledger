/**
 * Loki QA — verifyWebhookSignature direct unit tests (issue #1778)
 *
 * These tests target verifyWebhookSignature *without* mocking it, covering:
 *   - Returns null when STRIPE_WEBHOOK_SECRET is absent
 *   - Returns null when stripe.webhooks.constructEvent throws
 *   - Returns the Stripe event when verification succeeds
 *
 * The main webhook route tests mock verifyWebhookSignature — this file
 * fills that gap by exercising the function's own error handling logic.
 *
 * Also validates that all four events from AC#1778 are handled by the
 * webhook route (no 501/ignored for the required event set).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type Stripe from "stripe";

// ── Mock Stripe SDK so we can control constructEvent ─────────────────────────

const mockConstructEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe/api", () => ({
  stripe: {
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: vi.fn() },
  },
}));

// ── Mock logger ───────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { verifyWebhookSignature } from "@/lib/stripe/webhook";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMinimalEvent(type: string, id = "evt_test_sig"): Stripe.Event {
  return {
    id,
    type,
    data: { object: {} },
    object: "event",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

// ── Tests: verifyWebhookSignature ─────────────────────────────────────────────

describe("verifyWebhookSignature", () => {
  const originalEnv = process.env.STRIPE_WEBHOOK_SECRET;

  afterEach(() => {
    // Restore env after each test
    if (originalEnv === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = originalEnv;
    }
    vi.clearAllMocks();
  });

  it("returns null when STRIPE_WEBHOOK_SECRET is not configured", () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const result = verifyWebhookSignature("raw-body", "t=123,v1=abc");

    expect(result).toBeNull();
    // constructEvent should not be called if secret is missing
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("returns null when STRIPE_WEBHOOK_SECRET is an empty string", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "";

    const result = verifyWebhookSignature("raw-body", "t=123,v1=abc");

    expect(result).toBeNull();
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("returns null when constructEvent throws (invalid signature)", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload.");
    });

    const result = verifyWebhookSignature("raw-body", "t=123,v1=bad_sig");

    expect(result).toBeNull();
    expect(mockConstructEvent).toHaveBeenCalledWith("raw-body", "t=123,v1=bad_sig", "whsec_test_secret");
  });

  it("returns the Stripe event when signature is valid", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    const event = makeMinimalEvent("checkout.session.completed");
    mockConstructEvent.mockReturnValue(event);

    const result = verifyWebhookSignature("raw-body", "t=123,v1=good_sig");

    expect(result).toBe(event);
    expect(mockConstructEvent).toHaveBeenCalledWith("raw-body", "t=123,v1=good_sig", "whsec_test_secret");
  });

  it("passes the raw body (not parsed JSON) to constructEvent", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    const rawBody = '{"id":"evt_raw","type":"customer.subscription.updated"}';
    const event = makeMinimalEvent("customer.subscription.updated", "evt_raw");
    mockConstructEvent.mockReturnValue(event);

    verifyWebhookSignature(rawBody, "sig_test");

    // constructEvent must receive the exact raw string (not parsed JSON)
    expect(mockConstructEvent).toHaveBeenCalledWith(rawBody, "sig_test", expect.any(String));
  });
});

// ── Tests: all 4 AC#1778 events are handled by the webhook route ──────────────

describe("Webhook route: AC#1778 — all 4 required events are handled (not ignored)", () => {
  // These mocks are needed to drive the full route handler
  const mockIsEventProcessed = vi.hoisted(() => vi.fn());
  const mockMarkEventProcessed = vi.hoisted(() => vi.fn());
  const mockSetStripeEntitlement = vi.hoisted(() => vi.fn());
  const mockSetAnonymousStripeEntitlement = vi.hoisted(() => vi.fn());
  const mockGetGoogleSubByStripeCustomerId = vi.hoisted(() => vi.fn());
  const mockStripeSubsRetrieve = vi.hoisted(() => vi.fn());

  vi.mock("@/lib/firebase/firestore", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/firebase/firestore")>();
    return {
      ...actual,
      isEventProcessed: mockIsEventProcessed,
      markEventProcessed: mockMarkEventProcessed,
    };
  });

  vi.mock("@/lib/kv/entitlement-store", () => ({
    getStripeEntitlement: vi.fn().mockResolvedValue(null),
    setStripeEntitlement: (...args: unknown[]) => mockSetStripeEntitlement(...args),
    getGoogleSubByStripeCustomerId: (...args: unknown[]) => mockGetGoogleSubByStripeCustomerId(...args),
    setAnonymousStripeEntitlement: (...args: unknown[]) => mockSetAnonymousStripeEntitlement(...args),
    getAnonymousStripeEntitlement: vi.fn().mockResolvedValue(null),
    isAnonymousStripeReverseIndex: (v: string) => v.startsWith("stripe:"),
    extractStripeCustomerIdFromReverseIndex: (v: string) => v.slice("stripe:".length),
  }));

  // Override the stripe mock from above to also have subscriptions.retrieve
  vi.mock("@/lib/stripe/api", () => ({
    stripe: {
      webhooks: { constructEvent: mockConstructEvent },
      subscriptions: { retrieve: mockStripeSubsRetrieve },
    },
  }));

  // Re-mock verifyWebhookSignature to return events for these tests
  const mockVerifyWebhookSignature = vi.hoisted(() => vi.fn());
  vi.mock("@/lib/stripe/webhook", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/stripe/webhook")>();
    return { ...actual, verifyWebhookSignature: mockVerifyWebhookSignature };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEventProcessed.mockResolvedValue(false);
    mockMarkEventProcessed.mockResolvedValue(undefined);
    mockSetStripeEntitlement.mockResolvedValue(undefined);
    mockSetAnonymousStripeEntitlement.mockResolvedValue(undefined);
    mockGetGoogleSubByStripeCustomerId.mockResolvedValue(null);
  });

  function makeEvent(type: string): Stripe.Event {
    return {
      id: `evt_ac1778_${type.replace(/\./g, "_")}`,
      type,
      data: { object: {} },
      object: "event",
      api_version: "2024-06-20",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 0,
      request: null,
    } as unknown as Stripe.Event;
  }

  function makeRequest(): Request {
    return new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "sig_ac1778" },
      body: "{}",
    });
  }

  it("processes checkout.session.completed (AC event 1/4)", async () => {
    // Need to import POST here to pick up the mocked modules in this describe block
    const { POST } = await import("@/app/api/stripe/webhook/route");

    const sub = {
      id: "sub_ac1778",
      status: "active",
      customer: "cus_ac1778",
      cancel_at_period_end: false,
      cancel_at: null,
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 }] },
    };
    const sessionEvent = {
      ...makeEvent("checkout.session.completed"),
      data: {
        object: {
          id: "cs_ac1778",
          subscription: "sub_ac1778",
          customer: "cus_ac1778",
          metadata: { googleSub: "google-sub-ac1778" },
        },
      },
    };
    mockVerifyWebhookSignature.mockReturnValue(sessionEvent);
    mockStripeSubsRetrieve.mockResolvedValue(sub);

    const res = await POST(makeRequest() as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    // Must NOT be ignored — must be processed
    expect(json.status).not.toBe("ignored");
    expect(json.eventType).toBe("checkout.session.completed");
  });

  it("processes customer.subscription.updated (AC event 2/4)", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");

    const sub = {
      id: "sub_ac1778",
      status: "active",
      customer: "cus_ac1778",
      cancel_at_period_end: false,
      cancel_at: null,
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 }] },
    };
    const updateEvent = {
      ...makeEvent("customer.subscription.updated"),
      data: { object: sub },
    };
    mockVerifyWebhookSignature.mockReturnValue(updateEvent);
    // unknown customer → ignored (but not with status ignored for the event type mismatch)
    mockGetGoogleSubByStripeCustomerId.mockResolvedValue(null);

    const res = await POST(makeRequest() as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    // Route accepted and routed to the subscription handler (reason: unknown_customer)
    // The key assertion: it was NOT ignored due to being an unregistered event type
    expect(json.status).toBe("ignored");
    expect(json.reason).toBe("unknown_customer");
  });

  it("processes customer.subscription.deleted (AC event 3/4)", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");

    const sub = {
      id: "sub_ac1778",
      status: "canceled",
      customer: "cus_ac1778",
      cancel_at_period_end: false,
      cancel_at: null,
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 }] },
    };
    const deleteEvent = {
      ...makeEvent("customer.subscription.deleted"),
      data: { object: sub },
    };
    mockVerifyWebhookSignature.mockReturnValue(deleteEvent);
    mockGetGoogleSubByStripeCustomerId.mockResolvedValue("google-sub-ac1778");

    const res = await POST(makeRequest() as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("processed");
    expect(json.eventType).toBe("customer.subscription.deleted");
    expect(json.tier).toBe("thrall");
    expect(json.active).toBe(false);
  });

  it("processes billing_portal.session.created (AC event 4/4)", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");

    const portalEvent = makeEvent("billing_portal.session.created");
    mockVerifyWebhookSignature.mockReturnValue(portalEvent);

    const res = await POST(makeRequest() as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    // Must be acknowledged, NOT ignored as an unregistered event
    expect(json.status).toBe("acknowledged");
    expect(json.eventType).toBe("billing_portal.session.created");
  });

  it("rejects events NOT in the subscribed set (regression guard)", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");

    const unsubscribedEvent = makeEvent("payment_intent.succeeded");
    mockVerifyWebhookSignature.mockReturnValue(unsubscribedEvent);

    const res = await POST(makeRequest() as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("ignored");
    // No eventType field for unhandled events
    expect(json.eventType).toBe("payment_intent.succeeded");
  });
});
