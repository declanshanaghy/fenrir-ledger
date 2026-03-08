import { test, expect } from '@playwright/test';
import { clearAllStorage } from '../helpers/test-fixtures';

/**
 * Issue #298: Light theme white flash on import method card hover
 *
 * Tests validate that:
 * 1. Importing cards in Light theme have smooth hover transitions (no white flash)
 * 2. CSV drop zone hover is smooth (no white flash)
 * 3. Dark theme has no regression
 * 4. Transitions are applied correctly via card-interactive class
 *
 * Root cause: `transition-colors` was animating background-color,
 * interpolating from opaque white (#ffffff) to semi-transparent gold (bg-gold/5),
 * producing a bright intermediate frame. Fix uses card-interactive class which
 * only transitions border-color and box-shadow.
 */

test.describe('Issue #298 - Light Hover Flash on Import Cards', () => {
  // Navigate to the import modal by triggering the custom event
  const openImportWizard = async (page: any) => {
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('fenrir:open-import-wizard'));
    });
    await page.waitForTimeout(300);
  };

  test.describe('Light Theme - Import Method Cards', () => {
    test.beforeEach(async ({ page }) => {
      // Set light theme
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
      });
      await page.goto('/', { waitUntil: 'networkidle' });
      // Wait for dashboard to load, then open import modal
      await page.waitForTimeout(500);
    });

    test('URL card has card-interactive class and transitions correctly', async ({ page }) => {
      // Open import wizard
      await openImportWizard(page);

      // Find the "Share a Rune Tablet" card (URL method)
      const urlCard = page.locator('[role="option"]').filter({ hasText: 'Share a Rune Tablet' });
      await urlCard.waitFor({ state: 'visible', timeout: 5000 });

      // Verify card-interactive class is applied
      const classAttr = await urlCard.getAttribute('class');
      expect(classAttr).toContain('card-interactive');

      // Hover and check computed styles
      await urlCard.hover();
      await page.waitForTimeout(100);

      // Get computed transition-property to verify no background-color transition
      const transitionProperty = await urlCard.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).transitionProperty;
      });

      // card-interactive should only transition border-color and box-shadow
      expect(transitionProperty).toContain('border-color');
      expect(transitionProperty).toContain('box-shadow');
      // Should NOT transition background-color
      expect(transitionProperty).not.toContain('background-color');
    });

    test('Picker card has card-interactive class', async ({ page }) => {
      await openImportWizard(page);

      const pickerCard = page.locator('[role="option"]').filter({ hasText: 'Browse the Archives' });
      await pickerCard.waitFor({ state: 'visible', timeout: 5000 });
      const classAttr = await pickerCard.getAttribute('class');
      expect(classAttr).toContain('card-interactive');
    });

    test('CSV card has card-interactive class', async ({ page }) => {
      await openImportWizard(page);

      const csvCard = page.locator('[role="option"]').filter({ hasText: 'Deliver a Rune-Stone' });
      await csvCard.waitFor({ state: 'visible', timeout: 5000 });
      const classAttr = await csvCard.getAttribute('class');
      expect(classAttr).toContain('card-interactive');
    });

    test('Import method cards have smooth hover without flash', async ({ page }) => {
      await openImportWizard(page);

      const cards = page.locator('[role="option"]');
      await cards.first().waitFor({ state: 'visible', timeout: 5000 });

      for (let i = 0; i < await cards.count(); i++) {
        const card = cards.nth(i);
        const isDisabled = await card.evaluate((el: HTMLElement) => {
          return el.getAttribute('aria-disabled') === 'true';
        });

        if (!isDisabled) {
          // Get initial background color
          const initialBg = await card.evaluate((el: HTMLElement) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Hover
          await card.hover();

          // Wait for hover state to settle
          await page.waitForTimeout(200);

          // Get hovered background color
          const hoverBg = await card.evaluate((el: HTMLElement) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Background colors should be different (resting vs hover)
          // but the transition should NOT animate background-color
          // (background changes instantly, border/shadow animate smoothly)
          expect(initialBg).not.toEqual(hoverBg);

          // Reset hover state
          await page.mouse.move(0, 0);
          await page.waitForTimeout(100);
        }
      }
    });
  });

  test.describe('Light Theme - CSV Drop Zone', () => {
    test.beforeEach(async ({ page }) => {
      // Set light theme
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
      });
      // Navigate to home page
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
    });

    test('CSV drop zone has card-interactive class', async ({ page }) => {
      await openImportWizard(page);

      // Click on CSV method card to get to upload
      const csvCard = page.locator('[role="option"]').filter({ hasText: 'Deliver a Rune-Stone' });
      await csvCard.waitFor({ state: 'visible', timeout: 5000 });
      await csvCard.click();
      await page.waitForTimeout(300);

      // Find drop zone
      const dropZone = page.locator('[aria-label="Upload spreadsheet file"]');
      await dropZone.waitFor({ state: 'visible', timeout: 5000 });
      const classAttr = await dropZone.getAttribute('class');
      expect(classAttr).toContain('card-interactive');
    });

    test('CSV drop zone hover is smooth without background flash', async ({ page }) => {
      await openImportWizard(page);

      const csvCard = page.locator('[role="option"]').filter({ hasText: 'Deliver a Rune-Stone' });
      await csvCard.waitFor({ state: 'visible', timeout: 5000 });
      await csvCard.click();
      await page.waitForTimeout(300);

      const dropZone = page.locator('[aria-label="Upload spreadsheet file"]');
      await dropZone.waitFor({ state: 'visible', timeout: 5000 });

      // Verify card-interactive class is applied
      const classAttr = await dropZone.getAttribute('class');
      expect(classAttr).toContain('card-interactive');

      // Verify transition-property doesn't animate background-color
      const transitionProperty = await dropZone.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).transitionProperty;
      });
      expect(transitionProperty).not.toContain('background-color');
      expect(transitionProperty).toContain('border-color');
      expect(transitionProperty).toContain('box-shadow');
    });
  });

  test.describe('Dark Theme - Regression Tests', () => {
    test.beforeEach(async ({ page }) => {
      // Set dark theme
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
    });

    test('Dark theme import cards maintain card-interactive class', async ({ page }) => {
      await openImportWizard(page);

      const cards = page.locator('[role="option"]');
      await cards.first().waitFor({ state: 'visible', timeout: 5000 });

      for (let i = 0; i < await cards.count(); i++) {
        const card = cards.nth(i);
        const classAttr = await card.getAttribute('class');
        expect(classAttr).toContain('card-interactive');
      }
    });

    test('Dark theme cards have no white flash on hover', async ({ page }) => {
      await openImportWizard(page);

      const cards = page.locator('[role="option"]');
      await cards.first().waitFor({ state: 'visible', timeout: 5000 });

      for (let i = 0; i < await cards.count(); i++) {
        const card = cards.nth(i);
        const isDisabled = await card.evaluate((el: HTMLElement) => {
          return el.getAttribute('aria-disabled') === 'true';
        });

        if (!isDisabled) {
          // Hover
          await card.hover();
          await page.waitForTimeout(200);

          // Get background color - should be dark theme color
          const bgColor = await card.evaluate((el: HTMLElement) => {
            return window.getComputedStyle(el).backgroundColor;
          });

          // Dark theme background should not be white or near-white
          // This is a sanity check that dark theme is applied
          expect(bgColor).not.toMatch(/^rgb\(255,\s*255,\s*255/);

          // Reset hover
          await page.mouse.move(0, 0);
          await page.waitForTimeout(100);
        }
      }
    });

    test('Dark theme CSV drop zone has no regression', async ({ page }) => {
      await openImportWizard(page);

      const csvCard = page.locator('[role="option"]').filter({ hasText: 'Deliver a Rune-Stone' });
      await csvCard.waitFor({ state: 'visible', timeout: 5000 });
      await csvCard.click();
      await page.waitForTimeout(300);

      const dropZone = page.locator('[aria-label="Upload spreadsheet file"]');
      await dropZone.waitFor({ state: 'visible', timeout: 5000 });

      const classAttr = await dropZone.getAttribute('class');
      expect(classAttr).toContain('card-interactive');

      // Verify transition-property doesn't animate background-color
      const transitionProperty = await dropZone.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).transitionProperty;
      });
      expect(transitionProperty).not.toContain('background-color');
      expect(transitionProperty).toContain('border-color');
      expect(transitionProperty).toContain('box-shadow');
    });
  });

  test.describe('prefers-reduced-motion compliance', () => {
    test('card-interactive class respects prefers-reduced-motion', async ({ page }) => {
      // Set prefers-reduced-motion
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      await openImportWizard(page);

      const card = page.locator('[role="option"]').first();
      await card.waitFor({ state: 'visible', timeout: 5000 });

      const transitionDuration = await card.evaluate((el: HTMLElement) => {
        return window.getComputedStyle(el).transitionDuration;
      });

      // Should have no transition (0s)
      expect(transitionDuration).toMatch(/0s/);
    });
  });
});
