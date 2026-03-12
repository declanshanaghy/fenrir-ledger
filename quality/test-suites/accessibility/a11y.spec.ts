/**
 * Accessibility Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Trimmed to 2 core a11y gate tests per issue #613:
 *   1. Dashboard heading hierarchy (WCAG 2.4.6)
 *   2. Card form field labels (WCAG 1.3.1)
 *
 * Data isolation: clearAllStorage() + seedHousehold() before each test.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  seedCards,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";
import { FEW_CARDS } from "../helpers/seed-data";

test.describe("Accessibility Gates", () => {
  test("TC-A05: dashboard has h1 with correct text", async ({ page }) => {
    await page.goto("/ledger");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "load" });

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("The Ledger of Fates");
  });

  test("TC-A08: card form fields have associated labels", async ({ page }) => {
    await page.goto("/ledger");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/cards/new");
    await page.waitForSelector("form", { timeout: 5000 });

    const step1Pairs: Array<{ labelFor: string; inputId: string }> = [
      { labelFor: "issuerId", inputId: "issuerId" },
      { labelFor: "cardName", inputId: "cardName" },
      { labelFor: "openDate", inputId: "openDate" },
      { labelFor: "annualFee", inputId: "annualFee" },
      { labelFor: "bonusType", inputId: "bonusType" },
    ];

    for (const { labelFor, inputId } of step1Pairs) {
      const label = page.locator(`label[for="${labelFor}"]`);
      await expect(label).toBeAttached();
      const input = page.locator(`#${inputId}`);
      await expect(input).toBeAttached();
    }
  });
});
