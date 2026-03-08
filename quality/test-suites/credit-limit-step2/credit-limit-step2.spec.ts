/**
 * Credit Limit Step 2 Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests Issue #270: Credit Limit select field visibility on Step 2 of the card wizard.
 *
 * Acceptance Criteria:
 * - Credit Limit select is visible and interactive on Step 2
 * - Selected credit limit value is included in the saved card data
 * - Credit Limit is not visible on Step 1
 *
 * Spec references:
 *   - CardForm.tsx: Credit Limit fieldset only renders when currentStep === 2 or isEditMode
 *   - CardForm.tsx line 414-443: Credit Limit fieldset with legend "Credit Limit"
 *   - CardForm.tsx line 420-436: Select with options from $0 to $95,000
 *   - storage.ts: saveCard() persists card data including creditLimit
 *
 * Data isolation: clearAllStorage() before each test; seedHousehold() sets up context.
 * Each test flows through the wizard: fill Step 1, click "More Details" to reach Step 2.
 */

import { test, expect } from "@playwright/test";
import {
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
  getCards,
} from "../helpers/test-fixtures";

// ─── Shared setup ─────────────────────────────────────────────────────────────
// Every credit-limit-step2 test starts from clean state with a known household.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  // Navigate directly to the add form
  await page.goto("/cards/new", { waitUntil: "networkidle" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Credit Limit Hidden on Step 1
// ════════════════════════════════════════════════════════════════════════════

test.describe("Credit Limit Step 2 — Step 1 Isolation", () => {
  test("credit limit select is NOT visible on Step 1", async ({ page }) => {
    // Spec: CardForm.tsx line 414 — Credit Limit fieldset only renders
    // when (isEditMode || currentStep === 2), so Step 1 should not show it.
    const creditLimitTrigger = page.locator("#creditLimit");
    await expect(creditLimitTrigger).not.toBeVisible();
  });

  test("credit limit legend is NOT visible on Step 1", async ({ page }) => {
    // Ensure the entire Credit Limit fieldset is not rendered on Step 1
    const creditLimitLegend = page.locator(
      'legend:has-text("Credit Limit")'
    );
    await expect(creditLimitLegend).not.toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Credit Limit Visible on Step 2
// ════════════════════════════════════════════════════════════════════════════

test.describe("Credit Limit Step 2 — Step 2 Visibility", () => {
  test("credit limit select IS visible on Step 2", async ({ page }) => {
    // Spec: CardForm.tsx line 414-415 — Credit Limit fieldset renders
    // when currentStep === 2. Flow: fill Step 1, click "More Details".
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]:has-text("Chase")').click();
    await page.locator("#cardName").fill("Test Card");
    await page.locator("#openDate").fill("2026-01-01");

    // Navigate to Step 2
    await page.locator('button:has-text("More Details")').click();

    // Step 2 should now show the Credit Limit select
    const creditLimitTrigger = page.locator("#creditLimit");
    await expect(creditLimitTrigger).toBeVisible();
  });

  test("credit limit legend is visible on Step 2", async ({ page }) => {
    // Ensure the Credit Limit fieldset legend is rendered on Step 2
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]:has-text("Chase")').click();
    await page.locator("#cardName").fill("Test Card");
    await page.locator("#openDate").fill("2026-01-01");

    // Navigate to Step 2
    await page.locator('button:has-text("More Details")').click();

    const creditLimitLegend = page.locator(
      'legend:has-text("Credit Limit")'
    );
    await expect(creditLimitLegend).toBeVisible();
  });

  test("credit limit dropdown contains expected values", async ({ page }) => {
    // Spec: CardForm.tsx line 427-434 — Select options from $0 (Not set) to $95,000
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]:has-text("Chase")').click();
    await page.locator("#cardName").fill("Test Card");
    await page.locator("#openDate").fill("2026-01-01");

    // Navigate to Step 2
    await page.locator('button:has-text("More Details")').click();

    // Open the credit limit dropdown
    await page.locator("#creditLimit").click();

    // Verify some key option values exist
    await expect(page.locator('[role="option"]:has-text("Not set")')).toBeVisible();
    await expect(page.locator('[role="option"]:has-text("$1,000")')).toBeVisible();
    await expect(page.locator('[role="option"]:has-text("$5,000")')).toBeVisible();
    await expect(page.locator('[role="option"]:has-text("$10,000")')).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Credit Limit Persistence
// ════════════════════════════════════════════════════════════════════════════

test.describe("Credit Limit Step 2 — Data Persistence", () => {
  test("selected credit limit is persisted in saved card data", async ({
    page,
  }) => {
    // Spec: CardForm.tsx onSubmit → saveCard() persists all form data
    // including creditLimit (line 69-76, creditLimit field in schema)
    // Flow: fill Step 1, go to Step 2, select credit limit, save card, verify in storage.

    // Fill Step 1
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]:has-text("American Express")').click();
    await page.locator("#cardName").fill("Amex Platinum");
    await page.locator("#openDate").fill("2026-02-15");

    // Navigate to Step 2
    await page.locator('button:has-text("More Details")').click();

    // Verify we're on Step 2 now
    await expect(page.locator("#creditLimit")).toBeVisible();

    // Select a credit limit
    await page.locator("#creditLimit").click();
    await page.locator('[role="option"]:has-text("$25,000")').click();

    // Save the card
    await page.locator('button[type="submit"]:has-text("Save Card")').click();

    // Wait for navigation back to dashboard
    await page.waitForURL("**/", { timeout: 5000 });

    // Verify card was saved with correct credit limit in storage
    const savedCards = await getCards(page, ANONYMOUS_HOUSEHOLD_ID);
    expect(savedCards).toHaveLength(1);
    expect(savedCards[0]?.cardName).toBe("Amex Platinum");
    expect(savedCards[0]?.creditLimit).toBe(2500000); // In cents, so $25,000 = 2,500,000 cents
  });

  test("credit limit 'Not set' persists as 0", async ({ page }) => {
    // Spec: CardForm.tsx line 428 — SelectItem value="0" for "Not set"
    // Verify that selecting "Not set" saves as 0 (or empty string, depending on schema)

    // Fill Step 1
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]:has-text("Discover")').click();
    await page.locator("#cardName").fill("Discover IT");
    await page.locator("#openDate").fill("2026-03-01");

    // Navigate to Step 2
    await page.locator('button:has-text("More Details")').click();

    // Select "Not set"
    await page.locator("#creditLimit").click();
    await page.locator('[role="option"]:has-text("Not set")').click();

    // Save the card
    await page.locator('button[type="submit"]:has-text("Save Card")').click();

    // Wait for navigation back to dashboard
    await page.waitForURL("**/", { timeout: 5000 });

    // Verify card was saved with "Not set" credit limit
    const savedCards = await getCards(page, ANONYMOUS_HOUSEHOLD_ID);
    expect(savedCards).toHaveLength(1);
    expect(savedCards[0]?.cardName).toBe("Discover IT");
    // "Not set" should save as 0 or empty value
    expect([0, ""]).toContain(savedCards[0]?.creditLimit);
  });

  test("credit limit $50,000 persists correctly", async ({ page }) => {
    // Spec: Verify that a higher-value credit limit persists
    // CardForm.tsx line 432-433 — $50,000 is one of the high-value options

    // Fill Step 1
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]:has-text("Capital One")').click();
    await page.locator("#cardName").fill("Capital One Venture");
    await page.locator("#openDate").fill("2026-01-10");

    // Navigate to Step 2
    await page.locator('button:has-text("More Details")').click();

    // Select $50,000
    await page.locator("#creditLimit").click();
    await page.locator('[role="option"]:has-text("$50,000")').click();

    // Save the card
    await page.locator('button[type="submit"]:has-text("Save Card")').click();

    // Wait for navigation back to dashboard
    await page.waitForURL("**/", { timeout: 5000 });

    // Verify card was saved with correct credit limit
    const savedCards = await getCards(page, ANONYMOUS_HOUSEHOLD_ID);
    expect(savedCards).toHaveLength(1);
    expect(savedCards[0]?.cardName).toBe("Capital One Venture");
    expect(savedCards[0]?.creditLimit).toBe(5000000); // In cents, so $50,000 = 5,000,000 cents
  });

  test("multiple cards can have different credit limits", async ({ page }) => {
    // Spec: Verify that saving multiple cards preserves distinct credit limit values
    // This ensures the creditLimit field is properly scoped per card.

    // Create first card with $10,000 limit
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]:has-text("Chase")').click();
    await page.locator("#cardName").fill("Chase Sapphire");
    await page.locator("#openDate").fill("2026-01-01");

    await page.locator('button:has-text("More Details")').click();
    await page.locator("#creditLimit").click();
    await page.locator('[role="option"]:has-text("$10,000")').click();
    await page.locator('button[type="submit"]:has-text("Save Card")').click();

    // Wait for navigation back to dashboard
    await page.waitForURL("**/", { timeout: 5000 });

    // Start adding a second card
    await page.goto("/cards/new", { waitUntil: "networkidle" });

    // Create second card with $35,000 limit
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]:has-text("Citibank")').click();
    await page.locator("#cardName").fill("Citibank Prestige");
    await page.locator("#openDate").fill("2026-02-01");

    await page.locator('button:has-text("More Details")').click();
    await page.locator("#creditLimit").click();
    await page.locator('[role="option"]:has-text("$35,000")').click();
    await page.locator('button[type="submit"]:has-text("Save Card")').click();

    // Wait for navigation back to dashboard
    await page.waitForURL("**/", { timeout: 5000 });

    // Verify both cards were saved with correct distinct credit limits
    const savedCards = await getCards(page, ANONYMOUS_HOUSEHOLD_ID);
    expect(savedCards).toHaveLength(2);

    const sapphire = savedCards.find((c) => c.cardName === "Chase Sapphire");
    const prestige = savedCards.find((c) => c.cardName === "Citibank Prestige");

    expect(sapphire?.creditLimit).toBe(1000000); // $10,000 = 1,000,000 cents
    expect(prestige?.creditLimit).toBe(3500000); // $35,000 = 3,500,000 cents
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Credit Limit in Edit Mode
// ════════════════════════════════════════════════════════════════════════════

test.describe("Credit Limit Step 2 — Edit Mode Visibility", () => {
  test("credit limit is visible in edit mode", async ({ page }) => {
    // Spec: CardForm.tsx line 415 — Credit Limit shows when (isEditMode || currentStep === 2)
    // Edit mode should always show the credit limit field

    // First, create a card via wizard
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]:has-text("Wells Fargo")').click();
    await page.locator("#cardName").fill("Wells Fargo Propel");
    await page.locator("#openDate").fill("2026-01-20");

    await page.locator('button:has-text("More Details")').click();
    await page.locator("#creditLimit").click();
    await page.locator('[role="option"]:has-text("$15,000")').click();
    await page.locator('button[type="submit"]:has-text("Save Card")').click();

    await page.waitForURL("**/", { timeout: 5000 });

    // Get the card ID from storage
    const savedCards = await getCards(page, ANONYMOUS_HOUSEHOLD_ID);
    expect(savedCards).toHaveLength(1);
    const cardId = savedCards[0]?.id;

    // Navigate to edit page
    await page.goto(`/cards/${cardId}/edit`, { waitUntil: "networkidle" });

    // Verify credit limit select is visible in edit mode
    const creditLimitTrigger = page.locator("#creditLimit");
    await expect(creditLimitTrigger).toBeVisible();

    // Verify the previously selected value is pre-populated by checking the select's value state
    // The SelectValue component shows the selected text, and we can verify the trigger shows $15,000
    await expect(creditLimitTrigger).toContainText("$15,000");
  });

  test("credit limit can be edited and re-saved", async ({ page }) => {
    // Spec: Verify that credit limit can be changed in edit mode and persisted

    // Create initial card
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]:has-text("Chase")').click();
    await page.locator("#cardName").fill("Chase Freedom");
    await page.locator("#openDate").fill("2026-01-05");

    await page.locator('button:has-text("More Details")').click();
    await page.locator("#creditLimit").click();
    await page.locator('[role="option"]:has-text("$5,000")').click();
    await page.locator('button[type="submit"]:has-text("Save Card")').click();

    await page.waitForURL("**/", { timeout: 5000 });

    // Get the card ID
    const savedCards = await getCards(page, ANONYMOUS_HOUSEHOLD_ID);
    const cardId = savedCards[0]?.id;

    // Navigate to edit page
    await page.goto(`/cards/${cardId}/edit`, { waitUntil: "networkidle" });

    // Change credit limit from $5,000 to $20,000
    await page.locator("#creditLimit").click();
    await page.locator('[role="option"]:has-text("$20,000")').click();

    // Save changes
    await page.locator('button[type="submit"]:has-text("Save changes")').click();

    await page.waitForURL("**/", { timeout: 5000 });

    // Verify credit limit was updated in storage
    const updatedCards = await getCards(page, ANONYMOUS_HOUSEHOLD_ID);
    expect(updatedCards[0]?.cardName).toBe("Chase Freedom");
    expect(updatedCards[0]?.creditLimit).toBe(2000000); // Updated to $20,000 = 2,000,000 cents
  });
});
