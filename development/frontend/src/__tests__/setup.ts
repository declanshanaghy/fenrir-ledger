// Test setup file for Vitest
// Mock environment variables that are required for the tests
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';
process.env.STRIPE_PRICE_ID = 'price_test_mock';
process.env.APP_BASE_URL = 'https://fenrir-ledger.vercel.app';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.KV_REST_API_URL = 'https://test-kv-api.vercel.app';
process.env.KV_REST_API_TOKEN = 'test-kv-token';

// Mock console.log and console.error to reduce test noise
global.console = {
  ...console,
  log: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};