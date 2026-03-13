import { test, expect } from "@playwright/test";

/**
 * Marketing Navbar — E2E nav active highlighting tests
 *
 * Validates that the nav correctly highlights the link matching the current page,
 * not always "Free Trial". Tests both desktop and mobile viewports.
 *
 * Issue: #662
 */

test("nav: highlights Features link when on /features", async ({ page }) => {
    await page.goto("/features");

    const nav = page.locator('nav[aria-label="Marketing site navigation"]');
    const featuresLink = nav.locator("a", { hasText: "Features" });
    const freeTrialLink = nav.locator("a", { hasText: "Free Trial" });

    // Features should be marked as current page
    await expect(featuresLink).toHaveAttribute("aria-current", "page");

    // Free Trial should NOT be marked as current
    const freeTrialAriaAttr = await freeTrialLink.getAttribute("aria-current");
    expect(freeTrialAriaAttr).toBeNull();

    // Features should have the active styling
    const featuresClasses = await featuresLink.getAttribute("class");
    expect(featuresClasses).toContain("font-semibold");
  });

test("nav: highlights Prose Edda link when on /chronicles", async ({ page }) => {
    await page.goto("/chronicles");

    const nav = page.locator('nav[aria-label="Marketing site navigation"]');
    const proseEddaLink = nav.locator("a", { hasText: "Prose Edda" });
    const freeTrialLink = nav.locator("a", { hasText: "Free Trial" });

    // Prose Edda should be marked as current page
    await expect(proseEddaLink).toHaveAttribute("aria-current", "page");

    // Free Trial should NOT be marked as current
    const freeTrialAriaAttr = await freeTrialLink.getAttribute("aria-current");
    expect(freeTrialAriaAttr).toBeNull();

    // Prose Edda should have active styling
    const proseEddaClasses = await proseEddaLink.getAttribute("class");
    expect(proseEddaClasses).toContain("font-semibold");
  });

test("nav: highlights About link when on /about", async ({ page }) => {
    await page.goto("/about");

    const nav = page.locator('nav[aria-label="Marketing site navigation"]');
    const aboutLink = nav.locator("a", { hasText: "About" });
    const freeTrialLink = nav.locator("a", { hasText: "Free Trial" });

    // About should be marked as current page
    await expect(aboutLink).toHaveAttribute("aria-current", "page");

    // Free Trial should NOT be marked as current
    const freeTrialAriaAttr = await freeTrialLink.getAttribute("aria-current");
    expect(freeTrialAriaAttr).toBeNull();
  });

test("nav: highlights Free Trial link only when on /free-trial", async ({
    page,
  }) => {
    await page.goto("/free-trial");

    const nav = page.locator('nav[aria-label="Marketing site navigation"]');
    const freeTrialLink = nav.locator("a", { hasText: "Free Trial" });
    const pricingLink = nav.locator("a", { hasText: "Pricing" });

    // Free Trial should be marked as current page
    await expect(freeTrialLink).toHaveAttribute("aria-current", "page");

    // Pricing should NOT be marked as current
    const pricingAriaAttr = await pricingLink.getAttribute("aria-current");
    expect(pricingAriaAttr).toBeNull();

    // Free Trial should have active styling
    const freeTrialClasses = await freeTrialLink.getAttribute("class");
    expect(freeTrialClasses).toContain("font-semibold");
    expect(freeTrialClasses).toContain("border");
  });

test("nav: highlights Pricing link when on /pricing", async ({ page }) => {
    await page.goto("/pricing");

    const nav = page.locator('nav[aria-label="Marketing site navigation"]');
    const pricingLink = nav.locator("a", { hasText: "Pricing" });
    const freeTrialLink = nav.locator("a", { hasText: "Free Trial" });

    // Pricing should be marked as current page
    await expect(pricingLink).toHaveAttribute("aria-current", "page");

    // Free Trial should NOT be marked as current
    const freeTrialAriaAttr = await freeTrialLink.getAttribute("aria-current");
    expect(freeTrialAriaAttr).toBeNull();

    // Pricing should have active styling
    const pricingClasses = await pricingLink.getAttribute("class");
    expect(pricingClasses).toContain("font-semibold");
  });

test("nav: no nav link is highlighted on home page (/)", async ({ page }) => {
    await page.goto("/");

    const nav = page.locator('nav[aria-label="Marketing site navigation"]');
    const allLinks = nav.locator("a");

    // Check that no link has aria-current="page"
    const count = await allLinks.count();
    for (let i = 0; i < count; i++) {
      const ariaAttr = await allLinks.nth(i).getAttribute("aria-current");
      expect(ariaAttr).toBeNull();
    }
  });

test("nav: mobile menu renders correctly on /features", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/features");

    // Verify hamburger button is visible on mobile
    const hamburger = page.getByLabel("Open navigation menu");
    await expect(hamburger).toBeVisible();

    // Verify main nav still has the active state set correctly on mobile
    const nav = page.locator('nav[aria-label="Marketing site navigation"]');
    const featuresLink = nav.locator("a", { hasText: "Features" });

    // Even on mobile, the nav link should have aria-current for accessibility
    await expect(featuresLink).toHaveAttribute("aria-current", "page");
  });

test("nav: mobile menu renders correctly on /free-trial", async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/free-trial");

    // Verify hamburger button is visible on mobile
    const hamburger = page.getByLabel("Open navigation menu");
    await expect(hamburger).toBeVisible();

    // Verify main nav still has the active state set correctly on mobile
    const nav = page.locator('nav[aria-label="Marketing site navigation"]');
    const freeTrialLink = nav.locator("a", { hasText: "Free Trial" });

    // Even on mobile, the nav link should have aria-current for accessibility
    await expect(freeTrialLink).toHaveAttribute("aria-current", "page");
  });

test("nav: highlighting updates when navigating between pages", async ({
    page,
  }) => {
    // Start on /features
    await page.goto("/features");
    const nav = page.locator('nav[aria-label="Marketing site navigation"]');
    let featuresLink = nav.locator("a", { hasText: "Features" });
    await expect(featuresLink).toHaveAttribute("aria-current", "page");

    // Navigate to /pricing
    await page.goto("/pricing");
    const pricingLink = nav.locator("a", { hasText: "Pricing" });
    await expect(pricingLink).toHaveAttribute("aria-current", "page");

    // Features should no longer be highlighted
    featuresLink = nav.locator("a", { hasText: "Features" });
    const featuresAriaAttr = await featuresLink.getAttribute("aria-current");
    expect(featuresAriaAttr).toBeNull();
  });
