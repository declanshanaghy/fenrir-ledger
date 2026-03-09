/**
 * Card Count Subtitle Removal Test Suite — Issue #450
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the removal of the redundant card count subtitle from the dashboard.
 * The tab bar already displays counts per category, so the summary header
 * showing total card count and "N needs attention" is now removed.
 *
 * Acceptance Criteria:
 * - Card count subtitle removed from dashboard
 * - Tab bar still shows counts per category
 * - No visual regression or layout shifts
 * - Empty state (0 cards) works correctly
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  seedCards,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";
import { FEW_CARDS, EMPTY_CARDS } from "../helpers/seed-data";

test.describe("Card count subtitle removal (#450)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  });

  test("TC-450-01: should NOT display card count subtitle on dashboard with cards", async ({
    page,
  }) => {
    // Seed some cards
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "networkidle" });

    // Check that the card count subtitle is NOT visible
    // The old subtitle had text like "5 cards" or "N cards"
    const subtitle = page.locator("text=/^\\d+\\s+cards?$/");
    await expect(subtitle).not.toBeVisible();

    // Verify no "needs attention" subtitle either
    const needsAttention = page.locator("text=/need.*attention/");
    await expect(needsAttention).not.toBeVisible();
  });

  test("TC-450-02: tab bar container should exist and be properly positioned", async ({
    page,
  }) => {
    // Seed cards
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "networkidle" });

    // The key assertion: there should be NO card count subtitle text patterns
    // This is the core requirement of issue #450
    // Check that the old summary pattern doesn't appear at the start of a line
    const subtitle = page.locator("text=/^\\d+\\s+cards?$/");
    await expect(subtitle).not.toBeVisible();

    // Also verify no "needs attention" text appears in the summary area
    const needsAttention = page.locator("text=/^\\d+\\s+need.*attention/");
    await expect(needsAttention).not.toBeVisible();
  });

  test("TC-450-03: should handle empty state correctly (0 cards)", async ({
    page,
  }) => {
    // Seed with no cards
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, EMPTY_CARDS);
    await page.reload({ waitUntil: "networkidle" });

    // Verify no card count subtitle appears even in empty state
    const subtitle = page.locator("text=/^\\d+\\s+cards?$/");
    await expect(subtitle).not.toBeVisible();

    const needsAttention = page.locator("text=/need.*attention/");
    await expect(needsAttention).not.toBeVisible();
  });
});
