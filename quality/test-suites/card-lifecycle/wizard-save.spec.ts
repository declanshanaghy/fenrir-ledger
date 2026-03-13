/**
 * Wizard Save Flow — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Consolidated from wizard-step2 per issue #613:
 *   1. Save card from Step 2 persists to dashboard (localStorage round-trip)
 *
 * Data isolation: clearAllStorage() before each test.
 */

import { test, expect } from "@playwright/test";
import {
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/ledger");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
});

test("Save Card from Step 2 persists card to dashboard", async ({ page }) => {
  const cardName = `Step2SavedCard${Date.now()}`;

  await page.goto("/ledger/cards/new", { waitUntil: "domcontentloaded" });
  await page.locator("#cardName").waitFor({ state: "visible", timeout: 15000 });

  await page.locator("#issuerId").click();
  await page.locator('[role="option"]').first().click();
  await page.locator("#cardName").fill(cardName);

  await page.locator('button:has-text("More Details")').click();
  await page
    .locator('button:has-text("More Details")')
    .waitFor({ state: "hidden", timeout: 5000 });

  await page.locator("#notes").fill("Gleipnir binds even gods");

  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/ledger", { timeout: 5000 });
  await expect(page.locator(`text=${cardName}`).first()).toBeVisible();
});
