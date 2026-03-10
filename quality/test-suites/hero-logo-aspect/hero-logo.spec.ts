import { test, expect } from '@playwright/test';

test.describe('Hero Logo Aspect Ratio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('displays logo with natural 1:1 aspect ratio (not squashed)', async ({ page }) => {
    // In light mode, the light variant is visible
    const logoImg = page.locator('img[alt*="Fenrir"][alt*="logo"]').last();

    // Verify element exists
    await expect(logoImg).toBeVisible();

    // Get computed dimensions
    const box = await logoImg.boundingBox();
    expect(box).not.toBeNull();

    if (box) {
      const aspectRatio = box.width / box.height;

      // 1:1 aspect ratio = 1.0
      // Allow small tolerance for rounding
      expect(aspectRatio).toBeCloseTo(1.0, 0.1);
    }
  });

  test('logo sizing matches responsive breakpoints', async ({ page }) => {
    // In light mode (default), the light variant is visible
    const logoImg = page.locator('img[alt*="Fenrir"][alt*="logo"]').last();

    await expect(logoImg).toBeVisible();

    // Mobile: max-width 200px (< 640px viewport)
    await page.setViewportSize({ width: 375, height: 667 });
    let box = await logoImg.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(200);

    // Desktop: max-width 280px (>= 640px viewport)
    await page.setViewportSize({ width: 1280, height: 720 });
    box = await logoImg.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(280);
  });

  test('logo is vertically centered with hero text in light theme', async ({ page }) => {
    const heroSection = page.locator('section[aria-label="Hero"]');
    const logoImg = page.locator('img[alt*="Fenrir"][alt*="logo"]').last();
    const heroHeading = page.locator('h1', { hasText: 'Fenrir Ledger' });

    await expect(heroSection).toBeVisible();
    await expect(logoImg).toBeVisible();
    await expect(heroHeading).toBeVisible();

    // On desktop (sm breakpoint and above), grid uses items-center
    // Verify the grid layout container exists and has items-center class
    const gridContainer = heroSection.locator('div[class*="items-center"]').first();
    const classList = await gridContainer.getAttribute('class');

    expect(classList).toContain('items-center');
  });

  test('no layout shift or CLS regression on page load', async ({ page, context }) => {
    let layoutShifts = 0;

    // Monitor for layout instability
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(msg);
      }
    });

    // Track layout metrics
    const clsValue = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let cls = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).hadRecentInput) continue;
            cls += (entry as any).value;
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });

        setTimeout(() => {
          observer.disconnect();
          resolve(cls);
        }, 3000);
      });
    });

    // CLS should be minimal (< 0.1 is good)
    expect(clsValue).toBeLessThan(0.1);
  });

  test('logo image has correct source and dimensions', async ({ page }) => {
    const logoImgs = page.locator('img[alt*="Fenrir"][alt*="logo"]');

    // Two themed variants: dark and light
    await expect(logoImgs).toHaveCount(2);

    const darkImg = logoImgs.nth(0);
    const lightImg = logoImgs.nth(1);

    const darkSrc = await darkImg.getAttribute('src');
    const lightSrc = await lightImg.getAttribute('src');
    expect(darkSrc).toContain('fenrir-logo-dark.png');
    expect(lightSrc).toContain('fenrir-logo-light.png');

    // Both images are 1024x1024 (1:1 ratio)
    for (const img of [darkImg, lightImg]) {
      const width = await img.getAttribute('width');
      const height = await img.getAttribute('height');
      expect(width).toBe('1024');
      expect(height).toBe('1024');
    }
  });
});
