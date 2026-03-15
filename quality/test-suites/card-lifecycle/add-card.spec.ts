/**
 * Add Card Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Test cases:
 *   1. Add card happy path: fill form, save, card appears on dashboard
 *   2. Thrall tier card limit (issue #643): max 5 cards, 6th blocked with upsell
 *
 * Data isolation: clearAllStorage() before each test.
 */

import { test, expect } from "../helpers/analytics-block";
import {
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/ledger");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.goto("/ledger/cards/new", { waitUntil: "load" });
});

test("new card appears on dashboard after creation", async ({ page }) => {
  const uniqueName = `QA Card ${Date.now()}`;

  await page.locator("#issuerId").click();
  await page.locator('[role="option"]').first().click();

  await page.locator("#cardName").fill(uniqueName);
  await page.locator("#openDate").fill("2024-06-01");

  await page.locator('button[type="submit"]').click();

  await page.waitForURL("**/ledger", { timeout: 5000 });
  await expect(page.locator(`text=${uniqueName}`).first()).toBeVisible();
});

test.describe("Thrall card limit enforcement (issue #643)", () => {
  const addCardWithName = async (page: any, name: string) => {
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();
    await page.locator("#cardName").fill(name);
    await page.locator("#openDate").fill("2024-06-01");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/ledger", { timeout: 5000 });
  };

  test("allows exactly 5 cards on Thrall tier", async ({ page }) => {
    // Add 5 cards (at limit)
    for (let i = 1; i <= 5; i++) {
      await page.goto("/ledger/cards/new", { waitUntil: "load" });
      await addCardWithName(page, `Card ${i}`);
      await expect(page.locator(`text=Card ${i}`).first()).toBeVisible();
    }

    // Verify all 5 cards visible
    await page.goto("/ledger", { waitUntil: "load" });
    for (let i = 1; i <= 5; i++) {
      await expect(page.locator(`text=Card ${i}`).first()).toBeVisible();
    }
  });

  test("blocks 6th card on Thrall tier with upsell message", async ({ page }) => {
    // Add 5 cards first
    for (let i = 1; i <= 5; i++) {
      await page.goto("/ledger/cards/new", { waitUntil: "load" });
      await addCardWithName(page, `Card ${i}`);
    }

    // Verify dashboard shows 5 cards
    await page.goto("/ledger", { waitUntil: "load" });
    for (let i = 1; i <= 5; i++) {
      await expect(page.locator(`text=Card ${i}`).first()).toBeVisible();
    }

    // Try to add 6th card
    await page.goto("/ledger/cards/new", { waitUntil: "load" });
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();
    await page.locator("#cardName").fill("Card 6");
    await page.locator("#openDate").fill("2024-06-01");
    await page.locator('button[type="submit"]').click();

    // Should be blocked: either error message appears or 6th card is not in dashboard
    // First, wait a moment to see if error message appears
    const errorToast = page.locator('text=/Thrall.*5|Karl|Upgrade|limit/i').first();
    const toastExists = await errorToast.isVisible({ timeout: 2000 }).catch(() => false);

    if (!toastExists) {
      // If no error toast, verify the 6th card was not saved to dashboard
      await page.goto("/ledger", { waitUntil: "load" });
      // Card 6 should NOT appear in the main active tab (use getByRole to be specific)
      const mainGridArea = page.locator('[role="tabpanel"]:not([hidden])');
      await expect(mainGridArea.locator(`text=Card 6`)).not.toBeVisible();
      // Still only 5 cards visible
      for (let i = 1; i <= 5; i++) {
        await expect(page.locator(`text=Card ${i}`).first()).toBeVisible();
      }
    }
  });
});
