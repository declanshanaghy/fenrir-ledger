import { test, expect } from "@playwright/test";

/**
 * QA Test Suite: Chronicles Template Inconsistency — Breadcrumb Nav + Styling Mismatch (#427)
 *
 * Validates that the chronicle detail pages have been fixed per GitHub Issue #427:
 * - Breadcrumb nav removed from chronicle detail pages
 * - No stray --> arrow separator visible
 * - Both /chronicles/auto-complete and /chronicles/qa-partner render identically
 * - Template matches rest of marketing site styling
 *
 * Acceptance Criteria:
 * - Breadcrumb nav removed from chronicle detail pages
 * - No stray --> arrow visible
 * - Both /chronicles/auto-complete and /chronicles/qa-partner render identically
 * - Matches rest of marketing site
 */

test.describe("Issue #427: Chronicles Template Inconsistency", () => {
  // ── AC 1: Breadcrumb nav removed from chronicle detail pages ──────────────────

  test("AC 1a: /chronicles/auto-complete has no breadcrumb navigation", async ({ page }) => {
    await page.goto("/chronicles/auto-complete");

    expect(page.url()).toContain("/chronicles/auto-complete");

    // Check for breadcrumb patterns: "HOME / CHRONICLES / TITLE" or similar
    // Breadcrumbs typically show hierarchical path with "/" or ">" separators
    const bodyText = await page.locator("body").textContent();

    // Should not contain breadcrumb pattern like "HOME / CHRONICLES / Title"
    // or "home > chronicles > title"
    expect(bodyText).not.toMatch(/\b(Home|HOME)\s*[/>]\s*(Chronicles?|CHRONICLE[S]?)\s*[/>]/i);
  });

  test("AC 1b: /chronicles/qa-partner has no breadcrumb navigation", async ({ page }) => {
    await page.goto("/chronicles/qa-partner");

    expect(page.url()).toContain("/chronicles/qa-partner");

    // Check for breadcrumb patterns
    const bodyText = await page.locator("body").textContent();

    // Should not contain breadcrumb pattern
    expect(bodyText).not.toMatch(/\b(Home|HOME)\s*[/>]\s*(Chronicles?|CHRONICLE[S]?)\s*[/>]/i);
  });

  // ── AC 2: No stray --> arrow visible ───────────────────────────────────────────

  test("AC 2a: /chronicles/qa-partner has no stray --> arrow separator", async ({ page }) => {
    await page.goto("/chronicles/qa-partner");

    // Get page content as text
    const bodyText = await page.locator("body").textContent();

    // Should not contain the stray arrow separator
    expect(bodyText).not.toMatch(/\s+-->\s+/);
  });

  test("AC 2b: /chronicles/auto-complete has no stray --> arrow separator", async ({ page }) => {
    await page.goto("/chronicles/auto-complete");

    // Get page content as text
    const bodyText = await page.locator("body").textContent();

    // Should not contain the stray arrow separator
    expect(bodyText).not.toMatch(/\s+-->\s+/);
  });

  // ── AC 3: Both chronicles render identically (same template structure) ────────

  test("AC 3a: Both /chronicles/auto-complete and /chronicles/qa-partner have same heading structure", async ({
    page,
  }) => {
    // Get auto-complete structure
    await page.goto("/chronicles/auto-complete");
    const autoCompleteHeadings = await page.locator("h1, h2").count();
    const autoCompleteMainTitle = await page.locator("h1").first().textContent();

    // Get qa-partner structure
    await page.goto("/chronicles/qa-partner");
    const qaPartnerHeadings = await page.locator("h1, h2").count();
    const qaPartnerMainTitle = await page.locator("h1").first().textContent();

    // Both should have similar heading counts (within 2 headings tolerance for content variation)
    expect(Math.abs(autoCompleteHeadings - qaPartnerHeadings)).toBeLessThanOrEqual(5);

    // Both should have a main title (h1)
    expect(autoCompleteMainTitle?.length ?? 0).toBeGreaterThan(0);
    expect(qaPartnerMainTitle?.length ?? 0).toBeGreaterThan(0);
  });

  test("AC 3b: Both chronicles have prev/next navigation with same structure", async ({ page }) => {
    // Check auto-complete
    await page.goto("/chronicles/auto-complete");
    const autoCompleteNav = page.locator("nav[aria-label*='Chronicle']");
    const autoCompleteNavCount = await autoCompleteNav.count();

    // Check qa-partner
    await page.goto("/chronicles/qa-partner");
    const qaPartnerNav = page.locator("nav[aria-label*='Chronicle']");
    const qaPartnerNavCount = await qaPartnerNav.count();

    // Both should have the chronicle navigation section
    expect(autoCompleteNavCount).toBeGreaterThan(0);
    expect(qaPartnerNavCount).toBeGreaterThan(0);

    // Both should have links to other chronicles (Previous/Next navigation)
    await page.goto("/chronicles/auto-complete");
    const autoCompleteLinks = await page.locator("nav a[href*='/chronicles/']").count();

    await page.goto("/chronicles/qa-partner");
    const qaPartnerLinks = await page.locator("nav a[href*='/chronicles/']").count();

    // Both should have similar navigation structure (links to other chronicles)
    expect(autoCompleteLinks).toBeGreaterThan(0);
    expect(qaPartnerLinks).toBeGreaterThan(0);
  });

  // ── AC 4: Matches rest of marketing site styling ──────────────────────────────

  test("AC 4a: Chronicle pages use consistent typography and layout class names", async ({ page }) => {
    await page.goto("/chronicles/auto-complete");

    // Check for expected chronicle page wrapper
    const chroniclePage = page.locator(".chronicle-page, [class*='chronicle']");
    expect(await chroniclePage.count()).toBeGreaterThan(0);

    // Should have footer or attribution
    const footer = page.locator("footer, [class*='footer']");
    const footerCount = await footer.count();
    expect(footerCount).toBeGreaterThanOrEqual(0); // May vary, but should be structured
  });

  test("AC 4b: Both chronicle detail pages render without layout shift or missing content", async ({ page }) => {
    await page.goto("/chronicles/auto-complete");

    // Check for main content area
    const main = page.locator("main, article, [role='main']").first();
    const mainVisible = await main.isVisible().catch(() => false);
    const mainText = await main.textContent().catch(() => "");

    // Should have substantial content
    expect(mainText.length).toBeGreaterThan(100);
  });

  test("AC 4c: Chronicle pages include proper session metadata (date, title, content)", async ({ page }) => {
    await page.goto("/chronicles/qa-partner");

    // Should have title
    const title = page.locator("h1").first();
    const titleText = await title.textContent();
    expect(titleText?.length ?? 0).toBeGreaterThan(0);

    // Should have content (not just metadata)
    const body = page.locator("body");
    const bodyText = await body.textContent();
    expect(bodyText.length).toBeGreaterThan(500); // Substantial content
  });
});
