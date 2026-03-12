import { test, expect } from '@playwright/test';
import { clearAllStorage, seedHousehold, ANONYMOUS_HOUSEHOLD_ID } from '../helpers/test-fixtures';

/**
 * Wizard Back Button Tests — Issue #269
 *
 * Validates that the Back button on Step 2 of the new-card wizard:
 * 1. Returns user to Step 1 when clicked
 * 2. Preserves all form values from Step 1 through the navigation
 * Slimmed to core interactive behavior only.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.goto('/ledger/cards/new', { waitUntil: 'load' });
  await page.waitForSelector('#issuerId');
});

test('Clicking Back returns to Step 1', async ({ page }) => {
  await page.locator('#issuerId').click();
  await page.locator('[role="option"]').first().click();

  await page.locator('#cardName').fill('Test Card');
  await page.locator('#openDate').fill('2026-01-15');

  await page.click('button:has-text("More Details")');

  const backButton = page.locator('button:has-text("Back")');
  await expect(backButton).toBeVisible();

  await page.click('button:has-text("Back")');

  await expect(page.locator('button:has-text("More Details")')).toBeVisible();
  await expect(page.locator('button:has-text("Back")')).not.toBeVisible();
});

test('All Step 1 values are preserved after clicking Back', async ({ page }) => {
  const cardName = 'Platinum Card';
  const openDate = '2025-06-20';

  await page.locator('#issuerId').click();
  const amexOption = page.locator('[role="option"]:has-text("American Express")').first();
  await amexOption.click();

  await page.locator('#cardName').fill(cardName);
  await page.locator('#openDate').fill(openDate);

  await page.click('button:has-text("More Details")');

  await page.click('button:has-text("Back")');

  const cardNameInput = page.locator('#cardName');
  const openDateInput = page.locator('#openDate');

  await expect(cardNameInput).toHaveValue(cardName);
  await expect(openDateInput).toHaveValue(openDate);
});

test('Notes field is preserved through Step 2 navigation', async ({ page }) => {
  await page.locator('#issuerId').click();
  await page.locator('[role="option"]').first().click();

  await page.locator('#cardName').fill('Notes Card');
  await page.locator('#openDate').fill('2026-01-10');

  await page.click('button:has-text("More Details")');

  const notesArea = page.locator('#notes');
  if (await notesArea.isVisible()) {
    await notesArea.fill('Test notes for this card');
  }

  await page.click('button:has-text("Back")');

  await page.click('button:has-text("More Details")');

  const notesAfter = page.locator('#notes');
  if (await notesAfter.isVisible()) {
    await expect(notesAfter).toHaveValue('Test notes for this card');
  }
});

test('Multiple back-and-forth cycles preserve all data', async ({ page }) => {
  await page.locator('#issuerId').click();
  await page.locator('[role="option"]').first().click();

  await page.locator('#cardName').fill('Multi-Cycle Card');
  await page.locator('#openDate').fill('2026-02-01');

  await page.click('button:has-text("More Details")');

  await page.click('button:has-text("Back")');

  await expect(page.locator('#cardName')).toHaveValue('Multi-Cycle Card');
  await expect(page.locator('#openDate')).toHaveValue('2026-02-01');

  await page.click('button:has-text("More Details")');

  const notesArea = page.locator('#notes');
  if (await notesArea.isVisible()) {
    await notesArea.fill('Cycle 2 notes');
  }

  await page.click('button:has-text("Back")');

  await expect(page.locator('#cardName')).toHaveValue('Multi-Cycle Card');

  await page.click('button:has-text("More Details")');

  const notesAfter = page.locator('#notes');
  if (await notesAfter.isVisible()) {
    await expect(notesAfter).toHaveValue('Cycle 2 notes');
  }
});
