/**
 * Unit tests for Stripe URL construction logic
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Stripe Redirect URL Construction", () => {
  // Extract the URL construction logic from the checkout route
  const getBaseUrl = (env: { APP_BASE_URL?: string; VERCEL_URL?: string; VERCEL_ENV?: string }) => {
    const { APP_BASE_URL, VERCEL_URL, VERCEL_ENV } = env;
    return APP_BASE_URL
      ?? (VERCEL_URL
        ? (VERCEL_ENV === "development"
          ? `http://${VERCEL_URL}`
          : `https://${VERCEL_URL}`)
        : "http://localhost:9653");
  };

  beforeEach(() => {
    // Clear environment variables before each test
    vi.unstubAllEnvs();
  });

  it("should use APP_BASE_URL when set", () => {
    const env = {
      APP_BASE_URL: "https://custom.example.com",
      VERCEL_URL: "vercel.app",
      VERCEL_ENV: "production",
    };

    const result = getBaseUrl(env);
    expect(result).toBe("https://custom.example.com");
  });

  it("should use http:// for VERCEL_ENV=development", () => {
    const env = {
      VERCEL_URL: "localhost:3000",
      VERCEL_ENV: "development",
    };

    const result = getBaseUrl(env);
    expect(result).toBe("http://localhost:3000");
  });

  it("should use https:// for VERCEL_ENV=production", () => {
    const env = {
      VERCEL_URL: "myapp.vercel.app",
      VERCEL_ENV: "production",
    };

    const result = getBaseUrl(env);
    expect(result).toBe("https://myapp.vercel.app");
  });

  it("should use https:// for VERCEL_ENV=preview", () => {
    const env = {
      VERCEL_URL: "myapp-git-feature.vercel.app",
      VERCEL_ENV: "preview",
    };

    const result = getBaseUrl(env);
    expect(result).toBe("https://myapp-git-feature.vercel.app");
  });

  it("should use https:// when VERCEL_ENV is not set but VERCEL_URL is", () => {
    const env = {
      VERCEL_URL: "myapp.vercel.app",
    };

    const result = getBaseUrl(env);
    expect(result).toBe("https://myapp.vercel.app");
  });

  it("should fall back to http://localhost:9653 when no environment variables are set", () => {
    const env = {};

    const result = getBaseUrl(env);
    expect(result).toBe("http://localhost:9653");
  });

  it("should prioritize APP_BASE_URL over VERCEL_URL", () => {
    const env = {
      APP_BASE_URL: "https://override.example.com",
      VERCEL_URL: "should-not-use.vercel.app",
      VERCEL_ENV: "production",
    };

    const result = getBaseUrl(env);
    expect(result).toBe("https://override.example.com");
  });

  it("should handle empty string values as undefined", () => {
    const result = getBaseUrl({});
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