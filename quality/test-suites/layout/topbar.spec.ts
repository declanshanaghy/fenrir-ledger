/**
 * TopBar Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Trimmed to 1 core test per issue #613:
 *   1. Anonymous avatar click opens upsell panel
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/ledger");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.reload({ waitUntil: "load" });
});

test("clicking anonymous avatar opens the upsell prompt panel", async ({
  page,
}) => {
  const avatarButton = page.locator(
    'header button[aria-label="Sign in to sync your data"]'
  );
  await avatarButton.click();

  const upsellPanel = page.locator(
    '[role="dialog"][aria-label="Sign in to sync"]'
  );
  await expect(upsellPanel).toBeVisible();
});
