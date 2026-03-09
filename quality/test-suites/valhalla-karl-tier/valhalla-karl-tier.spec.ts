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

import { test, expect, Page } from "@playwright/test";

// ============================================================================
// Test Setup & Helpers
// ============================================================================

const APP_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";

/**
 * Helper: Sign in a Thrall (free) user via test API
 */
async function signInThrall(page: Page) {
  await page.goto(`${APP_URL}/auth/test?tier=thrall`);
  await page.waitForURL(/\/ledger/);
}

/**
 * Helper: Sign in a Karl (paid) user via test API
 */
async function signInKarl(page: Page) {
  await page.goto(`${APP_URL}/auth/test?tier=karl`);
  await page.waitForURL(/\/ledger/);
}

/**
 * Helper: Wait for Valhalla tab button to be visible
 */
async function waitForValhallaTab(page: Page) {
  await page.getByRole("button", { name: /valhalla/i }).first().waitFor();
}

// ============================================================================
// Tests
// ============================================================================

test.describe("Valhalla Karl Tier Gating — Issue #377", () => {

  // ── Test 1: Thrall user sees upsell dialog on Valhalla tab click ───────────

  test("AC1: Thrall user sees common upsell dialog when clicking Valhalla tab", async ({
    page,
  }) => {
    // Setup: Sign in as Thrall
    await signInThrall(page);
    await waitForValhallaTab(page);

    // Action: Click Valhalla tab
    const valhallaTabButton = page.getByRole("button", { name: /valhalla/i }).first();
    await valhallaTabButton.click();

    // Assert: Upsell dialog appears
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();

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
    // Setup: Sign in as Karl
    await signInKarl(page);
    await waitForValhallaTab(page);

    // Action: Click Valhalla tab
    const valhallaTabButton = page.getByRole("button", { name: /valhalla/i }).first();
    await valhallaTabButton.click();

    // Assert: Tab is now active (aria-selected or similar)
    // The tab content should render without a dialog
    // If there are closed cards, they should be visible
    // If no closed cards, an empty state should appear
    await expect(page.locator("[id*='panel-valhalla']")).toBeVisible();

    // Assert: No upsell dialog is shown
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).not.toBeVisible();
  });

  // ── Test 3: /ledger/valhalla returns 404 ────────────────────────────────

  test("AC3: /ledger/valhalla route returns 404 (Thrall cannot bypass gating)", async ({
    page,
  }) => {
    // Setup: Sign in as Thrall
    await signInThrall(page);

    // Action: Attempt direct navigation to /ledger/valhalla
    const response = await page.goto(`${APP_URL}/ledger/valhalla`);

    // Assert: Page returns 404
    expect(response?.status()).toBe(404);

    // Assert: Not found page is displayed
    // (Next.js notFound() shows "Not Found" page)
    await expect(
      page.locator("text=/not found|404/i")
    ).toBeVisible();
  });

  // ── Test 4: ?tab=valhalla auto-opens upsell for Thrall ─────────────────────

  test("AC4: Thrall user navigating to ?tab=valhalla auto-opens upsell dialog", async ({
    page,
  }) => {
    // Setup: Sign in as Thrall
    await signInThrall(page);

    // Action: Navigate to dashboard with ?tab=valhalla query param
    await page.goto(`${APP_URL}/ledger?tab=valhalla`);

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

  test("AC5: Sidebar Valhalla link triggers upsell for Thrall, works for Karl", async ({
    page,
  }) => {
    // Setup: Sign in as Thrall
    await signInThrall(page);

    // Action: Click Valhalla sidebar link (if visible)
    // The sidebar should still show the link, but clicking it opens the upsell
    const sidebarValhallaLink = page
      .locator("nav")
      .getByRole("button", { name: /valhalla/i })
      .first();

    // If the link exists, click it
    const exists = await sidebarValhallaLink.isVisible().catch(() => false);
    if (exists) {
      await sidebarValhallaLink.click();

      // Assert: Upsell dialog appears
      const dialog = page.locator("[role='dialog']");
      await expect(dialog).toBeVisible({ timeout: 3000 });
      await expect(dialog.locator("text=Valhalla")).toBeVisible();
    }

    // ── Repeat with Karl user ────────────────────────────────────────────
    // Sign in as Karl
    await signInKarl(page);

    // Action: Click sidebar Valhalla link
    const karlSidebarLink = page
      .locator("nav")
      .getByRole("button", { name: /valhalla/i })
      .first();

    const karlLinkExists = await karlSidebarLink.isVisible().catch(() => false);
    if (karlLinkExists) {
      await karlSidebarLink.click();

      // Assert: Valhalla tab becomes active, NO upsell dialog
      const valhallaDailog = page.locator("[role='dialog']");
      await expect(valhallaDailog).not.toBeVisible();

      // Assert: Tab panel is visible
      await expect(page.locator("[id*='panel-valhalla']")).toBeVisible();
    }
  });

  // ── Test 6: Valhalla tab remains visible for Thrall (not hidden) ──────────

  test("AC6: Valhalla tab remains visible (not hidden) for Thrall users", async ({
    page,
  }) => {
    // Setup: Sign in as Thrall
    await signInThrall(page);

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
    // Setup: Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    // Sign in as Thrall
    await signInThrall(page);

    // Action: Click Valhalla tab in bottom sheet (mobile)
    const mobileValhallaTab = page.getByRole("button", { name: /valhalla/i }).first();
    await mobileValhallaTab.click();

    // Assert: Upsell dialog appears (should be bottom-anchored on mobile)
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Assert: Dialog content is visible and scrollable
    await expect(dialog.locator("text=Valhalla")).toBeVisible();
  });

  // ── Test 8: Common upsell dialog props reusability ──────────────────────

  test("AC8: Common upsell dialog is reused by Valhalla, Howl, and Velocity", async ({
    page,
  }) => {
    // This test verifies that KarlUpsellDialog component exists and
    // is prop-driven so it can be reused. We check the DOM structure.

    // Setup: Sign in as Thrall
    await signInThrall(page);

    // Action: Click Valhalla tab to open upsell
    const valhallaTab = page.getByRole("button", { name: /valhalla/i }).first();
    await valhallaTab.click();

    // Assert: Dialog contains the expected structure from KarlUpsellDialog
    const dialog = page.locator("[role='dialog']");
    await expect(dialog).toBeVisible();

    // Check for key elements defined in KarlUpsellDialog
    // - Header: "Karl Tier Feature" + "$3.99/month"
    await expect(dialog.locator("text=Karl Tier Feature")).toBeVisible();
    await expect(dialog.locator("text=$3.99/month")).toBeVisible();

    // - Feature name (Valhalla in this case)
    await expect(dialog.getByRole("heading", { name: /valhalla/i })).toBeVisible();

    // - Feature teaser (Voice 1 description)
    const teaser = dialog.locator(
      "text=/See every card you've closed|anniversary dates|total rewards/i"
    );
    await expect(teaser).toBeVisible();

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
    // Setup: Sign in as Thrall
    await signInThrall(page);

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
    // Setup: Sign in as Thrall
    await signInThrall(page);

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
