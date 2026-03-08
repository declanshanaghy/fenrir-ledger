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

    // After advancing to Step 2, the step indicator should show Step 2 highlighted
    // and Step 2-only fields should be visible
    const step2Indicator = page.locator("button").filter({ hasText: /^2$/ });
    await expect(step2Indicator).toBeVisible();
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

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Value Persistence Through Save
// ════════════════════════════════════════════════════════════════════════════

test.describe("Fee and Bonus Fields on Step 2 — Persistence", () => {
  test("Annual Fee Date value persists after saving card", async ({
    page,
  }) => {
    // Spec: CardForm.tsx onSubmit → saveCard() → localStorage
    // Fill Step 1 fields
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    const uniqueName = `Fee Date Persistence ${Date.now()}`;
    await page.locator("#cardName").fill(uniqueName);
    await page.locator("#openDate").fill("2024-01-15");

    // Advance to Step 2 and set fee date
    await page.locator('button:has-text("More Details")').click();
    await page.locator("#annualFeeDate").fill("2025-06-15");

    // Save the card
    await page.locator('button[type="submit"]').click();

    // Wait for navigation to dashboard
    await page.waitForURL("**/", { timeout: 5000 });

    // Navigate back to edit the card to verify the fee date persisted
    const editLink = page.locator(`a[href*="/cards/"][href*="/edit"]`).first();
    await editLink.click();

    await page.waitForURL("**/cards/**/edit", { timeout: 5000 });

    // Verify the annual fee date was saved
    const annualFeeDateInput = page.locator("#annualFeeDate");
    await expect(annualFeeDateInput).toHaveValue("2025-06-15");
  });

  test("Bonus Deadline value persists after saving card", async ({
    page,
  }) => {
    // Spec: CardForm.tsx onSubmit → saveCard() → localStorage
    // Fill Step 1 fields
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    const uniqueName = `Bonus Deadline Persistence ${Date.now()}`;
    await page.locator("#cardName").fill(uniqueName);
    await page.locator("#openDate").fill("2024-01-15");

    // Advance to Step 2 and set bonus deadline
    await page.locator('button:has-text("More Details")').click();
    await page.locator("#bonusDeadline").fill("2025-12-31");

    // Save the card
    await page.locator('button[type="submit"]').click();

    // Wait for navigation to dashboard
    await page.waitForURL("**/", { timeout: 5000 });

    // Navigate back to edit the card to verify the deadline persisted
    const editLink = page.locator(`a[href*="/cards/"][href*="/edit"]`).first();
    await editLink.click();

    await page.waitForURL("**/cards/**/edit", { timeout: 5000 });

    // Verify the bonus deadline was saved
    const bonusDeadlineInput = page.locator("#bonusDeadline");
    await expect(bonusDeadlineInput).toHaveValue("2025-12-31");
  });

  test("Bonus Met checkbox state persists after saving card", async ({
    page,
  }) => {
    // Spec: CardForm.tsx onSubmit → saveCard() → localStorage
    // Fill Step 1 fields
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    const uniqueName = `Bonus Met Persistence ${Date.now()}`;
    await page.locator("#cardName").fill(uniqueName);
    await page.locator("#openDate").fill("2024-01-15");

    // Advance to Step 2 and check the bonus met checkbox
    await page.locator('button:has-text("More Details")').click();
    const bonusMetCheckbox = page.locator("#bonusMet");

    // Ensure it's checked
    if (!(await bonusMetCheckbox.isChecked())) {
      await bonusMetCheckbox.click();
    }

    // Save the card
    await page.locator('button[type="submit"]').click();

    // Wait for navigation to dashboard
    await page.waitForURL("**/", { timeout: 5000 });

    // Navigate back to edit the card to verify the bonus met state persisted
    const editLink = page.locator(`a[href*="/cards/"][href*="/edit"]`).first();
    await editLink.click();

    await page.waitForURL("**/cards/**/edit", { timeout: 5000 });

    // Verify the bonus met checkbox is still checked
    const savedBonusMetCheckbox = page.locator("#bonusMet");
    await expect(savedBonusMetCheckbox).toBeChecked();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Edit Mode Shows All Fields (including Step 2 fields)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Fee and Bonus Fields in Edit Mode", () => {
  test("Edit mode shows Annual Fee Date field without wizard steps", async ({
    page,
  }) => {
    // Spec: CardForm.tsx — Annual Fee Date rendered when (isEditMode || currentStep === 2)
    // In edit mode, isEditMode=true so all fields show without needing Step 2
    const uniqueName = `Edit Mode Fee Date ${Date.now()}`;

    // Create a card first
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill(uniqueName);
    await page.locator("#openDate").fill("2024-01-15");

    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/", { timeout: 5000 });

    // Navigate to edit page
    const editLink = page.locator(`a[href*="/cards/"][href*="/edit"]`).first();
    await editLink.click();

    await page.waitForURL("**/cards/**/edit", { timeout: 5000 });

    // In edit mode, Annual Fee Date should be visible without needing Step 2
    const annualFeeDateInput = page.locator("#annualFeeDate");
    await expect(annualFeeDateInput).toBeVisible();
  });

  test("Edit mode shows Bonus Deadline field without wizard steps", async ({
    page,
  }) => {
    // Spec: CardForm.tsx — Bonus Deadline rendered when (isEditMode || currentStep === 2)
    const uniqueName = `Edit Mode Bonus Deadline ${Date.now()}`;

    // Create a card first
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill(uniqueName);
    await page.locator("#openDate").fill("2024-01-15");

    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/", { timeout: 5000 });

    // Navigate to edit page
    const editLink = page.locator(`a[href*="/cards/"][href*="/edit"]`).first();
    await editLink.click();

    await page.waitForURL("**/cards/**/edit", { timeout: 5000 });

    // In edit mode, Bonus Deadline should be visible without needing Step 2
    const bonusDeadlineInput = page.locator("#bonusDeadline");
    await expect(bonusDeadlineInput).toBeVisible();
  });

  test("Edit mode shows Bonus Met checkbox without wizard steps", async ({
    page,
  }) => {
    // Spec: CardForm.tsx — Bonus Met checkbox rendered when (isEditMode || currentStep === 2)
    const uniqueName = `Edit Mode Bonus Met ${Date.now()}`;

    // Create a card first
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill(uniqueName);
    await page.locator("#openDate").fill("2024-01-15");

    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/", { timeout: 5000 });

    // Navigate to edit page
    const editLink = page.locator(`a[href*="/cards/"][href*="/edit"]`).first();
    await editLink.click();

    await page.waitForURL("**/cards/**/edit", { timeout: 5000 });

    // In edit mode, Bonus Met checkbox should be visible without needing Step 2
    const bonusMetCheckbox = page.locator("#bonusMet");
    await expect(bonusMetCheckbox).toBeVisible();
  });
});
