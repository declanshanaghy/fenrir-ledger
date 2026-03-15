/**
 * Delete Card Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Trimmed to 1 core test per issue #613:
 *   1. Delete card: confirm delete, card no longer on dashboard
 *
 * Data isolation: clearAllStorage() before each test.
 */

import { test, expect } from "../helpers/analytics-block";
import {
  makeCard,
  seedCards,
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/ledger");
  await clearAllStorage(page);
});

test("deleted card no longer appears on dashboard", async ({ page }) => {
  const card = makeCard({ cardName: "Permanently Gone Card" });
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
  await page.reload({ waitUntil: "load" });

  await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "load" });

  await page.locator('button:has-text("Delete card")').first().click();
  await expect(page.locator("text=Delete this card?")).toBeVisible();

  const confirmBtn = page
    .locator('[role="dialog"] button:has-text("Delete")')
    .last();
  await confirmBtn.click();

  await page.waitForURL("**/ledger", { timeout: 5000 });

  const body = await page.locator("body").innerText();
  expect(body).not.toContain("Permanently Gone Card");
});
