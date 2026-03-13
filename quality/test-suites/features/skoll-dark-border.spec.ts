/**
 * Skoll Dark Border Fix — Issue #647
 *
 * Validates that the Sköll feature image has no white border visible in dark mode
 * and renders seamlessly with the page background.
 *
 * AC:
 * - Sköll feature image has no white border in dark mode
 * - Image blends seamlessly with dark background
 * - Light mode is unaffected
 * - Other feature images remain unchanged
 * - Works at mobile viewport (375px)
 */

import { test, expect } from "@playwright/test";

const FEATURES_PAGE = "http://localhost:3000/features";

test.describe("Feature 05 — Sköll Dark Mode Border Fix (Issue #647)", () => {
  test("should render sköll image without white border in dark mode", async ({
    page,
  }) => {
    // Navigate to features page
    await page.goto(FEATURES_PAGE);

    // Set dark mode (force dark theme)
    await page.emulateMedia({ colorScheme: "dark" });

    // Find the Annual Fee Tracking section (Feature 05)
    const featureSection = page.locator('section[id="annual-fee-tracking"]');
    await expect(featureSection).toBeVisible();

    // Find the dark mode image within this section
    const darkImage = featureSection.locator('img[src*="skoll-dark.png"]');
    await expect(darkImage).toBeVisible();

    // Verify image is displayed with correct dimensions
    const boundingBox = await darkImage.boundingBox();
    expect(boundingBox).toBeTruthy();
    expect(boundingBox!.width).toBeGreaterThan(0);
    expect(boundingBox!.height).toBeGreaterThan(0);

    // Take screenshot for visual inspection
    await expect(featureSection).toHaveScreenshot(
      "skoll-feature-dark-mode.png",
      {
        maxDiffPixels: 100, // Allow minor rendering differences
      }
    );
  });

  test("should render sköll image correctly in light mode", async ({
    page,
  }) => {
    // Navigate to features page
    await page.goto(FEATURES_PAGE);

    // Set light mode
    await page.emulateMedia({ colorScheme: "light" });

    // Find the Annual Fee Tracking section
    const featureSection = page.locator('section[id="annual-fee-tracking"]');
    await expect(featureSection).toBeVisible();

    // Find the light mode image
    const lightImage = featureSection.locator('img[src*="skoll-light.png"]');
    await expect(lightImage).toBeVisible();

    // Verify image is displayed
    const boundingBox = await lightImage.boundingBox();
    expect(boundingBox).toBeTruthy();
    expect(boundingBox!.width).toBeGreaterThan(0);
    expect(boundingBox!.height).toBeGreaterThan(0);
  });

  test("should display sköll image at mobile viewport (375px)", async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    // Navigate to features page
    await page.goto(FEATURES_PAGE);

    // Set dark mode for mobile
    await page.emulateMedia({ colorScheme: "dark" });

    // Find the sköll feature section
    const featureSection = page.locator('section[id="annual-fee-tracking"]');
    await expect(featureSection).toBeVisible();

    // Verify dark image is visible and rendered
    const darkImage = featureSection.locator('img[src*="skoll-dark.png"]');
    await expect(darkImage).toBeVisible();

    // Check that image fits within viewport
    const boundingBox = await darkImage.boundingBox();
    expect(boundingBox).toBeTruthy();
    expect(boundingBox!.width).toBeLessThanOrEqual(375);
  });

  test("should not break other feature images on /features page", async ({
    page,
  }) => {
    // Navigate to features page
    await page.goto(FEATURES_PAGE);

    // Find all feature images (both dark and light variants)
    const darkImages = page.locator('img[src*="-dark.png"]');
    const lightImages = page.locator('img[src*="-light.png"]');

    // Verify at least 9 features load (3 Thrall + 6 Karl shown)
    const darkCount = await darkImages.count();
    const lightCount = await lightImages.count();

    expect(darkCount).toBeGreaterThanOrEqual(9);
    expect(lightCount).toBeGreaterThanOrEqual(9);

    // Specifically check other feature images render
    const fenrirDark = page.locator('img[src*="fenrir-dark.png"]');
    const huginMuninnDark = page.locator('img[src*="huginn-muninn-dark.png"]');
    const hatiDark = page.locator('img[src*="hati-dark.png"]');

    await expect(fenrirDark).toBeVisible();
    await expect(huginMuninnDark).toBeVisible();
    await expect(hatiDark).toBeVisible();
  });

  test("should use correct image filenames for sköll feature", async ({
    page,
  }) => {
    // Navigate to features page
    await page.goto(FEATURES_PAGE);

    // Get all image src attributes
    const allImages = await page
      .locator('img[src*="/images/features/"]')
      .evaluateAll((elements) =>
        elements
          .map((el) => el.getAttribute("src"))
          .filter((src) => src && src.includes("skoll"))
      );

    // Should have both dark and light variants
    expect(allImages).toContain(expect.stringContaining("skoll-dark.png"));
    expect(allImages).toContain(expect.stringContaining("skoll-light.png"));
  });
});
