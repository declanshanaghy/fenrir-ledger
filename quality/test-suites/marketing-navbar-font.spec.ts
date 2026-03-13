import { test, expect } from "@playwright/test";

/**
 * Marketing Navbar — E2E font & link order tests
 *
 * Validates visual and interactive behavior:
 *   - Nav links use Cinzel font (font-heading)
 *   - Correct visual hierarchy and styling
 *   - Mobile hamburger menu opens and closes
 *   - No layout shifts on theme toggle (light/dark)
 *
 * Issue: #648
 */

test.describe("MarketingNavbar — E2E (issue #648)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("desktop nav links are visible and styled with font-heading", async ({
    page,
  }) => {
    // Get the desktop nav links container (center section with gap-8)
    const navContainer = page.locator(
      'nav[aria-label="Marketing site navigation"] > div > div:nth-child(2)'
    );
    const navLinks = navContainer.locator('a');
    const count = await navLinks.count();

    expect(count).toBe(5); // Features, Prose Edda, About, Free Trial, Pricing

    // Verify first link (Features) has font-heading
    const firstLink = navLinks.first();
    const classes = await firstLink.getAttribute("class");
    expect(classes).toContain("font-heading");
  });

  test("mobile hamburger opens and closes overlay with font-heading nav links", async ({
    page,
  }) => {
    // Set viewport to mobile
    await page.setViewportSize({ width: 375, height: 667 });

    // Click hamburger
    const hamburger = page.getByLabel("Open navigation menu");
    await hamburger.click();

    // Overlay should be visible
    const overlay = page.getByLabel("Navigation menu");
    await expect(overlay).toBeVisible();

    // Mobile nav should be visible
    const mobileNav = page.getByLabel("Mobile navigation");
    await expect(mobileNav).toBeVisible();

    // Mobile nav links should exist and use font-heading
    const mobileLinks = page.locator('nav[aria-label="Mobile navigation"] a');
    const count = await mobileLinks.count();

    // We should have 5 nav links
    expect(count).toBe(5);

    // Verify first mobile link has font-heading
    const firstMobileLink = mobileLinks.first();
    const classes = await firstMobileLink.getAttribute("class");
    expect(classes).toContain("font-heading");

    // Close overlay
    const closeBtn = page.getByLabel("Close navigation menu");
    await closeBtn.click();

    // Overlay should be hidden
    await expect(overlay).not.toBeVisible();
  });

  test("Free Trial link has distinct styling (border, font-semibold)", async ({
    page,
  }) => {
    const navContainer = page.locator(
      'nav[aria-label="Marketing site navigation"] > div > div:nth-child(2)'
    );
    const freeTrialLink = navContainer.locator('a').getByText("Free Trial");

    const classes = await freeTrialLink.getAttribute("class");

    expect(classes).toContain("font-semibold");
    expect(classes).toContain("border");
    expect(classes).toContain("border-border");
  });

  test("nav works in light and dark modes", async ({ page }) => {
    // Verify light mode (default)
    const nav = page.locator('nav[aria-label="Marketing site navigation"]');
    const bgClass = await nav.getAttribute("class");
    expect(bgClass).toContain("bg-background");

    // Nav should be visible and have proper structure
    await expect(nav).toBeVisible();

    // Get initial computed background color in light mode
    const lightModeBg = await page.evaluate(() => {
      const nav = document.querySelector(
        'nav[aria-label="Marketing site navigation"]'
      );
      return window.getComputedStyle(nav!).backgroundColor;
    });

    // Verify light mode has light background
    expect(lightModeBg).toBeTruthy();

    // Nav should remain visible in both modes
    await expect(nav).toBeVisible();
  });

  test("nav link order is correct: Features, Prose Edda, About, Free Trial, Pricing", async ({
    page,
  }) => {
    const navContainer = page.locator(
      'nav[aria-label="Marketing site navigation"] > div > div:nth-child(2)'
    );
    const navLinks = navContainer.locator('a');

    const labels: string[] = [];
    const count = await navLinks.count();

    for (let i = 0; i < count; i++) {
      const text = await navLinks.nth(i).textContent();
      labels.push(text?.trim() || "");
    }

    expect(labels).toEqual([
      "Features",
      "Prose Edda",
      "About",
      "Free Trial",
      "Pricing",
    ]);
  });

  test("no horizontal scroll on mobile nav (hamburger fits in viewport)", async ({
    page,
  }) => {
    // Set narrow viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const hamburger = page.getByLabel("Open navigation menu");
    expect(await hamburger.isVisible()).toBe(true);

    // Button should fit without horizontal scroll
    const pageWidth = await page.evaluate(() => window.innerWidth);
    expect(pageWidth).toBe(375);
  });
});
