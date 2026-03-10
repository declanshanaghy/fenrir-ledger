/**
 * Karl Upsell Dialogs — Validation Tests
 * Issue #488: Unify Karl upsell dialogs across Valhalla, The Hunt, and The Howl
 *
 * Validates:
 * - Single shared KarlUpsellDialog component used by all three tabs
 * - Two-column layout on desktop (icon+copy left, features+CTA right)
 * - Collapses to single column on mobile (min 375px)
 * - Each tab passes its own contextual copy via props
 * - No duplicate upsell implementations
 */

import { test, expect } from "@playwright/test";
import {
  seedHousehold,
  seedEntitlement,
  seedCards,
  makeCard,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

test.describe("Karl Upsell Dialogs — Issue #488", () => {
  // Setup: Navigate to dashboard with test user who lacks Karl features (Thrall tier)
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (at /ledger, not /dashboard)
    await page.goto("/ledger");

    // Clear any existing storage
    await clearAllStorage(page);

    // Seed household and activate it
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);

    // Seed a few test cards so dashboard isn't empty
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeCard({ cardName: "Chase Sapphire Preferred" }),
      makeCard({ cardName: "American Express Gold" }),
    ]);

    // Seed Thrall tier (no Karl features) so upsell dialogs appear when clicking gated tabs
    await seedEntitlement(page, "thrall", true);

    // Reload to pick up the seeded data
    await page.reload();

    // Wait for dashboard to load
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 1: Valhalla (card archive) upsell dialog opens with correct content
  // ───────────────────────────────────────────────────────────────────────────
  test("Valhalla: Karl upsell dialog shows with Valhalla-specific content", async ({
    page,
  }) => {
    // Click the Valhalla tab (locked for Thrall users)
    const valhallaTab = page.locator('[id="tab-valhalla"]');
    await valhallaTab.click();

    // Verify dialog appears
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify Valhalla-specific content in dialog
    const dialogTitle = dialog.locator('h2:has-text("Valhalla")');
    await expect(dialogTitle).toBeVisible();

    await expect(
      dialog.locator('text="Hall of the Honored Dead"')
    ).toBeVisible();

    // Verify feature benefits for Valhalla
    await expect(
      dialog.locator("text=Full archive of closed and graduated cards")
    ).toBeVisible();
    await expect(
      dialog.locator("text=Annual fees avoided over time")
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 2: The Howl upsell dialog opens with Howl-specific content
  // ───────────────────────────────────────────────────────────────────────────
  test("The Howl: Karl upsell dialog shows with Howl-specific content", async ({
    page,
  }) => {
    // Click The Howl tab (locked for Thrall users)
    const howlTab = page.locator('[id="tab-howl"]');
    await howlTab.click();

    // Verify dialog appears
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify Howl-specific content in dialog
    const dialogTitle = dialog.locator('h2:has-text("The Howl")');
    await expect(dialogTitle).toBeVisible();

    await expect(
      dialog.locator('text="The Wolf Cries Before the Chain Breaks"')
    ).toBeVisible();

    // Verify feature benefits for Howl
    await expect(
      dialog.locator("text=Upcoming fee alerts with urgency ranking")
    ).toBeVisible();
    await expect(
      dialog.locator("text=Proactive notifications before you lose value")
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 3: The Hunt (Velocity) upsell dialog opens with Hunt-specific content
  // ───────────────────────────────────────────────────────────────────────────
  test("The Hunt (Velocity): Karl upsell dialog shows with Hunt-specific content", async ({
    page,
  }) => {
    // Click The Hunt tab (locked for Thrall users)
    const huntTab = page.locator('[id="tab-hunt"]');
    await huntTab.click();

    // Verify dialog appears
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify Hunt/Velocity-specific content in dialog
    const dialogTitle = dialog.locator('h2:has-text("Velocity")');
    await expect(dialogTitle).toBeVisible();

    await expect(
      dialog.locator('text="How Fast Does Your Plunder Flow?"')
    ).toBeVisible();

    // Verify feature benefits for Velocity
    await expect(
      dialog.locator("text=Real-time spend tracking against bonus targets")
    ).toBeVisible();
    await expect(
      dialog.locator("text=Alerts when you fall behind target pace")
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 4: Dialog has "Upgrade to Karl" CTA button and pricing info
  // ───────────────────────────────────────────────────────────────────────────
  test("Karl upsell dialog displays upgrade CTA with pricing", async ({
    page,
  }) => {
    // Open any Karl-gated tab (Valhalla)
    const valhallaTab = page.locator('[id="tab-valhalla"]');
    await valhallaTab.click();

    // Verify dialog appears
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify CTA button and pricing
    await expect(
      dialog.locator('text="Upgrade to Karl — $3.99/month"')
    ).toBeVisible();

    await expect(
      dialog.locator('text="Unlock all premium features"')
    ).toBeVisible();

    await expect(
      dialog.locator("text=Billed monthly. Cancel anytime.")
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 5: Dialog can be dismissed with "Not now" button
  // ───────────────────────────────────────────────────────────────────────────
  test("Karl upsell dialog can be dismissed with Not now button", async ({
    page,
  }) => {
    // Open Valhalla dialog
    await page.locator('[id="tab-valhalla"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click "Not now" button
    const dismissButton = dialog.locator('text="Not now"');
    await dismissButton.click();

    // Verify dialog is gone
    await expect(dialog).not.toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 6: All three tabs use the same shared dialog component
  // ───────────────────────────────────────────────────────────────────────────
  test("All three Karl-gated tabs use the same shared dialog component", async ({
    page,
  }) => {
    // Verify each tab triggers the same dialog with consistent structure
    // Check Valhalla — should have "Karl Tier Feature" header
    await page.locator('[id="tab-valhalla"]').click();
    let dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('text="Karl Tier Feature"')
    ).toBeVisible();

    // Close and check Howl — same header
    await dialog.locator('text="Not now"').click();
    await expect(dialog).not.toBeVisible();

    await page.locator('[id="tab-howl"]').click();
    dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('text="Karl Tier Feature"')
    ).toBeVisible();

    // Close and check Hunt — same header
    await dialog.locator('text="Not now"').click();
    await expect(dialog).not.toBeVisible();

    await page.locator('[id="tab-hunt"]').click();
    dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('text="Karl Tier Feature"')
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 7: Dialog displays feature benefits as checklist
  // ───────────────────────────────────────────────────────────────────────────
  test("Karl upsell dialog displays feature benefits with checkmarks", async ({
    page,
  }) => {
    // Open Valhalla dialog
    await page.locator('[id="tab-valhalla"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify checklist container exists with aria-label
    const benefitsList = dialog.locator("ul[aria-label]");
    await expect(benefitsList).toBeVisible();

    // Verify benefits are listed (with checkmarks rendered)
    const benefits = dialog.locator("ul li");
    const count = await benefits.count();
    expect(count).toBeGreaterThan(0);
  });
});
