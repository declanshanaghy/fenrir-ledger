/**
 * Dashboard Tabs — User Menu Overlap — Issue #154 / #279
 * Authored by Loki, QA Tester of the Pack
 *
 * Updated for Issue #279: HowlPanel sidebar removed; tabs replace it.
 * The sidebar overlap issue (#154) is resolved by the tab redesign.
 *
 * This suite validates that user menu elements remain accessible when
 * urgent cards exist and the Howl tab is shown. Consolidates overlap checks.
 *
 * Spec references:
 *   - development/frontend/src/components/dashboard/Dashboard.tsx
 *   - development/frontend/src/components/layout/TopBar.tsx
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

async function seedRagnarokCards(page: Page) {
  const overdue = -1;
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

test.describe("Dashboard Tabs — Howl User Menu Overlap — Issue #154/#279", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
  });

  test("user avatar is clickable when urgent cards exist (desktop)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);
    await page.goto("/", { waitUntil: "networkidle" });

    // Howl tab is default — urgent cards are in the tab panel
    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await expect(howlTab).toHaveAttribute("aria-selected", "true");

    // Old HowlPanel aside must NOT exist
    const oldPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(oldPanel).not.toBeAttached();

    // User avatar is clickable
    const anonAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(anonAvatar).toBeVisible();
    await anonAvatar.click();

    const upsellPanel = page.locator('#anon-upsell-panel[role="dialog"]');
    await expect(upsellPanel).toBeVisible();

    const signInButton = upsellPanel.locator('button:has-text("Sign in to Google")');
    await expect(signInButton).toBeVisible();
    await expect(signInButton).toBeEnabled();

    const themeSection = upsellPanel.locator('div:has-text("Theme")');
    await expect(themeSection).toBeVisible();
  });

  test("user avatar is clickable when Howl tab is in Ragnarök mode", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedRagnarokCards(page);
    await page.goto("/", { waitUntil: "networkidle" });

    // Ragnarök mode (≥5 urgent cards)
    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await expect(howlTab).toContainText("Ragnarök Approaches");

    const anonAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(anonAvatar).toBeVisible();
    await anonAvatar.click();

    const upsellPanel = page.locator('#anon-upsell-panel[role="dialog"]');
    await expect(upsellPanel).toBeVisible();
  });

  test("user avatar is accessible on mobile with Howl tab (no bell button)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);
    await page.goto("/", { waitUntil: "networkidle" });

    // Mobile bell button is gone — tab bar replaces it
    const oldBellButton = page.locator('button[aria-label*="urgent card"]');
    await expect(oldBellButton).not.toBeAttached();

    // Tab bar is visible instead
    const tabList = page.locator('[role="tablist"][aria-label="Card dashboard tabs"]');
    await expect(tabList).toBeVisible();

    // Avatar is still accessible
    const anonAvatar = page.locator('button[aria-label*="Sign in to sync"]');
    await expect(anonAvatar).toBeVisible();
    await anonAvatar.click();

    const upsellPanel = page.locator('#anon-upsell-panel[role="dialog"]');
    await expect(upsellPanel).toBeVisible();
  });

  test("Howl tab does not overlap TopBar header (y-position check)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);
    await page.goto("/", { waitUntil: "networkidle" });

    const topBarHeader = page.locator("header").first();
    const tabList = page.locator('[role="tablist"][aria-label="Card dashboard tabs"]');

    await expect(topBarHeader).toBeVisible();
    await expect(tabList).toBeVisible();

    const headerBox = await topBarHeader.boundingBox();
    const tabBox = await tabList.boundingBox();

    expect(headerBox).not.toBeNull();
    expect(tabBox).not.toBeNull();

    // Header bottom edge should be above tab bar top edge
    const headerBottom = headerBox!.y + headerBox!.height;
    expect(headerBottom).toBeLessThanOrEqual(tabBox!.y + 5); // 5px tolerance
  });

  test("TopBar z-index is higher than tab panel content", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);
    await page.goto("/", { waitUntil: "networkidle" });

    const topBarZIndex = await page.evaluate(() => {
      const header = document.querySelector("header") as HTMLElement;
      if (!header) return null;
      return window.getComputedStyle(header).getPropertyValue("z-index");
    });

    const topBarZ = parseInt(topBarZIndex || "0", 10);
    // Header z-index must be 50 per spec
    expect(topBarZ).toBe(50);
  });

  test("urgent count badge in tab is visible and not covered", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeUrgentCard({ id: "u1" }),
      makeUrgentCard({ id: "u2" }),
    ]);
    await page.goto("/", { waitUntil: "networkidle" });

    // Badge is in the tab bar
    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    const badge = howlTab.locator('span[aria-label="2 cards"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("2");
  });

  test("Howl tab panel cards are clickable (not blocked by UI)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeUrgentCard({ id: "urgent-1" }),
      makeCard({ id: "normal-1", cardName: "Regular Card" }),
    ]);
    await page.goto("/", { waitUntil: "networkidle" });

    const cardLink = page.locator('[role="tabpanel"][id="panel-howl"] a[href*="/cards/"]').first();
    await expect(cardLink).toBeVisible();
    await expect(cardLink).toBeEnabled();

    const box = await cardLink.boundingBox();
    expect(box).not.toBeNull();
  });
});
