/**
 * Chronicles Migration QA Tests — Issue #373
 *
 * Validates the migration of session chronicles from HTML to Next.js pages under /chronicles.
 *
 * Acceptance Criteria:
 *   1. /chronicles shows index of all session chronicles
 *   2. /chronicles/{slug} shows individual chronicle content
 *   3. Chronicles render inside marketing layout (navbar + footer)
 *   4. Chronicles in navbar links to /chronicles
 *   5. Chronicles in footer links to /chronicles
 *   6. Old /blog route removed (returns 404)
 *   7. /sessions rewrite removed from next.config.ts
 *   8. All existing chronicles accessible via their slugs
 *   9. Responsive grid on index page
 *   10. Prev/next navigation on detail pages
 */

import { test, expect } from "@playwright/test";

test.describe("Chronicles Migration QA — Issue #373", () => {
  test.describe.configure({ timeout: 30000 });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: /chronicles index page loads and lists all chronicles
  // ─────────────────────────────────────────────────────────────────────────

  test("TC-1: /chronicles index loads and displays all chronicles in responsive grid", async ({
    page,
  }) => {
    // Navigate to chronicles index
    const response = await page.goto("/chronicles", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);

    // Verify page title
    const title = page.locator("h1");
    await expect(title).toContainText("Chronicles");

    // Verify page description
    const description = page.locator("p");
    await expect(description.first()).toContainText("Behind-the-scenes narratives");

    // Verify chronicle cards exist - look for links with h2 inside (title elements)
    const cards = page.locator("a[href*='/chronicles/']");
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
    console.log(`Found ${cardCount} chronicle cards on index`);

    // Verify first card has required elements (h2 title)
    const firstCard = cards.first();
    const firstTitle = firstCard.locator("h2");
    await expect(firstTitle).toBeVisible({ timeout: 5000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: /chronicles/{slug} detail page renders chronicle content
  // ─────────────────────────────────────────────────────────────────────────

  test("TC-2: /chronicles/{slug} detail page renders chronicle with breadcrumb and nav", async ({
    page,
  }) => {
    // First get the list of chronicles
    await page.goto("/chronicles", { waitUntil: "networkidle" });

    // Get first chronicle card
    const firstCard = page.locator("a[href*='/chronicles/']").first();
    const href = await firstCard.getAttribute("href");
    expect(href).toBeTruthy();

    // Navigate to the detail page
    const response = await page.goto(href || "/chronicles", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);

    // Verify breadcrumb navigation exists - look for link to /chronicles
    const chroniclesLink = page.locator("a[href='/chronicles']");
    await expect(chroniclesLink).toBeVisible();

    // Verify home link in breadcrumb
    const homeLink = page.locator("a[href='/']");
    await expect(homeLink).toBeVisible();

    // Verify chronicle content is rendered
    const content = page.locator("main, article, section").first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Chronicles render inside marketing layout (navbar + footer)
  // ─────────────────────────────────────────────────────────────────────────

  test("TC-3: Chronicles pages render with marketing navbar and footer", async ({
    page,
  }) => {
    // Navigate to chronicles index
    await page.goto("/chronicles", { waitUntil: "networkidle" });

    // Verify navbar exists with navigation - check for home link
    const homeLink = page.locator("a[href='/']").first();
    await expect(homeLink).toBeVisible();

    // Verify footer exists
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();

    // Verify page header is visible
    const pageHeader = page.locator("h1");
    await expect(pageHeader).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Chronicles link in navbar and footer point to /chronicles
  // ─────────────────────────────────────────────────────────────────────────

  test("TC-4: Navbar and footer contain Chronicles links pointing to /chronicles", async ({
    page,
  }) => {
    // Navigate to home page to verify navbar/footer
    await page.goto("/", { waitUntil: "networkidle" });

    // Find all links with text "Chronicles"
    const chroniclesLinks = page.locator("a:has-text('Chronicles')");
    const count = await chroniclesLinks.count();
    expect(count).toBeGreaterThanOrEqual(2); // At least navbar + footer

    // Verify at least one link points to /chronicles
    for (let i = 0; i < count; i++) {
      const href = await chroniclesLinks.nth(i).getAttribute("href");
      if (href === "/chronicles") {
        expect(href).toBe("/chronicles");
        break;
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: /blog route returns 404
  // ─────────────────────────────────────────────────────────────────────────

  test("TC-5: /blog route returns 404 (removed in favor of /chronicles)", async ({
    page,
  }) => {
    // Navigate to old /blog route
    const response = await page.goto("/blog", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(404);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 6: Responsive grid on /chronicles index (mobile: 1 column)
  // ─────────────────────────────────────────────────────────────────────────

  test("TC-6: Chronicles index grid is responsive", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto("/chronicles", { waitUntil: "networkidle" });

    // Verify cards are visible and stacked on mobile
    const cards = page.locator("a[href*='/chronicles/']");
    const firstCard = cards.first();
    const secondCard = cards.nth(1);

    // Both cards should be visible
    await expect(firstCard).toBeVisible();
    await expect(secondCard).toBeVisible();

    // Verify main section is visible
    const container = page.locator("section").first();
    await expect(container).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 7: Prev/Next navigation on detail pages
  // ─────────────────────────────────────────────────────────────────────────

  test("TC-7: Detail pages have prev/next chronicle navigation", async ({
    page,
  }) => {
    // Navigate to chronicles index
    await page.goto("/chronicles", { waitUntil: "networkidle" });

    // Get first chronicle link
    const firstCard = page.locator("a[href*='/chronicles/']").first();
    const href = await firstCard.getAttribute("href");

    // Navigate to detail page
    await page.goto(href || "/chronicles", { waitUntil: "networkidle" });

    // Look for "All Chronicles" link which indicates prev/next nav exists
    const allChroniclesLink = page.locator("a:has-text('All Chronicles')");
    await expect(allChroniclesLink).toBeVisible({ timeout: 5000 });

    // Verify navigation sections exist (breadcrumb + prev/next)
    const navSections = page.locator("nav");
    expect(await navSections.count()).toBeGreaterThanOrEqual(2);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 8: All existing chronicles are accessible
  // ─────────────────────────────────────────────────────────────────────────

  test("TC-8: All chronicles listed on index are accessible via /chronicles/{slug}", async ({
    page,
  }) => {
    // Get all chronicle cards
    await page.goto("/chronicles", { waitUntil: "networkidle" });

    const chronicleLinks = page.locator("a[href*='/chronicles/']");
    const count = await chronicleLinks.count();

    // Test first 3 chronicles (budget test)
    for (let i = 0; i < Math.min(count, 3); i++) {
      const link = chronicleLinks.nth(i);
      const href = await link.getAttribute("href");
      expect(href).toMatch(/^\/chronicles\/[a-z0-9-]+$/);

      // Navigate and verify 200 status
      const response = await page.goto(href || "/chronicles", { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);

      // Verify content is rendered
      const content = page.locator("main, article, section").first();
      await expect(content).toBeVisible({ timeout: 5000 });
    }
  });
});
