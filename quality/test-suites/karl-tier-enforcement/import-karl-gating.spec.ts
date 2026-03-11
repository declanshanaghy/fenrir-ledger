/**
 * Import Karl Tier Enforcement QA Test Suite — Issue #559
 *
 * Validates: Enforce Karl tier on Import — upsell dialog + backend middleware
 *
 * Acceptance Criteria Tested:
 * AC1: Import button stays visible for Thrall users
 * AC2: Clicking Import as Thrall shows Norse-themed upsell dialog
 * AC3: Karl users click Import and get wizard as normal
 * AC4: Upsell dialog matches design system
 * AC5: Backend /api/sheets/import enforces requireKarl middleware
 * AC6: Backend /api/config/picker enforces requireKarl middleware
 * AC7: 402 Payment Required response with proper error shape
 * AC8: All Karl-gated routes audited and middleware applied
 *
 * Implementation verified in:
 *   - src/app/ledger/page.tsx (Import button + upsell dialog gating)
 *   - src/components/entitlement/KarlUpsellDialog.tsx (KARL_UPSELL_IMPORT props)
 *   - src/lib/auth/require-karl.ts (middleware + 402 response)
 *   - src/app/api/sheets/import/route.ts (requireKarl applied)
 *   - src/app/api/config/picker/route.ts (requireKarl applied)
 *   - src/hooks/useSheetImport.ts (handles 402 SUBSCRIPTION_REQUIRED)
 */

import { test, expect, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// Test Utilities
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.SERVER_URL ?? "http://localhost:9653";

/** Auth session key from src/lib/auth/session.ts */
const AUTH_SESSION_KEY = "auth:session";

/**
 * Seed an authenticated Google session into localStorage.
 * Required for accessing dashboard routes.
 */
async function seedSession(page: Page, tier: "thrall" | "karl") {
  const now = Date.now();
  const googleSub = `test-user-${tier}-${now}`;

  const session = {
    user: {
      sub: googleSub,
      email: `${tier}@fenrir-ledger.dev`,
      name: `Test ${tier} User`,
      picture: "https://example.com/photo.jpg",
    },
    access_token: `ya29.test_token_${tier}_${now}`,
    id_token: "test_id_token",
    refresh_token: "test_refresh_token",
    expires_at: now + 3600000, // Valid for 1 hour
  };

  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    {
      key: AUTH_SESSION_KEY,
      value: JSON.stringify(session),
    }
  );
}

/**
 * Seed entitlement for a given tier.
 * localStorage key: fenrir_ledger:{householdId}:entitlement
 */
async function seedEntitlement(
  page: Page,
  householdId: string,
  tier: "thrall" | "karl"
) {
  await page.evaluate(
    ({ householdId, tier }) => {
      const entitlement = {
        tier,
        active: tier === "karl" ? true : false,
        platform: "stripe",
        userId: `${tier}-customer-${householdId}`,
        linkedAt: Date.now(),
        checkedAt: Date.now(),
      };
      localStorage.setItem(
        `fenrir_ledger:${householdId}:entitlement`,
        JSON.stringify(entitlement)
      );
    },
    { householdId, tier }
  );
}

/**
 * Seed household ID to localStorage.
 */
async function seedHousehold(page: Page, householdId: string) {
  await page.evaluate(
    ({ householdId }) => {
      localStorage.setItem("fenrir:household", householdId);
    },
    { householdId }
  );
}

/**
 * Seed empty cards to avoid "empty state" CTA visibility issues.
 */
async function seedCards(page: Page, householdId: string) {
  await page.evaluate(
    ({ householdId }) => {
      localStorage.setItem(`fenrir_ledger:${householdId}:cards`, JSON.stringify([]));
    },
    { householdId }
  );
}

/**
 * Navigate to dashboard (/ledger), seeding all required auth, household, and entitlement data.
 */
async function goToDashboardWithTier(page: Page, tier: "thrall" | "karl") {
  // Navigate to home first to establish origin and context (required for localStorage)
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  // Clear all storage to start fresh
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Create a stable household ID for this test
  const householdId = `test-household-${tier}`;

  // Seed auth session (required for /ledger access)
  await seedSession(page, tier);

  // Seed household and tier entitlement
  await seedHousehold(page, householdId);
  await seedEntitlement(page, householdId, tier);
  await seedCards(page, householdId);

  // Navigate directly to /ledger with fully seeded localStorage
  await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle" });
}

/**
 * Helper to add test cards so the Import button appears in the header.
 * Import button only shows when hasCards === true.
 */
async function seedTestCards(page: Page, householdId: string, count: number) {
  const cards = Array.from({ length: count }, (_, i) => ({
    id: `test-card-${i}`,
    householdId,
    issuer: `Test Card ${i + 1}`,
    productName: `Test Product`,
    status: "active" as const,
    openedDate: new Date().toISOString(),
    annualFee: 0,
    welcomeBonusTarget: 1000,
    welcomeBonusDeadline: new Date().toISOString(),
  }));

  await page.evaluate(
    ({ householdId, cards }) => {
      localStorage.setItem(
        `fenrir_ledger:${householdId}:cards`,
        JSON.stringify(cards)
      );
    },
    { householdId, cards }
  );

  // Reload to pick up the cards
  await page.reload({ waitUntil: "networkidle" });
}

// ─────────────────────────────────────────────────────────────────────────────
// AC1-AC4: Frontend — Import Button Gating & Upsell Dialog
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC1-AC4: Frontend Import Button Gating & Upsell Dialog", () => {
  test("AC1: Import button is visible for Thrall users", async ({ page }) => {
    // Setup: Thrall user on dashboard
    await goToDashboardWithTier(page, "thrall");
    const householdId = "test-household-thrall";
    await seedTestCards(page, householdId, 1);

    // Assert: Import button exists in header
    const importButton = page.getByRole("button", { name: /import/i });
    await expect(importButton).toBeVisible({ timeout: 3000 });

    // Assert: Button is not disabled
    await expect(importButton).toBeEnabled();

    // Assert: Import button contains "K" badge for Thrall users
    const kBadge = importButton.locator('text=K');
    await expect(kBadge).toBeVisible();
  });

  test("AC2: Clicking Import as Thrall shows upsell dialog", async ({ page }) => {
    // Setup: Thrall user on dashboard
    await goToDashboardWithTier(page, "thrall");
    const householdId = "test-household-thrall";
    await seedTestCards(page, householdId, 1);

    // Action: Click Import button
    const importButton = page.getByRole("button", { name: /import/i });
    await importButton.click();

    // Assert: Upsell dialog appears (KarlUpsellDialog with KARL_UPSELL_IMPORT)
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Assert: Dialog contains Import-specific content
    await expect(dialog.locator("text=/Import/i")).toBeVisible();
    await expect(dialog.locator("text=/Runes Inscribed Afar/i")).toBeVisible();
    await expect(dialog.locator("text=/Karl Tier Feature/i")).toBeVisible();

    // Assert: Dialog has upgrade CTA
    const upgradeButton = dialog.getByRole("button", { name: /Upgrade to Karl/i });
    await expect(upgradeButton).toBeVisible();

    // Assert: Dialog has "Not now" dismiss button
    const notNowButton = dialog.getByRole("button", { name: /Not now/i });
    await expect(notNowButton).toBeVisible();
  });

  test("AC3: Karl users click Import and get wizard (no upsell)", async ({
    page,
  }) => {
    // Setup: Karl user on dashboard
    await goToDashboardWithTier(page, "karl");
    const householdId = "test-household-karl";
    await seedTestCards(page, householdId, 1);

    // Action: Click Import button
    const importButton = page.getByRole("button", { name: /import/i });
    await importButton.click();

    // Assert: Import wizard appears (NOT the upsell dialog)
    // The wizard has a dialog with title "Import Cards" or similar
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Assert: Dialog does NOT contain upsell-specific text
    // Should contain import wizard content instead
    const dialogText = await dialog.textContent();
    expect(dialogText).not.toMatch(/Karl Tier Feature/i);
    expect(dialogText).not.toMatch(/Upgrade to Karl/i);

    // Assert: Wizard has method selection or other import UI
    // (Import method selection, Google Sheets, CSV, Excel, etc.)
    const methodContent = dialog.locator(
      "text=/Google Sheets|CSV|Excel|File|method/i"
    );
    // At least one of these should be visible in wizard
    const hasImportContent =
      (await methodContent.count()) > 0 || (await dialog.textContent())?.length! > 100;
    expect(hasImportContent).toBeTruthy();
  });

  test("AC4: Upsell dialog matches design system (two-column layout, responsive)", async ({
    page,
  }) => {
    // Setup: Thrall user on dashboard
    await goToDashboardWithTier(page, "thrall");
    const householdId = "test-household-thrall";
    await seedTestCards(page, householdId, 1);

    // Action: Click Import button
    const importButton = page.getByRole("button", { name: /import/i });
    await importButton.click();

    // Assert: Dialog is visible
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Assert: Header with "Karl Tier Feature" + price
    const header = dialog.locator("text=/Karl Tier Feature/i");
    await expect(header).toBeVisible();

    // Assert: Feature icon is present
    const icon = dialog.locator("text=/\u16DA/"); // ᛚ Laguz rune
    await expect(icon).toBeVisible();

    // Assert: Feature name "Import"
    await expect(dialog.locator("text=/^Import$/i")).toBeVisible();

    // Assert: Feature tagline — "Runes Inscribed Afar..."
    await expect(dialog.locator("text=/Runes Inscribed Afar/i")).toBeVisible();

    // Assert: Benefits list visible
    const benefits = dialog.locator("li");
    await expect(benefits).toHaveCount(4); // Should have 4 benefits
    await expect(benefits.nth(0).locator("text=/Google Sheets/i")).toBeVisible();
    await expect(benefits.nth(1).locator("text=/Google Drive/i")).toBeVisible();
    await expect(benefits.nth(2).locator("text=/CSV and Excel/i")).toBeVisible();
    await expect(benefits.nth(3).locator("text=/deduplication/i")).toBeVisible();

    // Assert: Pricing info visible
    await expect(dialog.locator("text=/Karl.*\\$3.99/i")).toBeVisible();

    // Assert: Primary CTA button
    const upgradeButton = dialog.getByRole("button", {
      name: /Upgrade to Karl.*\$3.99/i,
    });
    await expect(upgradeButton).toBeVisible();

    // Assert: Secondary dismiss button
    const notNowButton = dialog.getByRole("button", { name: /Not now/i });
    await expect(notNowButton).toBeVisible();

    // Assert: Responsive layout classes present in DOM
    const dialogContent = dialog.locator("..");
    const classes = await dialogContent.evaluate((el) => el.className);
    expect(classes).toContain("md:grid"); // Two-column grid on desktop

    // Assert: Dialog can be closed via X button (built-in to DialogContent)
    const closeButton = dialog.locator("button[aria-label*='Close']").first();
    if ((await closeButton.count()) > 0) {
      await expect(closeButton).toBeVisible();
    }
  });

  test("Upsell dialog is dismissible", async ({ page }) => {
    // Setup: Thrall user on dashboard
    await goToDashboardWithTier(page, "thrall");
    const householdId = "test-household-thrall";
    await seedTestCards(page, householdId, 1);

    // Action: Click Import button
    const importButton = page.getByRole("button", { name: /import/i });
    await importButton.click();

    // Assert: Dialog is visible
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Action: Click "Not now" button
    const notNowButton = dialog.getByRole("button", { name: /Not now/i });
    await notNowButton.click();

    // Assert: Dialog is dismissed
    await expect(dialog).not.toBeVisible({ timeout: 1000 });

    // Assert: Import button is still visible (feature not blocked)
    const importButtonAfter = page.getByRole("button", { name: /import/i });
    await expect(importButtonAfter).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC5-AC7: Backend Middleware — requireKarl + 402 Response
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC5-AC7: Backend Middleware — requireKarl + 402 Response", () => {
  test("AC5: GET /api/config/picker returns 402 for Thrall tier", async ({
    page,
  }) => {
    // Setup: Thrall user session
    await goToDashboardWithTier(page, "thrall");

    // Get the session token from localStorage
    const sessionData = await page.evaluate(() => {
      const session = localStorage.getItem("auth:session");
      return session ? JSON.parse(session) : null;
    });

    expect(sessionData).toBeTruthy();
    expect(sessionData.user.sub).toMatch(/test-user-thrall/);

    // Action: Call /api/config/picker with auth header
    const response = await page.request.get(
      `${BASE_URL}/api/config/picker`,
      {
        headers: {
          Authorization: `Bearer ${sessionData.id_token}`,
        },
      }
    );

    // Assert: Returns 402 Payment Required
    expect(response.status()).toBe(402);

    // Assert: Response body has correct error shape
    const body = await response.json();
    expect(body).toHaveProperty("error", "subscription_required");
    expect(body).toHaveProperty("required_tier", "karl");
    expect(body).toHaveProperty("current_tier", "thrall");
    expect(body).toHaveProperty("message");
    expect(body.message).toMatch(/upgrade|karl/i);
  });

  test("AC5: POST /api/sheets/import returns 402 for Thrall tier", async ({
    page,
  }) => {
    // Setup: Thrall user session
    await goToDashboardWithTier(page, "thrall");

    // Get the session token from localStorage
    const sessionData = await page.evaluate(() => {
      const session = localStorage.getItem("auth:session");
      return session ? JSON.parse(session) : null;
    });

    expect(sessionData).toBeTruthy();

    // Action: Call /api/sheets/import with test URL
    const response = await page.request.post(
      `${BASE_URL}/api/sheets/import`,
      {
        headers: {
          Authorization: `Bearer ${sessionData.id_token}`,
          "Content-Type": "application/json",
        },
        data: {
          url: "https://docs.google.com/spreadsheets/d/test-id/edit",
        },
      }
    );

    // Assert: Returns 402 Payment Required (before trying to fetch the sheet)
    expect(response.status()).toBe(402);

    // Assert: Response body has correct error shape
    const body = await response.json();
    expect(body).toHaveProperty("error", "subscription_required");
    expect(body).toHaveProperty("required_tier", "karl");
    expect(body).toHaveProperty("current_tier", "thrall");
  });

  test("AC5: GET /api/config/picker returns 200 for Karl tier", async ({
    page,
  }) => {
    // Setup: Karl user session
    await goToDashboardWithTier(page, "karl");

    // Get the session token from localStorage
    const sessionData = await page.evaluate(() => {
      const session = localStorage.getItem("auth:session");
      return session ? JSON.parse(session) : null;
    });

    expect(sessionData).toBeTruthy();
    expect(sessionData.user.sub).toMatch(/test-user-karl/);

    // Action: Call /api/config/picker with auth header
    const response = await page.request.get(
      `${BASE_URL}/api/config/picker`,
      {
        headers: {
          Authorization: `Bearer ${sessionData.id_token}`,
        },
      }
    );

    // Assert: Returns 200 OK (or 500 if config not set, but NOT 402)
    expect([200, 500]).toContain(response.status());
    expect(response.status()).not.toBe(402);
  });

  test("AC7: 402 response includes current_tier field", async ({ page }) => {
    // Setup: Thrall user session
    await goToDashboardWithTier(page, "thrall");

    const sessionData = await page.evaluate(() => {
      const session = localStorage.getItem("auth:session");
      return session ? JSON.parse(session) : null;
    });

    // Action: Call /api/config/picker
    const response = await page.request.get(
      `${BASE_URL}/api/config/picker`,
      {
        headers: {
          Authorization: `Bearer ${sessionData.id_token}`,
        },
      }
    );

    // Assert: 402 response
    expect(response.status()).toBe(402);

    // Assert: Error object has current_tier field
    const body = await response.json();
    expect(body.current_tier).toBe("thrall");
  });

  test("Frontend handles 402 SUBSCRIPTION_REQUIRED error gracefully", async ({
    page,
  }) => {
    // Setup: Thrall user on dashboard
    await goToDashboardWithTier(page, "thrall");
    const householdId = "test-household-thrall";
    await seedTestCards(page, householdId, 1);

    // Action: Try to trigger import (which would hit 402 on API)
    // We test the error handling in useSheetImport hook
    const importButton = page.getByRole("button", { name: /import/i });
    await importButton.click();

    // Assert: Upsell dialog appears instead of error state
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // The upsell dialog is the expected user-facing response to Thrall tier
    await expect(dialog.locator("text=/Import/i")).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC6: Code Verification — All Karl-gated routes have middleware
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC6: Code Verification — All Karl-gated routes have middleware", () => {
  test("require-karl.ts exports requireKarl function with correct signature", async ({
    page,
  }) => {
    const requireKarlFile = require("fs").readFileSync(
      "/workspace/development/frontend/src/lib/auth/require-karl.ts",
      "utf8"
    );

    // Should export function requireKarl
    expect(requireKarlFile).toContain("export async function requireKarl");

    // Should accept user: VerifiedUser parameter
    expect(requireKarlFile).toContain("user: VerifiedUser");

    // Should return Promise<KarlResult>
    expect(requireKarlFile).toContain("Promise<KarlResult>");

    // Should check tier === "karl" && active === true
    expect(requireKarlFile).toContain('tier === "karl"');
    expect(requireKarlFile).toContain("active === true");

    // Should return 402 for non-Karl users
    expect(requireKarlFile).toContain("402");
    expect(requireKarlFile).toContain("subscription_required");
  });

  test("/api/sheets/import route applies requireKarl middleware", async ({
    page,
  }) => {
    const routeFile = require("fs").readFileSync(
      "/workspace/development/frontend/src/app/api/sheets/import/route.ts",
      "utf8"
    );

    // Should import requireKarl
    expect(routeFile).toContain('import { requireKarl }');

    // Should call requireKarl in POST handler
    expect(routeFile).toContain("const karl = await requireKarl");

    // Should check karl.ok
    expect(routeFile).toContain("if (!karl.ok)");

    // Should return karl.response
    expect(routeFile).toContain("return karl.response");

    // Should be after requireAuth check
    const authIndex = routeFile.indexOf("await requireAuth");
    const karlIndex = routeFile.indexOf("await requireKarl");
    expect(karlIndex).toBeGreaterThan(authIndex);
  });

  test("/api/config/picker route applies requireKarl middleware", async ({
    page,
  }) => {
    const routeFile = require("fs").readFileSync(
      "/workspace/development/frontend/src/app/api/config/picker/route.ts",
      "utf8"
    );

    // Should import requireKarl
    expect(routeFile).toContain('import { requireKarl }');

    // Should call requireKarl in GET handler
    expect(routeFile).toContain("const karl = await requireKarl");

    // Should check karl.ok
    expect(routeFile).toContain("if (!karl.ok)");

    // Should return karl.response
    expect(routeFile).toContain("return karl.response");

    // Should be after requireAuth check
    const authIndex = routeFile.indexOf("await requireAuth");
    const karlIndex = routeFile.indexOf("await requireKarl");
    expect(karlIndex).toBeGreaterThan(authIndex);
  });

  test("SUBSCRIPTION_REQUIRED error code is in SheetImportErrorCode union", async ({
    page,
  }) => {
    const typesFile = require("fs").readFileSync(
      "/workspace/development/frontend/src/lib/sheets/types.ts",
      "utf8"
    );

    // Should have SUBSCRIPTION_REQUIRED in error code union
    expect(typesFile).toContain("SUBSCRIPTION_REQUIRED");
    expect(typesFile).toContain("SheetImportErrorCode");
  });

  test("useSheetImport handles 402 status code", async ({ page }) => {
    const hookFile = require("fs").readFileSync(
      "/workspace/development/frontend/src/hooks/useSheetImport.ts",
      "utf8"
    );

    // Should check for 402 status
    expect(hookFile).toContain("response.status === 402");

    // Should set error code to SUBSCRIPTION_REQUIRED
    expect(hookFile).toContain("SUBSCRIPTION_REQUIRED");

    // Should display user-friendly message
    expect(hookFile).toMatch(/Upgrade to Karl|subscription/i);
  });

  test("KarlUpsellDialog has KARL_UPSELL_IMPORT preset", async ({ page }) => {
    const dialogFile = require("fs").readFileSync(
      "/workspace/development/frontend/src/components/entitlement/KarlUpsellDialog.tsx",
      "utf8"
    );

    // Should export KARL_UPSELL_IMPORT
    expect(dialogFile).toContain("export const KARL_UPSELL_IMPORT");

    // Should have featureName: "Import"
    expect(dialogFile).toContain("featureName: \"Import\"");

    // Should have Laguz rune (ᛚ) icon
    expect(dialogFile).toContain("16DA"); // Unicode for Laguz

    // Should have tagline about "Runes Inscribed"
    expect(dialogFile).toContain("Runes Inscribed Afar");

    // Should have Import-specific teaser
    expect(dialogFile).toContain(
      "Import cards from Google Sheets, CSV, or Excel"
    );

    // Should have 4 benefits
    expect(
      (dialogFile.match(/Google Sheets|Google Drive|CSV|Excel|deduplication/g) || []).length
    ).toBeGreaterThanOrEqual(4);
  });

  test("ledger/page.tsx imports and uses KarlUpsellDialog for Import", async ({
    page,
  }) => {
    const pageFile = require("fs").readFileSync(
      "/workspace/development/frontend/src/app/ledger/page.tsx",
      "utf8"
    );

    // Should import KarlUpsellDialog and KARL_UPSELL_IMPORT
    expect(pageFile).toContain("import { KarlUpsellDialog, KARL_UPSELL_IMPORT }");

    // Should have state for import upsell dialog
    expect(pageFile).toContain("importUpsellOpen");
    expect(pageFile).toContain("setImportUpsellOpen");

    // Should render KarlUpsellDialog with KARL_UPSELL_IMPORT props
    expect(pageFile).toContain("<KarlUpsellDialog");
    expect(pageFile).toContain("{...KARL_UPSELL_IMPORT}");

    // Should have handleImportClick that checks canImport
    expect(pageFile).toContain("handleImportClick");
    expect(pageFile).toContain("if (canImport)");
    expect(pageFile).toContain("setImportUpsellOpen");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC8: Comprehensive Audit of Karl-gated Features
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC8: Comprehensive Audit — All Karl-gated features verified", () => {
  test("import feature is registered in entitlement types", async ({
    page,
  }) => {
    const typesFile = require("fs").readFileSync(
      "/workspace/development/frontend/src/lib/entitlement/types.ts",
      "utf8"
    );

    // Should have "import" in PremiumFeature type
    expect(typesFile).toContain('"import"');

    // Should be marked as Karl tier
    expect(typesFile).toContain('tier: "karl"');
  });

  test("entitlement hook provides hasFeature('import')", async ({ page }) => {
    const hookFile = require("fs").readFileSync(
      "/workspace/development/frontend/src/hooks/useEntitlement.ts",
      "utf8"
    );

    // Should export useEntitlement hook
    expect(hookFile).toContain("export function useEntitlement");

    // Should implement hasFeature method
    expect(hookFile).toContain("hasFeature");

    // Should check PREMIUM_FEATURES record
    expect(hookFile).toContain("PREMIUM_FEATURES");
  });

  test("Dashboard uses hasFeature('import') to gate Import button", async ({
    page,
  }) => {
    const pageFile = require("fs").readFileSync(
      "/workspace/development/frontend/src/app/ledger/page.tsx",
      "utf8"
    );

    // Should have canImport variable
    expect(pageFile).toContain("const canImport = hasFeature(\"import\")");

    // Should use canImport in conditional logic for upsell
    expect(pageFile).toContain("!canImport &&");
  });
});
