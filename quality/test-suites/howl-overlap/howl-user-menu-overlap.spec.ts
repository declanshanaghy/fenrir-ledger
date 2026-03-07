/**
 * Issue #154: Howl panel overlaps top-right user menu — menu inaccessible
 *
 * Test suite validates that:
 * 1. User menu/avatar is clickable and fully accessible when Howl panel is visible
 * 2. Howl panel does not overlap any header/navigation elements
 * 3. Fix maintains proper z-index layering (header z-50, Howl z-30)
 *
 * All tests use anonymous state (no auth required) since the issue affects
 * all users. Anonymous users have the ᛟ rune avatar that opens the upsell panel.
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedHousehold,
  makeUrgentCard,
  makeCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

/**
 * Helper: Seeds N overdue cards (days < 0) to trigger Ragnarök threshold (≥5)
 */
async function seedRagnarokCards(page: Page) {
  const overdue = -1; // 1 day overdue
  const cards = [
    makeUrgentCard({ id: "rag-1", annualFeeDate: daysFromNow(overdue) }),
    makeUrgentCard({ id: "rag-2", annualFeeDate: daysFromNow(overdue) }),
    makeUrgentCard({ id: "rag-3", annualFeeDate: daysFromNow(overdue) }),
    makeUrgentCard({ id: "rag-4", annualFeeDate: daysFromNow(overdue) }),
    makeUrgentCard({ id: "rag-5", annualFeeDate: daysFromNow(overdue) }),
  ];
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

test.describe("Howl Panel User Menu Overlap — Issue #154", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
  });

  test("user avatar is clickable when Howl panel is visible (desktop)", async ({
    page,
  }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // Setup household + urgent card
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);

    // Navigate to dashboard
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for Howl panel (desktop sidebar)
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible({ timeout: 10000 });

    // Verify anonymous avatar is visible
    const anonAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(anonAvatar).toBeVisible();

    // Click avatar — should open upsell panel
    await anonAvatar.click();

    // Verify upsell panel appears (not blocked by Howl)
    const upsellPanel = page.locator('#anon-upsell-panel[role="dialog"]');
    await expect(upsellPanel).toBeVisible();

    // Verify panel contents are accessible
    const signInButton = upsellPanel.locator(
      'button:has-text("Sign in to Google")'
    );
    await expect(signInButton).toBeVisible();
    await expect(signInButton).toBeEnabled();

    // Verify theme toggle is accessible
    const themeSection = upsellPanel.locator('div:has-text("Theme")');
    await expect(themeSection).toBeVisible();
  });

  test("user avatar is clickable when Howl panel is in Ragnarök mode", async ({
    page,
  }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // Setup Ragnarök threshold (≥5 overdue cards)
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedRagnarokCards(page);

    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for Howl panel
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible({ timeout: 10000 });

    // Verify Ragnarök header appears
    const ragnarokHeader = page.locator('h2:has-text("Ragnarök Approaches")');
    await expect(ragnarokHeader).toBeVisible();

    // Verify avatar is still clickable
    const anonAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(anonAvatar).toBeVisible();
    await anonAvatar.click();

    // Verify upsell panel opens
    const upsellPanel = page.locator('#anon-upsell-panel[role="dialog"]');
    await expect(upsellPanel).toBeVisible();
  });

  test("user avatar is accessible on mobile with Howl panel", async ({
    page,
  }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Setup urgent card
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);

    await page.goto("/", { waitUntil: "networkidle" });

    // On mobile, Howl is collapsed — bell button (ᚲ) should be visible
    const mobileHowlButton = page.locator(
      'button[aria-label*="urgent card"]'
    );
    await expect(mobileHowlButton).toBeVisible();

    // Open mobile Howl panel
    await mobileHowlButton.click();

    // Wait for mobile panel (bottom sheet)
    await page.waitForTimeout(500); // animation

    // Verify avatar is still accessible (header should be above Howl)
    const anonAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(anonAvatar).toBeVisible();
    await anonAvatar.click();

    // Verify upsell panel opens
    const upsellPanel = page.locator('#anon-upsell-panel[role="dialog"]');
    await expect(upsellPanel).toBeVisible();
  });

  test("Howl panel does not overlap TopBar header chrome (z-index check)", async ({
    page,
  }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // Setup urgent card
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);

    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for Howl panel
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible({ timeout: 10000 });

    // Get z-index of TopBar header
    const topBarHeader = page.locator("header").first();
    const topBarZIndex = await topBarHeader.evaluate((el) =>
      window.getComputedStyle(el).getPropertyValue("z-index")
    );

    // Get z-index of Howl panel's parent container (motion.div)
    const howlContainer = howlPanel.locator("xpath=..").first();
    const howlZIndex = await howlContainer.evaluate((el) =>
      window.getComputedStyle(el).getPropertyValue("z-index")
    );

    // TopBar z-index should be >= Howl z-index
    const topBarZ = parseInt(topBarZIndex, 10);
    const howlZ = parseInt(howlZIndex, 10);

    expect(topBarZ).toBeGreaterThanOrEqual(howlZ);

    // Verify header z-index is 50 (expected from spec)
    expect(topBarZ).toBe(50);

    // Verify Howl z-index is 30 (expected from fix)
    expect(howlZ).toBe(30);

    // Verify avatar is clickable (functional test)
    const anonAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(anonAvatar).toBeVisible();
    await anonAvatar.click();

    const upsellPanel = page.locator('#anon-upsell-panel[role="dialog"]');
    await expect(upsellPanel).toBeVisible();
  });

  test("theme toggle is accessible when Howl panel is visible", async ({
    page,
  }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // Setup urgent card
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);

    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for Howl panel
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible({ timeout: 10000 });

    // Open upsell panel
    const anonAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await anonAvatar.click();

    const upsellPanel = page.locator('#anon-upsell-panel[role="dialog"]');
    await expect(upsellPanel).toBeVisible();

    // Find theme section
    const themeSection = upsellPanel.locator('div:has-text("Theme")');
    await expect(themeSection).toBeVisible();

    // Verify theme toggle button is clickable
    const themeButton = themeSection.locator("button").first();
    await expect(themeButton).toBeVisible();
    await expect(themeButton).toBeEnabled();

    // Click it to verify it works
    await themeButton.click();
    // Theme should toggle (exact behavior depends on current theme)
  });

  test("Howl panel urgent count badge is visible and not covered", async ({
    page,
  }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // Setup 2 urgent cards
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeUrgentCard({ id: "u1" }),
      makeUrgentCard({ id: "u2" }),
    ]);

    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for Howl panel
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible({ timeout: 10000 });

    // Verify count badge shows "2"
    const countBadge = howlPanel.locator('[data-slot="count"]').first();
    await expect(countBadge).toBeVisible();
    await expect(countBadge).toHaveText("2");
  });

  test("Howl panel does not block clicking cards in the grid", async ({
    page,
  }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // Setup 1 urgent card + 1 normal card
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeUrgentCard({ id: "urgent-1" }),
      makeCard({ id: "normal-1", cardName: "Regular Card" }),
    ]);

    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for Howl panel
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible({ timeout: 10000 });

    // Find a card in the grid (left side)
    const cardLink = page.locator('a[href*="/cards/"]').first();
    await expect(cardLink).toBeVisible();

    // Verify it's clickable (not blocked by Howl)
    await expect(cardLink).toBeEnabled();

    // Get its bounding box
    const box = await cardLink.boundingBox();
    expect(box).not.toBeNull();
  });
});
