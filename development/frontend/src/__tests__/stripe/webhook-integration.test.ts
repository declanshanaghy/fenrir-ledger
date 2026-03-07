/**
 * Integration tests for Stripe webhook handlers with mocked Stripe SDK
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/stripe/webhook/route';
import { NextRequest } from 'next/server';
import type Stripe from 'stripe';

// Mock the stripe module
vi.mock('@/lib/stripe/api', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  },
}));

// Mock the KV entitlement store
vi.mock('@/lib/kv/entitlement-store', () => ({
  getStripeEntitlement: vi.fn(),
  setStripeEntitlement: vi.fn(),
  getGoogleSubByStripeCustomerId: vi.fn(),
  setAnonymousStripeEntitlement: vi.fn(),
  getAnonymousStripeEntitlement: vi.fn(),
  isAnonymousStripeReverseIndex: vi.fn(),
  extractStripeCustomerIdFromReverseIndex: vi.fn(),
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  log: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import { stripe } from '@/lib/stripe/api';
import * as kvStore from '@/lib/kv/entitlement-store';

describe('Webhook Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  const createMockRequest = (body: string, signature: string): NextRequest => {
    return {
      text: async () => body,
      headers: {
        get: (name: string) => name === 'stripe-signature' ? signature : null,
      },
    } as unknown as NextRequest;
  };

  describe('checkout.session.completed', () => {
    it('should create entitlement under Google sub when googleSub metadata is present', async () => {
      const mockGoogleSub = 'google_sub_12345';
      const mockCustomerId = 'cus_test123';
      const mockSubscriptionId = 'sub_test123';

      const mockEvent: Stripe.Event = {
        id: 'evt_test123',
        object: 'event',
        api_version: '2023-10-16',
        created: 1609459200,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test123',
            object: 'checkout.session',
            customer: mockCustomerId,
            subscription: mockSubscriptionId,
            metadata: { googleSub: mockGoogleSub },
          } as any,
          previous_attributes: null as any,
        },
      };

      const mockSubscription: Partial<Stripe.Subscription> = {
        id: mockSubscriptionId,
        status: 'active',
        cancel_at_period_end: false,
        cancel_at: null,
        items: {
          object: 'list',
          data: [{
            id: 'si_test',
            object: 'subscription_item',
            current_period_end: 1612137600,
            current_period_start: 1609459200,
          } as any],
          has_more: false,
          url: '/v1/subscription_items',
        },
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent);
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(mockSubscription as any);

      const request = createMockRequest(JSON.stringify(mockEvent), 'valid_signature');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('processed');
      expect(data.eventType).toBe('checkout.session.completed');
      expect(data.tier).toBe('karl');
      expect(data.active).toBe(true);
      expect(data.anonymous).toBe(false);

      expect(kvStore.setStripeEntitlement).toHaveBeenCalledWith(
        mockGoogleSub,
        expect.objectContaining({
          tier: 'karl',
          active: true,
          stripeCustomerId: mockCustomerId,
          stripeSubscriptionId: mockSubscriptionId,
        })
      );
    });

    it('should create anonymous entitlement when googleSub metadata is absent', async () => {
      const mockCustomerId = 'cus_test456';
      const mockSubscriptionId = 'sub_test456';

      const mockEvent: Stripe.Event = {
        id: 'evt_test456',
        object: 'event',
        api_version: '2023-10-16',
        created: 1609459200,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test456',
            object: 'checkout.session',
            customer: mockCustomerId,
            subscription: mockSubscriptionId,
            metadata: {}, // No googleSub
          } as any,
          previous_attributes: null as any,
        },
      };

      const mockSubscription: Partial<Stripe.Subscription> = {
        id: mockSubscriptionId,
        status: 'active',
        cancel_at_period_end: false,
        cancel_at: null,
        items: {
          object: 'list',
          data: [{
            id: 'si_test',
            object: 'subscription_item',
            current_period_end: 1612137600,
            current_period_start: 1609459200,
          } as any],
          has_more: false,
          url: '/v1/subscription_items',
        },
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent);
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(mockSubscription as any);

      const request = createMockRequest(JSON.stringify(mockEvent), 'valid_signature');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('processed');
      expect(data.anonymous).toBe(true);

      expect(kvStore.setAnonymousStripeEntitlement).toHaveBeenCalledWith(
        mockCustomerId,
        expect.objectContaining({
          tier: 'karl',
          active: true,
          stripeCustomerId: mockCustomerId,
        })
      );
    });
  });

  describe('customer.subscription.updated', () => {
    it('should store cancelAtPeriodEnd: true when cancel_at is set', async () => {
      const mockCustomerId = 'cus_test789';
      const mockSubscriptionId = 'sub_test789';
      const mockGoogleSub = 'google_sub_789';
      const cancelAtTimestamp = 1612137600;

      const mockEvent: Stripe.Event = {
        id: 'evt_test789',
        object: 'event',
        api_version: '2023-10-16',
        created: 1609459200,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: mockSubscriptionId,
            customer: mockCustomerId,
            status: 'active',
            cancel_at_period_end: false,
            cancel_at: cancelAtTimestamp,
            items: {
              object: 'list',
              data: [{
                id: 'si_test',
                object: 'subscription_item',
                current_period_end: 1612137600,
                current_period_start: 1609459200,
              } as any],
              has_more: false,
              url: '/v1/subscription_items',
            },
          } as any,
          previous_attributes: null as any,
        },
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent);
      vi.mocked(kvStore.getGoogleSubByStripeCustomerId).mockResolvedValue(mockGoogleSub);
      vi.mocked(kvStore.isAnonymousStripeReverseIndex).mockReturnValue(false);
      vi.mocked(kvStore.getStripeEntitlement).mockResolvedValue(null);

      const request = createMockRequest(JSON.stringify(mockEvent), 'valid_signature');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('processed');

      expect(kvStore.setStripeEntitlement).toHaveBeenCalledWith(
        mockGoogleSub,
        expect.objectContaining({
          cancelAtPeriodEnd: true,
          currentPeriodEnd: new Date(cancelAtTimestamp * 1000).toISOString(),
        })
      );
    });

    it('should set tier: karl and active: true for status active', async () => {
      const mockCustomerId = 'cus_active';
      const mockSubscriptionId = 'sub_active';
      const mockGoogleSub = 'google_sub_active';

      const mockEvent: Stripe.Event = {
        id: 'evt_active',
        object: 'event',
        api_version: '2023-10-16',
        created: 1609459200,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: mockSubscriptionId,
            customer: mockCustomerId,
            status: 'active',
            cancel_at_period_end: false,
            cancel_at: null,
            items: {
              object: 'list',
              data: [{
                id: 'si_test',
                object: 'subscription_item',
                current_period_end: 1612137600,
                current_period_start: 1609459200,
              } as any],
              has_more: false,
              url: '/v1/subscription_items',
            },
          } as any,
          previous_attributes: null as any,
        },
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent);
      vi.mocked(kvStore.getGoogleSubByStripeCustomerId).mockResolvedValue(mockGoogleSub);
      vi.mocked(kvStore.isAnonymousStripeReverseIndex).mockReturnValue(false);
      vi.mocked(kvStore.getStripeEntitlement).mockResolvedValue(null);

      const request = createMockRequest(JSON.stringify(mockEvent), 'valid_signature');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tier).toBe('karl');
      expect(data.active).toBe(true);

      expect(kvStore.setStripeEntitlement).toHaveBeenCalledWith(
        mockGoogleSub,
        expect.objectContaining({
          tier: 'karl',
          active: true,
        })
      );
    });
  });

  describe('customer.subscription.deleted', () => {
    it('should store tier: thrall and active: false', async () => {
      const mockCustomerId = 'cus_deleted';
      const mockSubscriptionId = 'sub_deleted';
      const mockGoogleSub = 'google_sub_deleted';

      const mockEvent: Stripe.Event = {
        id: 'evt_deleted',
        object: 'event',
        api_version: '2023-10-16',
        created: 1609459200,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: mockSubscriptionId,
            customer: mockCustomerId,
            status: 'canceled',
            cancel_at_period_end: false,
            cancel_at: null,
            items: {
              object: 'list',
              data: [{
                id: 'si_test',
                object: 'subscription_item',
                current_period_end: 1612137600,
                current_period_start: 1609459200,
              } as any],
              has_more: false,
              url: '/v1/subscription_items',
            },
          } as any,
          previous_attributes: null as any,
        },
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent);
      vi.mocked(kvStore.getGoogleSubByStripeCustomerId).mockResolvedValue(mockGoogleSub);
      vi.mocked(kvStore.isAnonymousStripeReverseIndex).mockReturnValue(false);
      vi.mocked(kvStore.getStripeEntitlement).mockResolvedValue(null);

      const request = createMockRequest(JSON.stringify(mockEvent), 'valid_signature');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tier).toBe('thrall');
      expect(data.active).toBe(false);

      expect(kvStore.setStripeEntitlement).toHaveBeenCalledWith(
        mockGoogleSub,
        expect.objectContaining({
          tier: 'thrall',
          active: false,
        })
      );
    });
  });

  describe('Unknown event type', () => {
    it('should return status: ignored for unknown event type', async () => {
      const mockEvent: Stripe.Event = {
        id: 'evt_unknown',
        object: 'event',
        api_version: '2023-10-16',
        created: 1609459200,
        livemode: false,
        pending_webhooks: 0,
        request: null,
        type: 'payment_intent.succeeded', // Not handled
        data: {
          object: {} as any,
          previous_attributes: null as any,
        },
      };

      vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(mockEvent);

      const request = createMockRequest(JSON.stringify(mockEvent), 'valid_signature');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ignored');
      expect(data.eventType).toBe('payment_intent.succeeded');
    });
  });
});