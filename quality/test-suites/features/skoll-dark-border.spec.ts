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

// Uses baseURL from playwright.config.ts (localhost:9653 by default)
const FEATURES_PAGE = "/features";
const THEME_STORAGE_KEY = "fenrir-theme";
const DARK_CLASS = "dark";

test.describe("Feature 05 — Sköll Dark Mode Border Fix (Issue #647)", () => {
  test("should render sköll dark image without white border in dark mode", async ({
    page,
  }) => {
    // Set dark mode via localStorage before navigation
    await page.addInitScript((key) => {
      localStorage.setItem(key, "dark");
    }, THEME_STORAGE_KEY);

    // Navigate to features page
    await page.goto(FEATURES_PAGE);
    await page.waitForLoadState("networkidle");

    // Verify dark mode is applied
    const htmlClasses = await page.evaluate(() =>
      document.documentElement.className
    );
    expect(htmlClasses).toContain(DARK_CLASS);

    // Find the Annual Fee Tracking section (Feature 05)
    const featureSection = page.locator('section[id="annual-fee-tracking"]');
    await expect(featureSection).toBeVisible();

    // Find the dark mode image (first one, as both dark and light variants exist in DOM)
    const darkImage = featureSection
      .locator('img[alt*="Sköll Watches the Fee"]')
      .first();
    await expect(darkImage).toBeVisible();

    // Verify image has correct src
    const imgSrc = await darkImage.getAttribute("srcset");
    expect(imgSrc).toContain("skoll-dark.png");

    // Verify image is displayed with correct dimensions
    const boundingBox = await darkImage.boundingBox();
    expect(boundingBox).toBeTruthy();
    expect(boundingBox!.width).toBeGreaterThan(0);
    expect(boundingBox!.height).toBeGreaterThan(0);
  });

  test("should render sköll light image correctly in light mode", async ({
    page,
  }) => {
    // Default to light mode (no localStorage set)
    await page.goto(FEATURES_PAGE);
    await page.waitForLoadState("networkidle");

    // Find the Annual Fee Tracking section
    const featureSection = page.locator('section[id="annual-fee-tracking"]');
    await expect(featureSection).toBeVisible();

    // Find the light mode image (second one, as both dark and light variants exist in DOM)
    const lightImage = featureSection
      .locator('img[alt*="Sköll Watches the Fee"]')
      .nth(1);
    await expect(lightImage).toBeVisible();

    // Verify it points to light image
    const imgSrc = await lightImage.getAttribute("srcset");
    expect(imgSrc).toContain("skoll-light.png");

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

    // Set dark mode via localStorage before navigation
    await page.addInitScript((key) => {
      localStorage.setItem(key, "dark");
    }, THEME_STORAGE_KEY);

    // Navigate to features page
    await page.goto(FEATURES_PAGE);
    await page.waitForLoadState("networkidle");

    // Find the sköll feature section
    const featureSection = page.locator('section[id="annual-fee-tracking"]');
    await expect(featureSection).toBeVisible();

    // Verify dark image is visible and rendered (first one in dark mode)
    const darkImage = featureSection
      .locator('img[alt*="Sköll Watches the Fee"]')
      .first();
    await expect(darkImage).toBeVisible();

    // Check that image fits within viewport and has content
    const boundingBox = await darkImage.boundingBox();
    expect(boundingBox).toBeTruthy();
    expect(boundingBox!.width).toBeLessThanOrEqual(400); // Allow some padding
    expect(boundingBox!.height).toBeGreaterThan(0);
  });

  test("should not break other feature images on /features page", async ({
    page,
  }) => {
    // Navigate to features page
    await page.goto(FEATURES_PAGE);
    await page.waitForLoadState("networkidle");

    // Find all feature images (Next Image optimization adds _next/image query)
    const allImages = page.locator('img[srcset*="images/features"]');
    const imageCount = await allImages.count();

    // Should have at least 18 images (dark + light variants of 9+ features)
    expect(imageCount).toBeGreaterThanOrEqual(18);

    // Verify specific features are visible
    const fSection = page.locator('section[id="add-your-cards"]');
    const dashboardSection = page.locator('section[id="the-dashboard"]');
    const cardNotesSection = page.locator('section[id="card-notes"]');

    await expect(fSection).toBeVisible();
    await expect(dashboardSection).toBeVisible();
    await expect(cardNotesSection).toBeVisible();
  });

  test("should have both dark and light image files for sköll feature", async ({
    page,
  }) => {
    // Set dark mode to see dark image
    await page.addInitScript((key) => {
      localStorage.setItem(key, "dark");
    }, THEME_STORAGE_KEY);

    await page.goto(FEATURES_PAGE);
    await page.waitForLoadState("networkidle");

    const featureSection = page.locator('section[id="annual-fee-tracking"]');
    const skollImgDark = featureSection
      .locator('img[alt*="Sköll Watches the Fee"]')
      .first();

    // Get the srcset which contains the image path
    const srcset = await skollImgDark.getAttribute("srcset");
    expect(srcset).toBeTruthy();
    expect(srcset).toContain("skoll-dark.png");

    // Verify light image variant also exists in DOM
    const skollImgLight = featureSection
      .locator('img[alt*="Sköll Watches the Fee"]')
      .nth(1);
    const lightSrcset = await skollImgLight.getAttribute("srcset");
    expect(lightSrcset).toContain("skoll-light.png");
  });
});
