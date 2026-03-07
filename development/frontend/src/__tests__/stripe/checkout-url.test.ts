/**
 * Unit tests for Stripe checkout URL construction
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
    // This is the logic from checkout/route.ts lines 73-78
    return process.env.APP_BASE_URL
      ?? (process.env.VERCEL_URL
        ? (process.env.VERCEL_ENV === "development"
          ? `http://${process.env.VERCEL_URL}`
          : `https://${process.env.VERCEL_URL}`)
        : "http://localhost:9653");
  };

  it('should use http:// for VERCEL_ENV=development', () => {
    delete process.env.APP_BASE_URL;
    process.env.VERCEL_URL = 'test-app.vercel.app';
    process.env.VERCEL_ENV = 'development';

    const baseUrl = getBaseUrl();

    expect(baseUrl).toBe('http://test-app.vercel.app');
  });

  it('should use https:// for VERCEL_ENV=production', () => {
    delete process.env.APP_BASE_URL;
    process.env.VERCEL_URL = 'test-app.vercel.app';
    process.env.VERCEL_ENV = 'production';

    const baseUrl = getBaseUrl();

    expect(baseUrl).toBe('https://test-app.vercel.app');
  });

  it('should use https:// for VERCEL_ENV=preview', () => {
    delete process.env.APP_BASE_URL;
    process.env.VERCEL_URL = 'test-app-preview.vercel.app';
    process.env.VERCEL_ENV = 'preview';

    const baseUrl = getBaseUrl();

    expect(baseUrl).toBe('https://test-app-preview.vercel.app');
  });

  it('should fall back to http://localhost:9653 when no VERCEL_URL is set', () => {
    delete process.env.APP_BASE_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_ENV;

    const baseUrl = getBaseUrl();

    expect(baseUrl).toBe('http://localhost:9653');
  });

  it('should use APP_BASE_URL when provided', () => {
    process.env.APP_BASE_URL = 'https://custom-domain.com';
    process.env.VERCEL_URL = 'test-app.vercel.app';
    process.env.VERCEL_ENV = 'development';

    const baseUrl = getBaseUrl();

    expect(baseUrl).toBe('https://custom-domain.com');
  });

  it('should use https:// when VERCEL_ENV is undefined but VERCEL_URL exists', () => {
    delete process.env.APP_BASE_URL;
    process.env.VERCEL_URL = 'test-app.vercel.app';
    delete process.env.VERCEL_ENV;

    const baseUrl = getBaseUrl();

    expect(baseUrl).toBe('https://test-app.vercel.app');
  });

  it('should construct correct success URL with session_id placeholder', () => {
    process.env.APP_BASE_URL = 'https://example.com';

    const baseUrl = getBaseUrl();
    const successUrl = `${baseUrl}/settings?stripe=success&session_id={CHECKOUT_SESSION_ID}`;

    expect(successUrl).toBe('https://example.com/settings?stripe=success&session_id={CHECKOUT_SESSION_ID}');
  });

  it('should construct correct cancel URL', () => {
    process.env.APP_BASE_URL = 'https://example.com';

    const baseUrl = getBaseUrl();
    const cancelUrl = `${baseUrl}/settings?stripe=cancel`;

    expect(cancelUrl).toBe('https://example.com/settings?stripe=cancel');
  });
});