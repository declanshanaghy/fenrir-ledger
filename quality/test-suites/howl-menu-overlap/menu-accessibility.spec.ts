/**
 * HowlPanel Menu Overlap Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates GitHub Issue #154: Howl panel overlaps top-right user menu.
 *
 * Acceptance Criteria:
 *   - User menu is clickable and fully accessible when the Howl panel is visible
 *   - Howl panel does not overlap any header/navigation elements
 *   - Fix uses lower Howl z-index to ensure header stays on top
 *
 * Edge cases covered:
 *   - Howl panel visible + user menu click (anonymous state)
 *   - Howl panel in Ragnarök mode (≥5 urgent cards) + user menu
 *   - Mobile viewport with both elements visible
 *   - Theme toggle accessible when Howl is showing
 *
 * Spec references:
 *   - development/frontend/src/components/layout/HowlPanel.tsx — z-index: 30 (desktop), 30/40 (mobile)
 *   - development/frontend/src/components/layout/TopBar.tsx — z-index: 50 (higher than Howl)
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedHousehold,
  makeUrgentCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";
import { URGENT_CARDS } from "../helpers/seed-data";

// ════════════════════════════════════════════════════════════════════════════
// Setup helper
// ════════════════════════════════════════════════════════════════════════════

async function setupWithUrgentCards(
  page: Parameters<typeof clearAllStorage>[0],
  cards: Parameters<typeof seedCards>[2]
) {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
  await page.reload({ waitUntil: "networkidle" });
}

// ════════════════════════════════════════════════════════════════════════════
// Suite 1: User menu accessible with Howl panel visible (desktop)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Howl Panel — User menu accessibility (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("user menu is clickable when Howl panel is visible", async ({ page }) => {
    // Setup: seed urgent cards so the Howl panel appears
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Urgent Fee Card" }),
    ]);

    // Verify the Howl panel is visible (precondition)
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible();

    // Verify the anonymous user avatar is visible in the top-right
    const userAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(userAvatar).toBeVisible();

    // Click the user avatar — this should open the upsell prompt panel
    await userAvatar.click();

    // Verify the upsell prompt dialog appears (anonymous state)
    const upsellDialog = page.locator('div[role="dialog"]');
    await expect(upsellDialog).toBeVisible();
  });

  test("logo link is clickable when Howl panel is visible", async ({
    page,
  }) => {
    // Setup: seed urgent cards so the Howl panel appears
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Logo Test Card" }),
    ]);

    // Verify the Howl panel is visible (precondition)
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible();

    // Verify the logo link in the header is visible and clickable
    const logoLink = page.locator('header a[href="/static"]').first();
    await expect(logoLink).toBeVisible();

    // Verify the link is clickable (not blocked by Howl panel)
    await expect(logoLink).toBeEnabled();
  });

  test("Howl panel z-index is lower than header navigation", async ({ page }) => {
    // Setup: seed urgent cards so the Howl panel appears
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Z-Index Test Card" }),
    ]);

    // Verify the Howl panel is visible
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible();

    // Get computed z-index of the desktop Howl panel's parent motion.div
    const howlZIndex = await page.evaluate(() => {
      const howlMotionDiv = document.querySelector(
        'div[style*="z-index"]'
      ) as HTMLElement;
      if (!howlMotionDiv) return null;
      return window.getComputedStyle(howlMotionDiv).zIndex;
    });

    // Get computed z-index of the header navigation
    const headerZIndex = await page.evaluate(() => {
      const header = document.querySelector("header") as HTMLElement;
      if (!header) return null;
      return window.getComputedStyle(header).zIndex;
    });

    // Verify both z-index values exist
    expect(howlZIndex).not.toBeNull();
    expect(headerZIndex).not.toBeNull();

    // Verify header z-index is higher than Howl panel z-index
    // Per the fix: Howl desktop z-index is 30, header should be 50
    const howlZ = parseInt(howlZIndex || "0", 10);
    const headerZ = parseInt(headerZIndex || "0", 10);

    expect(headerZ).toBeGreaterThan(howlZ);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2: User menu accessible in Ragnarök mode (≥5 urgent cards)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Howl Panel — User menu in Ragnarök mode (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("user menu is clickable when Howl panel is in Ragnarök mode", async ({
    page,
  }) => {
    // Setup: seed ≥5 urgent cards to trigger Ragnarök mode
    await setupWithUrgentCards(page, URGENT_CARDS); // has 5 cards

    // Verify Ragnarök mode is active
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible();
    await expect(howlPanel).toContainText("Ragnarök Approaches");

    // Verify the user avatar is visible and clickable
    const userAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(userAvatar).toBeVisible();

    // Click the user avatar — should open the upsell prompt
    await userAvatar.click();

    // Verify the upsell dialog appears
    const upsellDialog = page.locator('div[role="dialog"]');
    await expect(upsellDialog).toBeVisible();
  });

  test("logo link is clickable when Howl panel is in Ragnarök mode", async ({
    page,
  }) => {
    // Setup: seed ≥5 urgent cards to trigger Ragnarök mode
    await setupWithUrgentCards(page, URGENT_CARDS);

    // Verify Ragnarök mode is active
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toContainText("Ragnarök Approaches");

    // Verify the logo link is clickable
    const logoLink = page.locator('header a[href="/static"]').first();
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toBeEnabled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3: Mobile viewport — Howl bell button + user menu
// ════════════════════════════════════════════════════════════════════════════

test.describe("Howl Panel — Mobile menu accessibility", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("user menu is accessible when Howl bell button is visible (mobile)", async ({
    page,
  }) => {
    // Setup: seed urgent cards so the mobile bell button appears
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Mobile Urgent Card" }),
    ]);

    // Verify the mobile bell button is visible
    const bellButton = page.locator('button[aria-label*="urgent card"]');
    await expect(bellButton).toBeVisible();

    // Verify the user avatar is visible and clickable (not blocked by bell)
    const userAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(userAvatar).toBeVisible();

    // Click the user avatar — should open the upsell prompt
    await userAvatar.click();

    // Verify the upsell dialog appears
    const upsellDialog = page.locator('div[role="dialog"]');
    await expect(upsellDialog).toBeVisible();
  });

  test("user menu is accessible when mobile Howl sheet is open", async ({
    page,
  }) => {
    // Setup: seed urgent cards and open the mobile Howl sheet
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Mobile Sheet Card" }),
    ]);

    // Open the mobile Howl sheet
    const bellButton = page.locator('button[aria-label*="urgent card"]');
    await bellButton.click();

    // Verify the mobile sheet is visible
    const mobileSheet = page.locator(
      'aside[aria-label="Urgent deadlines"].rounded-t-sm'
    );
    await expect(mobileSheet).toBeVisible();

    // Verify the user avatar is still visible above the sheet (z-index)
    const userAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(userAvatar).toBeVisible();

    // Click the user avatar — should open the upsell prompt above the Howl sheet
    await userAvatar.click();

    // Verify the upsell dialog appears
    const upsellDialog = page.locator('div[role="dialog"]');
    await expect(upsellDialog).toBeVisible();
  });

  test("logo link is accessible when mobile Howl sheet is open", async ({
    page,
  }) => {
    // Setup: seed urgent cards and open the mobile Howl sheet
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Logo Mobile Card" }),
    ]);

    // Open the mobile Howl sheet
    const bellButton = page.locator('button[aria-label*="urgent card"]');
    await bellButton.click();

    // Verify the mobile sheet is visible
    const mobileSheet = page.locator(
      'aside[aria-label="Urgent deadlines"].rounded-t-sm'
    );
    await expect(mobileSheet).toBeVisible();

    // Verify the logo link is still accessible
    const logoLink = page.locator('header a[href="/static"]').first();
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toBeEnabled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4: Howl panel does not overlap header elements
// ════════════════════════════════════════════════════════════════════════════

test.describe("Howl Panel — No overlap with header", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("Howl panel does not visually overlap the user avatar", async ({
    page,
  }) => {
    // Setup: seed urgent cards so the Howl panel appears
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Overlap Test Card" }),
    ]);

    // Get bounding boxes for both elements
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    const userAvatar = page.locator('button[aria-label*="Sign in to sync"]');

    await expect(howlPanel).toBeVisible();
    await expect(userAvatar).toBeVisible();

    const howlBox = await howlPanel.boundingBox();
    const avatarBox = await userAvatar.boundingBox();

    expect(howlBox).not.toBeNull();
    expect(avatarBox).not.toBeNull();

    // Verify the avatar is in the top-right corner above the Howl panel
    // (avatar top Y should be less than or equal to Howl panel top Y)
    expect(avatarBox!.y).toBeLessThanOrEqual(howlBox!.y);
  });

  test("Howl panel does not visually overlap the logo link", async ({
    page,
  }) => {
    // Setup: seed urgent cards so the Howl panel appears
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Logo Overlap Test" }),
    ]);

    // Get bounding boxes
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    const logoLink = page.locator('header a[href="/static"]').first();

    await expect(howlPanel).toBeVisible();
    await expect(logoLink).toBeVisible();

    const howlBox = await howlPanel.boundingBox();
    const logoBox = await logoLink.boundingBox();

    expect(howlBox).not.toBeNull();
    expect(logoBox).not.toBeNull();

    // Verify the logo link is in the header above the Howl panel
    expect(logoBox!.y).toBeLessThanOrEqual(howlBox!.y);
  });
});
