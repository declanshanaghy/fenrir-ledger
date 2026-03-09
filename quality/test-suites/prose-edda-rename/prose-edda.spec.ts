import { test, expect } from "@playwright/test";

/**
 * Prose Edda Rename QA Suite — Issue #429
 *
 * Validates the complete Chronicles → Prose Edda rename:
 * - Visible text updated everywhere (nav, headings, titles)
 * - URL paths remain /chronicles (unchanged)
 * - Norse voice copy on index page
 * - Meta titles updated
 * - No broken links
 */

test.describe("Issue #429: Chronicles → Prose Edda Rename", () => {
  test("Navigation displays 'Prose Edda' instead of Chronicles", async ({
    page,
  }) => {
    await page.goto("/");

    // Desktop nav should show "Prose Edda"
    const desktopNav = page.locator('[role="navigation"]');
    await expect(desktopNav).toContainText("Prose Edda");

    // Ensure "Chronicles" is NOT visible in nav
    const navText = await desktopNav.textContent();
    expect(navText).not.toMatch(/\bChronicles\b/);
  });

  test("Prose Edda index page uses /chronicles URL with correct title", async ({
    page,
  }) => {
    await page.goto("/chronicles");

    // URL path must remain /chronicles
    expect(page.url()).toContain("/chronicles");

    // Page title must be "Prose Edda"
    const title = await page.locator("h1").first().textContent();
    expect(title).toContain("Prose Edda");
  });

  test("Meta title includes 'Prose Edda'", async ({ page }) => {
    await page.goto("/chronicles");

    const pageTitle = await page.title();
    expect(pageTitle).toContain("Prose Edda");
    expect(pageTitle).toContain("Fenrir Ledger");
  });

  test("Meta description contains Norse voice copy", async ({ page }) => {
    await page.goto("/chronicles");

    const metaDesc = await page
      .locator('meta[name="description"]')
      .getAttribute("content");

    // Should mention skalds, runes, and sagas
    expect(metaDesc).toMatch(/saga|skald|rune/i);
  });

  test("Index page contains full Norse voice copy", async ({ page }) => {
    await page.goto("/chronicles");

    const body = await page.locator("body").textContent();

    // Should contain key Norse voice phrases
    expect(body).toMatch(/sagas of the forge/i);
    expect(body).toMatch(/carved into the record/i);
    expect(body).toMatch(/wolf does not explain/i);
  });

  test("Navigation link to Prose Edda is clickable and works", async ({
    page,
  }) => {
    await page.goto("/");

    // Click the Prose Edda nav link (from marketing nav, not footer)
    const link = page
      .locator('[role="navigation"]')
      .locator('a[href="/chronicles"]')
      .first();
    await link.click();

    // Wait for navigation to complete
    await page.waitForURL("**/chronicles");

    // Should see the Prose Edda heading
    await expect(page.locator("h1")).toContainText("Prose Edda");
  });

  test("No broken links in Prose Edda index cards", async ({ page }) => {
    await page.goto("/chronicles");

    // Get all chronicle card links
    const links = await page.locator("a[href*='/chronicles/']").all();

    // Each link should be valid (non-empty href)
    for (const link of links) {
      const href = await link.getAttribute("href");
      expect(href).toMatch(/^\/chronicles\/[\w-]+$/);
    }
  });

  test("Footer links reference Prose Edda correctly", async ({ page }) => {
    await page.goto("/");

    const footer = page.locator("footer");
    if (await footer.isVisible()) {
      const footerText = await footer.textContent();

      // If chronicles is mentioned in footer, it should be about the path, not the display name
      // The important thing: no visible "Chronicles" text in footer UI
      const chroniclesCount = (footerText?.match(/\bChronicles\b/g) || []).length;
      expect(chroniclesCount).toBe(0);
    }
  });

  test("Mobile navigation shows 'Prose Edda'", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/");

    // Open mobile menu
    await page.click('button[aria-label="Open navigation menu"]');

    // Should see "Prose Edda" in the overlay
    const overlay = page.locator('[role="dialog"]');
    await expect(overlay).toContainText("Prose Edda");
  });

  test("'Prose Edda' appears in all visible headings on index", async ({
    page,
  }) => {
    await page.goto("/chronicles");

    const mainHeading = page.locator("h1").first();
    await expect(mainHeading).toContainText("Prose Edda");

    // No instances of "Chronicles" in visible headings
    const allHeadings = page.locator("h1, h2, h3");
    const headingText = await allHeadings.allTextContents();

    headingText.forEach((text) => {
      expect(text).not.toMatch(/\bChronicles\b/);
    });
  });
});
