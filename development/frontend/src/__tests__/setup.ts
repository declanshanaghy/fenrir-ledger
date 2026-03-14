// Test setup file for Vitest
// Mock environment variables that are required for the tests
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';
process.env.STRIPE_PRICE_ID = 'price_test_mock';
process.env.APP_BASE_URL = 'https://fenrir-ledger.example.com';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock console.log and console.error to reduce test noise
global.console = {
  ...console,
  log: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

// Clean up DOM after each test (for component render tests)
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});