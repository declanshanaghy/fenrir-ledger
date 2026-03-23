/**
 * Unit tests for rateLimit() — Fenrir Ledger
 *
 * Tests the in-memory rate limiter used for serverless API protection.
 * The rate limiter uses a simple Map-based sliding window per key.
 *
 * No external dependencies to mock — the module uses an in-memory Map.
 *
 * @see src/lib/rate-limit.ts
 * @ref #570
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn() },
}));

// We need a fresh module for each test to reset the in-memory store.
// Use dynamic import + vi.resetModules to achieve this.

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("rateLimit", () => {
  let rateLimit: typeof import("@/lib/rate-limit").rateLimit;

  beforeEach(async () => {
    vi.resetModules();
    // Re-mock logger after resetModules
    vi.doMock("@/lib/logger", () => ({
      log: { debug: vi.fn(), error: vi.fn() },
    }));
    const mod = await import("@/lib/rate-limit");
    rateLimit = mod.rateLimit;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Happy path — under limit passes
  // ═══════════════════════════════════════════════════════════════════════

  it("allows first request and returns remaining = limit - 1", () => {
    const result = rateLimit("user:1", { limit: 5, windowMs: 60_000 });

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("allows multiple requests under the limit", () => {
    for (let i = 0; i < 4; i++) {
      const result = rateLimit("user:2", { limit: 5, windowMs: 60_000 });
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }
  });

  it("uses default limit of 10 and windowMs of 60000 when not specified", () => {
    const result = rateLimit("user:defaults");

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(9); // 10 - 1
  });

  // ═══════════════════════════════════════════════════════════════════════
  // At limit — blocked
  // ═══════════════════════════════════════════════════════════════════════

  it("allows request at exactly the limit count", () => {
    // With limit=3, requests 1, 2, 3 should succeed
    for (let i = 0; i < 3; i++) {
      const result = rateLimit("user:3", { limit: 3, windowMs: 60_000 });
      expect(result.success).toBe(true);
    }
  });

  it("blocks request exceeding the limit", () => {
    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
      rateLimit("user:4", { limit: 3, windowMs: 60_000 });
    }

    // 4th request should be blocked
    const result = rateLimit("user:4", { limit: 3, windowMs: 60_000 });
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("returns retryAfter (seconds) when rate limited", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    // Exhaust the limit
    for (let i = 0; i < 2; i++) {
      rateLimit("user:retry", { limit: 2, windowMs: 30_000 });
    }

    const result = rateLimit("user:retry", { limit: 2, windowMs: 30_000 });
    expect(result.success).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    expect(result.retryAfter).toBeLessThanOrEqual(30);
  });

  it("does not return retryAfter for successful requests", () => {
    const result = rateLimit("user:no-retry", { limit: 5, windowMs: 60_000 });
    expect(result.success).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it("returns remaining=0 for the last allowed request", () => {
    // With limit=2, the 2nd request should have remaining=0
    rateLimit("user:5", { limit: 2, windowMs: 60_000 });
    const result = rateLimit("user:5", { limit: 2, windowMs: 60_000 });

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Window reset
  // ═══════════════════════════════════════════════════════════════════════

  it("resets counter after window expires", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
      rateLimit("user:6", { limit: 3, windowMs: 1000 });
    }

    // Should be blocked
    let result = rateLimit("user:6", { limit: 3, windowMs: 1000 });
    expect(result.success).toBe(false);

    // Advance time past the window
    vi.spyOn(Date, "now").mockReturnValue(now + 1001);

    // Should be allowed again (new window)
    result = rateLimit("user:6", { limit: 3, windowMs: 1000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Key isolation
  // ═══════════════════════════════════════════════════════════════════════

  it("tracks different keys independently", () => {
    // Exhaust limit for key A
    for (let i = 0; i < 2; i++) {
      rateLimit("key-a", { limit: 2, windowMs: 60_000 });
    }

    // Key A should be blocked
    expect(rateLimit("key-a", { limit: 2, windowMs: 60_000 }).success).toBe(
      false
    );

    // Key B should still be allowed
    expect(rateLimit("key-b", { limit: 2, windowMs: 60_000 }).success).toBe(
      true
    );
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Edge: limit of 1
  // ═══════════════════════════════════════════════════════════════════════

  it("works correctly with limit of 1", () => {
    const first = rateLimit("user:one-shot", { limit: 1, windowMs: 60_000 });
    expect(first.success).toBe(true);
    expect(first.remaining).toBe(0);

    const second = rateLimit("user:one-shot", { limit: 1, windowMs: 60_000 });
    expect(second.success).toBe(false);
    expect(second.remaining).toBe(0);
  });
});
