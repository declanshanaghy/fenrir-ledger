/**
 * Loki QA — Webhook route: Firestore dedup event ID propagation
 *
 * Tests that the webhook route correctly uses isEventProcessed/markEventProcessed
 * from the Firestore dedup helpers (issue #1518). Focuses on:
 *   - markEventProcessed called with exact event ID
 *   - markEventProcessed NOT called for duplicates
 *   - markEventProcessed NOT called for unhandled event types
 *   - markEventProcessed NOT called when processing throws (500 path)
 *   - already_processed response includes eventId in body
 *   - isEventProcessed called with exact event ID before processing
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type Stripe from "stripe";

// ── Mock Firestore dedup helpers ──────────────────────────────────────────────

const mockIsEventProcessed = vi.hoisted(() => vi.fn());
const mockMarkEventProcessed = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/firebase/firestore")>();
  return {
    ...actual,
    isEventProcessed: mockIsEventProcessed,
    markEventProcessed: mockMarkEventProcessed,
  };
});

// ── Mock entitlement store (Firestore-backed) ────────────────────────────────

const mockSetStripeEntitlement = vi.hoisted(() => vi.fn());
const mockSetAnonymousStripeEntitlement = vi.hoisted(() => vi.fn());
const mockGetGoogleSubByStripeCustomerId = vi.hoisted(() => vi.fn());
const mockGetAnonymousStripeEntitlement = vi.hoisted(() => vi.fn());

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: vi.fn().mockResolvedValue(null),
  setStripeEntitlement: (...args: unknown[]) => mockSetStripeEntitlement(...args),
  getGoogleSubByStripeCustomerId: (...args: unknown[]) => mockGetGoogleSubByStripeCustomerId(...args),
  setAnonymousStripeEntitlement: (...args: unknown[]) => mockSetAnonymousStripeEntitlement(...args),
  getAnonymousStripeEntitlement: (...args: unknown[]) => mockGetAnonymousStripeEntitlement(...args),
  isAnonymousStripeReverseIndex: (v: string) => v.startsWith("stripe:"),
  extractStripeCustomerIdFromReverseIndex: (v: string) => v.slice("stripe:".length),
}));

// ── Mock Stripe SDK ───────────────────────────────────────────────────────────

const mockStripeSubscriptionsRetrieve = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe/api", () => ({
  stripe: {
    subscriptions: { retrieve: mockStripeSubscriptionsRetrieve },
    webhooks: { constructEvent: vi.fn() },
  },
}));

// ── Mock webhook helpers ──────────────────────────────────────────────────────

vi.mock("@/lib/stripe/webhook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe/webhook")>();
  return { ...actual, verifyWebhookSignature: vi.fn() };
});

// ── Import after mocks ────────────────────────────────────────────────────────

import { POST } from "@/app/api/stripe/webhook/route";
import { verifyWebhookSignature } from "@/lib/stripe/webhook";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStripeEvent(type: string, data: Record<string, unknown>, id = "evt_dedup_test"): Stripe.Event {
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

function makeRequest(body = "{}", signature = "sig_test"): Request {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body,
  });
}

function makeSubscription(): Stripe.Subscription {
  return {
    id: "sub_dedup789",
    status: "active",
    customer: "cus_dedup456",
    cancel_at_period_end: false,
    cancel_at: null,
    items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 }] },
  } as unknown as Stripe.Subscription;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Webhook dedup: Firestore event ID propagation", () => {
  beforeEach(() => {
    mockIsEventProcessed.mockResolvedValue(false);
    mockMarkEventProcessed.mockResolvedValue(undefined);
    mockSetStripeEntitlement.mockResolvedValue(undefined);
    mockSetAnonymousStripeEntitlement.mockResolvedValue(undefined);
    mockGetGoogleSubByStripeCustomerId.mockResolvedValue(null);
    mockGetAnonymousStripeEntitlement.mockResolvedValue(null);
  });

  it("calls markEventProcessed with the exact event ID after checkout.session.completed", async () => {
    const eventId = "evt_precise_checkout_id";
    const sub = makeSubscription();
    const session = {
      id: "cs_test",
      subscription: "sub_dedup789",
      customer: "cus_dedup456",
      metadata: { googleSub: "google-sub-abc" },
    };
    const event = makeStripeEvent("checkout.session.completed", session, eventId);
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);
    mockStripeSubscriptionsRetrieve.mockResolvedValue(sub);

    await POST(makeRequest() as never);

    expect(mockMarkEventProcessed).toHaveBeenCalledTimes(1);
    expect(mockMarkEventProcessed).toHaveBeenCalledWith(eventId);
  });

  it("does NOT call markEventProcessed for duplicate events (already_processed)", async () => {
    const eventId = "evt_already_seen_222";
    const event = makeStripeEvent("checkout.session.completed", {}, eventId);
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);
    mockIsEventProcessed.mockResolvedValueOnce(true); // duplicate

    const res = await POST(makeRequest() as never);
    const json = await res.json();

    expect(json.status).toBe("already_processed");
    expect(mockMarkEventProcessed).not.toHaveBeenCalled();
  });

  it("does NOT call markEventProcessed for unhandled event types", async () => {
    const eventId = "evt_unhandled_333";
    const event = makeStripeEvent("payment_intent.succeeded", {}, eventId);
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);

    const res = await POST(makeRequest() as never);
    const json = await res.json();

    expect(json.status).toBe("ignored");
    expect(mockMarkEventProcessed).not.toHaveBeenCalled();
  });

  it("calls markEventProcessed after customer.subscription.updated is processed", async () => {
    const eventId = "evt_sub_updated_444";
    const sub = makeSubscription();
    const event = makeStripeEvent("customer.subscription.updated", sub, eventId);
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);
    mockGetGoogleSubByStripeCustomerId.mockResolvedValueOnce("google-sub-abc");

    await POST(makeRequest() as never);

    expect(mockMarkEventProcessed).toHaveBeenCalledWith(eventId);
  });

  it("calls markEventProcessed after customer.subscription.deleted is processed", async () => {
    const eventId = "evt_sub_deleted_555";
    const sub = makeSubscription();
    const event = makeStripeEvent("customer.subscription.deleted", sub, eventId);
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);
    mockGetGoogleSubByStripeCustomerId.mockResolvedValueOnce("google-sub-abc");

    await POST(makeRequest() as never);

    expect(mockMarkEventProcessed).toHaveBeenCalledWith(eventId);
  });

  it("calls markEventProcessed after billing_portal.session.created is acknowledged", async () => {
    const eventId = "evt_portal_666";
    const event = makeStripeEvent("billing_portal.session.created", {}, eventId);
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);

    await POST(makeRequest() as never);

    expect(mockMarkEventProcessed).toHaveBeenCalledWith(eventId);
  });

  it("does NOT call markEventProcessed when event processing throws (500 path)", async () => {
    const sub = makeSubscription();
    const session = {
      id: "cs_test",
      subscription: "sub_dedup789",
      customer: "cus_dedup456",
      metadata: { googleSub: "google-sub-abc" },
    };
    const event = makeStripeEvent("checkout.session.completed", session, "evt_err_777");
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);
    mockStripeSubscriptionsRetrieve.mockResolvedValue(sub);
    mockSetStripeEntitlement.mockRejectedValueOnce(new Error("storage failure"));

    const res = await POST(makeRequest() as never);
    expect(res.status).toBe(500);
    expect(mockMarkEventProcessed).not.toHaveBeenCalled();
  });

  it("includes eventId in already_processed response body", async () => {
    const eventId = "evt_body_check_888";
    const event = makeStripeEvent("checkout.session.completed", {}, eventId);
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);
    mockIsEventProcessed.mockResolvedValueOnce(true);

    const res = await POST(makeRequest() as never);
    const json = await res.json();

    expect(json.eventId).toBe(eventId);
    expect(json.status).toBe("already_processed");
  });

  it("calls isEventProcessed with the exact event ID before processing", async () => {
    const eventId = "evt_dedup_check_999";
    const event = makeStripeEvent("payment_intent.succeeded", {}, eventId);
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);

    await POST(makeRequest() as never);

    expect(mockIsEventProcessed).toHaveBeenCalledWith(eventId);
  });
});
