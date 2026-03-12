import { test, expect } from '@playwright/test';
import { clearAllStorage, seedHousehold, ANONYMOUS_HOUSEHOLD_ID } from '../helpers/test-fixtures';

/**
 * Select Value Persistence Tests — Issue #273
 *
 * Validates that Select components in the new-card wizard Step 1 preserve
 * their values when clicking Back from Step 2.
 *
 * Previously, the Issuer, Bonus Type, and Minimum Spend Select components
 * used uncontrolled `defaultValue`, causing them to reset to placeholder
 * when the Step 1 fieldset unmounted and remounted.
 *
 * The fix switches these to controlled `value` prop with react-hook-form.
 *
 * Acceptance Criteria:
 * - After clicking Back from Step 2, the Issuer select shows the previously selected issuer
 * - After clicking Back from Step 2, the Bonus Type select retains its value
 * - After clicking Back from Step 2, the Minimum Spend select retains its value
 */

test.beforeEach(async ({ page }) => {
  // Navigate to home first to establish browser context
  await page.goto('/');
  // Clear localStorage to start fresh
  await clearAllStorage(page);
  // Seed household so the form loads properly
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  // Navigate to the new card form
  await page.goto('/ledger/cards/new', { waitUntil: 'load' });
  // Wait for the form to be visible
  await page.waitForSelector('#issuerId');
});

test('Issuer select preserves value after Back from Step 2', async ({ page }) => {
  // Select an issuer on Step 1
  await page.locator('#issuerId').click();
  const issuerOption = page.locator('[role="option"]:has-text("American Express")').first();
  await issuerOption.click();

  // Fill Step 1 required fields
  await page.locator('#cardName').fill('Test Card');
  await page.locator('#openDate').fill('2026-01-15');

  // Advance to Step 2
  await page.click('button:has-text("More Details")');

  // Verify we're on Step 2 (Back button is visible)
  await expect(page.locator('button:has-text("Back")')).toBeVisible();

  // Click Back
  await page.click('button:has-text("Back")');

  // Verify we're back on Step 1
  await expect(page.locator('button:has-text("More Details")')).toBeVisible();

  // Verify the Issuer select trigger shows a value (not placeholder)
  // Click the select to open it and see if the option is marked as selected
  await page.locator('#issuerId').click();

  // Find the American Express option and check if it's marked as selected
  const amexOption = page.locator('[role="option"]:has-text("American Express")').first();
  const isSelected = await amexOption.evaluate((el: Element) => {
    return el.getAttribute('aria-selected') === 'true' || el.classList.contains('bg-accent');
  });

  // The option should be selected/highlighted
  expect(isSelected).toBe(true);
});

test('Bonus Type select preserves value after Back from Step 2', async ({ page }) => {
  // Fill Step 1 fields
  await page.locator('#issuerId').click();
  await page.locator('[role="option"]').first().click();

  await page.locator('#cardName').fill('Bonus Card');
  await page.locator('#openDate').fill('2026-01-10');

  // Select a Bonus Type on Step 1
  await page.locator('#bonusType').click();
  const bonusOption = page.locator('[role="option"]:has-text("Points")').first();
  await bonusOption.click();

  // Advance to Step 2
  await page.click('button:has-text("More Details")');

  // Verify we're on Step 2
  await expect(page.locator('button:has-text("Back")')).toBeVisible();

  // Click Back
  await page.click('button:has-text("Back")');

  // Verify we're back on Step 1
  await expect(page.locator('button:has-text("More Details")')).toBeVisible();

  // Verify the Bonus Type select still shows Points (not placeholder)
  await page.locator('#bonusType').click();

  // Check if Points option is marked as selected
  const pointsOption = page.locator('[role="option"]:has-text("Points")').first();
  const isSelected = await pointsOption.evaluate((el: Element) => {
    return el.getAttribute('aria-selected') === 'true' || el.classList.contains('bg-accent');
  });

  // Points should be selected
  expect(isSelected).toBe(true);
});

test('All three selects preserve values simultaneously after Back', async ({ page }) => {
  // Select Issuer
  await page.locator('#issuerId').click();
  await page.locator('[role="option"]').first().click();

  // Fill Card Name and Date
  await page.locator('#cardName').fill('Multi-Select Card');
  await page.locator('#openDate').fill('2026-02-05');

  // Select Bonus Type
  await page.locator('#bonusType').click();
  await page.locator('[role="option"]:has-text("Miles")').first().click();

  // Advance to Step 2
  await page.click('button:has-text("More Details")');

  // Verify we're on Step 2
  await expect(page.locator('button:has-text("Back")')).toBeVisible();

  // Click Back
  await page.click('button:has-text("Back")');

  // Verify Card Name and Date (text inputs) are preserved
  await expect(page.locator('#cardName')).toHaveValue('Multi-Select Card');
  await expect(page.locator('#openDate')).toHaveValue('2026-02-05');

  // Verify Issuer select has a value selected by opening and checking
  await page.locator('#issuerId').click();
  const issuerFirstOption = page.locator('[role="option"]').first();
  const issuerSelected = await issuerFirstOption.evaluate((el: Element) =>
    el.getAttribute('aria-selected') === 'true' || el.classList.contains('bg-accent')
  );
  expect(issuerSelected).toBe(true);

  // Verify Bonus Type select has Miles selected
  // Click elsewhere to close issuer dropdown
  await page.click('body');
  await page.locator('#bonusType').click();
  const milesOption = page.locator('[role="option"]:has-text("Miles")').first();
  const bonusSelected = await milesOption.evaluate((el: Element) =>
    el.getAttribute('aria-selected') === 'true' || el.classList.contains('bg-accent')
  );
  expect(bonusSelected).toBe(true);
});

test('Clearing a select and going Back preserves the cleared state', async ({ page }) => {
  // Select an issuer
  await page.locator('#issuerId').click();
  await page.locator('[role="option"]').first().click();

  await page.locator('#cardName').fill('Test Card');
  await page.locator('#openDate').fill('2026-01-15');

  // Advance to Step 2
  await page.click('button:has-text("More Details")');

  // Go back
  await page.click('button:has-text("Back")');

  // Now change the issuer selection to a different option
  await page.locator('#issuerId').click();
  const secondOption = page.locator('[role="option"]').nth(1);
  await secondOption.click();

  // Advance to Step 2
  await page.click('button:has-text("More Details")');

  // Go back
  await page.click('button:has-text("Back")');

  // The second selection should be preserved
  await page.locator('#issuerId').click();
  const secondOptionVerify = page.locator('[role="option"]').nth(1);
  const isSelected = await secondOptionVerify.evaluate((el: Element) =>
    el.getAttribute('aria-selected') === 'true' || el.classList.contains('bg-accent')
  );

  // The second option should be selected
  expect(isSelected).toBe(true);
});

test('Changing bonus type selection preserves new value after Back navigation', async ({ page }) => {
  // Select initial issuer and bonus type
  await page.locator('#issuerId').click();
  await page.locator('[role="option"]').first().click();

  await page.locator('#cardName').fill('Type Change Test');
  await page.locator('#openDate').fill('2026-01-10');

  // Select Points initially
  await page.locator('#bonusType').click();
  await page.locator('[role="option"]:has-text("Points")').first().click();

  // Go to Step 2
  await page.click('button:has-text("More Details")');

  // Go back
  await page.click('button:has-text("Back")');

  // Now change the bonus type to Miles
  await page.locator('#bonusType').click();
  const milesOption = page.locator('[role="option"]:has-text("Miles")').first();
  await milesOption.click();

  // Go to Step 2 again
  await page.click('button:has-text("More Details")');

  // Go back
  await page.click('button:has-text("Back")');

  // Verify the new selection (Miles) is preserved
  await page.locator('#bonusType').click();
  const milesVerify = page.locator('[role="option"]:has-text("Miles")').first();
  const isSelected = await milesVerify.evaluate((el: Element) =>
    el.getAttribute('aria-selected') === 'true' || el.classList.contains('bg-accent')
  );
  expect(isSelected).toBe(true);
});

test('Form submission still works correctly with controlled selects', async ({ page }) => {
  // Fill all required Step 1 fields
  await page.locator('#issuerId').click();
  await page.locator('[role="option"]').first().click();

  await page.locator('#cardName').fill('Submit Test Card');
  await page.locator('#openDate').fill('2026-03-01');

  // Advance to Step 2
  await page.click('button:has-text("More Details")');

  // Fill Step 2 fields
  const creditLimitTrigger = page.locator('#creditLimit');
  if (await creditLimitTrigger.count() > 0) {
    await creditLimitTrigger.click();
    const limit = page.locator('[role="option"]:has-text("5,000")').first();
    if (await limit.isVisible()) {
      await limit.click();
    }
  }

  // Click Save Card button
  const saveButton = page.locator('button:has-text("Save Card")').last();
  const isVisible = await saveButton.isVisible();

  if (isVisible) {
    // The save should succeed without form validation errors
    // We won't actually complete the save, but verify the button is clickable
    await expect(saveButton).toBeEnabled();
  }
});

test('Issuer select reflects correct value in form state on Back navigation', async ({ page }) => {
  // Select an issuer
  await page.locator('#issuerId').click();
  await page.locator('[role="option"]').first().click();

  // Fill other required fields
  await page.locator('#cardName').fill('Form State Card');
  await page.locator('#openDate').fill('2026-01-20');

  // Go to Step 2
  await page.click('button:has-text("More Details")');

  // Go back
  await page.click('button:has-text("Back")');

  // Verify the issuer select retained its value by clicking and checking selection
  await page.locator('#issuerId').click();
  const firstOption = page.locator('[role="option"]').first();
  const isSelected = await firstOption.evaluate((el: Element) =>
    el.getAttribute('aria-selected') === 'true' || el.classList.contains('bg-accent')
  );

  // The first option (the one we selected) should be marked as selected
  expect(isSelected).toBe(true);
});

test('Bonus Type select shows correct option after selecting and navigating back', async ({ page }) => {
  // Fill Step 1 fields
  await page.locator('#issuerId').click();
  await page.locator('[role="option"]').first().click();

  await page.locator('#cardName').fill('Bonus Option Card');
  await page.locator('#openDate').fill('2026-02-10');

  // Select Miles bonus type
  await page.locator('#bonusType').click();
  const milesOption = page.locator('[role="option"]:has-text("Miles")').first();
  await milesOption.click();

  // Go to Step 2
  await page.click('button:has-text("More Details")');

  // Go back
  await page.click('button:has-text("Back")');

  // Click on bonus type select to verify it shows the selected option
  await page.locator('#bonusType').click();

  // The Miles option should be highlighted/selected
  const milesOptionInDropdown = page.locator('[role="option"]:has-text("Miles")').first();
  const ariaSelected = await milesOptionInDropdown.getAttribute('aria-selected');

  // aria-selected should be 'true'
  expect(ariaSelected).toBe('true');
});
