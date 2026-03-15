/**
 * Edit Card Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Trimmed to 1 core test per issue #613:
 *   1. Edit card happy path: update name, save, new name visible on dashboard
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

test("updated card name is visible on dashboard after save", async ({
  page,
}) => {
  const card = makeCard({ cardName: "Before Update" });
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
  await page.reload({ waitUntil: "load" });

  await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "load" });

  const newName = `After Update ${Date.now()}`;
  await page.locator("#cardName").fill(newName);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL("**/ledger", { timeout: 5000 });
  await expect(page.locator(`text=${newName}`).first()).toBeVisible();
});
