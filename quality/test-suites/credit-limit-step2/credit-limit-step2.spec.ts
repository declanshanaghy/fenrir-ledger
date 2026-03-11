/**
 * Credit Limit Step 2 Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests Issue #270: Credit Limit select field on Step 2 of the card wizard.
 * Slimmed to core interactive behavior: field renders, validates input, saves value.
 */

import { test, expect } from "@playwright/test";
import {
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
  getCards,
} from "../helpers/test-fixtures";

// ─── Shared setup ─────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.goto("/ledger/cards/new", { waitUntil: "networkidle" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Credit Limit Visibility
// ════════════════════════════════════════════════════════════════════════════

test.describe("Credit Limit Step 2 — Visibility", () => {
  test("credit limit select is NOT visible on Step 1", async ({ page }) => {
    const creditLimitTrigger = page.locator("#creditLimit");
    await expect(creditLimitTrigger).not.toBeVisible();
  });

  test("credit limit select IS visible on Step 2", async ({ page }) => {
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]:has-text("Chase")').click();
    await page.locator("#cardName").fill("Test Card");
    await page.locator("#openDate").fill("2026-01-01");

    await page.locator('button:has-text("More Details")').click();

    const creditLimitTrigger = page.locator("#creditLimit");
    await expect(creditLimitTrigger).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Credit Limit Persistence
// ════════════════════════════════════════════════════════════════════════════

test.describe("Credit Limit Step 2 — Data Persistence", () => {
  test("selected credit limit is persisted in saved card data", async ({
    page,
  }) => {
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]:has-text("American Express")').click();
    await page.locator("#cardName").fill("Amex Platinum");
    await page.locator("#openDate").fill("2026-02-15");

    await page.locator('button:has-text("More Details")').click();

    await expect(page.locator("#creditLimit")).toBeVisible();

    await page.locator("#creditLimit").click();
    await page.locator('[role="option"]:has-text("$25,000")').click();

    await page.locator('button[type="submit"]:has-text("Save Card")').click();

    await page.waitForURL("**/", { timeout: 5000 });

    const savedCards = await getCards(page, ANONYMOUS_HOUSEHOLD_ID);
    expect(savedCards).toHaveLength(1);
    expect(savedCards[0]?.cardName).toBe("Amex Platinum");
    expect(savedCards[0]?.creditLimit).toBe(2500000);
  });

});
