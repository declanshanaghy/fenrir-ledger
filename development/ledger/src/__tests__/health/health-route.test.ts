/**
 * Unit tests for /api/health — Fenrir Ledger
 *
 * Tests the Kubernetes health check endpoint used for liveness,
 * readiness, and startup probes in the GKE Autopilot deployment.
 *
 * This endpoint is intentionally unauthenticated — K8s probes
 * do not carry application credentials.
 *
 * @see src/app/api/health/route.ts
 * @ref #680
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "@/app/api/health/route";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/api/health", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 200 status", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it("returns JSON with status 'ok'", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  it("includes a valid ISO timestamp", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.timestamp).toBeDefined();
    // Verify it's a valid ISO 8601 date
    const parsed = new Date(body.timestamp);
    expect(parsed.toISOString()).toBe(body.timestamp);
  });

  it("includes version from env var", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "2.0.0-test");
    const response = await GET();
    const body = await response.json();
    expect(body.version).toBe("2.0.0-test");
  });

  it("returns 'unknown' when version env var is not set", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "");
    // Clear the env var entirely
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    const response = await GET();
    const body = await response.json();
    expect(body.version).toBe("unknown");
  });

  it("includes buildId from env var", async () => {
    vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "abc123sha");
    const response = await GET();
    const body = await response.json();
    expect(body.buildId).toBe("abc123sha");
  });

  it("returns 'unknown' when buildId env var is not set", async () => {
    delete process.env.NEXT_PUBLIC_BUILD_ID;
    const response = await GET();
    const body = await response.json();
    expect(body.buildId).toBe("unknown");
  });

  it("response has correct content-type header", async () => {
    const response = await GET();
    expect(response.headers.get("content-type")).toContain("application/json");
  });
});
