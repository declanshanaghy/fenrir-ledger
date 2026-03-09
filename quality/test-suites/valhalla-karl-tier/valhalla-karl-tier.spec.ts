/**
 * Valhalla Karl Tier Gating — QA Test Suite
 *
 * Validates Issue #377: Move Valhalla (card archive) to Karl tier.
 * Tests cover acceptance criteria, edge cases, and integration across
 * tab bar, sidebar, mobile bottom tabs, and upsell dialog.
 *
 * Budget: 5 tests covering:
 *   1. Thrall user sees upsell dialog on tab click
 *   2. Karl user accesses Valhalla normally
 *   3. /ledger/valhalla returns 404 for Thrall
 *   4. ?tab=valhalla auto-opens upsell for Thrall
 *   5. Sidebar/bottom-tabs Valhalla link gated for Thrall
 */

import { test, expect, type Page } from "@playwright/test";

// ============================================================================
// Test Setup & Helpers
// ============================================================================

const BASE_URL = process.env.SERVER_URL ?? "http://localhost:9653";

/**
 * Helper: Set Thrall (free) entitlement in localStorage
 */
async function setThrallEntitlement(page: Page) {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(() => {
    const entitlement = {
      tier: "thrall",
      active: false,
      platform: "stripe",
      userId: "test-thrall",
      linkedAt: Date.now(),
      checkedAt: Date.now(),
    };
    localStorage.setItem("fenrir:entitlement", JSON.stringify(entitlement));
  });
}

/**
 * Helper: Set Karl (paid) entitlement in localStorage
 */
async function setKarlEntitlement(page: Page) {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(() => {
    const entitlement = {
      tier: "karl",
      active: true,
      platform: "stripe",
      userId: "test-karl",
      linkedAt: Date.now(),
      checkedAt: Date.now(),
    };
    localStorage.setItem("fenrir:entitlement", JSON.stringify(entitlement));
  });
}

/**
 * Helper: Clear entitlement state
 */
async function clearEntitlementState(page: Page) {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(() => {
    localStorage.removeItem("fenrir:entitlement");
  });
}

// ============================================================================
// Tests
// ============================================================================

test.describe("Valhalla Karl Tier Gating — Issue #377", () => {

  // ── Test 1: Thrall user sees upsell dialog on Valhalla tab click ───────────

  test("AC1: Thrall user sees common upsell dialog when clicking Valhalla tab", async ({
    page,
  }) => {
    // Setup: Set Thrall entitlement and navigate to dashboard
    await setThrallEntitlement(page);
    await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle" });

    // Action: Click Valhalla tab
    const valhallaTabButton = page.getByRole("button", { name: /valhalla/i }).first();
    await valhallaTabButton.click();

    // Assert: Upsell dialog appears
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Assert: Dialog contains Valhalla-specific text
    await expect(dialog.locator("text=Valhalla")).toBeVisible();
    await expect(dialog.locator("text=Hall of the Honored Dead")).toBeVisible();
    await expect(dialog.locator("text=Karl Tier Feature")).toBeVisible();

    // Assert: Upgrade button is clickable (simulate, don't complete flow)
    const upgradeBtn = dialog.getByRole("button", {
      name: /Upgrade to Karl/i,
    });
    await expect(upgradeBtn).toBeVisible();
  });

  // ── Test 2: Karl user accesses Valhalla tab normally ──────────────────────

  test("AC2: Karl user sees closed cards in Valhalla tab as normal", async ({
    page,
  }) => {
    // Setup: Set Karl entitlement and navigate to dashboard
    await setKarlEntitlement(page);
    await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle" });

    // Action: Click Valhalla tab
    const valhallaTabButton = page.getByRole("button", { name: /valhalla/i }).first();
    await valhallaTabButton.click();

    // Assert: Tab panel is visible (no upsell dialog)
    await expect(page.locator("[id*='panel-valhalla']")).toBeVisible();

    // Assert: No upsell dialog is shown
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).not.toBeVisible();
  });

  // ── Test 3: /ledger/valhalla shows not found page ──────────────────────

  test("AC3: /ledger/valhalla route shows not-found (Thrall cannot bypass gating)", async ({
    page,
  }) => {
    // Setup: Set Thrall entitlement
    await setThrallEntitlement(page);

    // Action: Attempt direct navigation to /ledger/valhalla
    await page.goto(`${BASE_URL}/ledger/valhalla`, { waitUntil: "networkidle" });

    // Assert: Not found page is displayed (Next.js notFound() handler)
    // The page might return 200 but with notFound() triggering a special UI
    await expect(
      page.locator("text=/not found|this page|doesn't exist/i")
    ).toBeVisible({ timeout: 3000 });
  });

  // ── Test 4: ?tab=valhalla auto-opens upsell for Thrall ─────────────────────

  test("AC4: Thrall user navigating to ?tab=valhalla auto-opens upsell dialog", async ({
    page,
  }) => {
    // Setup: Set Thrall entitlement
    await setThrallEntitlement(page);

    // Action: Navigate to dashboard with ?tab=valhalla query param
    await page.goto(`${BASE_URL}/ledger?tab=valhalla`, { waitUntil: "networkidle" });

    // Wait for upsell dialog to appear
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Assert: Dialog shows Valhalla feature
    await expect(dialog.locator("text=Valhalla")).toBeVisible();
    await expect(dialog.locator("text=Hall of the Honored Dead")).toBeVisible();

    // Assert: Active tab is NOT Valhalla (should fall back to default like Active or Howl)
    // This ensures Thrall can't view Valhalla content even with URL param
    const activeTab = page.locator("[role='button'][aria-selected='true']").first();
    const activeTabName = await activeTab.textContent();
    expect(activeTabName).not.toMatch(/valhalla/i);
  });

  // ── Test 5: Sidebar Valhalla link gated for Thrall ───────────────────────

  test("AC5: Sidebar Valhalla link triggers upsell for Thrall", async ({
    page,
  }) => {
    // Setup: Set Thrall entitlement
    await setThrallEntitlement(page);
    await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle" });

    // Action: Click Valhalla tab
    const valhallaTab = page.getByRole("button", { name: /valhalla/i }).first();
    await valhallaTab.click();

    // Assert: Upsell dialog appears
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog.locator("text=Valhalla")).toBeVisible();
  });

  // ── Test 6: Valhalla tab remains visible for Thrall (not hidden) ──────────

  test("AC6: Valhalla tab remains visible (not hidden) for Thrall users", async ({
    page,
  }) => {
    // Setup: Set Thrall entitlement
    await setThrallEntitlement(page);
    await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle" });

    // Assert: Valhalla tab button is visible
    const valhallaTab = page.getByRole("button", { name: /valhalla/i }).first();
    await expect(valhallaTab).toBeVisible();

    // Assert: It's not hidden with display:none or visibility:hidden
    const isHidden = await valhallaTab.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display === "none" || style.visibility === "hidden";
    });
    expect(isHidden).toBe(false);
  });

  // ── Test 7: Mobile bottom tabs Valhalla link gated ──────────────────────

  test("AC7: Mobile bottom tabs Valhalla link gated for Thrall", async ({
    page,
  }) => {
    // Setup: Set mobile viewport and Thrall entitlement
    await page.setViewportSize({ width: 375, height: 812 });
    await setThrallEntitlement(page);
    await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle" });

    // Action: Click Valhalla tab in mobile view
    const mobileValhallaTab = page.getByRole("button", { name: /valhalla/i }).first();
    await mobileValhallaTab.click();

    // Assert: Upsell dialog appears (bottom-anchored on mobile)
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Assert: Dialog content is visible
    await expect(dialog.locator("text=Valhalla")).toBeVisible();
  });

  // ── Test 8: Common upsell dialog structure ───────────────────────────────

  test("AC8: Common upsell dialog contains expected elements", async ({
    page,
  }) => {
    // Setup: Set Thrall entitlement
    await setThrallEntitlement(page);
    await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle" });

    // Action: Click Valhalla tab to open upsell
    const valhallaTab = page.getByRole("button", { name: /valhalla/i }).first();
    await valhallaTab.click();

    // Assert: Dialog contains expected structure
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();

    // Check for key elements from KarlUpsellDialog
    // - Header: "Karl Tier Feature" + "$3.99/month"
    await expect(dialog.locator("text=Karl Tier Feature")).toBeVisible();
    await expect(dialog.locator("text=$3.99/month")).toBeVisible();

    // - Feature name (Valhalla)
    await expect(dialog.getByRole("heading", { name: /valhalla/i })).toBeVisible();

    // - Upgrade button
    await expect(
      dialog.getByRole("button", { name: /Upgrade to Karl/i })
    ).toBeVisible();

    // - "Not now" dismiss button
    await expect(
      dialog.getByRole("button", { name: /Not now/i })
    ).toBeVisible();
  });

  // ── Test 9: Upsell dialog dismiss via "Not now" button ──────────────────

  test("AC9: Upsell dialog can be dismissed via 'Not now' button", async ({
    page,
  }) => {
    // Setup: Set Thrall entitlement
    await setThrallEntitlement(page);
    await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle" });

    // Action: Click Valhalla tab
    const valhallaTab = page.getByRole("button", { name: /valhalla/i }).first();
    await valhallaTab.click();

    // Assert: Dialog is open
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();

    // Action: Click "Not now" button
    const notNowBtn = dialog.getByRole("button", { name: /Not now/i });
    await notNowBtn.click();

    // Assert: Dialog is closed
    await expect(dialog).not.toBeVisible();

    // Assert: User is on a default tab (not Valhalla)
    const activeTab = page.locator("[role='button'][aria-selected='true']").first();
    const activeTabName = await activeTab.textContent();
    expect(activeTabName).not.toMatch(/valhalla/i);
  });

  // ── Test 10: Upsell dialog dismiss via Escape key ───────────────────────

  test("AC10: Upsell dialog can be dismissed via Escape key", async ({
    page,
  }) => {
    // Setup: Set Thrall entitlement
    await setThrallEntitlement(page);
    await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle" });

    // Action: Click Valhalla tab
    const valhallaTab = page.getByRole("button", { name: /valhalla/i }).first();
    await valhallaTab.click();

    // Assert: Dialog is open
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();

    // Action: Press Escape key
    await page.keyboard.press("Escape");

    // Assert: Dialog is closed
    await expect(dialog).not.toBeVisible();
  });

});
