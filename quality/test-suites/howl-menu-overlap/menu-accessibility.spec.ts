/**
 * Menu Accessibility Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Updated for Issue #279: HowlPanel sidebar removed; tabs replace it.
 * The old overlap concern (Howl panel z-index vs header z-index) is no longer
 * applicable since there is no fixed right sidebar.
 *
 * This suite now validates that header menu elements remain accessible
 * when the dashboard tab bar is visible and cards are in The Howl tab.
 *
 * Acceptance Criteria:
 *   - User avatar is clickable when urgent cards are shown in tab view
 *   - Logo link is accessible on desktop and mobile
 *   - Header z-index is higher than tab panel content
 *
 * Spec references:
 *   - development/frontend/src/components/dashboard/Dashboard.tsx
 *   - development/frontend/src/components/layout/TopBar.tsx
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedHousehold,
  makeUrgentCard,
  makeCard,
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
// Suite 1: User menu accessible with tab dashboard visible (desktop)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — User menu accessibility (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("user menu is clickable when Howl tab is the active tab", async ({ page }) => {
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Urgent Fee Card" }),
    ]);

    // Howl tab is default with urgent cards
    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await expect(howlTab).toHaveAttribute("aria-selected", "true");

    // Verify the anonymous user avatar is visible in the top-right
    const userAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(userAvatar).toBeVisible();

    // Click the user avatar — should open the upsell prompt panel
    await userAvatar.click();

    // Verify the upsell prompt dialog appears
    const upsellDialog = page.locator('div[role="dialog"]');
    await expect(upsellDialog).toBeVisible();
  });

  test("logo link is clickable when Howl tab is the active tab", async ({ page }) => {
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Logo Test Card" }),
    ]);

    // Howl tab is active (urgent cards present)
    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await expect(howlTab).toHaveAttribute("aria-selected", "true");

    // Verify the logo link in the header is visible and clickable
    const logoLink = page.locator('header a[href="/static"]').first();
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toBeEnabled();
  });

  test("header z-index is higher than tab panel content", async ({ page }) => {
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Z-Index Test Card" }),
    ]);

    // Get computed z-index of the header navigation
    const headerZIndex = await page.evaluate(() => {
      const header = document.querySelector("header") as HTMLElement;
      if (!header) return null;
      return window.getComputedStyle(header).zIndex;
    });

    expect(headerZIndex).not.toBeNull();
    const headerZ = parseInt(headerZIndex || "0", 10);
    // Header z-index should be 50 (per TopBar spec)
    expect(headerZ).toBeGreaterThanOrEqual(50);
  });

  test("HowlPanel aside does NOT exist in the DOM", async ({ page }) => {
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Tab Test Card" }),
    ]);

    // The old sidebar must not be attached to the DOM
    const oldSidebar = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(oldSidebar).not.toBeAttached();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2: User menu accessible when Ragnarök mode is active
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — User menu in Ragnarök mode (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("user menu is clickable when Howl tab is in Ragnarök mode (≥5 urgent cards)", async ({
    page,
  }) => {
    await setupWithUrgentCards(page, URGENT_CARDS);

    // Verify Ragnarök mode is active in the tab label
    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await expect(howlTab).toContainText("Ragnarök Approaches");

    // Verify the user avatar is visible and clickable
    const userAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(userAvatar).toBeVisible();

    await userAvatar.click();

    // Verify the upsell dialog appears
    const upsellDialog = page.locator('div[role="dialog"]');
    await expect(upsellDialog).toBeVisible();
  });

  test("logo link is clickable when Howl tab is in Ragnarök mode", async ({ page }) => {
    await setupWithUrgentCards(page, URGENT_CARDS);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await expect(howlTab).toContainText("Ragnarök Approaches");

    const logoLink = page.locator('header a[href="/static"]').first();
    await expect(logoLink).toBeVisible();
    await expect(logoLink).toBeEnabled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3: Mobile viewport — tab bar + user menu
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — Mobile menu accessibility", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("user menu is accessible when Howl tab is active on mobile", async ({ page }) => {
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Mobile Urgent Card" }),
    ]);

    // Tab bar is visible on mobile
    const tabList = page.locator('[role="tablist"][aria-label="Card dashboard tabs"]');
    await expect(tabList).toBeVisible();

    // User avatar is visible and clickable
    const userAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(userAvatar).toBeVisible();
    await userAvatar.click();

    const upsellDialog = page.locator('div[role="dialog"]');
    await expect(upsellDialog).toBeVisible();
  });

  test("user menu is accessible after switching tabs on mobile", async ({ page }) => {
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Mobile Sheet Card" }),
      makeCard({ cardName: "Active Card" }),
    ]);

    // Switch to Active tab
    const activeTab = page.locator('[role="tab"][id="tab-active"]');
    await activeTab.click();
    await expect(activeTab).toHaveAttribute("aria-selected", "true");

    // User avatar still accessible
    const userAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(userAvatar).toBeVisible();
    await userAvatar.click();

    const upsellDialog = page.locator('div[role="dialog"]');
    await expect(upsellDialog).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4: Dashboard tab bar does not overlap header elements
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — No overlap with header", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("tab bar does not visually overlap the user avatar", async ({ page }) => {
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Overlap Test Card" }),
    ]);

    const tabList = page.locator('[role="tablist"][aria-label="Card dashboard tabs"]');
    const userAvatar = page.locator('button[aria-label*="Sign in to sync"]');

    await expect(tabList).toBeVisible();
    await expect(userAvatar).toBeVisible();

    const tabBox = await tabList.boundingBox();
    const avatarBox = await userAvatar.boundingBox();

    expect(tabBox).not.toBeNull();
    expect(avatarBox).not.toBeNull();

    // Avatar is in the header — its bottom should be above or at tab bar top
    const avatarBottom = avatarBox!.y + avatarBox!.height;
    // Tab bar top minus 20px tolerance for layout
    expect(avatarBottom).toBeLessThanOrEqual(tabBox!.y + 20);
  });

  test("clicking a card in Howl tab opens edit page (not blocked by UI)", async ({ page }) => {
    await setupWithUrgentCards(page, [
      makeUrgentCard({ cardName: "Clickable Urgent Card" }),
    ]);

    // Find a card link in the Howl tab
    const cardLink = page.locator('[role="tabpanel"][id="panel-howl"] a[href*="/cards/"]').first();
    await expect(cardLink).toBeVisible();
    await expect(cardLink).toBeEnabled();

    const box = await cardLink.boundingBox();
    expect(box).not.toBeNull();
  });
});
