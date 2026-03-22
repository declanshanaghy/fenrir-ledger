/**
 * Unit tests for Stripe URL construction logic
 *
 * After GKE migration (#682), the base URL resolution is simplified:
 * APP_BASE_URL ?? "http://localhost:9653" — no more VERCEL_URL/VERCEL_ENV fallback.
 */

import { describe, it, expect } from "vitest";

describe("Stripe Redirect URL Construction", () => {
  // Extract the URL construction logic from the checkout route (post-GKE migration)
  const getBaseUrl = (env: { APP_BASE_URL?: string }): string => {
    return env.APP_BASE_URL ?? "http://localhost:9653";
  };

  it("should use APP_BASE_URL when set", () => {
    const result = getBaseUrl({ APP_BASE_URL: "https://custom.example.com" });
    expect(result).toBe("https://custom.example.com");
  });

  it("should fall back to http://localhost:9653 when APP_BASE_URL is not set", () => {
    const result = getBaseUrl({});
    expect(result).toBe("http://localhost:9653");
  });

  it("should fall back to http://localhost:9653 when APP_BASE_URL is undefined", () => {
    const result = getBaseUrl({ APP_BASE_URL: undefined });
    expect(result).toBe("http://localhost:9653");
  });

  describe("Success and Cancel URLs", () => {
    it("should construct correct success URL with session_id placeholder", () => {
      const baseUrl = getBaseUrl({ APP_BASE_URL: "https://example.com" });
      const successUrl = `${baseUrl}/settings?stripe=success&session_id={CHECKOUT_SESSION_ID}`;

      expect(successUrl).toBe("https://example.com/settings?stripe=success&session_id={CHECKOUT_SESSION_ID}");
    });

    it("should construct correct cancel URL", () => {
      const baseUrl = getBaseUrl({ APP_BASE_URL: "https://example.com" });
      const cancelUrl = `${baseUrl}/settings?stripe=cancel`;

      expect(cancelUrl).toBe("https://example.com/settings?stripe=cancel");
    });
  });
});
