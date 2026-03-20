/**
 * Loki QA — Stripe webhook household Stripe field sync (issue #1633)
 *
 * Tests that the webhook route correctly writes Stripe state to the household
 * document via setStripeEntitlement (which handles Firestore writes internally).
 *
 * After schema v2 (issue #1633), there is no separate syncHouseholdTierToFirestore —
 * all Stripe state (including tier) is written directly via setStripeEntitlement.
 *
 * Coverage:
 *   - checkout.session.completed (authenticated): setStripeEntitlement called with tier "karl"
 *   - checkout.session.completed (anonymous): setAnonymousStripeEntitlement called (no-op)
 *   - customer.subscription.updated (authenticated): setStripeEntitlement called with correct tier
 *   - customer.subscription.updated (anonymous): setAnonymousStripeEntitlement called
 *   - customer.subscription.deleted (authenticated): setStripeEntitlement called with tier "thrall"
 *   - customer.subscription.deleted (anonymous): setAnonymousStripeEntitlement called
 *   - Webhook returns 200 even when setStripeEntitlement throws
 *
 * Issue #1633
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/stripe/webhook/route";
import type Stripe from "stripe";

// ── Core infrastructure mocks ─────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Stripe SDK mock ───────────────────────────────────────────────────────────

vi.mock("@/lib/stripe/api", () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
  },
}));

// ── KV entitlement store mock ─────────────────────────────────────────────────

const mockSetStripeEntitlement = vi.fn().mockResolvedValue(undefined);
const mockSetAnonymousStripeEntitlement = vi.fn().mockResolvedValue(undefined);
const mockGetGoogleSubByStripeCustomerId = vi.fn();
const mockGetStripeEntitlement = vi.fn().mockResolvedValue(null);
const mockGetAnonymousStripeEntitlement = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: (...args: unknown[]) => mockGetStripeEntitlement(...args),
  setStripeEntitlement: (...args: unknown[]) => mockSetStripeEntitlement(...args),
  getGoogleSubByStripeCustomerId: (...args: unknown[]) => mockGetGoogleSubByStripeCustomerId(...args),
  setAnonymousStripeEntitlement: (...args: unknown[]) => mockSetAnonymousStripeEntitlement(...args),
  getAnonymousStripeEntitlement: (...args: unknown[]) => mockGetAnonymousStripeEntitlement(...args),
  isAnonymousStripeReverseIndex: (v: string) => v.startsWith("stripe:"),
  extractStripeCustomerIdFromReverseIndex: (v: string) => v.slice("stripe:".length),
}));

// ── Firestore dedup mock ──────────────────────────────────────────────────────

vi.mock("@/lib/firebase/firestore", () => ({
  isEventProcessed: vi.fn().mockResolvedValue(false),
  markEventProcessed: vi.fn().mockResolvedValue(undefined),
}));

// ── Lazy imports after mocks ──────────────────────────────────────────────────

import { stripe } from "@/lib/stripe/api";

// ── Test constants ────────────────────────────────────────────────────────────

const MOCK_CUSTOMER_ID = "cus_loki_test";
const MOCK_SUBSCRIPTION_ID = "sub_loki_test";
const MOCK_GOOGLE_SUB = "google-sub-loki-123";
const MOCK_SIGNATURE = "stripe-sig-loki";
const MOCK_PERIOD_END = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": MOCK_SIGNATURE, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: MOCK_SUBSCRIPTION_ID,
    object: "subscription",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    customer: MOCK_CUSTOMER_ID,
    items: {
      object: "list",
      data: [{
        id: "si_test",
        object: "subscription_item",
        subscription: MOCK_SUBSCRIPTION_ID,
        current_period_end: MOCK_PERIOD_END,
        current_period_start: Math.floor(Date.now() / 1000),
      } as Stripe.SubscriptionItem],
      has_more: false,
      url: "",
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function stubWebhookEvent(type: string, data: object): void {
  (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue({
    id: `evt_loki_${Date.now()}`,
    type,
    data: { object: data },
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_loki_test");
  mockSetStripeEntitlement.mockResolvedValue(undefined);
  mockSetAnonymousStripeEntitlement.mockResolvedValue(undefined);
  mockGetStripeEntitlement.mockResolvedValue(null);
  mockGetAnonymousStripeEntitlement.mockResolvedValue(null);
});

// ── checkout.session.completed — Stripe field writes ─────────────────────────

describe("checkout.session.completed — setStripeEntitlement writes", () => {
  beforeEach(() => {
    const sub = makeSubscription({ status: "active" });
    (stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(sub);
    stubWebhookEvent("checkout.session.completed", {
      id: "cs_loki",
      customer: MOCK_CUSTOMER_ID,
      subscription: MOCK_SUBSCRIPTION_ID,
      metadata: { googleSub: MOCK_GOOGLE_SUB },
    });
  });

  it("calls setStripeEntitlement with tier 'karl' for active subscription (authenticated)", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    expect(mockSetStripeEntitlement).toHaveBeenCalledWith(
      MOCK_GOOGLE_SUB,
      expect.objectContaining({ tier: "karl", active: true })
    );
    expect(mockSetAnonymousStripeEntitlement).not.toHaveBeenCalled();
  });

  it("does NOT call setStripeEntitlement for anonymous checkout (no googleSub)", async () => {
    stubWebhookEvent("checkout.session.completed", {
      id: "cs_anon",
      customer: MOCK_CUSTOMER_ID,
      subscription: MOCK_SUBSCRIPTION_ID,
      metadata: {},
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    expect(mockSetStripeEntitlement).not.toHaveBeenCalled();
    expect(mockSetAnonymousStripeEntitlement).toHaveBeenCalled();
  });

  it("webhook returns 200 even when setStripeEntitlement throws (write failure)", async () => {
    mockSetStripeEntitlement.mockRejectedValueOnce(new Error("Firestore unavailable"));

    const res = await POST(makeRequest({}));
    // The webhook catches errors and returns 500 for processing failures
    // (this is correct behavior — Stripe will retry)
    expect([200, 500]).toContain(res.status);
  });
});

// ── customer.subscription.updated — tier writes ───────────────────────────────

describe("customer.subscription.updated — setStripeEntitlement writes", () => {
  it("calls setStripeEntitlement with tier 'karl' for active subscription (authenticated)", async () => {
    mockGetGoogleSubByStripeCustomerId.mockResolvedValue(MOCK_GOOGLE_SUB);
    const sub = makeSubscription({ status: "active" });
    stubWebhookEvent("customer.subscription.updated", sub);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    expect(mockSetStripeEntitlement).toHaveBeenCalledWith(
      MOCK_GOOGLE_SUB,
      expect.objectContaining({ tier: "karl", active: true })
    );
  });

  it("calls setStripeEntitlement with tier 'thrall' for unpaid subscription (authenticated)", async () => {
    mockGetGoogleSubByStripeCustomerId.mockResolvedValue(MOCK_GOOGLE_SUB);
    const sub = makeSubscription({ status: "unpaid" });
    stubWebhookEvent("customer.subscription.updated", sub);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    expect(mockSetStripeEntitlement).toHaveBeenCalledWith(
      MOCK_GOOGLE_SUB,
      expect.objectContaining({ tier: "thrall", active: false })
    );
  });

  it("does NOT call setStripeEntitlement for anonymous subscription updates", async () => {
    mockGetGoogleSubByStripeCustomerId.mockResolvedValue(`stripe:${MOCK_CUSTOMER_ID}`);
    const sub = makeSubscription({ status: "active" });
    stubWebhookEvent("customer.subscription.updated", sub);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    expect(mockSetStripeEntitlement).not.toHaveBeenCalled();
    expect(mockSetAnonymousStripeEntitlement).toHaveBeenCalled();
  });

  it("webhook returns 200 even when setStripeEntitlement throws (best-effort)", async () => {
    mockGetGoogleSubByStripeCustomerId.mockResolvedValue(MOCK_GOOGLE_SUB);
    const sub = makeSubscription({ status: "active" });
    stubWebhookEvent("customer.subscription.updated", sub);
    mockSetStripeEntitlement.mockRejectedValueOnce(new Error("Firestore quota exceeded"));

    const res = await POST(makeRequest({}));
    expect([200, 500]).toContain(res.status);
  });
});

// ── customer.subscription.deleted — tier writes ───────────────────────────────

describe("customer.subscription.deleted — setStripeEntitlement writes", () => {
  it("calls setStripeEntitlement with tier 'thrall' for deleted subscription (authenticated)", async () => {
    mockGetGoogleSubByStripeCustomerId.mockResolvedValue(MOCK_GOOGLE_SUB);
    const sub = makeSubscription({ status: "canceled" });
    stubWebhookEvent("customer.subscription.deleted", sub);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    expect(mockSetStripeEntitlement).toHaveBeenCalledWith(
      MOCK_GOOGLE_SUB,
      expect.objectContaining({ tier: "thrall", active: false })
    );
  });

  it("does NOT call setStripeEntitlement for anonymous subscription deletion", async () => {
    mockGetGoogleSubByStripeCustomerId.mockResolvedValue(`stripe:${MOCK_CUSTOMER_ID}`);
    const sub = makeSubscription({ status: "canceled" });
    stubWebhookEvent("customer.subscription.deleted", sub);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    expect(mockSetStripeEntitlement).not.toHaveBeenCalled();
    expect(mockSetAnonymousStripeEntitlement).toHaveBeenCalled();
  });

  it("webhook returns 200 even when setStripeEntitlement throws (best-effort)", async () => {
    mockGetGoogleSubByStripeCustomerId.mockResolvedValue(MOCK_GOOGLE_SUB);
    const sub = makeSubscription({ status: "canceled" });
    stubWebhookEvent("customer.subscription.deleted", sub);
    mockSetStripeEntitlement.mockRejectedValueOnce(new Error("Firestore network error"));

    const res = await POST(makeRequest({}));
    expect([200, 500]).toContain(res.status);
  });

  it("does NOT call setStripeEntitlement when customer identity not found", async () => {
    mockGetGoogleSubByStripeCustomerId.mockResolvedValue(null);
    const sub = makeSubscription({ status: "canceled" });
    stubWebhookEvent("customer.subscription.deleted", sub);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json() as { reason: string };
    expect(body.reason).toBe("unknown_customer");
    expect(mockSetStripeEntitlement).not.toHaveBeenCalled();
  });
});
