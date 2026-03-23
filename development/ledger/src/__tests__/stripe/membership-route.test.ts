/**
 * Tests for the membership route handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/stripe/membership/route';
import { NextRequest } from 'next/server';

// Mock dependencies
const mockRequireAuthz = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/authz', () => ({
  requireAuthz: mockRequireAuthz,
}));

vi.mock('@/lib/kv/entitlement-store', () => ({
  getStripeEntitlement: vi.fn(),
  setStripeEntitlement: vi.fn(),
}));

vi.mock('@/lib/stripe/api', () => ({
  stripe: {
    subscriptions: {
      retrieve: vi.fn(),
    },
    checkout: {
      sessions: {
        retrieve: vi.fn(),
      },
    },
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue({ success: true }),
}));

vi.mock('@/lib/logger', () => ({
  log: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import * as kvStore from '@/lib/kv/entitlement-store';
import { stripe } from '@/lib/stripe/api';

describe('GET /api/stripe/membership', () => {
  const mockGoogleSub = 'google_sub_12345';

  const createMockRequest = (searchParams: Record<string, string> = {}): NextRequest => {
    const url = new URL('http://localhost:3000/api/stripe/membership');
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return {
      headers: {
        get: (name: string) => name === 'x-forwarded-for' ? '127.0.0.1' : null,
      },
      nextUrl: url,
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    mockRequireAuthz.mockResolvedValue({
      ok: true,
      user: { sub: mockGoogleSub, email: 'test@example.com', name: 'Test User', picture: 'https://example.com/picture.jpg' },
      firestoreUser: { userId: mockGoogleSub, email: 'test@example.com', displayName: 'Test User', householdId: 'hh-test', role: 'owner' as const, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
    });
  });

  describe('Backfill cancellation data', () => {
    it('should return cancelAtPeriodEnd: true for subscription with cancel_at set', async () => {
      const mockCustomerId = 'cus_backfill1';
      const mockSubscriptionId = 'sub_backfill1';
      const cancelAtTimestamp = 1612137600;

      // Initial cached entitlement without period end info
      vi.mocked(kvStore.getStripeEntitlement).mockResolvedValue({
        tier: 'karl',
        active: true,
        stripeCustomerId: mockCustomerId,
        stripeSubscriptionId: mockSubscriptionId,
        stripeStatus: 'active',
        linkedAt: '2024-01-01T00:00:00Z',
        checkedAt: '2024-01-01T00:00:00Z',
      });

      // Stripe API returns subscription with cancel_at
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        id: mockSubscriptionId,
        status: 'active',
        cancel_at_period_end: false,
        cancel_at: cancelAtTimestamp,
        items: {
          object: 'list',
          data: [{
            current_period_end: 1612137600,
          }],
          has_more: false,
          url: '/v1/subscription_items',
        },
      } as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cancelAtPeriodEnd).toBe(true);
      expect(data.currentPeriodEnd).toBe(new Date(cancelAtTimestamp * 1000).toISOString());
      expect(data.tier).toBe('karl');
      expect(data.active).toBe(true);

      // Verify the KV store was updated with backfilled data
      expect(kvStore.setStripeEntitlement).toHaveBeenCalledWith(
        mockGoogleSub,
        expect.objectContaining({
          cancelAtPeriodEnd: true,
          currentPeriodEnd: new Date(cancelAtTimestamp * 1000).toISOString(),
        })
      );
    });

    it('should return cancelAtPeriodEnd: true for subscription with cancel_at_period_end set', async () => {
      const mockCustomerId = 'cus_backfill2';
      const mockSubscriptionId = 'sub_backfill2';
      const periodEndTimestamp = 1612137600;

      // Initial cached entitlement without period end info
      vi.mocked(kvStore.getStripeEntitlement).mockResolvedValue({
        tier: 'karl',
        active: true,
        stripeCustomerId: mockCustomerId,
        stripeSubscriptionId: mockSubscriptionId,
        stripeStatus: 'active',
        linkedAt: '2024-01-01T00:00:00Z',
        checkedAt: '2024-01-01T00:00:00Z',
      });

      // Stripe API returns subscription with cancel_at_period_end
      vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
        id: mockSubscriptionId,
        status: 'active',
        cancel_at_period_end: true,
        cancel_at: null,
        items: {
          object: 'list',
          data: [{
            current_period_end: periodEndTimestamp,
          }],
          has_more: false,
          url: '/v1/subscription_items',
        },
      } as any);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cancelAtPeriodEnd).toBe(true);
      expect(data.currentPeriodEnd).toBe(new Date(periodEndTimestamp * 1000).toISOString());
    });
  });

  describe('No entitlement', () => {
    it('should return tier: thrall and active: false when no entitlement exists', async () => {
      vi.mocked(kvStore.getStripeEntitlement).mockResolvedValue(null);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tier).toBe('thrall');
      expect(data.active).toBe(false);
      expect(data.platform).toBe('stripe');
    });
  });

  describe('Existing entitlement', () => {
    it('should return cached entitlement data when available', async () => {
      const mockEntitlement = {
        tier: 'karl' as const,
        active: true,
        stripeCustomerId: 'cus_existing',
        stripeSubscriptionId: 'sub_existing',
        stripeStatus: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        linkedAt: '2024-01-01T00:00:00Z',
        checkedAt: '2024-01-15T00:00:00Z',
      };

      vi.mocked(kvStore.getStripeEntitlement).mockResolvedValue(mockEntitlement);

      // No backfill should occur since all fields are present
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tier).toBe('karl');
      expect(data.active).toBe(true);
      expect(data.customerId).toBe('cus_existing');
      expect(data.linkedAt).toBe('2024-01-01T00:00:00Z');
      expect(data.cancelAtPeriodEnd).toBe(false);
      expect(data.currentPeriodEnd).toBe('2024-02-01T00:00:00Z');

      // Verify backfill was not called since fields are already present
      expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    });
  });

  describe('Authentication', () => {
    it('should return 401 when authentication fails', async () => {
      const mockResponse = new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }) as any;

      mockRequireAuthz.mockResolvedValueOnce({
        ok: false,
        response: mockResponse,
      });

      const request = createMockRequest();
      const response = await GET(request);

      expect(response).toBe(mockResponse);
    });
  });
});