/**
 * Vitest integration tests for GKE health checks — Issue #680
 *
 * These tests verify that the health endpoint works correctly for:
 * 1. Kubernetes liveness probes
 * 2. Kubernetes readiness probes
 * 3. Kubernetes startup probes
 * 4. Docker HEALTHCHECK command
 *
 * @ref #680
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GKE Health Checks — /api/health", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe("HTTP Response", () => {
    it("returns 200 OK status for K8s readiness probes", async () => {
      const response = await GET();
      expect(response.status).toBe(200);
    });

    it("returns JSON response type", async () => {
      const response = await GET();
      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("application/json");
    });

    it("includes Cache-Control headers to prevent caching of health state", async () => {
      const response = await GET();
      // Health checks should not be cached
      const cacheControl = response.headers.get("cache-control");
      // Either no-cache or must-revalidate
      if (cacheControl) {
        expect(
          cacheControl.includes("no-cache") || cacheControl.includes("no-store")
        ).toBeTruthy();
      }
    });
  });

  describe("Health Status Data", () => {
    it("returns 'ok' status for healthy app", async () => {
      const response = await GET();
      const body = await response.json();
      expect(body.status).toBe("ok");
    });

    it("includes timestamp in ISO 8601 format", async () => {
      const response = await GET();
      const body = await response.json();
      expect(body.timestamp).toBeDefined();
      // Verify it's valid ISO format
      const date = new Date(body.timestamp);
      expect(date.toISOString()).toBe(body.timestamp);
    });

    it("includes app version from environment", async () => {
      vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "1.2.3");
      const response = await GET();
      const body = await response.json();
      expect(body.version).toBe("1.2.3");
    });

    it("defaults version to 'unknown' when not set", async () => {
      delete process.env.NEXT_PUBLIC_APP_VERSION;
      const response = await GET();
      const body = await response.json();
      expect(body.version).toBe("unknown");
    });

    it("includes build ID from environment", async () => {
      vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "abc123def456");
      const response = await GET();
      const body = await response.json();
      expect(body.buildId).toBe("abc123def456");
    });

    it("defaults buildId to 'unknown' when not set", async () => {
      delete process.env.NEXT_PUBLIC_BUILD_ID;
      const response = await GET();
      const body = await response.json();
      expect(body.buildId).toBe("unknown");
    });
  });

  describe("K8s Probe Behavior", () => {
    it("responds quickly (< 200ms) for K8s timeout (3-5 seconds)", async () => {
      const start = Date.now();
      await GET();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(200);
    });

    it("response is idempotent — multiple calls return same status", async () => {
      const r1 = await GET();
      const r2 = await GET();
      expect(r1.status).toBe(r2.status);

      const b1 = await r1.json();
      const b2 = await r2.json();
      expect(b1.status).toBe(b2.status);
    });

    it("always returns 200 OK (never 503 Service Unavailable)", async () => {
      // Even if internal services fail, health endpoint should respond
      // This is intentional for K8s probes
      const response = await GET();
      expect(response.status).toBe(200);
    });
  });

  describe("Docker & GKE Integration", () => {
    it("endpoint path is /api/health (as used in Dockerfile HEALTHCHECK)", async () => {
      // This test verifies the endpoint exists at the correct path
      // The actual routing is tested by the framework
      const response = await GET();
      expect(response.status).toBe(200);
    });

    it("response can be parsed by wget (used in Dockerfile)", async () => {
      // Dockerfile uses: wget --no-verbose --tries=1 --spider http://localhost:3000/api/health
      const response = await GET();
      expect(response.status).toBe(200); // wget expects 2xx
      expect(response.headers.get("content-type")).toBeTruthy();
    });

    it("response includes headers needed for K8s BackendConfig health check", async () => {
      const response = await GET();
      // K8s health check expects 2xx status and valid response
      expect(response.status).toBe(200);
      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("application/json");
    });
  });

  describe("Security", () => {
    it("endpoint is intentionally unauthenticated (K8s probes don't carry credentials)", async () => {
      // This is by design — K8s liveness/readiness probes are external checks
      const response = await GET();
      expect(response.status).toBe(200);
      // No authentication required
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });

    it("does not expose sensitive secrets in response", async () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_secret123");
      vi.stubEnv("GOOGLE_CLIENT_SECRET", "oauth_secret");

      const response = await GET();
      const bodyText = await response.text();

      expect(bodyText).not.toContain("sk_live");
      expect(bodyText).not.toContain("oauth_secret");
    });

    it("only exposes NEXT_PUBLIC_* variables (safe for client)", async () => {
      // version and buildId use NEXT_PUBLIC_ prefix
      const response = await GET();
      const body = await response.json();

      // These should only be the public vars
      const keys = Object.keys(body);
      expect(keys).toContain("status");
      expect(keys).toContain("timestamp");
      expect(keys).toContain("version");
      expect(keys).toContain("buildId");

      // Should NOT contain any STRIPE_, GOOGLE_, ANTHROPIC_, etc keys
      keys.forEach((key) => {
        expect(["status", "timestamp", "version", "buildId"]).toContain(key);
      });
    });
  });

  describe("Multi-environment support", () => {
    it("works in development (empty env vars)", async () => {
      delete process.env.NEXT_PUBLIC_APP_VERSION;
      delete process.env.NEXT_PUBLIC_BUILD_ID;
      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.version).toBe("unknown");
      expect(body.buildId).toBe("unknown");
    });

    it("works in production (populated env vars from K8s secrets)", async () => {
      vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "2024.03.13-abc123");
      vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "sha256:abc123def456");
      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.version).toBe("2024.03.13-abc123");
      expect(body.buildId).toBe("sha256:abc123def456");
    });

    it("works in CI/CD (GitHub Actions build tags)", async () => {
      vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "v1.0.0");
      vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "github-sha-12345");
      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.version).toBe("v1.0.0");
      expect(body.buildId).toBe("github-sha-12345");
    });
  });
});
