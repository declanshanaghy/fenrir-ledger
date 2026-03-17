/**
 * Loki QA — audit log validation for issue #1199
 *
 * Tests requireAuthz DIRECTLY (not mocked) to verify that the audit trail
 * (log.warn) fires correctly on IDOR attempts at the sync routes.
 *
 * Validations:
 *   - log.warn fires on household_mismatch with reason, userId, both household IDs
 *   - log.warn includes the route path for forensic tracing
 *   - 403 response body does NOT leak household IDs (no information disclosure)
 *   - log.warn is NOT called for legitimate household matches (no false positives)
 *
 * Note: requireAuthz is NOT mocked here — the real implementation runs.
 *       Only its upstream dependencies (requireAuth, getUser, entitlement) are mocked.
 *
 * Issue #1199
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── Mocks: requireAuthz deps (requireAuth, getUser, entitlement) ────────────
// requireAuthz itself is NOT mocked — we need the real implementation.

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/firebase/firestore", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: vi.fn(),
}));

vi.mock("@/lib/kv/trial-store", () => ({
  getTrial: vi.fn(),
  initTrial: vi.fn(),
  computeTrialStatus: vi.fn(),
}));

vi.mock("@/lib/trial-utils", () => ({
  isValidFingerprint: vi.fn(() => false),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { requireAuthz } from "@/lib/auth/authz";
import { requireAuth } from "@/lib/auth/require-auth";
import { getUser } from "@/lib/firebase/firestore";
import { log } from "@/lib/logger";

// ── Fixtures ────────────────────────────────────────────────────────────────

const ATTACKER_SUB = "attacker-google-sub-1199";
const ATTACKER_HOUSEHOLD = "attacker-hh-1199";
const VICTIM_HOUSEHOLD = "victim-hh-1199";

function makeReq(url = "http://localhost/api/sync/pull"): NextRequest {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "authorization" ? "Bearer attacker-token" : null,
    },
    nextUrl: new URL(url),
  } as unknown as NextRequest;
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Simulate attacker authenticated as themselves — but belonging to their own household
  vi.mocked(requireAuth).mockResolvedValue({
    ok: true as const,
    user: {
      sub: ATTACKER_SUB,
      email: "attacker@example.com",
      name: "Attacker",
      picture: "",
    },
  });

  vi.mocked(getUser).mockResolvedValue({
    clerkUserId: ATTACKER_SUB,
    email: "attacker@example.com",
    displayName: "Attacker",
    householdId: ATTACKER_HOUSEHOLD, // attacker's real household
    role: "owner" as const,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG tests for issue #1199
// ═══════════════════════════════════════════════════════════════════════════════

describe("AUDIT LOG #1199 — requireAuthz emits log.warn on sync IDOR attempts", () => {
  it("logs household_mismatch when attacker targets a different household", async () => {
    await requireAuthz(makeReq(), { householdId: VICTIM_HOUSEHOLD, tier: "karl" });

    expect(log.warn).toHaveBeenCalledWith(
      "requireAuthz: access denied",
      expect.objectContaining({ reason: "household_mismatch" }),
    );
  });

  it("audit log includes googleSub (userId) for forensic attribution", async () => {
    await requireAuthz(makeReq(), { householdId: VICTIM_HOUSEHOLD });

    expect(log.warn).toHaveBeenCalledWith(
      "requireAuthz: access denied",
      expect.objectContaining({ googleSub: ATTACKER_SUB }),
    );
  });

  it("audit log includes suppliedHouseholdId (victim's household) for forensics", async () => {
    await requireAuthz(makeReq(), { householdId: VICTIM_HOUSEHOLD });

    expect(log.warn).toHaveBeenCalledWith(
      "requireAuthz: access denied",
      expect.objectContaining({ suppliedHouseholdId: VICTIM_HOUSEHOLD }),
    );
  });

  it("audit log includes actualHouseholdId (attacker's real household) for forensics", async () => {
    await requireAuthz(makeReq(), { householdId: VICTIM_HOUSEHOLD });

    expect(log.warn).toHaveBeenCalledWith(
      "requireAuthz: access denied",
      expect.objectContaining({ actualHouseholdId: ATTACKER_HOUSEHOLD }),
    );
  });

  it("audit log includes route path /api/sync/pull for tracing", async () => {
    await requireAuthz(makeReq("http://localhost/api/sync/pull"), { householdId: VICTIM_HOUSEHOLD });

    expect(log.warn).toHaveBeenCalledWith(
      "requireAuthz: access denied",
      expect.objectContaining({ route: "/api/sync/pull" }),
    );
  });

  it("audit log fires for sync/push route path too (SEV-002 coverage)", async () => {
    await requireAuthz(makeReq("http://localhost/api/sync/push"), { householdId: VICTIM_HOUSEHOLD });

    expect(log.warn).toHaveBeenCalledWith(
      "requireAuthz: access denied",
      expect.objectContaining({
        reason: "household_mismatch",
        googleSub: ATTACKER_SUB,
        route: "/api/sync/push",
      }),
    );
  });

  it("403 response body does NOT leak the victim's householdId (no info disclosure)", async () => {
    const result = await requireAuthz(makeReq(), { householdId: VICTIM_HOUSEHOLD });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json() as Record<string, unknown>;
      expect(body.error).toBe("forbidden");
      // Neither victim nor attacker household must appear in the error response
      expect(JSON.stringify(body)).not.toContain(VICTIM_HOUSEHOLD);
      expect(JSON.stringify(body)).not.toContain(ATTACKER_HOUSEHOLD);
      expect(body).not.toHaveProperty("actualHouseholdId");
      expect(body).not.toHaveProperty("suppliedHouseholdId");
    }
  });

  it("log.warn for household_mismatch is NOT called when households match (no false positives)", async () => {
    // Same household → check passes, no mismatch log
    await requireAuthz(makeReq(), { householdId: ATTACKER_HOUSEHOLD });

    expect(log.warn).not.toHaveBeenCalledWith(
      "requireAuthz: access denied",
      expect.objectContaining({ reason: "household_mismatch" }),
    );
  });
});
