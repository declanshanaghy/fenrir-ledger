/**
 * Unit tests for requireKarl() — Fenrir Ledger
 *
 * Tests the Karl-tier subscription guard that checks entitlements in
 * Vercel KV after authentication. Must be called after requireAuth().
 *
 * All external dependencies (getStripeEntitlement) are mocked via vi.mock.
 *
 * @see src/lib/auth/require-karl.ts
 * @ref #570
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { requireKarl } from "@/lib/auth/require-karl";
import type { VerifiedUser } from "@/lib/auth/verify-id-token";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn() },
}));

import { getStripeEntitlement } from "@/lib/kv/entitlement-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KARL_USER: VerifiedUser = {
  sub: "google-sub-karl",
  email: "karl@fenrir.dev",
  name: "Karl the Worthy",
  picture: "https://example.com/karl.jpg",
};

const THRALL_USER: VerifiedUser = {
  sub: "google-sub-thrall",
  email: "thrall@fenrir.dev",
  name: "Thrall the Free",
  picture: "https://example.com/thrall.jpg",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("requireKarl", () => {
  // ═══════════════════════════════════════════════════════════════════════
  // Happy path — Karl-entitled user passes
  // ═══════════════════════════════════════════════════════════════════════

  it("returns ok:true when user has active Karl entitlement", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue({
      tier: "karl",
      active: true,
      stripeCustomerId: "cus_karl123",
      stripeSubscriptionId: "sub_karl123",
      stripeStatus: "active",
      linkedAt: "2024-01-01T00:00:00Z",
      checkedAt: "2024-01-15T00:00:00Z",
    });

    const result = await requireKarl(KARL_USER);

    expect(result.ok).toBe(true);
    expect(getStripeEntitlement).toHaveBeenCalledWith("google-sub-karl");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Thrall user blocked (402)
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 402 when user has thrall tier entitlement", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue({
      tier: "thrall",
      active: true,
      stripeCustomerId: "cus_thrall123",
      stripeSubscriptionId: "sub_thrall123",
      stripeStatus: "active",
      linkedAt: "2024-01-01T00:00:00Z",
      checkedAt: "2024-01-15T00:00:00Z",
    });

    const result = await requireKarl(THRALL_USER);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(402);
      expect(body.error).toBe("subscription_required");
      expect(body.required_tier).toBe("karl");
      expect(body.current_tier).toBe("thrall");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Missing entitlement (no KV record)
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 402 when no entitlement exists in KV", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);

    const result = await requireKarl(THRALL_USER);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(402);
      expect(body.error).toBe("subscription_required");
      expect(body.current_tier).toBe("thrall"); // defaults to "thrall" when null
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Inactive Karl subscription
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 402 when Karl entitlement exists but is inactive", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue({
      tier: "karl",
      active: false,
      stripeCustomerId: "cus_karl_inactive",
      stripeSubscriptionId: "sub_karl_inactive",
      stripeStatus: "canceled",
      linkedAt: "2024-01-01T00:00:00Z",
      checkedAt: "2024-01-15T00:00:00Z",
    });

    const result = await requireKarl(KARL_USER);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(402);
      expect(body.error).toBe("subscription_required");
      expect(body.current_tier).toBe("karl");
      expect(body.message).toBe("Upgrade to Karl to access this feature.");
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════════════════════════════════

  it("uses the user.sub to look up entitlement", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);

    await requireKarl(KARL_USER);

    expect(getStripeEntitlement).toHaveBeenCalledWith(KARL_USER.sub);
  });

  it("returns 402 with message prompting upgrade", async () => {
    vi.mocked(getStripeEntitlement).mockResolvedValue(null);

    const result = await requireKarl(THRALL_USER);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body.message).toBe("Upgrade to Karl to access this feature.");
    }
  });
});
