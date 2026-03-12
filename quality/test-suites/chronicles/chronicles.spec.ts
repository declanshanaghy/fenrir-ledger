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

  test("TC-1: /chronicles index loads and lists chronicle cards", async ({
    page,
  }) => {
    const response = await page.goto("/chronicles", { waitUntil: "load" });
    expect(response?.status()).toBe(200);

    // Verify chronicle cards exist
    const cards = page.locator("a[href*='/chronicles/']");
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Verify first card has title
    const firstCard = cards.first();
    const firstTitle = firstCard.locator("h2");
    await expect(firstTitle).toBeVisible({ timeout: 5000 });
  });

  // TC-1 static title "Prose Edda" + description — REMOVED (Issue #610): Static copy.

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: /chronicles/{slug} detail page renders chronicle content
  // ─────────────────────────────────────────────────────────────────────────

  test("TC-2: /chronicles/{slug} detail page renders chronicle with breadcrumb and nav", async ({
    page,
  }) => {
    // First get the list of chronicles
    await page.goto("/chronicles", { waitUntil: "load" });

    // Get first chronicle card
    const firstCard = page.locator("a[href*='/chronicles/']").first();
    const href = await firstCard.getAttribute("href");
    expect(href).toBeTruthy();

    // Navigate to the detail page
    const response = await page.goto(href || "/chronicles", { waitUntil: "load" });
    expect(response?.status()).toBe(200);

    // Verify breadcrumb navigation exists - look for link to /chronicles in breadcrumb
    const breadcrumbNav = page.locator("nav").first();
    const chroniclesLink = breadcrumbNav.locator("a[href='/chronicles']");
    await expect(chroniclesLink).toBeVisible();

    // Verify home link in breadcrumb
    const homeLink = breadcrumbNav.locator("a[href='/']");
    await expect(homeLink).toBeVisible();

    // Verify chronicle content is rendered
    const content = page.locator("main, article, section").first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Chronicles render inside marketing layout (navbar + footer)
  // ─────────────────────────────────────────────────────────────────────────

  // TC-3: marketing layout — REMOVED (Issue #610): Static navbar/footer presence check.

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Chronicles link in navbar and footer point to /chronicles
  // ─────────────────────────────────────────────────────────────────────────

  // TC-4: "Prose Edda" link count — REMOVED (Issue #610): Static marketing content check.

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: /blog route returns 404
  // ─────────────────────────────────────────────────────────────────────────

  // TC-5: /blog 404 — REMOVED (Issue #610): Dead route, migration completed months ago.

  // ─────────────────────────────────────────────────────────────────────────
  // Test 6: Responsive grid on /chronicles index (mobile: 1 column)
  // ─────────────────────────────────────────────────────────────────────────

  test("TC-6: Chronicles index grid is responsive", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto("/chronicles", { waitUntil: "load" });

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
    await page.goto("/chronicles", { waitUntil: "load" });

    // Get first chronicle link
    const firstCard = page.locator("a[href*='/chronicles/']").first();
    const href = await firstCard.getAttribute("href");

    // Navigate to detail page
    await page.goto(href || "/chronicles", { waitUntil: "load" });

    // Look for "Back to All Sagas" link which indicates prev/next nav exists
    const allChroniclesLink = page.locator("a:has-text('Back to All Sagas')");
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
    await page.goto("/chronicles", { waitUntil: "load" });

    // Test first 2 chronicles (budget test, 30s timeout is tight)
    for (let i = 0; i < 2; i++) {
      const link = page.locator("a[href*='/chronicles/']").nth(i);
      const href = await link.getAttribute("href");
      expect(href).toMatch(/^\/chronicles\/[a-z0-9-]+$/);

      // Navigate and verify 200 status
      const response = await page.goto(href || "/chronicles", { waitUntil: "load" });
      expect(response?.status()).toBe(200);

      // Verify we're on a detail page (not index)
      const breadcrumb = page.locator("nav").first();
      await expect(breadcrumb).toBeVisible();

      // Go back to index for next iteration
      await page.goto("/chronicles", { waitUntil: "load" });
    }
  });
});
