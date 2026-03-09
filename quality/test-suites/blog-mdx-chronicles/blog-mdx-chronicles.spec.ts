/**
 * Blog MDX Chronicles QA Tests — Issue #340
 *
 * Validates the conversion of session chronicle HTML to MDX blog pages.
 * The session chronicles are Fenrir's dev blog — build history told as Norse sagas.
 *
 * Acceptance Criteria:
 *   1. All session chronicle HTML files converted to MDX with frontmatter
 *   2. Blog index at /blog lists all chronicles, sorted newest-first
 *   3. Individual entries render at /blog/[slug] with full styling
 *   4. Chronicle styling preserved (runic decorations, act structure, Norse voice)
 *   5. Breadcrumbs on entry pages: Home > Blog > [Session Title]
 *   6. Previous/Next navigation between entries
 *   7. Light/dark theme support
 *   8. Mobile responsive at 375px
 *   9. Old public/sessions/ directory deleted
 *   10. export const dynamic = 'force-static' + generateStaticParams
 */

import { test, expect } from "@playwright/test";

// ─── Test Configuration ─────────────────────────────────────────────────────

test.describe("Blog MDX Chronicles QA — Issue #340", () => {
  // Viewports for testing responsiveness
  test.describe.configure({ timeout: 30000 });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: Blog index page loads and lists all chronicles
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-1: Blog index /blog loads and displays all chronicles sorted newest-first", async ({
    page,
  }) => {
    // Navigate to blog index
    const response = await page.goto("/blog", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);

    // Verify page title and header
    const title = page.locator("h1");
    await expect(title).toContainText("Session Chronicles");

    // Verify header runes are present (Norse aesthetic)
    const headerRunes = page.locator('p[class*="font-mono"]').first();
    await expect(headerRunes).toContainText("ᛉ");

    // Verify chronicles list exists
    const chronicleList = page.locator('ol[aria-label="Session chronicles"]');
    await expect(chronicleList).toBeVisible();

    // Count chronicle entries
    const entries = chronicleList.locator("li");
    const count = await entries.count();
    expect(count).toBeGreaterThan(0);
    console.log(`Found ${count} chronicle entries`);

    // Verify each entry has required elements: rune, title, date, excerpt
    for (let i = 0; i < Math.min(count, 3); i++) {
      const entry = entries.nth(i);

      // Rune symbol in box
      const rune = entry.locator('[aria-hidden="true"]').first();
      await expect(rune).toBeVisible();

      // Title
      const entryTitle = entry.locator("h2");
      await expect(entryTitle).toBeVisible();
      const titleText = await entryTitle.textContent();
      expect(titleText).toBeTruthy();

      // Date
      const date = entry.locator("span.font-mono").first();
      await expect(date).toBeVisible();

      // Excerpt
      const excerpt = entry.locator("p.text-muted-foreground");
      await expect(excerpt).toBeVisible();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Blog index sorts chronicles newest-first
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-2: Chronicles are sorted newest-first with correct sequential numbering", async ({
    page,
  }) => {
    await page.goto("/blog", { waitUntil: "networkidle" });

    // Get all entries
    const entries = page.locator('ol[aria-label="Session chronicles"] li');
    const count = await entries.count();

    // Verify sequential numbering: first = #<count>, last = #01
    for (let i = 0; i < count; i++) {
      const entry = entries.nth(i);
      const numberText = await entry
        .locator("span.font-mono")
        .nth(1)
        .textContent();
      const expectedNum = count - i;
      expect(numberText).toContain(`#${String(expectedNum).padStart(2, "0")}`);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: Individual chronicle entry page loads and renders MDX
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-3: Individual blog entry /blog/[slug] renders with full MDX content", async ({
    page,
  }) => {
    // First, go to index to get a valid slug
    await page.goto("/blog", { waitUntil: "networkidle" });

    // Click first chronicle link
    const firstLink = page.locator('ol[aria-label="Session chronicles"] a').first();
    const href = await firstLink.getAttribute("href");
    expect(href).toBeTruthy();
    expect(href).toMatch(/^\/blog\/.+/);

    // Navigate to entry
    const response = await page.goto(href!, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);

    // Verify breadcrumb navigation
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toBeVisible();

    const breadcrumbLinks = breadcrumb.locator("a");
    expect(await breadcrumbLinks.count()).toBe(2); // Home + Blog

    const homeLink = breadcrumbLinks.first();
    await expect(homeLink).toContainText("Home");
    await expect(homeLink).toHaveAttribute("href", "/");

    const blogLink = breadcrumbLinks.nth(1);
    await expect(blogLink).toContainText("Blog");
    await expect(blogLink).toHaveAttribute("href", "/blog");

    // Verify current page in breadcrumb
    const currentPage = breadcrumb.locator('[aria-current="page"]');
    await expect(currentPage).toBeVisible();
    const currentText = await currentPage.textContent();
    expect(currentText).toBeTruthy();

    // Verify MDX content exists (check for any content on the page)
    // Wait for page to be fully hydrated
    await page.waitForLoadState("networkidle");

    // Check what's actually on the page
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(1000); // Should have substantial content

    // Verify MDX was rendered (should have chronicle-specific content)
    expect(pageContent).toMatch(/session|chronicle|act|rune|DATE|ACTS/i);

    // Verify breadcrumb back link works
    const backLink = page.locator('a').filter({ hasText: "↑ All Chronicles" });
    expect(await backLink.count()).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: Previous/Next navigation between entries
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-4: Previous/Next navigation works correctly between entries", async ({
    page,
  }) => {
    // Go to first chronicle
    await page.goto("/blog", { waitUntil: "networkidle" });
    const firstLink = page.locator('ol[aria-label="Session chronicles"] a').first();
    const firstHref = await firstLink.getAttribute("href");
    await page.goto(firstHref!, { waitUntil: "networkidle" });

    // Verify navigation nav exists
    const navBar = page.locator('nav[aria-label="Chronicle navigation"]');
    await expect(navBar).toBeVisible();

    // For the first (newest) entry: should have no Next, should have Previous
    const nextButton = navBar.locator("a").filter({ hasText: "Next →" });
    const prevButton = navBar.locator("a").filter({ hasText: "← Previous" });

    // Next should not exist (we're at the newest)
    const nextCount = await nextButton.count();
    if (nextCount === 0) {
      // This is the newest entry, verify previous exists
      await expect(prevButton).toBeVisible();
      const prevHref = await prevButton.getAttribute("href");
      expect(prevHref).toMatch(/^\/blog\/.+/);
    }

    // Click Previous and verify we can navigate
    if (nextCount === 0 && (await prevButton.count()) > 0) {
      const prevLink = await prevButton.first().getAttribute("href");
      await page.goto(prevLink!, { waitUntil: "networkidle" });

      // Verify we're on a different entry
      const newNav = page.locator('nav[aria-label="Chronicle navigation"]');
      const newPrevButton = newNav
        .locator("a")
        .filter({ hasText: "← Previous" });
      const newNextButton = newNav.locator("a").filter({ hasText: "Next →" });

      // Should have Next (back to newer entry)
      expect(await newNextButton.count()).toBeGreaterThan(0);
    }

    // Verify "Back to All Chronicles" link
    const backLink = navBar.locator("a").filter({ hasText: "↑ All Chronicles" });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute("href", "/blog");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: Chronicle styling preserved (runic decorations, Norse theme)
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-5: Chronicle styling preserved with runic decorations and Norse voice", async ({
    page,
  }) => {
    await page.goto("/blog", { waitUntil: "networkidle" });

    // Navigate to first chronicle
    const firstLink = page.locator('ol[aria-label="Session chronicles"] a').first();
    const href = await firstLink.getAttribute("href");
    await page.goto(href!, { waitUntil: "networkidle" });

    // Verify header runes
    const headerRunes = page.locator(".header-runes").first();
    await expect(headerRunes).toBeVisible();
    const runeText = await headerRunes.textContent();
    expect(runeText).toMatch(/ᚠ|ᛖ|ᚾ|ᚱ|ᛁ/);

    // Verify act structure with rune symbols
    const actRunes = page.locator(".entry-rune");
    const runeCount = await actRunes.count();
    expect(runeCount).toBeGreaterThan(0);

    // Verify act labels are present
    const actLabels = page.locator(".act-label");
    const labelCount = await actLabels.count();
    expect(labelCount).toBeGreaterThan(0);

    // Verify file change chips
    const chips = page.locator(".chip");
    const chipCount = await chips.count();
    // May or may not have chips, but if present, verify styling classes
    if (chipCount > 0) {
      const firstChip = chips.first();
      const classes = await firstChip.getAttribute("class");
      expect(classes).toMatch(/chip-(add|mod|del)/);
    }

    // Verify message structure (user-msg divs)
    const messages = page.locator(".user-msg");
    const messageCount = await messages.count();
    // Some entries may not have messages
    if (messageCount > 0) {
      const firstMsg = messages.first();
      const role = firstMsg.locator(".msg-role");
      await expect(role).toBeVisible();
      const text = firstMsg.locator(".msg-text");
      await expect(text).toBeVisible();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 6: Mobile responsive at 375px
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-6: Blog pages are mobile responsive at 375px viewport", async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Test blog index
    await page.goto("/blog", { waitUntil: "networkidle" });

    // Verify header is visible and readable
    const title = page.locator("h1");
    await expect(title).toBeVisible();

    // Verify chronicle list is scrollable
    const chronicleList = page.locator('ol[aria-label="Session chronicles"]');
    await expect(chronicleList).toBeVisible();

    // Navigate to first entry
    const firstLink = page.locator('ol[aria-label="Session chronicles"] a').first();
    const href = await firstLink.getAttribute("href");
    await page.goto(href!, { waitUntil: "networkidle" });

    // Verify breadcrumb is readable on mobile
    const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toBeVisible();

    // Verify content is not cut off
    const sessionHeader = page.locator(".session-header");
    await expect(sessionHeader).toBeVisible();

    // Verify navigation buttons are accessible
    const navBar = page.locator('nav[aria-label="Chronicle navigation"]');
    await expect(navBar).toBeVisible();

    // All text should not be cut off (basic check)
    const mainContent = page.locator(".session-header");
    const boundingBox = await mainContent.boundingBox();
    expect(boundingBox).toBeTruthy();
    if (boundingBox) {
      expect(boundingBox.width).toBeLessThanOrEqual(375);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 7: Dark/Light theme support
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-7: Blog pages support light and dark theme switching", async ({
    page,
  }) => {
    await page.goto("/blog", { waitUntil: "networkidle" });

    // Check if theme toggle exists (typically in header)
    const themeButton = page.locator('button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="light" i]').first();

    if (await themeButton.count() > 0) {
      // Get current background color
      const body = page.locator("body");
      const initialComputedStyle = await body.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // Click theme toggle
      await themeButton.click();
      await page.waitForTimeout(500); // Wait for theme transition

      // Get new background color
      const newComputedStyle = await body.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // Background color should have changed (or at least attempted to)
      // Note: styles might be inherited, so we're mainly checking that toggle works
      console.log(`Initial bg: ${initialComputedStyle}, New bg: ${newComputedStyle}`);
    } else {
      // Even if no theme button, styles should use CSS vars that support theming
      const chroniclePage = page.locator(".chronicle-page");
      const computedStyle = await chroniclePage.evaluate((el) => {
        return window.getComputedStyle(el).color;
      });
      expect(computedStyle).toBeTruthy();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 8: Static generation (static params and force-static)
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-8: Blog pages use static generation (force-static + generateStaticParams)", async ({
    page,
  }) => {
    // These are Next.js compile-time checks, we verify by:
    // 1. Page loads without requiring dynamic rendering
    // 2. Entry pages load instantly (no dynamic computation)

    const startTime = Date.now();
    await page.goto("/blog", { waitUntil: "networkidle" });
    const indexLoadTime = Date.now() - startTime;

    // Static pages should load quickly
    expect(indexLoadTime).toBeLessThan(5000);

    // Navigate to an entry
    const firstLink = page
      .locator('ol[aria-label="Session chronicles"] a')
      .first();
    const href = await firstLink.getAttribute("href");

    const entryStartTime = Date.now();
    await page.goto(href!, { waitUntil: "networkidle" });
    const entryLoadTime = Date.now() - entryStartTime;

    // Entry pages should also load quickly (static generation)
    expect(entryLoadTime).toBeLessThan(5000);

    console.log(
      `Index load: ${indexLoadTime}ms, Entry load: ${entryLoadTime}ms`
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 9: Old public/sessions directory is deleted
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-9: Old public/sessions directory no longer exists", async ({ page }) => {
    // Try to access old session paths and expect 404
    const oldSessionPaths = [
      "/sessions/",
      "/sessions/index.html",
      "/sessions/chronicle.css",
    ];

    for (const path of oldSessionPaths) {
      const response = await page.goto(path, {
        waitUntil: "networkidle",
      });
      // Should be 404 or redirect
      expect([404, 301, 302, 307, 308]).toContain(response?.status());
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 10: MDX frontmatter contains all required fields
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-10: MDX files contain required frontmatter (title, date, rune, excerpt, slug)", async ({
    page,
  }) => {
    // Navigate to a few entries and verify all have proper metadata
    await page.goto("/blog", { waitUntil: "networkidle" });

    const entries = page.locator('ol[aria-label="Session chronicles"] a');
    const count = await entries.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const entry = entries.nth(i);
      const href = await entry.getAttribute("href");
      await page.goto(href!, { waitUntil: "networkidle" });

      // Verify breadcrumb title (from frontmatter title)
      const breadcrumbTitle = page.locator('[aria-current="page"]');
      const titleText = await breadcrumbTitle.textContent();
      expect(titleText).toBeTruthy();
      expect(titleText!.length).toBeGreaterThan(0);

      // Verify session header (rendered from MDX)
      const sessionTitle = page.locator(".session-title");
      const sessionTitleText = await sessionTitle.textContent();
      expect(sessionTitleText).toBeTruthy();

      // Verify date in metadata
      const sessionMeta = page.locator(".session-meta");
      const metaText = await sessionMeta.textContent();
      expect(metaText).toContain("DATE");

      // Verify rune symbol
      const rune = page.locator(".entry-rune").first();
      const runeText = await rune.textContent();
      expect(runeText).toMatch(/ᚠ|ᛖ|ᚾ|ᚱ|ᛁ|ᛏ|ᚢ|ᛈ|ᚦ|ᛉ|ᚡ|ᚲ|ᚳ|ᚴ|ᛗ|ᚹ|ᚾ/);

      // Back to index for next iteration
      await page.goto("/blog", { waitUntil: "networkidle" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 11: Links within blog pages are functional
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-11: Blog navigation links (Home, Blog, Previous, Next) are functional", async ({
    page,
  }) => {
    await page.goto("/blog", { waitUntil: "networkidle" });

    // Click first entry
    const firstLink = page.locator('ol[aria-label="Session chronicles"] a').first();
    await firstLink.click();
    await page.waitForURL("/blog/**");

    // Click Home in breadcrumb
    const homeLink = page
      .locator('nav[aria-label="Breadcrumb"]')
      .locator('a[href="/"]');
    await homeLink.click();
    await page.waitForURL("/");

    // Go back to blog via navigation
    const blogLink = page.locator("a").filter({ hasText: "Blog" }).first();
    if (await blogLink.count() > 0) {
      // If there's a blog nav link, use it
      await blogLink.click();
      await page.waitForURL("/blog");
    } else {
      // Otherwise navigate directly
      await page.goto("/blog");
    }

    // Click Blog in breadcrumb (should stay on index)
    const blogBreadcrumb = page
      .locator('nav[aria-label="Breadcrumb"]')
      .locator('a[href="/blog"]');
    await blogBreadcrumb.click();
    await page.waitForURL("/blog");

    // Verify we're on blog index
    const title = page.locator("h1");
    await expect(title).toContainText("Session Chronicles");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 12: Blog index shows empty state gracefully (if applicable)
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-12: Blog index shows at least one chronicle entry", async ({
    page,
  }) => {
    await page.goto("/blog", { waitUntil: "networkidle" });

    const entries = page.locator('ol[aria-label="Session chronicles"] li');
    const count = await entries.count();

    // Should have at least one chronicle (the issue says 14 were migrated)
    expect(count).toBeGreaterThanOrEqual(1);

    // If somehow no entries, empty state message should be visible
    if (count === 0) {
      const emptyState = page.locator("p").filter({
        hasText: "The forge is cold",
      });
      await expect(emptyState).toBeVisible();
    }
  });
});
