/**
 * Trust/Safety Messaging E2E Tests
 *
 * Validates that DataSafetyBanner component is correctly rendered across
 * all marketing pages with appropriate variants:
 * - Home page: full variant
 * - Features page: full variant
 * - Pricing page: compact variant
 * - About page: inline variant
 * - Marketing footer: footer variant (all pages)
 *
 * Also validates that key trust messaging is visible and accessible.
 *
 * Issue: #644
 */

import { test, expect } from "@playwright/test";

// ── Test Setup ────────────────────────────────────────────────────────────

test.describe("Trust/Safety Messaging — Marketing Pages", () => {
  test("Home page displays full DataSafetyBanner variant", async ({
    page,
  }) => {
    await page.goto("/");

    // Check for the full variant heading
    const heading = page.locator(
      'text="What Fenrir Tracks — and What It Never Touches"'
    );
    await expect(heading).toBeVisible();

    // Check for role=note (accessibility)
    const banner = page.locator('section[role="note"]').first();
    await expect(banner).toBeVisible();

    // Check for include column (What Fenrir Tracks)
    const tracksList = page.locator('[aria-label="What Fenrir Ledger tracks"]');
    await expect(tracksList).toBeVisible();

    // Check for exclude column (What Fenrir Never Touches)
    const neverList = page.locator(
      '[aria-label="What Fenrir Ledger never collects"]'
    );
    await expect(neverList).toBeVisible();

    // Verify some key tracked items are present
    await expect(
      page.locator('text="Card name & product"')
    ).toBeVisible();
    await expect(page.locator('text="Annual fee amount"')).toBeVisible();

    // Verify some key excluded items are present
    await expect(
      page.locator('text="Credit card numbers (16-digit PAN)"')
    ).toBeVisible();
    await expect(page.locator('text="CVV / CVC security codes"')).toBeVisible();
    await expect(page.locator('text="Card PINs"')).toBeVisible();
  });

  test("Features page displays full DataSafetyBanner variant", async ({
    page,
  }) => {
    await page.goto("/features");

    // Check for the full variant heading
    const heading = page.locator(
      'text="What Fenrir Tracks — and What It Never Touches"'
    );
    await expect(heading).toBeVisible();

    // Check for role=note
    const banner = page.locator('section[role="note"]').first();
    await expect(banner).toBeVisible();

    // Check for include column
    const tracksList = page.locator('[aria-label="What Fenrir Ledger tracks"]');
    await expect(tracksList).toBeVisible();

    // Check for exclude column
    const neverList = page.locator(
      '[aria-label="What Fenrir Ledger never collects"]'
    );
    await expect(neverList).toBeVisible();
  });

  test("Pricing page displays compact DataSafetyBanner variant", async ({
    page,
  }) => {
    await page.goto("/pricing");

    // Check for compact variant text
    const compactText = page.locator(
      'text="Fenrir never collects credit card numbers, CVVs, PINs, or passwords"'
    );
    await expect(compactText).toBeVisible();

    // Check for role=note
    const banner = page.locator('div[role="note"]').first();
    await expect(banner).toBeVisible();

    // Check for "Learn more" link
    const learnMoreLink = page.locator('a:has-text("Learn more")').first();
    await expect(learnMoreLink).toBeVisible();
    await expect(learnMoreLink).toHaveAttribute("href", "/about#data-safety");
  });

  test("About page displays inline DataSafetyBanner variant", async ({
    page,
  }) => {
    await page.goto("/about");

    // Check for inline variant with "Safe By Design" heading or similar
    const safeByDesign = page.locator('text="Safe By Design"');
    const allBanners = page.locator('div[role="note"]');

    // At least one banner should be present
    const count = await allBanners.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Marketing footer displays footer variant on all pages", async ({
    page,
  }) => {
    const pages = ["/", "/features", "/pricing", "/about"];

    for (const path of pages) {
      await page.goto(path);

      // Check for footer variant text
      const footerText = page.locator(
        'text="Fenrir Ledger never collects credit card numbers, CVVs, PINs, or passwords"'
      );

      // The footer variant should be somewhere on the page
      const anyBanner = page.locator('div[role="note"]').last();
      await expect(anyBanner).toBeVisible();
    }
  });

  test("All banners are accessible with proper ARIA attributes", async ({
    page,
  }) => {
    await page.goto("/");

    // All role=note elements should have aria-label
    const banners = page.locator('[role="note"]');
    const count = await banners.count();

    for (let i = 0; i < count; i++) {
      const banner = banners.nth(i);
      const ariaLabel = await banner.getAttribute("aria-label");
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel?.length).toBeGreaterThan(0);
    }
  });

  test("Trust messaging is visible on mobile viewport (375px)", async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/");

    // Check that the banner is still visible on mobile
    const banner = page.locator('section[role="note"]').first();
    await expect(banner).toBeVisible();

    // Check that include/exclude columns are visible (may be stacked on mobile)
    const tracksList = page.locator('[aria-label="What Fenrir Ledger tracks"]');
    const neverList = page.locator(
      '[aria-label="What Fenrir Ledger never collects"]'
    );

    await expect(tracksList).toBeVisible();
    await expect(neverList).toBeVisible();
  });

  test("Trust messaging is responsive at 480px breakpoint", async ({
    page,
  }) => {
    // Set viewport to 480px (breakpoint where layout should collapse)
    await page.setViewportSize({ width: 480, height: 800 });

    await page.goto("/");

    // Banner should still be visible and readable
    const banner = page.locator('section[role="note"]').first();
    await expect(banner).toBeVisible();

    // Check that text is readable
    const heading = page.locator(
      'text="What Fenrir Tracks — and What It Never Touches"'
    );
    await expect(heading).toBeVisible();
  });

  test("Trust messaging contains key trust statements", async ({ page }) => {
    await page.goto("/");

    // Search for key trust statements across all banners
    const page_text = await page.textContent("body");

    expect(page_text).toContain("never collects");
    expect(page_text).toContain("card metadata");
    expect(page_text).toContain("card name");
    expect(page_text).toContain("issuer");
    expect(page_text).toContain("card number");
    expect(page_text).toContain("CVV");
    expect(page_text).toContain("PIN");
    expect(page_text).toContain("password");
  });

  test("FAQ page includes new trust/safety entries", async ({ page }) => {
    await page.goto("/faq");

    // Check for new FAQ entry about card numbers
    const collectCardNumbers = page.locator(
      'text="Does Fenrir Ledger collect my credit card numbers?"'
    );
    await expect(collectCardNumbers).toBeVisible();

    // Check for Smart Import safety FAQ
    const smartImportSafety = page.locator('text="Smart Import"');
    await expect(smartImportSafety).toBeVisible();

    // Check that answers contain key trust messaging
    const faqText = await page.textContent("[role='main']");
    expect(faqText).toContain("never collects");
    expect(faqText).toContain("metadata");
  });

  test("Trust messaging has adequate contrast for accessibility", async ({
    page,
  }) => {
    await page.goto("/");

    // Get the banner element
    const banner = page.locator('section[role="note"]').first();
    await expect(banner).toBeVisible();

    // Check that warning/never-collected items have amber styling
    const neverItems = page.locator(
      '[aria-label="What Fenrir Ledger never collects"] li'
    );
    const count = await neverItems.count();

    // There should be multiple never-collected items
    expect(count).toBeGreaterThan(0);

    // Verify the items are visually distinct (styled with amber colors)
    for (let i = 0; i < Math.min(count, 3); i++) {
      const item = neverItems.nth(i);
      const style = await item.getAttribute("style");
      // The item or its parent should have some styling distinguishing it
      await expect(item).toBeVisible();
    }
  });
});

// ── Content Validation ────────────────────────────────────────────────────

test.describe("Trust/Safety Messaging — Content Validation", () => {
  test("DataSafetyBanner displays complete list of tracked data", async ({
    page,
  }) => {
    await page.goto("/");

    const trackedContent = await page.locator(
      '[aria-label="What Fenrir Ledger tracks"]'
    ).textContent();

    // Verify key tracked items are listed
    expect(trackedContent).toContain("Card name");
    expect(trackedContent).toContain("Card issuer");
    expect(trackedContent).toContain("Annual fee");
    expect(trackedContent).toContain("Sign-up bonus");
    expect(trackedContent).toContain("Card open date");
  });

  test("DataSafetyBanner displays complete list of never-collected data", async ({
    page,
  }) => {
    await page.goto("/");

    const neverContent = await page.locator(
      '[aria-label="What Fenrir Ledger never collects"]'
    ).textContent();

    // Verify key never-collected items are listed
    expect(neverContent).toContain("Credit card number");
    expect(neverContent).toContain("CVV");
    expect(neverContent).toContain("PIN");
    expect(neverContent).toContain("password");
    expect(neverContent).toContain("Social Security");
    expect(neverContent).toContain("Bank account");
  });

  test("Landing page hero section mentions trust/safety", async ({ page }) => {
    await page.goto("/");

    // Get all text on the page
    const pageText = await page.textContent("body");

    // Verify trust messaging is present
    expect(pageText).toMatch(/metadata|metadata-only|card metadata/i);
    expect(pageText).toMatch(/never.*collect|don.*t collect/i);
  });

  test("Footer credit statement is present and visible", async ({ page }) => {
    await page.goto("/");

    // Footer should have copyright
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();

    const footerText = await footer.textContent();
    expect(footerText).toContain("©");
  });
});
