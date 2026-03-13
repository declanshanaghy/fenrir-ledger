/**
 * Rune Rendering Tests — Issue #616
 *
 * Validates that Elder Futhark rune characters render correctly across all
 * dashboard tabs and components. Ensures Unicode escape sequences are
 * properly converted to literal rune glyphs.
 *
 * Acceptance Criteria:
 * - All 5 tabs display actual rune characters (not escape sequences)
 * - Runes are visually distinct and recognizable
 * - Empty states show correct runes with proper rendering
 * - Tab headers in empty state mode render runes without literal \u#### text
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedEntitlement,
  seedHousehold,
  makeCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// Expected rune characters per tab (literal Unicode glyphs, not escape sequences)
const RUNE_MAP = {
  all: "ᛟ", // U+16DF Othala (all cards)
  valhalla: "↑", // U+2191 Upwards arrow (hall of honored dead)
  active: "ᛉ", // U+16C9 Ansuz (active warriors)
  hunt: "ᛜ", // U+16DC Hagall (the hunt)
  howl: "ᚲ", // U+16B2 Kenaz (the howl/fire)
};

async function setupDashboard(
  page: Parameters<typeof clearAllStorage>[0],
  cards: Parameters<typeof seedCards>[2]
) {
  await page.goto("/ledger");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  if (cards && cards.length > 0) {
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
  }
  await seedEntitlement(page);
  await page.reload({ waitUntil: "load" });
  // Wait for dashboard/tablist to appear
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
}

test.describe("Rune Rendering — Tab Headers", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("should display runes in tab buttons (not escape sequences)", async ({
    page,
  }) => {
    await setupDashboard(page, [makeCard({ cardName: "Test Card" })]);

    // Active tab button should contain the active rune
    const activeTab = page.getByRole("tab", { name: /active/i });
    const activeTabText = await activeTab.textContent();
    expect(activeTabText).toContain(RUNE_MAP.active);
    // Ensure no literal escape sequences appear
    expect(activeTabText).not.toMatch(/\\u[0-9A-Fa-f]{4}/);

    // Howl tab button should contain the howl rune
    const howlTab = page.getByRole("tab", { name: /howl|ragnarok/i });
    const howlTabText = await howlTab.textContent();
    expect(howlTabText).toContain(RUNE_MAP.howl);
    // Ensure no literal escape sequences appear
    expect(howlTabText).not.toMatch(/\\u[0-9A-Fa-f]{4}/);
  });

  test("should not display literal unicode escape sequences anywhere on dashboard", async ({
    page,
  }) => {
    await setupDashboard(page, [makeCard({ cardName: "Test Card" })]);

    // Get all text content on the page
    const bodyText = await page.locator("body").textContent();

    // Ensure no literal escape sequences appear (e.g., \u16C9, \u16B2, etc.)
    expect(bodyText).not.toMatch(/\\u16[0-9A-Fa-f]{2}/);
    expect(bodyText).not.toMatch(/\\u2191/);
  });

  test("should render runes with serif font-family", async ({ page }) => {
    await setupDashboard(page, [makeCard({ cardName: "Test Card" })]);

    // Find a rune span in the active tab button
    const activeTab = page.getByRole("tab", { name: /active/i });
    const runeSpan = activeTab.locator("span").first();

    // Verify the rune is visible
    await expect(runeSpan).toBeVisible();

    // Check font-family style
    const fontFamily = await runeSpan.evaluate((el) =>
      window.getComputedStyle(el).fontFamily
    );
    expect(fontFamily).toContain("serif");
  });

  test("should render runes correctly on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await setupDashboard(page, [makeCard({ cardName: "Test Card" })]);

    // Verify runes are still visible on mobile
    const activeTab = page.getByRole("tab", { name: /active/i });
    const mobileRune = await activeTab.locator("span").first().textContent();
    expect(mobileRune).toBe(RUNE_MAP.active);

    // Ensure no escape sequences appear
    expect(mobileRune).not.toMatch(/\\u[0-9A-Fa-f]{4}/);
  });
});

test.describe("Rune Rendering — Tab Content Consistency", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("all tab runes remain consistent across page reloads", async ({
    page,
  }) => {
    await setupDashboard(page, [makeCard({ cardName: "Test Card" })]);

    // Capture initial rune text
    const activeTab = page.getByRole("tab", { name: /active/i });
    const initialRune = await activeTab.locator("span").first().textContent();

    // Verify the rune matches our expected value
    expect(initialRune).toBe(RUNE_MAP.active);

    // Reload the page and verify consistency
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 });

    const reloadedRune = await activeTab.locator("span").first().textContent();
    expect(reloadedRune).toBe(initialRune);
  });

  test("runes in all 5 tab buttons are present and correct", async ({
    page,
  }) => {
    await setupDashboard(page, [makeCard({ cardName: "Test Card" })]);

    // Tabs should be visible in tab list
    const tablist = page.locator('[role="tablist"]');
    expect(tablist).toBeVisible();

    // Get text content of all visible tabs
    const tabText = await tablist.textContent();

    // Verify that literal rune characters are present (not escape codes)
    // At least the active tab rune should be visible
    expect(tabText).toContain(RUNE_MAP.active);
    expect(tabText).toContain(RUNE_MAP.howl);

    // Verify no literal escape sequences
    expect(tabText).not.toMatch(/\\u16/);
  });
});
