/**
 * Add Card Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Trimmed to 1 core test per issue #613:
 *   1. Add card happy path: fill form, save, card appears on dashboard
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
