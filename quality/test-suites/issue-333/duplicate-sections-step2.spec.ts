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

  test("Annual Fee and Sign-up Bonus NOT duplicated on Step 2", async ({
    page,
  }) => {
    // Step 1: Fill required fields
    await page.locator("#issuerId").click();
    await page.locator("text=American Express").click();
    await page.locator("#cardName").fill("Sapphire Preferred");
    await page.locator("#openDate").fill("2025-01-01");

    // Advance to Step 2
    await page.locator("button:has-text('More Details')").click();
    await page.waitForURL("**/cards/new");

    // Count Annual Fee fieldsets on Step 2 — should be exactly 1
    // (only the one shown on Step 1 if rendered, but step 2 shouldn't render it)
    const afFieldsets = page.locator(
      'fieldset:has-text("Annual Fee")'
    );
    const afCount = await afFieldsets.count();

    // Count Sign-up Bonus fieldsets on Step 2 — should be exactly 1
    const subFieldsets = page.locator(
      'fieldset:has-text("Sign-up Bonus")'
    );
    const subCount = await subFieldsets.count();

    // On Step 2, we should NOT see the AF/SUB fieldsets at all
    // because they only render on Step 1 (currentStep === 1)
    // They should not render because the condition changed from
    // (isEditMode || currentStep === 1 || currentStep === 2)
    // to (isEditMode || currentStep === 1)
    expect(afCount).toBe(0);
    expect(subCount).toBe(0);
  });

  test("Annual Fee and Sign-up Bonus ARE present in edit mode (full page)", async ({
    page,
  }) => {
    // This test ensures the fix doesn't break edit mode
    // In edit mode, all fields should be visible on a single page
    // (not a step-based wizard)

    // First, create a card
    await page.locator("#issuerId").click();
    await page.locator("text=American Express").click();
    await page.locator("#cardName").fill("Test Card");
    await page.locator("#openDate").fill("2025-01-01");
    await page.locator("button:has-text('Save Card')").click();

    // Wait for redirect to home
    await page.waitForURL("/");

    // Click to edit the card
    await page.locator("text=Test Card").click();
    await page.waitForURL(/\/cards\/.*\/edit/);

    // In edit mode, both AF and SUB fieldsets should be visible
    const afFieldset = page.locator('fieldset:has-text("Annual Fee")');
    const subFieldset = page.locator('fieldset:has-text("Sign-up Bonus")');

    await expect(afFieldset).toBeVisible();
    await expect(subFieldset).toBeVisible();
  });

  test("No empty fieldset shells on Step 2", async ({ page }) => {
    // Verify there are no invisible/empty fieldsets on Step 2
    // that would create visual duplicates

    // Step 1: Fill required fields
    await page.locator("#issuerId").click();
    await page.locator("text=American Express").click();
    await page.locator("#cardName").fill("Sapphire Preferred");
    await page.locator("#openDate").fill("2025-01-01");

    // Advance to Step 2
    await page.locator("button:has-text('More Details')").click();
    await page.waitForURL("**/cards/new");

    // On Step 2, only Credit Limit fieldset and Annual Fee Date / Bonus Deadline
    // (from the step 2 sections) should be visible.
    // The old duplicate empty AF/SUB fieldsets should not exist.

    const creditLimitFieldset = page.locator(
      'fieldset:has-text("Card Details")'
    ).nth(1); // Second occurrence (step 2 card details)
    const annualFeeDateFieldset = page.locator(
      'fieldset:has-text("Annual Fee")'
    );
    const bonusDeadlineFieldset = page.locator(
      'fieldset:has-text("Sign-up Bonus")'
    );

    // On Step 2, Credit Limit should be visible
    await expect(creditLimitFieldset).toBeVisible();

    // Annual Fee and Sign-up Bonus fieldsets should NOT be present at all
    await expect(annualFeeDateFieldset).not.toBeVisible();
    await expect(bonusDeadlineFieldset).not.toBeVisible();
  });
});
