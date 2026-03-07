/**
 * Test Suite: Cards Page Header Text
 * Issue: #209
 *
 * Validates that the Cards page header displays the correct text:
 * "The Ledger of Fates"
 */

import { test, expect } from '@playwright/test';

test.describe('Cards Page Header', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure clean state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('displays "The Ledger of Fates" as exact header text', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load and header to be visible
    const header = page.locator('h1').filter({ hasText: 'The Ledger of Fates' });
    await expect(header).toBeVisible();

    // Verify exact text match (not partial)
    await expect(header).toHaveText('The Ledger of Fates');
  });

  test('header has correct styling classes', async ({ page }) => {
    await page.goto('/');

    // Verify the header element has the expected CSS classes for Voice 2 atmospheric heading
    const header = page.locator('h1').filter({ hasText: 'The Ledger of Fates' });
    await expect(header).toBeVisible();
    await expect(header).toHaveClass(/font-display/);
    await expect(header).toHaveClass(/text-gold/);
  });

  test('header contains exactly "The Ledger of Fates" without extra suffixes', async ({ page }) => {
    await page.goto('/');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Get all h1 elements
    const h1Elements = await page.locator('h1').all();

    for (const h1 of h1Elements) {
      const text = await h1.textContent();
      // If it contains "The Ledger of Fates", it must not have "- Overhauled" suffix
      if (text?.includes('The Ledger of Fates')) {
        expect(text).not.toContain('- Overhauled');
      }
    }
  });

  test('header is visible on page load without requiring user interaction', async ({ page }) => {
    await page.goto('/');

    // Header should be immediately visible on load
    const header = page.locator('h1', { hasText: 'The Ledger of Fates' });
    await expect(header).toBeVisible({ timeout: 5000 });
  });
});
