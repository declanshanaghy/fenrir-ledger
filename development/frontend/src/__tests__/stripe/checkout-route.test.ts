/**
 * Unit tests for POST /api/stripe/checkout route handler
 *
 * Covers: auth, rate limiting, session creation, duplicate prevention (#565 guard),
 * revive/reactivation flow (must NOT create a new subscription when reactivating),
 * and error handling.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/stripe/checkout/route";

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
    checkout: { sessions: { create: vi.fn() } },
    subscriptions: {
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
      list: vi.fn(),
    },
  },
}));

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: vi.fn(),
  setStripeEntitlement: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockReturnValue({ success: true }),
}));

vi.mock("@/lib/stripe/webhook", () => ({
  buildEntitlementFromSubscription: vi.fn().mockReturnValue({
    tier: "karl",
    active: true,
    stripeCustomerId: "cus_test123",
    stripeSubscriptionId: "sub_test456",
    stripeStatus: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2024-02-15T10:00:00.000Z",
    linkedAt: "2024-01-15T10:00:00.000Z",
    checkedAt: "2024-01-15T10:00:00.000Z",
  }),
}));

import { requireAuth } from "@/lib/auth/require-auth";
import { stripe } from "@/lib/stripe/api";
import {
  getStripeEntitlement,
  setStripeEntitlement,
} from "@/lib/kv/entitlement-store";
import { rateLimit } from "@/lib/rate-limit";
import { buildEntitlementFromSubscription } from "@/lib/stripe/webhook";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const MOCK_GOOGLE_SUB = "google_123456789";
const MOCK_EMAIL = "test@example.com";
const MOCK_CUSTOMER_ID = "cus_test123";
const MOCK_SUBSCRIPTION_ID = "sub_test456";
const MOCK_PERIOD_END = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRequest(body?: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/stripe/checkout", {
    method: "POST",
    headers: {
      Authorization: "Bearer test_token",
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: auth succeeds
    (requireAuth as Mock).mockResolvedValue({
      ok: true,
      user: { sub: MOCK_GOOGLE_SUB, email: MOCK_EMAIL },
    });

    // Default: rate limit allows
    (rateLimit as Mock).mockReturnValue({ success: true });

    // Default: no existing entitlement
    (getStripeEntitlement as Mock).mockResolvedValue(null);

    // Default env
    process.env.STRIPE_PRICE_ID = "price_test_mock";
    process.env.APP_BASE_URL = "https://fenrir-ledger.vercel.app";
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
      const data = await response.json();
      expect(data.error).toBe("unauthorized");
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
  // Config errors
  // =========================================================================

  describe("Config errors", () => {
    it("should return 500 when STRIPE_PRICE_ID is not configured", async () => {
      delete process.env.STRIPE_PRICE_ID;

      const response = await POST(createMockRequest());
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("config_error");
    });
  });

  // =========================================================================
  // Fresh checkout (no prior subscription)
  // =========================================================================

  describe("Fresh checkout", () => {
    it("should create a checkout session and return URL for new user", async () => {
      (stripe.checkout.sessions.create as Mock).mockResolvedValue({
        id: "cs_test_session",
        url: "https://checkout.stripe.com/pay/cs_test_session",
      });

      const response = await POST(createMockRequest());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.url).toBe("https://checkout.stripe.com/pay/cs_test_session");

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          customer_email: MOCK_EMAIL,
          metadata: { googleSub: MOCK_GOOGLE_SUB },
        }),
      );
    });

    it("should reuse existing customer ID when entitlement has customer but no subscription", async () => {
      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
      });

      // Stripe guard: no active subs
      (stripe.subscriptions.list as Mock).mockResolvedValue({ data: [] });

      (stripe.checkout.sessions.create as Mock).mockResolvedValue({
        id: "cs_test_session",
        url: "https://checkout.stripe.com/pay/cs_test_session",
      });

      const response = await POST(createMockRequest());
      expect(response.status).toBe(200);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: MOCK_CUSTOMER_ID,
        }),
      );
    });

    it("should return 500 when session.url is null", async () => {
      (stripe.checkout.sessions.create as Mock).mockResolvedValue({
        id: "cs_test_session",
        url: null,
      });

      const response = await POST(createMockRequest());
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("checkout_error");
    });

    it("should use custom returnPath from body", async () => {
      (stripe.checkout.sessions.create as Mock).mockResolvedValue({
        id: "cs_test",
        url: "https://checkout.stripe.com/pay/cs_test",
      });

      const response = await POST(createMockRequest({ returnPath: "/ledger" }));
      expect(response.status).toBe(200);

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          success_url: expect.stringContaining("/ledger?stripe=success"),
          cancel_url: expect.stringContaining("/ledger?stripe=cancel"),
        }),
      );
    });
  });

  // =========================================================================
  // Duplicate prevention (#565 guard)
  // =========================================================================

  describe("Duplicate prevention", () => {
    it("should return 409 when user already has an active subscription (KV path)", async () => {
      const activeSub = createMockSubscription({ status: "active" });

      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
        stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
        stripeStatus: "active",
      });

      (stripe.subscriptions.retrieve as Mock).mockResolvedValue(activeSub);

      const response = await POST(createMockRequest());
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe("already_subscribed");

      // Must NOT create a new checkout session
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("should return 409 when user already has an active subscription (Stripe guard path)", async () => {
      // KV has customer but subscription retrieve fails
      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
        stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
        stripeStatus: "active",
      });

      (stripe.subscriptions.retrieve as Mock).mockRejectedValue(
        new Error("No such subscription"),
      );

      // Stripe guard finds active sub
      (stripe.subscriptions.list as Mock).mockResolvedValue({
        data: [
          {
            id: "sub_other",
            cancel_at_period_end: false,
            cancel_at: null,
          },
        ],
      });

      const response = await POST(createMockRequest());
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe("already_subscribed");

      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("should return 409 for trialing subscription", async () => {
      const trialingSub = createMockSubscription({ status: "trialing" });

      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
        stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
        stripeStatus: "trialing",
      });

      (stripe.subscriptions.retrieve as Mock).mockResolvedValue(trialingSub);

      const response = await POST(createMockRequest());
      expect(response.status).toBe(409);
    });
  });

  // =========================================================================
  // Revive/reactivation flow (CRITICAL — must NOT create new subscription)
  // =========================================================================

  describe("Revive/reactivation flow", () => {
    it("should revive cancel_at_period_end subscription via KV path instead of creating new", async () => {
      const cancelingSub = createMockSubscription({
        status: "active",
        cancel_at_period_end: true,
        cancel_at: null,
      });

      const revivedSub = createMockSubscription({
        status: "active",
        cancel_at_period_end: false,
        cancel_at: null,
      });

      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
        stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
        stripeStatus: "active",
        cancelAtPeriodEnd: true,
        linkedAt: "2024-01-01T00:00:00Z",
      });

      (stripe.subscriptions.retrieve as Mock).mockResolvedValue(cancelingSub);
      (stripe.subscriptions.update as Mock).mockResolvedValue(revivedSub);

      const response = await POST(createMockRequest());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.revived).toBe(true);
      expect(data.message).toContain("reactivated");

      // CRITICAL: must NOT create new checkout session
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();

      // Must update the existing subscription
      expect(stripe.subscriptions.update).toHaveBeenCalledWith(
        MOCK_SUBSCRIPTION_ID,
        { cancel_at_period_end: false },
      );

      // Must update KV entitlement
      expect(setStripeEntitlement).toHaveBeenCalledWith(
        MOCK_GOOGLE_SUB,
        expect.objectContaining({
          linkedAt: "2024-01-01T00:00:00Z",
        }),
      );
    });

    it("should revive cancel_at subscription and clear cancel_at", async () => {
      const cancelAt = Math.floor(Date.now() / 1000) + 15 * 24 * 60 * 60;

      const cancelingSub = createMockSubscription({
        status: "active",
        cancel_at_period_end: false,
        cancel_at: cancelAt,
      });

      const revivedSub = createMockSubscription({
        status: "active",
        cancel_at_period_end: false,
        cancel_at: null,
      });

      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
        stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
        stripeStatus: "active",
        cancelAtPeriodEnd: true,
        linkedAt: "2024-01-01T00:00:00Z",
      });

      (stripe.subscriptions.retrieve as Mock).mockResolvedValue(cancelingSub);
      (stripe.subscriptions.update as Mock).mockResolvedValue(revivedSub);

      const response = await POST(createMockRequest());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.revived).toBe(true);

      // Must pass cancel_at: "" when cancel_at was set
      expect(stripe.subscriptions.update).toHaveBeenCalledWith(
        MOCK_SUBSCRIPTION_ID,
        { cancel_at_period_end: false, cancel_at: "" },
      );

      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("should revive via Stripe guard path when KV retrieve fails", async () => {
      // KV has entitlement, but retrieve fails
      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
        stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
        stripeStatus: "active",
        linkedAt: "2024-01-01T00:00:00Z",
      });

      (stripe.subscriptions.retrieve as Mock).mockRejectedValue(
        new Error("No such subscription"),
      );

      // Stripe guard finds a canceling subscription
      (stripe.subscriptions.list as Mock).mockResolvedValue({
        data: [
          {
            id: "sub_found",
            cancel_at_period_end: true,
            cancel_at: null,
          },
        ],
      });

      const revivedSub = createMockSubscription({
        id: "sub_found",
        status: "active",
        cancel_at_period_end: false,
      });
      (stripe.subscriptions.update as Mock).mockResolvedValue(revivedSub);

      const response = await POST(createMockRequest());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.revived).toBe(true);

      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(stripe.subscriptions.update).toHaveBeenCalledWith(
        "sub_found",
        { cancel_at_period_end: false },
      );
    });
  });

  // =========================================================================
  // Terminal subscription (canceled, past_due, unpaid) → new checkout
  // =========================================================================

  describe("Terminal subscription cleanup", () => {
    it("should cancel past_due subscription and proceed to new checkout", async () => {
      const pastDueSub = createMockSubscription({ status: "past_due" });

      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
        stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
        stripeStatus: "past_due",
      });

      (stripe.subscriptions.retrieve as Mock).mockResolvedValue(pastDueSub);

      // Stripe guard: no active subs after cancel
      (stripe.subscriptions.list as Mock).mockResolvedValue({ data: [] });

      (stripe.checkout.sessions.create as Mock).mockResolvedValue({
        id: "cs_new",
        url: "https://checkout.stripe.com/pay/cs_new",
      });

      const response = await POST(createMockRequest());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.url).toBe("https://checkout.stripe.com/pay/cs_new");

      expect(stripe.subscriptions.cancel).toHaveBeenCalledWith(MOCK_SUBSCRIPTION_ID);
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: MOCK_CUSTOMER_ID,
        }),
      );
    });

    it("should proceed to new checkout for canceled subscription", async () => {
      const canceledSub = createMockSubscription({ status: "canceled" });

      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
        stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
        stripeStatus: "canceled",
      });

      (stripe.subscriptions.retrieve as Mock).mockResolvedValue(canceledSub);

      // Stripe guard: no active subs
      (stripe.subscriptions.list as Mock).mockResolvedValue({ data: [] });

      (stripe.checkout.sessions.create as Mock).mockResolvedValue({
        id: "cs_new",
        url: "https://checkout.stripe.com/pay/cs_new",
      });

      const response = await POST(createMockRequest());
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.url).toBeDefined();

      // Canceled subs should NOT be cancel()ed again (only past_due/unpaid)
      expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // KV stale sync
  // =========================================================================

  describe("KV stale sync", () => {
    it("should re-sync KV when it thinks sub is canceling but Stripe disagrees", async () => {
      const activeSub = createMockSubscription({
        status: "active",
        cancel_at_period_end: false,
        cancel_at: null,
      });

      (getStripeEntitlement as Mock).mockResolvedValue({
        stripeCustomerId: MOCK_CUSTOMER_ID,
        stripeSubscriptionId: MOCK_SUBSCRIPTION_ID,
        stripeStatus: "active",
        cancelAtPeriodEnd: true, // KV is stale
        linkedAt: "2024-01-01T00:00:00Z",
      });

      (stripe.subscriptions.retrieve as Mock).mockResolvedValue(activeSub);

      const response = await POST(createMockRequest());
      expect(response.status).toBe(409); // already_subscribed

      // Should have synced KV
      expect(setStripeEntitlement).toHaveBeenCalledWith(
        MOCK_GOOGLE_SUB,
        expect.objectContaining({
          linkedAt: "2024-01-01T00:00:00Z",
        }),
      );
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe("Error handling", () => {
    it("should return 500 when Stripe session creation throws", async () => {
      (stripe.checkout.sessions.create as Mock).mockRejectedValue(
        new Error("Stripe API error"),
      );

      const response = await POST(createMockRequest());
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("checkout_error");
    });
  });
});
