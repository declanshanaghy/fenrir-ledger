/**
 * Unit tests for POST /api/stripe/checkout route handler
 *
 * Tests the subscription revive logic, duplicate prevention, and error handling.
 * Mocks: Stripe SDK, KV entitlement store, auth, rate limiter, logger.
 *
 * Fixes #663 — Stripe rejects both cancel_at_period_end and cancel_at in same request.
 * Covers #571 — Unit tests for Stripe checkout route.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { StripeEntitlement } from "@/lib/kv/entitlement-store";

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports that reference them
// ---------------------------------------------------------------------------

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
  getStripe: vi.fn(),
}));

const mockGetEntitlement = vi.hoisted(() => vi.fn<() => Promise<StripeEntitlement | null>>());
const mockSetEntitlement = vi.hoisted(() => vi.fn());

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: (...args: unknown[]) => mockGetEntitlement(...args),
  setStripeEntitlement: (...args: unknown[]) => mockSetEntitlement(...args),
}));

const mockRequireAuthz = vi.hoisted(() => vi.fn().mockResolvedValue({
  ok: true,
  user: { sub: "google-sub-123", email: "test@example.com", name: "Test User", picture: "" },
  firestoreUser: { userId: "google-sub-123", email: "test@example.com", displayName: "Test User", householdId: "hh-test", role: "owner" as const, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
}));
vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: mockRequireAuthz,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockReturnValue({ success: true }),
}));

vi.mock("@/lib/stripe/webhook", () => ({
  buildEntitlementFromSubscription: vi.fn().mockReturnValue({
    tier: "karl",
    active: true,
    stripeCustomerId: "cus_existing",
    stripeSubscriptionId: "sub_existing",
    stripeStatus: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2026-04-12T00:00:00Z",
    linkedAt: "2026-03-01T00:00:00Z",
    checkedAt: "2026-03-12T00:00:00Z",
  }),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import the handler AFTER mocks are set up
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/stripe/checkout/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown> = { returnPath: "/ledger/settings" }): NextRequest {
  return new NextRequest("https://fenrir-ledger.example.com/api/stripe/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "127.0.0.1",
      authorization: "Bearer fake-id-token",
    },
    body: JSON.stringify(body),
  });
}

function makeEntitlement(overrides: Partial<StripeEntitlement> = {}): StripeEntitlement {
  return {
    tier: "karl",
    active: true,
    stripeCustomerId: "cus_existing",
    stripeSubscriptionId: "sub_existing",
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
    id: "sub_existing",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_ID = "price_test123";
    process.env.APP_BASE_URL = "https://fenrir-ledger.example.com";
  });

  // =========================================================================
  // Revive logic — the #663 regression
  // =========================================================================

  describe("revive: cancel_at set (not cancel_at_period_end)", () => {
    it("sends only cancel_at param, NOT both — fixes #663", async () => {
      mockGetEntitlement.mockResolvedValue(makeEntitlement({ cancelAtPeriodEnd: false }));
      mockSubscriptionsRetrieve.mockResolvedValue(
        makeSubscription({ cancel_at: 1775968387, cancel_at_period_end: false }),
      );
      mockSubscriptionsUpdate.mockResolvedValue(
        makeSubscription({ cancel_at: null, cancel_at_period_end: false }),
      );

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.revived).toBe(true);

      // THE KEY ASSERTION: only cancel_at, NOT cancel_at_period_end
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_existing", { cancel_at: "" });
      expect(mockSubscriptionsUpdate).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ cancel_at_period_end: expect.anything() }),
      );
    });
  });

  describe("revive: cancel_at_period_end set (no cancel_at)", () => {
    it("sends only cancel_at_period_end param", async () => {
      mockGetEntitlement.mockResolvedValue(makeEntitlement({ cancelAtPeriodEnd: true }));
      mockSubscriptionsRetrieve.mockResolvedValue(
        makeSubscription({ cancel_at: null, cancel_at_period_end: true }),
      );
      mockSubscriptionsUpdate.mockResolvedValue(
        makeSubscription({ cancel_at: null, cancel_at_period_end: false }),
      );

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.revived).toBe(true);

      // Only cancel_at_period_end, NOT cancel_at
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_existing", {
        cancel_at_period_end: false,
      });
      expect(mockSubscriptionsUpdate).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ cancel_at: expect.anything() }),
      );
    });
  });

  describe("revive: both cancel_at and cancel_at_period_end set", () => {
    it("prefers cancel_at param (clears both implicitly)", async () => {
      mockGetEntitlement.mockResolvedValue(makeEntitlement({ cancelAtPeriodEnd: true }));
      mockSubscriptionsRetrieve.mockResolvedValue(
        makeSubscription({ cancel_at: 1775968387, cancel_at_period_end: true }),
      );
      mockSubscriptionsUpdate.mockResolvedValue(
        makeSubscription({ cancel_at: null, cancel_at_period_end: false }),
      );

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.revived).toBe(true);

      // cancel_at takes precedence — only one param sent
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_existing", { cancel_at: "" });
    });
  });

  // =========================================================================
  // Stripe-level guard revive (second code path)
  // =========================================================================

  describe("Stripe-level guard revive path", () => {
    it("sends only cancel_at when guard finds canceling sub with cancel_at", async () => {
      // KV has stale data — subscription retrieve fails, but guard finds active sub
      mockGetEntitlement.mockResolvedValue(makeEntitlement());
      mockSubscriptionsRetrieve.mockRejectedValue(new Error("No such subscription"));
      mockSubscriptionsList.mockResolvedValue({
        data: [makeSubscription({ id: "sub_guard", cancel_at: 1775968387, cancel_at_period_end: false })],
      });
      mockSubscriptionsUpdate.mockResolvedValue(
        makeSubscription({ id: "sub_guard", cancel_at: null, cancel_at_period_end: false }),
      );

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.revived).toBe(true);
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_guard", { cancel_at: "" });
    });

    it("sends only cancel_at_period_end when guard finds sub with only that flag", async () => {
      mockGetEntitlement.mockResolvedValue(makeEntitlement());
      mockSubscriptionsRetrieve.mockRejectedValue(new Error("No such subscription"));
      mockSubscriptionsList.mockResolvedValue({
        data: [makeSubscription({ id: "sub_guard", cancel_at: null, cancel_at_period_end: true })],
      });
      mockSubscriptionsUpdate.mockResolvedValue(
        makeSubscription({ id: "sub_guard", cancel_at: null, cancel_at_period_end: false }),
      );

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.revived).toBe(true);
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith("sub_guard", {
        cancel_at_period_end: false,
      });
    });
  });

  // =========================================================================
  // Happy paths
  // =========================================================================

  describe("fresh user — no prior subscription", () => {
    it("creates checkout session with customer_email", async () => {
      mockGetEntitlement.mockResolvedValue(null);
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_new",
        url: "https://checkout.stripe.com/pay/cs_new",
      });

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.url).toBe("https://checkout.stripe.com/pay/cs_new");
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customer_email: "test@example.com" }),
      );
    });
  });

  describe("re-subscribe after cancellation", () => {
    it("creates checkout with existing customer ID", async () => {
      mockGetEntitlement.mockResolvedValue(
        makeEntitlement({ stripeStatus: "canceled", active: false }),
      );
      mockSubscriptionsRetrieve.mockResolvedValue(
        makeSubscription({ status: "canceled" }),
      );
      mockSubscriptionsList.mockResolvedValue({ data: [] });
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_resub",
        url: "https://checkout.stripe.com/pay/cs_resub",
      });

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.url).toContain("cs_resub");
      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_existing" }),
      );
    });
  });

  // =========================================================================
  // Duplicate prevention
  // =========================================================================

  describe("active subscription — not canceling", () => {
    it("returns 409 already_subscribed", async () => {
      mockGetEntitlement.mockResolvedValue(makeEntitlement());
      mockSubscriptionsRetrieve.mockResolvedValue(makeSubscription());

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.error).toBe("already_subscribed");
    });
  });

  describe("Stripe guard catches active sub missed by KV", () => {
    it("returns 409 when Stripe has active non-canceling sub", async () => {
      mockGetEntitlement.mockResolvedValue(
        makeEntitlement({ stripeStatus: "canceled", active: false }),
      );
      mockSubscriptionsRetrieve.mockResolvedValue(makeSubscription({ status: "canceled" }));
      mockSubscriptionsList.mockResolvedValue({
        data: [makeSubscription({ id: "sub_active", cancel_at: null, cancel_at_period_end: false })],
      });

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(409);
      expect(body.error).toBe("already_subscribed");
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe("deleted subscription in Stripe", () => {
    it("falls through to new checkout when retrieve fails", async () => {
      mockGetEntitlement.mockResolvedValue(makeEntitlement());
      mockSubscriptionsRetrieve.mockRejectedValue(
        new Error("No such subscription: 'sub_existing'"),
      );
      mockSubscriptionsList.mockResolvedValue({ data: [] });
      mockCheckoutSessionsCreate.mockResolvedValue({
        id: "cs_after_delete",
        url: "https://checkout.stripe.com/pay/cs_after_delete",
      });

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.url).toContain("cs_after_delete");
    });
  });

  describe("deleted customer in Stripe", () => {
    it("returns 500 with actual error message (not generic)", async () => {
      mockGetEntitlement.mockResolvedValue(makeEntitlement());
      mockSubscriptionsRetrieve.mockRejectedValue(new Error("No such subscription"));
      mockSubscriptionsList.mockRejectedValue(
        new Error("No such customer: 'cus_existing'"),
      );

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error_description).toContain("No such customer");
    });
  });

  describe("missing STRIPE_PRICE_ID", () => {
    it("returns 500 config_error", async () => {
      delete process.env.STRIPE_PRICE_ID;

      const res = await POST(makeRequest());
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe("config_error");
    });
  });
});
