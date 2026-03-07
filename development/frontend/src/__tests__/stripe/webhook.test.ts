/**
 * Unit tests for Stripe webhook helper functions
 */

import { describe, it, expect } from 'vitest';
import type Stripe from 'stripe';
import {
  buildEntitlementFromSubscription,
  mapStripeStatusToTier,
} from '@/lib/stripe/webhook';

describe('buildEntitlementFromSubscription', () => {
  const mockCustomerId = 'cus_test123';
  const mockSubscriptionId = 'sub_test123';

  const createMockSubscription = (overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription => {
    return {
      id: mockSubscriptionId,
      object: 'subscription',
      application: null,
      application_fee_percent: null,
      automatic_tax: { enabled: false, liability: null },
      billing_cycle_anchor: 1609459200,
      billing_cycle_anchor_config: null,
      billing_thresholds: null,
      cancel_at: null,
      cancel_at_period_end: false,
      canceled_at: null,
      cancellation_details: null,
      collection_method: 'charge_automatically',
      created: 1609459200,
      currency: 'usd',
      current_period_end: 1612137600,
      current_period_start: 1609459200,
      customer: mockCustomerId,
      days_until_due: null,
      default_payment_method: null,
      default_source: null,
      default_tax_rates: [],
      description: null,
      discount: null,
      discounts: [],
      ended_at: null,
      invoice_settings: { account_tax_ids: null, issuer: { type: 'self' } },
      items: {
        object: 'list',
        data: [
          {
            id: 'si_test123',
            object: 'subscription_item',
            billing_thresholds: null,
            created: 1609459200,
            discounts: [],
            metadata: {},
            plan: null as any,
            price: null as any,
            quantity: 1,
            subscription: mockSubscriptionId,
            tax_rates: [],
            current_period_end: 1612137600,
            current_period_start: 1609459200,
          },
        ],
        has_more: false,
        url: '/v1/subscription_items',
      },
      latest_invoice: null,
      livemode: false,
      metadata: {},
      next_pending_invoice_item_invoice: null,
      on_behalf_of: null,
      pause_collection: null,
      payment_settings: null,
      pending_invoice_item_interval: null,
      pending_setup_intent: null,
      pending_update: null,
      schedule: null,
      start_date: 1609459200,
      status: 'active',
      test_clock: null,
      transfer_data: null,
      trial_end: null,
      trial_settings: null,
      trial_start: null,
      ...overrides,
    } as Stripe.Subscription;
  };

  it('should return cancelAtPeriodEnd: true when cancel_at is set', () => {
    const cancelAtTimestamp = 1612137600; // Future timestamp
    const subscription = createMockSubscription({
      cancel_at: cancelAtTimestamp,
      cancel_at_period_end: false,
    });

    const result = buildEntitlementFromSubscription(subscription, mockCustomerId);

    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.currentPeriodEnd).toBe(new Date(cancelAtTimestamp * 1000).toISOString());
    expect(result.tier).toBe('karl');
    expect(result.active).toBe(true);
    expect(result.stripeCustomerId).toBe(mockCustomerId);
    expect(result.stripeSubscriptionId).toBe(mockSubscriptionId);
  });

  it('should return cancelAtPeriodEnd: true when cancel_at_period_end is true', () => {
    const subscription = createMockSubscription({
      cancel_at_period_end: true,
      cancel_at: null,
    });

    const result = buildEntitlementFromSubscription(subscription, mockCustomerId);

    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.tier).toBe('karl');
    expect(result.active).toBe(true);
  });

  it('should return cancelAtPeriodEnd: false when neither cancel_at nor cancel_at_period_end is set', () => {
    const subscription = createMockSubscription({
      cancel_at_period_end: false,
      cancel_at: null,
    });

    const result = buildEntitlementFromSubscription(subscription, mockCustomerId);

    expect(result.cancelAtPeriodEnd).toBe(false);
    expect(result.tier).toBe('karl');
    expect(result.active).toBe(true);
  });

  it('should handle canceled subscription status', () => {
    const subscription = createMockSubscription({
      status: 'canceled',
      cancel_at_period_end: false,
      cancel_at: null,
    });

    const result = buildEntitlementFromSubscription(subscription, mockCustomerId);

    expect(result.tier).toBe('thrall');
    expect(result.active).toBe(false);
    expect(result.cancelAtPeriodEnd).toBe(false);
  });

  it('should use current_period_end from first item when cancel_at is null', () => {
    const expectedPeriodEnd = 1612137600;
    const subscription = createMockSubscription({
      cancel_at: null,
      items: {
        object: 'list',
        data: [
          {
            id: 'si_test123',
            object: 'subscription_item',
            billing_thresholds: null,
            created: 1609459200,
            discounts: [],
            metadata: {},
            plan: null as any,
            price: null as any,
            quantity: 1,
            subscription: mockSubscriptionId,
            tax_rates: [],
            current_period_end: expectedPeriodEnd,
            current_period_start: 1609459200,
          },
        ],
        has_more: false,
        url: '/v1/subscription_items',
      },
    });

    const result = buildEntitlementFromSubscription(subscription, mockCustomerId);

    expect(result.currentPeriodEnd).toBe(new Date(expectedPeriodEnd * 1000).toISOString());
  });

  it('should use current date as fallback when no period end is available', () => {
    const beforeDate = new Date();

    const subscription = createMockSubscription({
      cancel_at: null,
      items: {
        object: 'list',
        data: [],
        has_more: false,
        url: '/v1/subscription_items',
      },
    });

    const result = buildEntitlementFromSubscription(subscription, mockCustomerId);
    const afterDate = new Date();

    const resultDate = new Date(result.currentPeriodEnd!);
    expect(resultDate.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
    expect(resultDate.getTime()).toBeLessThanOrEqual(afterDate.getTime());
  });
});

describe('mapStripeStatusToTier', () => {
  it('should map active status to karl tier', () => {
    const result = mapStripeStatusToTier('active');
    expect(result.tier).toBe('karl');
    expect(result.active).toBe(true);
  });

  it('should map trialing status to karl tier', () => {
    const result = mapStripeStatusToTier('trialing');
    expect(result.tier).toBe('karl');
    expect(result.active).toBe(true);
  });

  it('should map past_due status to karl tier', () => {
    const result = mapStripeStatusToTier('past_due');
    expect(result.tier).toBe('karl');
    expect(result.active).toBe(true);
  });

  it('should map canceled status to thrall tier', () => {
    const result = mapStripeStatusToTier('canceled');
    expect(result.tier).toBe('thrall');
    expect(result.active).toBe(false);
  });

  it('should map unpaid status to thrall tier', () => {
    const result = mapStripeStatusToTier('unpaid');
    expect(result.tier).toBe('thrall');
    expect(result.active).toBe(false);
  });

  it('should map incomplete status to thrall tier', () => {
    const result = mapStripeStatusToTier('incomplete');
    expect(result.tier).toBe('thrall');
    expect(result.active).toBe(false);
  });

  it('should map incomplete_expired status to thrall tier', () => {
    const result = mapStripeStatusToTier('incomplete_expired');
    expect(result.tier).toBe('thrall');
    expect(result.active).toBe(false);
  });

  it('should map paused status to thrall tier', () => {
    const result = mapStripeStatusToTier('paused');
    expect(result.tier).toBe('thrall');
    expect(result.active).toBe(false);
  });

  it('should map unknown status to thrall tier', () => {
    const result = mapStripeStatusToTier('some_unknown_status');
    expect(result.tier).toBe('thrall');
    expect(result.active).toBe(false);
  });
});