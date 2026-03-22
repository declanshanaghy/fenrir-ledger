/**
 * Unit tests for pure Stripe helper functions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mapStripeStatusToTier, buildEntitlementFromSubscription } from "@/lib/stripe/webhook";

describe("mapStripeStatusToTier", () => {
  it("should map 'active' status to karl tier with active=true", () => {
    const result = mapStripeStatusToTier("active");
    expect(result).toEqual({ tier: "karl", active: true });
  });

  it("should map 'trialing' status to karl tier with active=true", () => {
    const result = mapStripeStatusToTier("trialing");
    expect(result).toEqual({ tier: "karl", active: true });
  });

  it("should map 'past_due' status to karl tier with active=true", () => {
    const result = mapStripeStatusToTier("past_due");
    expect(result).toEqual({ tier: "karl", active: true });
  });

  it("should map 'canceled' status to thrall tier with active=false", () => {
    const result = mapStripeStatusToTier("canceled");
    expect(result).toEqual({ tier: "thrall", active: false });
  });

  it("should map 'unpaid' status to thrall tier with active=false", () => {
    const result = mapStripeStatusToTier("unpaid");
    expect(result).toEqual({ tier: "thrall", active: false });
  });

  it("should map 'incomplete' status to thrall tier with active=false", () => {
    const result = mapStripeStatusToTier("incomplete");
    expect(result).toEqual({ tier: "thrall", active: false });
  });

  it("should map 'incomplete_expired' status to thrall tier with active=false", () => {
    const result = mapStripeStatusToTier("incomplete_expired");
    expect(result).toEqual({ tier: "thrall", active: false });
  });

  it("should map 'paused' status to thrall tier with active=false", () => {
    const result = mapStripeStatusToTier("paused");
    expect(result).toEqual({ tier: "thrall", active: false });
  });

  it("should map unknown status to thrall tier with active=false", () => {
    const result = mapStripeStatusToTier("unknown_status");
    expect(result).toEqual({ tier: "thrall", active: false });
  });
});

describe("buildEntitlementFromSubscription", () => {
  const mockCustomerId = "cus_test123";
  const mockSubscriptionId = "sub_test456";
  const mockPeriodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now
  const mockCancelAt = Math.floor(Date.now() / 1000) + 15 * 24 * 60 * 60; // 15 days from now

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T10:00:00Z"));
  });

  const createMockSubscription = (overrides?: any): any => ({
    id: mockSubscriptionId,
    object: "subscription",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    customer: mockCustomerId,
    items: {
      object: "list",
      data: [{
        id: "si_test",
        object: "subscription_item",
        subscription: mockSubscriptionId,
        current_period_end: mockPeriodEnd,
        current_period_start: Math.floor(Date.now() / 1000),
      }],
      has_more: false,
      url: "",
    },
    ...overrides,
  });

  it("should return cancelAtPeriodEnd: false when neither cancel_at nor cancel_at_period_end is set", () => {
    const subscription = createMockSubscription({
      status: "active",
      cancel_at_period_end: false,
      cancel_at: null,
    });

    const result = buildEntitlementFromSubscription(subscription, mockCustomerId);

    expect(result.cancelAtPeriodEnd).toBe(false);
    expect(result.tier).toBe("karl");
    expect(result.active).toBe(true);
    expect(result.stripeCustomerId).toBe(mockCustomerId);
    expect(result.stripeSubscriptionId).toBe(mockSubscriptionId);
  });

  it("should return cancelAtPeriodEnd: true when cancel_at is set", () => {
    const subscription = createMockSubscription({
      status: "active",
      cancel_at_period_end: false,
      cancel_at: mockCancelAt,
    });

    const result = buildEntitlementFromSubscription(subscription, mockCustomerId);

    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.currentPeriodEnd).toBe(new Date(mockCancelAt * 1000).toISOString());
  });

  it("should return cancelAtPeriodEnd: true when cancel_at_period_end is true", () => {
    const subscription = createMockSubscription({
      status: "active",
      cancel_at_period_end: true,
      cancel_at: null,
    });

    const result = buildEntitlementFromSubscription(subscription, mockCustomerId);

    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.currentPeriodEnd).toBe(new Date(mockPeriodEnd * 1000).toISOString());
  });

  it("should return cancelAtPeriodEnd: true when both cancel_at and cancel_at_period_end are set", () => {
    const subscription = createMockSubscription({
      status: "active",
      cancel_at_period_end: true,
      cancel_at: mockCancelAt,
    });

    const result = buildEntitlementFromSubscription(subscription, mockCustomerId);

    expect(result.cancelAtPeriodEnd).toBe(true);
    // When cancel_at is set, it takes precedence for the currentPeriodEnd
    expect(result.currentPeriodEnd).toBe(new Date(mockCancelAt * 1000).toISOString());
  });

  it("should handle canceled subscription status", () => {
    const subscription = createMockSubscription({
      status: "canceled",
      cancel_at_period_end: false,
      cancel_at: null,
    });

    const result = buildEntitlementFromSubscription(subscription, mockCustomerId);

    expect(result.tier).toBe("thrall");
    expect(result.active).toBe(false);
    expect(result.stripeStatus).toBe("canceled");
  });

  it("should set linkedAt and checkedAt to current time", () => {
    const subscription = createMockSubscription();

    const result = buildEntitlementFromSubscription(subscription, mockCustomerId);

    expect(result.linkedAt).toBe("2024-01-15T10:00:00.000Z");
    expect(result.checkedAt).toBe("2024-01-15T10:00:00.000Z");
  });

  it("should handle subscription with no items data", () => {
    const subscription = createMockSubscription({
      items: {
        object: "list",
        data: [],
        has_more: false,
        url: "",
      },
    });

    const result = buildEntitlementFromSubscription(subscription, mockCustomerId);

    // Should fallback to current date when no items
    expect(result.currentPeriodEnd).toBe("2024-01-15T10:00:00.000Z");
  });
});