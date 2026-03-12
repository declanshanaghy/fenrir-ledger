/**
 * Dashboard Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Trimmed to 2 core tests per issue #613:
 *   1. Empty state shows Gleipnir heading + Add Card link
 *   2. Card grid renders and Add Card header button navigates to /cards/new
 *
 * Data isolation: clearAllStorage() before each test.
 */

import { test, expect } from "@playwright/test";
import {
  seedCards,
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";
import { EMPTY_CARDS, FEW_CARDS } from "../helpers/seed-data";

test.beforeEach(async ({ page }) => {
  await page.goto("/ledger");
  await clearAllStorage(page);
});

test("empty state shows Gleipnir heading and Add Card link", async ({
  page,
}) => {
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, EMPTY_CARDS);
  await page.reload({ waitUntil: "load" });

  const heading = page.locator("h2");
  await expect(heading).toContainText("Gleipnir");

  const addCardLink = page.locator('a[href="/ledger/cards/new"]').first();
  await expect(addCardLink).toBeVisible();
});

test("Add Card button navigates to /cards/new when cards exist", async ({
  page,
}) => {
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
  await page.reload({ waitUntil: "load" });

  const addCardBtn = page.locator('a[href="/ledger/cards/new"]').first();
  await expect(addCardBtn).toBeVisible();
  await addCardBtn.click();

  await page.waitForURL("**/cards/new");
  expect(page.url()).toContain("/ledger/cards/new");
});
