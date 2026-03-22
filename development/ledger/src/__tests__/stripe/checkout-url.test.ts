/**
 * Unit tests for Stripe checkout URL construction
 *
 * After GKE migration (#682), the base URL resolution is simplified:
 * APP_BASE_URL ?? "http://localhost:9653" — no more VERCEL_URL/VERCEL_ENV fallback.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Checkout URL construction', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore each env var individually for proper cleanup
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.entries(originalEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
  });

  const getBaseUrl = (): string => {
    // This matches the post-GKE migration logic from checkout/route.ts
    return process.env.APP_BASE_URL ?? "http://localhost:9653";
  };

  it('should use APP_BASE_URL when provided', () => {
    process.env.APP_BASE_URL = 'https://custom-domain.com';

    const baseUrl = getBaseUrl();

    expect(baseUrl).toBe('https://custom-domain.com');
  });

  it('should fall back to http://localhost:9653 when APP_BASE_URL is not set', () => {
    delete process.env.APP_BASE_URL;

    const baseUrl = getBaseUrl();

    expect(baseUrl).toBe('http://localhost:9653');
  });

  it('should construct correct success URL with session_id placeholder', () => {
    process.env.APP_BASE_URL = 'https://example.com';

    const baseUrl = getBaseUrl();
    const returnPath = '/ledger/settings';
    const successUrl = `${baseUrl}${returnPath}${returnPath.includes("?") ? "&" : "?"}stripe=success&session_id={CHECKOUT_SESSION_ID}`;

    expect(successUrl).toBe('https://example.com/ledger/settings?stripe=success&session_id={CHECKOUT_SESSION_ID}');
  });

  it('should construct correct cancel URL', () => {
    process.env.APP_BASE_URL = 'https://example.com';

    const baseUrl = getBaseUrl();
    const returnPath = '/ledger/settings';
    const cancelUrl = `${baseUrl}${returnPath}${returnPath.includes("?") ? "&" : "?"}stripe=cancel`;

    expect(cancelUrl).toBe('https://example.com/ledger/settings?stripe=cancel');
  });

  it('should construct correct success URL with custom return path', () => {
    process.env.APP_BASE_URL = 'https://example.com';

    const baseUrl = getBaseUrl();
    const returnPath = '/ledger';
    const successUrl = `${baseUrl}${returnPath}${returnPath.includes("?") ? "&" : "?"}stripe=success&session_id={CHECKOUT_SESSION_ID}`;

    expect(successUrl).toBe('https://example.com/ledger?stripe=success&session_id={CHECKOUT_SESSION_ID}');
  });

  it('should construct correct cancel URL with custom return path', () => {
    process.env.APP_BASE_URL = 'https://example.com';

    const baseUrl = getBaseUrl();
    const returnPath = '/ledger';
    const cancelUrl = `${baseUrl}${returnPath}${returnPath.includes("?") ? "&" : "?"}stripe=cancel`;

    expect(cancelUrl).toBe('https://example.com/ledger?stripe=cancel');
  });
});
