/**
 * Loki QA — verifyWebhookSignature direct unit tests (issue #1778)
 *
 * These tests target verifyWebhookSignature *without* mocking it, covering:
 *   - Returns null when STRIPE_WEBHOOK_SECRET is absent
 *   - Returns null when STRIPE_WEBHOOK_SECRET is empty string
 *   - Returns null when stripe.webhooks.constructEvent throws
 *   - Returns the Stripe event when verification succeeds
 *   - Passes the raw body (not parsed JSON) to constructEvent
 *
 * The main webhook route tests mock verifyWebhookSignature — this file
 * fills that gap by exercising the function's own error handling logic.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import type Stripe from "stripe";

// ── Mock Stripe SDK so we can control constructEvent ─────────────────────────

const mockConstructEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe/api", () => ({
  stripe: {
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: vi.fn() },
  },
}));

// ── Mock logger ───────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { verifyWebhookSignature } from "@/lib/stripe/webhook";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMinimalEvent(type: string, id = "evt_test_sig"): Stripe.Event {
  return {
    id,
    type,
    data: { object: {} },
    object: "event",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

// ── Tests: verifyWebhookSignature ─────────────────────────────────────────────

describe("verifyWebhookSignature (issue #1778)", () => {
  const ENV_KEY = "STRIPE_WEBHOOK_SECRET";

  afterEach(() => {
    delete process.env[ENV_KEY];
    vi.clearAllMocks();
  });

  it("returns null when STRIPE_WEBHOOK_SECRET is not set", () => {
    delete process.env[ENV_KEY];

    const result = verifyWebhookSignature("raw-body", "t=123,v1=abc");

    expect(result).toBeNull();
    // constructEvent must NOT be called if secret is missing — avoids unsafe calls
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("returns null when STRIPE_WEBHOOK_SECRET is an empty string", () => {
    process.env[ENV_KEY] = "";

    const result = verifyWebhookSignature("raw-body", "t=123,v1=abc");

    expect(result).toBeNull();
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("returns null when constructEvent throws (invalid signature)", () => {
    process.env[ENV_KEY] = "whsec_test_secret";
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("No signatures found matching the expected signature for payload.");
    });

    const result = verifyWebhookSignature("raw-body", "t=123,v1=bad_sig");

    expect(result).toBeNull();
    expect(mockConstructEvent).toHaveBeenCalledWith(
      "raw-body",
      "t=123,v1=bad_sig",
      "whsec_test_secret",
    );
  });

  it("returns the Stripe event when signature is valid", () => {
    process.env[ENV_KEY] = "whsec_test_secret";
    const event = makeMinimalEvent("checkout.session.completed");
    mockConstructEvent.mockReturnValueOnce(event);

    const result = verifyWebhookSignature("raw-body", "t=123,v1=good_sig");

    expect(result).toBe(event);
    expect(mockConstructEvent).toHaveBeenCalledWith(
      "raw-body",
      "t=123,v1=good_sig",
      "whsec_test_secret",
    );
  });

  it("passes the exact raw body string (not parsed JSON) to constructEvent", () => {
    process.env[ENV_KEY] = "whsec_test_secret";
    const rawBody = '{"id":"evt_raw","type":"customer.subscription.updated"}';
    const event = makeMinimalEvent("customer.subscription.updated", "evt_raw");
    mockConstructEvent.mockReturnValueOnce(event);

    const result = verifyWebhookSignature(rawBody, "sig_test");

    expect(result).toBe(event);
    // The exact raw string must reach constructEvent — Stripe validates against it
    const [firstArg] = mockConstructEvent.mock.calls[0];
    expect(firstArg).toBe(rawBody);
  });
});
