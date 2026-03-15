/**
 * Unit tests for lib/kv/trial-store.ts
 *
 * Loki QA augmentation — covers gaps not tested by the route-level integration
 * tests: pure computeTrialStatus boundary logic and Redis key / TTL contract.
 *
 * Acceptance criteria targeted:
 *  - AC1 (#944): trial is created on first sign-in (keepalive fix + auto-init)
 *  - AC2 (#944): computeTrialStatus correctly transitions active → expired at the
 *    30-day boundary so the auto-init fallback in /api/trial/status returns the
 *    right state
 *  - AC3 (#944): convertedDate overrides expiry (Stripe-converted users stay "converted")
 *  - Redis key format and TTL are stable (regression guard against key drift)
 *
 * FiremanDecko already tests the route handlers end-to-end. These tests exercise
 * computeTrialStatus and initTrial as pure unit-level contracts.
 *
 * @see src/lib/kv/trial-store.ts
 * @ref Issue #944 (regression of #922)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock("@/lib/kv/redis-client", () => ({
  getRedisClient: () => mockRedis,
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import { computeTrialStatus, initTrial, getTrial } from "@/lib/kv/trial-store";
import { TRIAL_DURATION_DAYS } from "@/lib/trial-utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_FINGERPRINT = "b".repeat(64);

/** Returns an ISO date exactly N days ago (ms-precise). */
function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

// ── computeTrialStatus — pure logic, no I/O ────────────────────────────────────

describe("computeTrialStatus — boundary conditions (#944 AC2)", () => {
  it("returns status:none when trial is null (no record in Redis)", () => {
    const result = computeTrialStatus(null);
    expect(result.status).toBe("none");
    expect(result.remainingDays).toBe(0);
  });

  it(`returns active with 1 remaining day when exactly ${TRIAL_DURATION_DAYS - 1} days have elapsed`, () => {
    const startDate = daysAgo(TRIAL_DURATION_DAYS - 1); // day 29
    const result = computeTrialStatus({ startDate });
    expect(result.status).toBe("active");
    expect(result.remainingDays).toBe(1);
  });

  it(`returns expired with 0 days when exactly ${TRIAL_DURATION_DAYS} days have elapsed`, () => {
    const startDate = daysAgo(TRIAL_DURATION_DAYS); // day 30 — trial is over
    const result = computeTrialStatus({ startDate });
    expect(result.status).toBe("expired");
    expect(result.remainingDays).toBe(0);
  });

  it("returns converted (overriding expiry) when convertedDate is set (#944 AC3)", () => {
    // User converted on day 10, then trial would have expired — status must stay "converted"
    const startDate = daysAgo(TRIAL_DURATION_DAYS + 5); // well past expiry
    const convertedDate = daysAgo(TRIAL_DURATION_DAYS - 20);
    const result = computeTrialStatus({ startDate, convertedDate });
    expect(result.status).toBe("converted");
    expect(result.remainingDays).toBe(0);
    expect(result.convertedDate).toBe(convertedDate);
  });
});

// ── initTrial — Redis key and TTL contract ────────────────────────────────────

describe("initTrial — Redis key format and TTL (#944 AC1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes trial under key `trial:{fingerprint}` with TTL 5184000 s (60 days)", async () => {
    mockRedis.get.mockResolvedValueOnce(null); // no existing trial
    mockRedis.set.mockResolvedValueOnce("OK");

    await initTrial(VALID_FINGERPRINT);

    expect(mockRedis.set).toHaveBeenCalledOnce();
    const [key, , exFlag, ttl] = mockRedis.set.mock.calls[0] as [string, string, string, number];
    expect(key).toBe(`trial:${VALID_FINGERPRINT}`);
    expect(exFlag).toBe("EX");
    // 60 days × 24 h × 60 min × 60 s = 5 184 000 s
    expect(ttl).toBe(60 * 24 * 60 * 60);
  });
});

// ── getTrial — malformed Redis value ──────────────────────────────────────────

describe("getTrial — error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null (not throws) when Redis contains malformed JSON", async () => {
    mockRedis.get.mockResolvedValueOnce("not-valid-json{{{");

    // getTrial should catch the parse error and return null
    const result = await getTrial(VALID_FINGERPRINT);
    expect(result).toBeNull();
  });
});
