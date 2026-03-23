/**
 * Loki QA tests for POST /api/stripe/checkout — issue #1683
 *
 * Validates the refactored route (complexity 40 → ≤15) by covering
 * edge cases not exercised by checkout-route.test.ts:
 *
 * - Rate limiting (429)
 * - Auth failure (401)
 * - past_due / unpaid subscription cancel-then-checkout
 * - Checkout session with no URL (500)
 * - returnPath defaulting when body is absent or path invalid
 * - returnPath with existing query params (sep = "&" not "?")
 * - Customer exists but no subscriptionId (customer reuse path)
 * - trialing + not canceling → 409
 * - KV stale cancelAtPeriodEnd re-sync path
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { StripeEntitlement } from "@/lib/kv/entitlement-store";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRateLimit = vi.hoisted(() => vi.fn().mockReturnValue({ success: true }));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

const mockSubscriptionsRetrieve = vi.hoisted(() => vi.fn());
const mockSubscriptionsUpdate = vi.hoisted(() => vi.fn());
const mockSubscriptionsCancel = vi.hoisted(() => vi.fn());
const mockSubscriptionsList = vi.hoisted(() => vi.fn());
const mockCheckoutSessionsCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe/api", () => ({
  stripe: {
    subscriptions: {
      retrieve: (...args: unknown[]) => mockSubscriptionsRetrieve(...args),
      update: (...args: unknown[]) => mockSubscriptionsUpdate(...args),
      cancel: (...args: unknown[]) => mockSubscriptionsCancel(...args),
      list: (...args: unknown[]) => mockSubscriptionsList(...args),
    },
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockCheckoutSessionsCreate(...args),
      },
    },
  },
}));

const mockGetEntitlement = vi.hoisted(() => vi.fn<() => Promise<StripeEntitlement | null>>());
const mockSetEntitlement = vi.hoisted(() => vi.fn());

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: (...args: unknown[]) => mockGetEntitlement(...args),
  setStripeEntitlement: (...args: unknown[]) => mockSetEntitlement(...args),
}));

const mockRequireAuthz = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    ok: true,
    user: {
      sub: "google-sub-loki",
      email: "loki@fenrir.test",
      name: "Loki Tester",
      picture: "",
    },
    firestoreUser: {
      userId: "google-sub-loki",
      email: "loki@fenrir.test",
      displayName: "Loki Tester",
      householdId: "hh-loki",
      role: "owner" as const,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
  }),
);
vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: mockRequireAuthz,
}));

vi.mock("@/lib/stripe/webhook", () => ({
  buildEntitlementFromSubscription: vi.fn().mockReturnValue({
    tier: "karl",
    active: true,
    stripeCustomerId: "cus_loki",
    stripeSubscriptionId: "sub_loki",
    stripeStatus: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2026-04-12T00:00:00Z",
    linkedAt: "2026-03-01T00:00:00Z",
    checkedAt: "2026-03-12T00:00:00Z",
  }),
}));

vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import handler AFTER mocks
import { POST } from "@/app/api/stripe/checkout/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  body: Record<string, unknown> | null = { returnPath: "/ledger/settings" },
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest("https://fenrir-ledger.test/api/stripe/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "10.0.0.1",
      authorization: "Bearer fake-token",
      ...headers,
    },
    body: body !== null ? JSON.stringify(body) : undefined,
  });
}

function makeEntitlement(overrides: Partial<StripeEntitlement> = {}): StripeEntitlement {
  return {
    tier: "karl",
    active: true,
    stripeCustomerId: "cus_loki",
    stripeSubscriptionId: "sub_loki",
    stripeStatus: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2026-04-12T00:00:00Z",
    linkedAt: "2026-03-01T00:00:00Z",
    checkedAt: "2026-03-12T00:00:00Z",
    ...overrides,
  };
}

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_loki",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/stripe/checkout — Loki QA (issue #1683)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_PRICE_ID = "price_loki_test";
    process.env.APP_BASE_URL = "https://fenrir-ledger.test";
    mockRateLimit.mockReturnValue({ success: true });
    mockRequireAuthz.mockResolvedValue({
      ok: true,
      user: {
        sub: "google-sub-loki",
        email: "loki@fenrir.test",
        name: "Loki Tester",
        picture: "",
      },
      firestoreUser: {
        userId: "google-sub-loki",
        email: "loki@fenrir.test",
        displayName: "Loki Tester",
        householdId: "hh-loki",
        role: "owner" as const,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    });
  });

  // =========================================================================
  // Rate limiting
  // =========================================================================

  describe("rate limiting", () => {
    it("returns 429 when rate limit exceeded", async () => {
      mockRateLimit.mockReturnValue({ success: false });

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(429);
      expect(body.error).toBe("rate_limited");
    });

    it("passes the correct key and window to rateLimit", async () => {
      mockRateLimit.mockReturnValue({ success: false });
      await POST(makeRequest({}, { "x-forwarded-for": "192.168.1.100" }));

      expect(mockRateLimit).toHaveBeenCalledWith(
        "stripe-checkout:192.168.1.100",
        expect.objectContaining({ limit: 10, windowMs: 60_000 }),
      );
    });
  });

  // =========================================================================
  // Auth failure
  // =========================================================================

  describe("authentication failure", () => {
    it("returns authz response when auth fails", async () => {
      mockRequireAuthz.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
      });

      const res = await POST(makeRequest());
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // past_due / unpaid → cancel then new checkout
  // =========================================================================

  describe("past_due subscription", () => {
    it("cancels the stale sub then creates new checkout", async () => {
      mockGetEntitlement.mockResolvedValue(makeEntitlement({ stripeStatus: "past_due" }));
      mockSubscriptionsRetrieve.mockResolvedValue(makeSubscription({ status: "past_due" }));
      mockSubscriptionsCancel.mockResolvedValue({});
      mockSubscriptionsList.mockResolvedValue({ data: [] });
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_after_pastdue",
        url: "https://checkout.stripe.com/pay/cs_after_pastdue",
      });

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.url).toContain("cs_after_pastdue");
      expect(mockSubscriptionsCancel).toHaveBeenCalledWith("sub_loki");
    });
  });

  describe("unpaid subscription", () => {
    it("cancels the stale sub then creates new checkout", async () => {
      mockGetEntitlement.mockResolvedValue(makeEntitlement({ stripeStatus: "unpaid" }));
      mockSubscriptionsRetrieve.mockResolvedValue(makeSubscription({ status: "unpaid" }));
      mockSubscriptionsCancel.mockResolvedValue({});
      mockSubscriptionsList.mockResolvedValue({ data: [] });
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_after_unpaid",
        url: "https://checkout.stripe.com/pay/cs_after_unpaid",
      });

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.url).toContain("cs_after_unpaid");
      expect(mockSubscriptionsCancel).toHaveBeenCalledWith("sub_loki");
    });
  });

  // =========================================================================
  // Checkout session URL missing
  // =========================================================================

  describe("buildCheckoutSession — no URL returned", () => {
    it("returns 500 checkout_error when session has no URL", async () => {
      mockGetEntitlement.mockResolvedValue(null);
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_no_url",
        url: null,
      });

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("checkout_error");
    });
  });

  // =========================================================================
  // returnPath parsing
  // =========================================================================

  describe("parseReturnPath — body with no returnPath", () => {
    it("defaults to /ledger/settings", async () => {
      mockGetEntitlement.mockResolvedValue(null);
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_default",
        url: "https://checkout.stripe.com/pay/cs_default",
      });

      // Send body without returnPath field
      const res = await POST(makeRequest({}));
      expect(res.status).toBe(200);

      const callArgs = mockCheckoutSessionsCreate.mock.calls[0]![0] as Record<string, string>;
      expect(callArgs.success_url).toContain("/ledger/settings");
      expect(callArgs.cancel_url).toContain("/ledger/settings");
    });
  });

  describe("parseReturnPath — returnPath missing leading slash", () => {
    it("ignores invalid returnPath and uses default", async () => {
      mockGetEntitlement.mockResolvedValue(null);
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_invalid_path",
        url: "https://checkout.stripe.com/pay/cs_invalid_path",
      });

      const res = await POST(makeRequest({ returnPath: "no-leading-slash" }));
      expect(res.status).toBe(200);

      const callArgs = mockCheckoutSessionsCreate.mock.calls[0]![0] as Record<string, string>;
      expect(callArgs.success_url).toContain("/ledger/settings");
    });
  });

  describe("parseReturnPath — returnPath with existing query params", () => {
    it("appends stripe params with & not ?", async () => {
      mockGetEntitlement.mockResolvedValue(null);
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_qs",
        url: "https://checkout.stripe.com/pay/cs_qs",
      });

      const res = await POST(makeRequest({ returnPath: "/ledger/settings?tab=billing" }));
      expect(res.status).toBe(200);

      const callArgs = mockCheckoutSessionsCreate.mock.calls[0]![0] as Record<string, string>;
      expect(callArgs.success_url).toContain("?tab=billing&stripe=success");
      expect(callArgs.cancel_url).toContain("?tab=billing&stripe=cancel");
    });
  });

  // =========================================================================
  // Customer exists, no subscriptionId
  // =========================================================================

  describe("customer exists but no subscriptionId in KV", () => {
    it("reuses customer ID for new checkout (no subscription retrieve)", async () => {
      mockGetEntitlement.mockResolvedValue(
        makeEntitlement({ stripeSubscriptionId: undefined }),
      );
      mockSubscriptionsList.mockResolvedValue({ data: [] });
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_reuse_cust",
        url: "https://checkout.stripe.com/pay/cs_reuse_cust",
      });

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.url).toContain("cs_reuse_cust");
      // Should use customer ID, not email
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_loki" }),
      );
      // Should not attempt to retrieve non-existent subscription
      expect(mockSubscriptionsRetrieve).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // trialing + not canceling → 409
  // =========================================================================

  describe("trialing subscription not scheduled to cancel", () => {
    it("returns 409 already_subscribed", async () => {
      mockGetEntitlement.mockResolvedValue(
        makeEntitlement({ stripeStatus: "trialing" }),
      );
      mockSubscriptionsRetrieve.mockResolvedValue(
        makeSubscription({ status: "trialing", cancel_at_period_end: false, cancel_at: null }),
      );

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.error).toBe("already_subscribed");
    });
  });

  // =========================================================================
  // KV stale cancelAtPeriodEnd re-sync
  // =========================================================================

  describe("KV stale cancelAtPeriodEnd re-sync", () => {
    it("re-syncs KV when it wrongly shows cancelAtPeriodEnd=true but Stripe is active", async () => {
      mockGetEntitlement.mockResolvedValue(
        makeEntitlement({ cancelAtPeriodEnd: true }),
      );
      // Stripe shows fully active, not canceling
      mockSubscriptionsRetrieve.mockResolvedValue(
        makeSubscription({ status: "active", cancel_at_period_end: false, cancel_at: null }),
      );

      const res = await POST(makeRequest());
      const body = await res.json();

      // Should still return 409 — user is active
      expect(res.status).toBe(409);
      expect(body.error).toBe("already_subscribed");
      // Should have re-synced KV
      expect(mockSetEntitlement).toHaveBeenCalledWith("google-sub-loki", expect.any(Object));
    });
  });

  // =========================================================================
  // Checkout session metadata
  // =========================================================================

  describe("checkout session metadata", () => {
    it("includes googleSub in session metadata", async () => {
      mockGetEntitlement.mockResolvedValue(null);
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_meta",
        url: "https://checkout.stripe.com/pay/cs_meta",
      });

      await POST(makeRequest());

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { googleSub: "google-sub-loki" },
        }),
      );
    });

    it("sets allow_promotion_codes true", async () => {
      mockGetEntitlement.mockResolvedValue(null);
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_promo",
        url: "https://checkout.stripe.com/pay/cs_promo",
      });

      await POST(makeRequest());

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ allow_promotion_codes: true }),
      );
    });
  });
});
