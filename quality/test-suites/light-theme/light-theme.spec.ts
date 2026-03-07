import { test, expect } from '@playwright/test';

test.describe('Light Theme — Stone/Marble Design', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('theme toggle switches between dark and light modes', async ({ page }) => {
    // Open user menu by clicking avatar
    const avatar = page.locator('button[aria-label*="Sign in" i], button[aria-label*="user menu" i]').first();
    await expect(avatar).toBeVisible({ timeout: 10000 });
    await avatar.click();
    await page.waitForTimeout(500);

    // Find theme toggle radiogroup (should now be visible in dropdown)
    const themeRadiogroup = page.locator('[role="radiogroup"][aria-label="Theme"]');
    await expect(themeRadiogroup).toBeVisible({ timeout: 5000 });

    // Get initial theme state
    const html = page.locator('html');
    const initialClass = await html.getAttribute('class') || '';

    // First switch to Dark to ensure we're starting from a known state
    const darkButton = themeRadiogroup.locator('button[role="radio"][aria-label="Dark"]');
    await darkButton.click();
    await page.waitForTimeout(500);

    // Verify dark theme is active
    const darkClass = await html.getAttribute('class');
    expect(darkClass).toContain('dark');

    // Now switch to Light
    const lightButton = themeRadiogroup.locator('button[role="radio"][aria-label="Light"]');
    await lightButton.click();
    await page.waitForTimeout(500); // Allow theme transition

    // Verify light theme is active
    const lightClass = await html.getAttribute('class');
    expect(lightClass).toContain('light');
    expect(lightClass).not.toContain('dark');
  });

  test('light theme applies stone/marble background colors', async ({ page }) => {
    // Switch to light theme
    const html = page.locator('html');
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });

    await page.waitForTimeout(500);

    // Verify light theme is active
    const htmlClass = await html.getAttribute('class');
    expect(htmlClass).toContain('light');

    // Check background color (should be light stone/marble, not dark)
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });

    // Light theme should have RGB values > 200 (light background)
    const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [_, r, g, b] = rgbMatch.map(Number);
      expect(r).toBeGreaterThan(180); // Light background threshold
    }
  });

  test('light theme text has adequate contrast', async ({ page }) => {
    // Switch to light theme
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });

    await page.waitForTimeout(500);

    // Check main heading exists and is visible
    const heading = page.locator('h1, h2, [class*="heading"]').first();
    await expect(heading).toBeVisible();

    // Get text color (should be dark/ink-black on light background)
    const textColor = await heading.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Dark text should have RGB values < 100 (dark text on light bg)
    const rgbMatch = textColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [_, r, g, b] = rgbMatch.map(Number);
      const avgBrightness = (r + g + b) / 3;
      expect(avgBrightness).toBeLessThan(150); // Dark text threshold
    }
  });

  test('light theme renders all components without errors', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Switch to light theme
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });

    await page.waitForTimeout(1000);

    // Verify no console errors
    expect(errors).toHaveLength(0);

    // Verify page loaded correctly
    await expect(page.locator('body')).toBeVisible();
  });

  test('dark theme still works correctly', async ({ page }) => {
    // Open user menu
    const avatar = page.locator('button[aria-label*="Sign in" i], button[aria-label*="user menu" i]').first();
    await avatar.click();
    await page.waitForTimeout(500);

    // Switch to dark theme via toggle
    const themeRadiogroup = page.locator('[role="radiogroup"][aria-label="Theme"]');
    const darkButton = themeRadiogroup.locator('button[role="radio"][aria-label="Dark"]');
    await darkButton.click();
    await page.waitForTimeout(500);

    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify dark theme is active
    const html = page.locator('html');
    const htmlClass = await html.getAttribute('class');
    expect(htmlClass).toContain('dark');

    // Check background color (should be dark)
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });

    // Dark theme should have RGB values < 100 (dark background)
    const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [_, r, g, b] = rgbMatch.map(Number);
      expect(r).toBeLessThan(100); // Dark background threshold
    }
  });

  test('theme preference persists across page reloads', async ({ page }) => {
    // Switch to light theme
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    });

    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify light theme persisted
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('light');
  });
});

test.describe('Mobile Viewport — Light Theme', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport (375px minimum)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
  });

  test('light theme renders correctly on mobile (375px)', async ({ page }) => {
    // Switch to light theme
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });

    await page.waitForTimeout(500);

    // Verify page is visible and laid out correctly
    await expect(page.locator('body')).toBeVisible();

    // Check no horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  test('theme toggle is accessible on mobile', async ({ page }) => {
    // Open user menu by clicking avatar
    const avatar = page.locator('button[aria-label*="Sign in" i], button[aria-label*="user menu" i]').first();
    await expect(avatar).toBeVisible({ timeout: 10000 });
    await avatar.click();
    await page.waitForTimeout(500);

    // Theme toggle radiogroup should be visible in dropdown
    const themeRadiogroup = page.locator('[role="radiogroup"][aria-label="Theme"]');
    await expect(themeRadiogroup).toBeVisible({ timeout: 5000 });

    // Verify it's clickable - switch to light
    const lightButton = themeRadiogroup.locator('button[role="radio"][aria-label="Light"]');
    await lightButton.click();
    await page.waitForTimeout(500);

    // Theme should have changed
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('light');
  });
});
