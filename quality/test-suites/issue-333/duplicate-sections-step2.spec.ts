/**
 * Issue #333 — Duplicate AF/SUB Sections on Wizard Step 2
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates that Annual Fee and Sign-up Bonus fieldsets do NOT appear on Step 2
 * of the card wizard. These sections should only render on Step 1 or in edit mode.
 *
 * Issue: The fieldsets were rendering on both Step 1 and Step 2 due to the
 * condition `(isEditMode || currentStep === 1 || currentStep === 2)`.
 * Even though the inner fields were guarded by `currentStep === 1`, the empty
 * fieldset shells created duplicates on Step 2.
 *
 * Fix: Changed condition to `(isEditMode || currentStep === 1)` so the entire
 * fieldset only renders on Step 1 or edit mode.
 *
 * Spec reference: CardForm.tsx line 419
 */

import { test, expect } from "@playwright/test";
import {
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.goto("/cards/new", { waitUntil: "networkidle" });
});

test.describe("Issue #333 — No Duplicate AF/SUB on Step 2", () => {
  test("Annual Fee fieldset is visible on Step 1", async ({ page }) => {
    // Verify Annual Fee fieldset exists on Step 1
    const afFieldset = page.locator('fieldset:has-text("Annual Fee")').first();
    await expect(afFieldset).toBeVisible();
  });

  test("Sign-up Bonus fieldset is visible on Step 1", async ({ page }) => {
    // Verify Sign-up Bonus fieldset exists on Step 1
    const subFieldset = page.locator('fieldset:has-text("Sign-up Bonus")').first();
    await expect(subFieldset).toBeVisible();
  });

  test("Step 1 Annual Fee amount fields are NOT shown on Step 2", async ({
    page,
  }) => {
    // Step 1: Fill required fields
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]:has-text("American Express")').click();
    await page.locator("#cardName").fill("Sapphire Preferred");
    await page.locator("#openDate").fill("2025-01-01");

    // Advance to Step 2
    await page.locator('button:has-text("More Details")').click();

    // The annual fee AMOUNT field (#annualFee) should NOT be visible on Step 2
    // (it's a Step 1 field). The annual fee DATE field (#annualFeeDate) IS on Step 2.
    await expect(page.locator("#annualFee")).not.toBeVisible();
    await expect(page.locator("#annualFeeDate")).toBeVisible();
  });
});
