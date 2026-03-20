/**
 * Loki QA — Stripe webhook Firestore household tier sync (issue #1119)
 *
 * Tests gaps not covered by existing webhook tests:
 *   - stripeTierToHouseholdTier mapping: "karl" → "karl", "thrall" → "free"
 *   - syncHouseholdTierToFirestore is called on checkout.session.completed (authenticated)
 *   - syncHouseholdTierToFirestore is called on customer.subscription.updated (authenticated)
 *   - syncHouseholdTierToFirestore is called with "thrall" on subscription.deleted
 *   - Best-effort: Firestore db.update() failure does not fail the webhook 200 response
 *   - Best-effort: getUser returning null does not fail the webhook 200 response
 *   - Anonymous paths do NOT trigger Firestore tier sync
 *
 * Issue #1119
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

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: vi.fn().mockResolvedValue(null),
  setStripeEntitlement: vi.fn().mockResolvedValue(undefined),
  getGoogleSubByStripeCustomerId: vi.fn(),
  setAnonymousStripeEntitlement: vi.fn().mockResolvedValue(undefined),
  getAnonymousStripeEntitlement: vi.fn().mockResolvedValue(null),
  isAnonymousStripeReverseIndex: vi.fn().mockReturnValue(false),
  extractStripeCustomerIdFromReverseIndex: vi.fn(),
}));

// ── Firestore mock ────────────────────────────────────────────────────────────
// We need to spy on the db.doc().update() call to verify tier values

const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn().mockReturnValue({ update: mockUpdate });
const mockGetUser = vi.fn();
const mockGetFirestore = vi.fn().mockReturnValue({ doc: mockDoc });

vi.mock("@/lib/firebase/firestore", () => ({
  getUser: (sub: string) => mockGetUser(sub),
  getFirestore: () => mockGetFirestore(),
}));

// ── Lazy imports after mocks ──────────────────────────────────────────────────

import { stripe } from "@/lib/stripe/api";
import {
  setStripeEntitlement,
  setAnonymousStripeEntitlement,
  getGoogleSubByStripeCustomerId,
  isAnonymousStripeReverseIndex,
  extractStripeCustomerIdFromReverseIndex,
} from "@/lib/kv/entitlement-store";

// ── Test constants ────────────────────────────────────────────────────────────

const MOCK_CUSTOMER_ID = "cus_loki_test";
const MOCK_SUBSCRIPTION_ID = "sub_loki_test";
const MOCK_GOOGLE_SUB = "google-sub-loki-123";
const MOCK_HOUSEHOLD_ID = "household-loki-456";
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

function userExists(): void {
  mockGetUser.mockResolvedValue({
    clerkUserId: MOCK_GOOGLE_SUB,
    householdId: MOCK_HOUSEHOLD_ID,
    email: "loki@test.com",
    displayName: "Loki Test",
    role: "owner",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_loki_test");
  // Default: authenticated user, not anonymous
  (isAnonymousStripeReverseIndex as ReturnType<typeof vi.fn>).mockReturnValue(false);
  mockGetFirestore.mockReturnValue({ doc: mockDoc });
  mockUpdate.mockResolvedValue(undefined);
});

// ── stripeTierToHouseholdTier mapping ─────────────────────────────────────────
// Tested indirectly via db.doc().update() calls — private function not exported.

describe("stripeTierToHouseholdTier — karl→karl, thrall→free", () => {
  it("maps 'karl' subscription tier to household tier 'karl' in Firestore", async () => {
    const sub = makeSubscription({ status: "active" });
    (stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(sub);
    stubWebhookEvent("checkout.session.completed", {
      id: "cs_loki",
      customer: MOCK_CUSTOMER_ID,
      subscription: MOCK_SUBSCRIPTION_ID,
      metadata: { googleSub: MOCK_GOOGLE_SUB },
    });
    userExists();

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    // db.doc().update() should be called with tier: "karl"
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "karl" })
    );
  });

  it("maps 'thrall' (canceled subscription) to household tier 'free' in Firestore", async () => {
    (getGoogleSubByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_GOOGLE_SUB);
    const sub = makeSubscription({ status: "canceled" });
    stubWebhookEvent("customer.subscription.deleted", sub);
    userExists();

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    // subscription.deleted always uses "thrall" → should map to "free"
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "free" })
    );
  });

  it("maps 'thrall' (unpaid subscription.updated) to household tier 'free' in Firestore", async () => {
    (getGoogleSubByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_GOOGLE_SUB);
    const sub = makeSubscription({ status: "unpaid" });
    stubWebhookEvent("customer.subscription.updated", sub);
    userExists();

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "free" })
    );
  });
});

// ── checkout.session.completed — Firestore tier sync ─────────────────────────

describe("checkout.session.completed — syncHouseholdTierToFirestore", () => {
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

  it("calls Firestore db.doc().update() with correct householdId path and tier", async () => {
    userExists();

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    expect(mockGetUser).toHaveBeenCalledWith(MOCK_GOOGLE_SUB);
    expect(mockDoc).toHaveBeenCalledWith(expect.stringContaining(MOCK_HOUSEHOLD_ID));
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "karl", updatedAt: expect.any(String) })
    );
  });

  it("webhook returns 200 even when getUser returns null (best-effort)", async () => {
    mockGetUser.mockResolvedValue(null); // user not in Firestore

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    // db.doc().update() should NOT be called — user not found
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("webhook returns 200 even when db.update() throws (best-effort)", async () => {
    userExists();
    mockUpdate.mockRejectedValue(new Error("Firestore unavailable"));

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    const body = await res.json() as { status: string };
    expect(body.status).toBe("processed");
  });

  it("does NOT call Firestore sync for anonymous checkout (no googleSub)", async () => {
    stubWebhookEvent("checkout.session.completed", {
      id: "cs_anon",
      customer: MOCK_CUSTOMER_ID,
      subscription: MOCK_SUBSCRIPTION_ID,
      metadata: {}, // no googleSub
    });

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    // Firestore sync is only for authenticated users
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

// ── customer.subscription.updated — Firestore tier sync ──────────────────────

describe("customer.subscription.updated — syncHouseholdTierToFirestore", () => {
  it("calls Firestore sync for authenticated users when subscription goes active", async () => {
    (getGoogleSubByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_GOOGLE_SUB);
    const sub = makeSubscription({ status: "active" });
    stubWebhookEvent("customer.subscription.updated", sub);
    userExists();

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    expect(mockGetUser).toHaveBeenCalledWith(MOCK_GOOGLE_SUB);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "karl" })
    );
  });

  it("does NOT call Firestore sync for anonymous subscription updates", async () => {
    // Anonymous path: getGoogleSubByStripeCustomerId returns anonymous marker
    (getGoogleSubByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(
      `stripe:${MOCK_CUSTOMER_ID}`
    );
    (isAnonymousStripeReverseIndex as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (extractStripeCustomerIdFromReverseIndex as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_CUSTOMER_ID);

    const sub = makeSubscription({ status: "active" });
    stubWebhookEvent("customer.subscription.updated", sub);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("webhook returns 200 even when db.update() throws on subscription update (best-effort)", async () => {
    (getGoogleSubByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_GOOGLE_SUB);
    const sub = makeSubscription({ status: "active" });
    stubWebhookEvent("customer.subscription.updated", sub);
    userExists();
    mockUpdate.mockRejectedValue(new Error("Firestore quota exceeded"));

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("processed");
  });
});

// ── customer.subscription.deleted — Firestore tier sync ──────────────────────

describe("customer.subscription.deleted — syncHouseholdTierToFirestore", () => {
  it("syncs 'free' tier to Firestore when subscription is deleted (authenticated)", async () => {
    (getGoogleSubByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_GOOGLE_SUB);
    const sub = makeSubscription({ status: "canceled" });
    stubWebhookEvent("customer.subscription.deleted", sub);
    userExists();

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    expect(mockGetUser).toHaveBeenCalledWith(MOCK_GOOGLE_SUB);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "free" })
    );
  });

  it("does NOT call Firestore sync for anonymous subscription deletion", async () => {
    (getGoogleSubByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(
      `stripe:${MOCK_CUSTOMER_ID}`
    );
    (isAnonymousStripeReverseIndex as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (extractStripeCustomerIdFromReverseIndex as ReturnType<typeof vi.fn>).mockReturnValue(MOCK_CUSTOMER_ID);

    const sub = makeSubscription({ status: "canceled" });
    stubWebhookEvent("customer.subscription.deleted", sub);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("webhook returns 200 even when db.update() throws on subscription delete (best-effort)", async () => {
    (getGoogleSubByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_GOOGLE_SUB);
    const sub = makeSubscription({ status: "canceled" });
    stubWebhookEvent("customer.subscription.deleted", sub);
    userExists();
    mockUpdate.mockRejectedValue(new Error("Firestore network error"));

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("processed");
  });

  it("does NOT call Firestore sync when customer identity not found", async () => {
    (getGoogleSubByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const sub = makeSubscription({ status: "canceled" });
    stubWebhookEvent("customer.subscription.deleted", sub);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    const body = await res.json() as { reason: string };
    expect(body.reason).toBe("unknown_customer");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
