/**
 * Fee and Bonus Fields on Step 2 Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests Issue #271: Wizard Step 2 visibility and editability of Annual Fee Date,
 * Bonus Deadline, and Bonus Met checkbox fields.
 *
 * Spec references (CardForm.tsx):
 *   - Annual Fee Date: rendered when (isEditMode || currentStep === 2)
 *   - Bonus Deadline: rendered when (isEditMode || currentStep === 2)
 *   - Bonus Met checkbox: rendered when (isEditMode || currentStep === 2)
 *   - "More Details" button advances from Step 1 to Step 2
 *
 * Acceptance Criteria (Issue #271):
 *   - Annual Fee Date input is visible and editable on Step 2
 *   - Bonus Deadline input is visible and editable on Step 2
 *   - Bonus Met checkbox is visible and interactive on Step 2
 *
 * Data isolation: clearAllStorage() is called before each test. seedHousehold()
 * ensures the app has a valid householdId before the form loads.
 */

import { test, expect } from "@playwright/test";
import {
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ─── Shared setup ─────────────────────────────────────────────────────────────
// Every test starts from a clean state with a known household.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  // Navigate to new card form
  await page.goto("/cards/new", { waitUntil: "networkidle" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Step 2 Navigation and Field Visibility
// ════════════════════════════════════════════════════════════════════════════

test.describe("Fee and Bonus Fields on Step 2 — Navigation", () => {
  test("More Details button advances from Step 1 to Step 2", async ({
    page,
  }) => {
    // Spec: CardForm.tsx handleMoreDetails() calls setCurrentStep(2)
    // Fill required Step 1 fields first
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill("Test Card for Step 2");
    await page.locator("#openDate").fill("2024-01-15");

    // Click "More Details" button
    const moreDetailsBtn = page.locator('button:has-text("More Details")');
    await expect(moreDetailsBtn).toBeVisible();
    await moreDetailsBtn.click();

    // After advancing to Step 2, step 2 fields should be visible
    await expect(page.locator("#creditLimit")).toBeVisible();
  });

  test("Annual Fee Date field is visible on Step 2", async ({ page }) => {
    // Spec: CardForm.tsx — Annual Fee Date rendered when (isEditMode || currentStep === 2)
    // Fill required Step 1 fields
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill("Card with Fee Date");
    await page.locator("#openDate").fill("2024-01-15");

    // Advance to Step 2
    await page.locator('button:has-text("More Details")').click();

    // Annual Fee Date input should now be visible
    const annualFeeDateInput = page.locator("#annualFeeDate");
    await expect(annualFeeDateInput).toBeVisible();
  });

  test("Bonus Deadline field is visible on Step 2", async ({ page }) => {
    // Spec: CardForm.tsx — Bonus Deadline rendered when (isEditMode || currentStep === 2)
    // Fill required Step 1 fields
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill("Card with Bonus Deadline");
    await page.locator("#openDate").fill("2024-01-15");

    // Advance to Step 2
    await page.locator('button:has-text("More Details")').click();

    // Bonus Deadline input should now be visible
    const bonusDeadlineInput = page.locator("#bonusDeadline");
    await expect(bonusDeadlineInput).toBeVisible();
  });

  test("Bonus Met checkbox is visible on Step 2", async ({ page }) => {
    // Spec: CardForm.tsx — Bonus Met checkbox rendered when (isEditMode || currentStep === 2)
    // Fill required Step 1 fields
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill("Card with Bonus Status");
    await page.locator("#openDate").fill("2024-01-15");

    // Advance to Step 2
    await page.locator('button:has-text("More Details")').click();

    // Bonus Met checkbox should now be visible
    const bonusMetCheckbox = page.locator("#bonusMet");
    await expect(bonusMetCheckbox).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Field Editability on Step 2
// ════════════════════════════════════════════════════════════════════════════

test.describe("Fee and Bonus Fields on Step 2 — Editability", () => {
  test("Annual Fee Date field is editable on Step 2", async ({ page }) => {
    // Spec: CardForm.tsx — Annual Fee Date input has no disabled attribute on Step 2
    // Fill required Step 1 fields
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill("Editable Fee Date Card");
    await page.locator("#openDate").fill("2024-01-15");

    // Advance to Step 2
    await page.locator('button:has-text("More Details")').click();

    // Annual Fee Date should be editable
    const annualFeeDateInput = page.locator("#annualFeeDate");
    await annualFeeDateInput.fill("2025-03-15");

    // Verify the value was set
    await expect(annualFeeDateInput).toHaveValue("2025-03-15");
  });

  test("Bonus Deadline field is editable on Step 2", async ({ page }) => {
    // Spec: CardForm.tsx — Bonus Deadline input has no disabled attribute on Step 2
    // Fill required Step 1 fields
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill("Editable Bonus Deadline Card");
    await page.locator("#openDate").fill("2024-01-15");

    // Advance to Step 2
    await page.locator('button:has-text("More Details")').click();

    // Bonus Deadline should be editable
    const bonusDeadlineInput = page.locator("#bonusDeadline");
    await bonusDeadlineInput.fill("2024-12-31");

    // Verify the value was set
    await expect(bonusDeadlineInput).toHaveValue("2024-12-31");
  });

  test("Bonus Met checkbox is interactive on Step 2", async ({ page }) => {
    // Spec: CardForm.tsx — Bonus Met checkbox can be toggled on Step 2
    // Fill required Step 1 fields
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill("Interactive Bonus Met Card");
    await page.locator("#openDate").fill("2024-01-15");

    // Advance to Step 2
    await page.locator('button:has-text("More Details")').click();

    // Bonus Met checkbox should be clickable and toggleable
    const bonusMetCheckbox = page.locator("#bonusMet");
    const initialState = await bonusMetCheckbox.isChecked();

    // Click to toggle
    await bonusMetCheckbox.click();

    // Verify the state changed
    const finalState = await bonusMetCheckbox.isChecked();
    expect(finalState).not.toBe(initialState);
  });
});

