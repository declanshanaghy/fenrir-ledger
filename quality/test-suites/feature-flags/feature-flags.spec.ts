/**
 * Feature Flags — Playwright Test Suite
 *
 * Story 1: Feature Flag Registry + Route Guards (PR #113)
 * Story 2: Client-Side Feature Flag Guards (PR #114)
 *
 * Tests verify that in default "patreon" mode:
 *   - All 7 Patreon API routes respond (not flag-disabled 404)
 *   - Client-side components render correctly (PatreonSettings, PatreonGate, etc.)
 *
 * What CANNOT be tested via Playwright (build-time flags):
 *   - Stripe mode (SUBSCRIPTION_PLATFORM=stripe) requires server restart.
 *   - Manual test steps are documented at the bottom of this file.
 */

import { test, expect, type Page, type APIResponse } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const BASE_URL = process.env.SERVER_URL ?? "http://localhost:9653";

/**
 * Assert that a response is NOT a feature-flag 404.
 */
async function assertNotFlagDisabled(response: APIResponse): Promise<void> {
  if (response.status() === 404) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    expect(
      body,
      "Route returned 404 with feature-flag-disabled body. " +
        "SUBSCRIPTION_PLATFORM may be set to 'stripe' — check .env.local.",
    ).not.toMatchObject({ error: "Patreon integration is disabled" });
  }
}

/**
 * Clear all entitlement and Patreon state from localStorage.
 */
async function clearPatreonState(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(() => {
    localStorage.removeItem("fenrir:entitlement");
    localStorage.removeItem("fenrir:patreon-user-id");
    localStorage.removeItem("fenrir:upsell-dismissed");
    sessionStorage.clear();
  });
}

// ===========================================================================
// Story 1: API Route Guards (default patreon mode)
// ===========================================================================

test.describe("API Route Guards — default patreon mode", () => {
  test(
    "TC-FF-001: GET /api/patreon/authorize responds in default Patreon mode",
    async ({ request }) => {
      const response = await request.get("/api/patreon/authorize", {
        maxRedirects: 0,
      });
      await assertNotFlagDisabled(response);
      expect([200, 302, 307, 429, 500]).toContain(response.status());
    },
  );

  test(
    "TC-FF-002: GET /api/patreon/callback responds in default Patreon mode",
    async ({ request }) => {
      const response = await request.get("/api/patreon/callback", {
        maxRedirects: 0,
      });
      await assertNotFlagDisabled(response);
      expect([302, 307, 429, 500]).toContain(response.status());
    },
  );

  test(
    "TC-FF-003: GET /api/patreon/membership returns 401 (auth), not 404 (flag disabled)",
    async ({ request }) => {
      const response = await request.get("/api/patreon/membership");
      await assertNotFlagDisabled(response);
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body).not.toMatchObject({ error: "Patreon integration is disabled" });
    },
  );

  test(
    "TC-FF-004: GET /api/patreon/membership-anon returns 400 (missing pid), not 404 (flag disabled)",
    async ({ request }) => {
      const response = await request.get("/api/patreon/membership-anon");
      await assertNotFlagDisabled(response);
      expect([400, 429]).toContain(response.status());
      if (response.status() === 400) {
        const body = await response.json();
        expect(body).toMatchObject({ error: "missing_pid" });
      }
    },
  );

  test(
    "TC-FF-005: GET /api/patreon/membership-anon with pid returns thrall tier, not 404",
    async ({ request }) => {
      const response = await request.get(
        "/api/patreon/membership-anon?pid=test-nonexistent-pid-loki-qa",
      );
      await assertNotFlagDisabled(response);
      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toMatchObject({
          tier: "thrall",
          active: false,
          platform: "patreon",
        });
        expect(body).toHaveProperty("checkedAt");
      } else {
        expect(response.status()).toBe(429);
      }
    },
  );

  test(
    "TC-FF-006: POST /api/patreon/migrate returns 401 (auth), not 404 (flag disabled)",
    async ({ request }) => {
      const response = await request.post("/api/patreon/migrate", {
        data: { patreonUserId: "test-pid-loki" },
      });
      await assertNotFlagDisabled(response);
      expect([401, 429]).toContain(response.status());
    },
  );

  test(
    "TC-FF-007: POST /api/patreon/unlink returns 401 (auth), not 404 (flag disabled)",
    async ({ request }) => {
      const response = await request.post("/api/patreon/unlink", {
        data: {},
      });
      await assertNotFlagDisabled(response);
      expect([401, 429]).toContain(response.status());
    },
  );

  test(
    "TC-FF-008: POST /api/patreon/webhook returns 400 (missing signature), not 404 (flag disabled)",
    async ({ request }) => {
      const response = await request.post("/api/patreon/webhook", {
        data: { test: "payload" },
      });
      await assertNotFlagDisabled(response);
      expect([400, 429]).toContain(response.status());
      if (response.status() === 400) {
        const body = await response.json();
        expect(body).toMatchObject({ error: "missing_signature" });
      }
    },
  );

  test(
    "TC-FF-009: /api/patreon/membership-anon returns application/json content-type",
    async ({ request }) => {
      const response = await request.get("/api/patreon/membership-anon");
      const contentType = response.headers()["content-type"] ?? "";
      expect(contentType).toContain("application/json");
    },
  );

  test(
    "TC-FF-010: membership-anon 200 response contains required fields per spec",
    async ({ request }) => {
      const response = await request.get(
        "/api/patreon/membership-anon?pid=loki-shape-test-pid",
      );
      if (response.status() !== 200) {
        test.skip();
        return;
      }
      const body = await response.json();
      expect(body).toHaveProperty("tier");
      expect(body).toHaveProperty("active");
      expect(body).toHaveProperty("platform");
      expect(body).toHaveProperty("checkedAt");
      expect(body.platform).toBe("patreon");
      expect(["thrall", "karl"]).toContain(body.tier);
      expect(typeof body.active).toBe("boolean");
    },
  );

  test(
    "TC-FF-011: non-Patreon routes are unaffected by the feature flag module",
    async ({ request }) => {
      const response = await request.post("/api/auth/token", { data: {} });
      expect(response.status()).not.toBe(404);
    },
  );

  test(
    "TC-FF-012: POST /api/patreon/webhook rejects non-hex signature gracefully",
    async ({ request }) => {
      const response = await request.post("/api/patreon/webhook", {
        headers: {
          "x-patreon-signature": "NOT_A_HEX_STRING!!!",
          "x-patreon-event": "members:pledge:create",
        },
        data: JSON.stringify({ test: "payload" }),
      });
      await assertNotFlagDisabled(response);
      expect([400, 429]).toContain(response.status());
      if (response.status() === 400) {
        const body = await response.json();
        expect(body.error).toBe("invalid_signature");
      }
    },
  );
});

// ===========================================================================
// Story 2: Client-Side Feature Flag Guards (default patreon mode)
// ===========================================================================

test.describe("Client-Side Guards — Settings page in patreon mode", () => {
  test("TC-FF-101: /settings page loads with HTTP 200", async ({ page }) => {
    await clearPatreonState(page);
    const response = await page.goto(`${BASE_URL}/settings`, {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(200);
  });

  test("TC-FF-102: Settings page renders the page heading", async ({ page }) => {
    await clearPatreonState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const heading = page.getByRole("heading", { level: 1, name: /Settings/i });
    await expect(heading).toBeVisible();
  });

  test("TC-FF-103: Patreon subscription section is visible in patreon mode", async ({
    page,
  }) => {
    await clearPatreonState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const patreonSection = page.locator('[aria-label="Patreon subscription"]');
    await expect(patreonSection).toBeVisible();
  });

  test("TC-FF-104: Stripe-mode placeholder absent in patreon mode", async ({
    page,
  }) => {
    await clearPatreonState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const stripePlaceholder = page.locator('[aria-label="Subscription Management"]');
    await expect(stripePlaceholder).not.toBeVisible();
  });
});

test.describe("Client-Side Guards — PatreonGate passes children in patreon mode", () => {
  test("TC-FF-105: Cloud Sync section is visible to anonymous users", async ({
    page,
  }) => {
    await clearPatreonState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const cloudSyncSection = page.locator('[aria-label="Cloud Sync"]');
    await expect(cloudSyncSection).toBeVisible();
  });

  test("TC-FF-106: Multi-Household section is visible to anonymous users", async ({
    page,
  }) => {
    await clearPatreonState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const multiHouseholdSection = page.locator('[aria-label="Multi-Household"]');
    await expect(multiHouseholdSection).toBeVisible();
  });

  test("TC-FF-107: Data Export section is visible to anonymous users", async ({
    page,
  }) => {
    await clearPatreonState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const dataExportSection = page.locator('[aria-label="Data Export"]');
    await expect(dataExportSection).toBeVisible();
  });

  test("TC-FF-108: Data Export button is present but disabled", async ({
    page,
  }) => {
    await clearPatreonState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const exportButton = page.locator('button[aria-label="Export data (coming soon)"]');
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeDisabled();
  });
});

test.describe("Client-Side Guards — SealedRuneModal in patreon mode", () => {
  test("TC-FF-109: SealedRuneModal is not visible before interaction", async ({
    page,
  }) => {
    await clearPatreonState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const modalHeading = page.getByText("THIS RUNE IS SEALED");
    await expect(modalHeading).not.toBeVisible();
  });

  test("TC-FF-110: Stripe-mode 'coming soon' text absent in patreon mode", async ({
    page,
  }) => {
    await clearPatreonState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const stripePlaceholderText = page.getByText("Subscription management coming soon.");
    await expect(stripePlaceholderText).not.toBeVisible();
  });
});

test.describe("Client-Side Guards — Page structure and regression", () => {
  test("TC-FF-111: Settings page contains all 4 expected sections", async ({
    page,
  }) => {
    await clearPatreonState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    await expect(page.locator('[aria-label="Patreon subscription"]')).toBeVisible();
    await expect(page.locator('[aria-label="Cloud Sync"]')).toBeVisible();
    await expect(page.locator('[aria-label="Multi-Household"]')).toBeVisible();
    await expect(page.locator('[aria-label="Data Export"]')).toBeVisible();
  });

  test("TC-FF-112: Settings page header tagline is visible", async ({ page }) => {
    await clearPatreonState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const tagline = page.getByText("Forge your preferences. Shape the ledger to your will.");
    await expect(tagline).toBeVisible();
  });

  test("TC-FF-113: 'Coming soon to Karl supporters' text renders", async ({
    page,
  }) => {
    await clearPatreonState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const comingSoonText = page.getByText("Coming soon to Karl supporters.").first();
    await expect(comingSoonText).toBeVisible();
  });

  test("TC-FF-114: Dashboard loads without errors in patreon mode", async ({
    page,
  }) => {
    await clearPatreonState(page);
    const response = await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    const body = page.locator("body");
    await expect(body).not.toContainText("Patreon integration is disabled");
  });

  test("TC-FF-115: Stripe 'Premium feature — subscription coming soon' absent in patreon mode", async ({
    page,
  }) => {
    await clearPatreonState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const stripeMessage = page.getByText("Premium feature — subscription coming soon.");
    await expect(stripeMessage).not.toBeVisible();
  });

  test("TC-FF-116: Settings page is accessible at mobile viewport (375px)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await clearPatreonState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const heading = page.getByRole("heading", { level: 1, name: /Settings/i });
    await expect(heading).toBeVisible();
    const patreonSection = page.locator('[aria-label="Patreon subscription"]');
    await expect(patreonSection).toBeVisible();
  });

  test("TC-FF-117: No JS errors on settings page load", async ({ page }) => {
    await clearPatreonState(page);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    expect(
      errors.filter((e) => !e.includes("hydration") && !e.includes("Warning:")),
    ).toHaveLength(0);
  });
});

// ===========================================================================
// MANUAL TEST STEPS — STRIPE MODE
// (Cannot be automated without server restart + env var change)
// ===========================================================================

/**
 * MANUAL TEST PLAN — Stripe Mode Validation
 *
 * Prerequisites:
 *   1. Set SUBSCRIPTION_PLATFORM=stripe and NEXT_PUBLIC_SUBSCRIPTION_PLATFORM=stripe
 *      in development/frontend/.env.local
 *   2. Restart the dev server: npm run dev
 *   3. Navigate to http://localhost:9653/settings
 *
 * MT-FF-01: Settings page shows "Subscription Management" placeholder (NOT PatreonSettings)
 *   Expected: aria-label="Subscription Management" section is visible
 *   Expected: "Subscription management coming soon." text appears
 *   Expected: aria-label="Patreon subscription" section is NOT visible
 *
 * MT-FF-02: PatreonGate sections render children directly (no lockout)
 *   Expected: Cloud Sync, Multi-Household, Data Export sections all visible
 *   Expected: No "Learn more" / "This feature requires a Karl subscription" text
 *
 * MT-FF-03: UpsellBanner does not appear on dashboard
 *   Navigate to http://localhost:9653/
 *   Expected: No upsell banner visible
 *
 * MT-FF-04: SealedRuneModal shows generic "coming soon" in stripe mode
 *   Expected: "Premium feature — subscription coming soon." text in modal
 *   Expected: "Pledge on Patreon" button NOT visible
 *
 * MT-FF-05: Zero Patreon API network requests in stripe mode
 *   Open DevTools Network tab, filter by "/api/patreon"
 *   Expected: Zero requests to /api/patreon/* routes
 *
 * MT-FF-06: All 7 Patreon API routes return 404 in stripe mode
 *   curl -s http://localhost:9653/api/patreon/authorize | jq .
 *   Expected: { "error": "Patreon integration is disabled" } with HTTP 404
 *   Repeat for: callback, membership, membership-anon, migrate, unlink, webhook
 */
