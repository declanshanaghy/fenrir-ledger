/**
 * footer.spec.ts — Issue #813 regression: Footer missing on /ledger pages
 *
 * Written by Loki, QA Tester. 2 E2E tests only — browser required to validate
 * that the footer actually renders in the live ledger layout.
 *
 * Budget: small fix (2 files) → max 2 Playwright tests.
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

test("footer is visible on /ledger dashboard", async ({ page }) => {
  await page.goto("/ledger");
  await page.waitForLoadState("load");

  const footer = page.getByRole("contentinfo", { name: "App footer" });
  await expect(footer).toBeVisible();
});

test("footer is visible on /ledger/cards and contains Loki trigger", async ({
  page,
}) => {
  await page.goto("/ledger/cards");
  await page.waitForLoadState("load");

  const footer = page.getByRole("contentinfo", { name: "App footer" });
  await expect(footer).toBeVisible();

  // Verify Loki easter egg trigger is present in the footer
  const lokiTrigger = page.locator("[data-loki-trigger]");
  await expect(lokiTrigger).toBeVisible();
});
