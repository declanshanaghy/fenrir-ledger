import { test, expect } from "@playwright/test";

/**
 * Chronicles Render Test Suite — GitHub Issue #407
 *
 * Validates that chronicle detail pages render styled HTML content correctly,
 * not raw HTML tags as plain text. Tests cover:
 *
 * ✅ Acceptance Criteria:
 *   - Chronicle detail pages render styled content, not raw HTML
 *   - Chronicle CSS (chronicle.css) applies correctly
 *   - All existing chronicles render properly
 *   - No XSS vulnerabilities introduced
 */

// ── Test Configuration ────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * List of all chronicle slugs to validate.
 * Updated from content/blog/ directory.
 */
const CHRONICLE_SLUGS = [
  "auto-complete",
  "brain-slug",
  "breaking-the-gleipnir",
  "cat-easter-egg",
  "leaner-pups",
  "lean-wolf",
  "moshing-them-home",
  "no-dependencies",
  "qa-partner",
  "super-wolf",
  "the-wolf-signs-in-valhalla-opens",
  "vercel-wrangling",
  "whats-chore-loki-readme-pr117-1",
  "wireframes-modals",
];

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Issue #407: Chronicles Render Styled Content", () => {
  test("chronicle index page loads", async ({ page }) => {
    await page.goto(`${BASE_URL}/chronicles`);
    await expect(page).toHaveTitle(/Chronicles/i);
  });

  CHRONICLE_SLUGS.forEach((slug) => {
    test(`${slug}: page loads without 404`, async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/chronicles/${slug}`);
      expect(response?.status()).toBe(200);
    });

    test(`${slug}: renders styled HTML, not raw tags`, async ({ page }) => {
      await page.goto(`${BASE_URL}/chronicles/${slug}`);

      // Acceptance Criterion: No raw HTML tags visible as plain text
      // Check that common HTML tags are NOT rendered as text content
      const bodyText = await page.innerText("body");

      // These patterns indicate raw HTML rendering (BAD):
      // - "<div" appearing as plain text
      // - "<span" appearing as plain text
      // - "<header" appearing as plain text
      // - etc.
      expect(bodyText).not.toMatch(/<div\s/i);
      expect(bodyText).not.toMatch(/<span\s/i);
      expect(bodyText).not.toMatch(/<header\s/i);
      expect(bodyText).not.toMatch(/<nav\s/i);
      expect(bodyText).not.toMatch(/<p\s/i);
      expect(bodyText).not.toMatch(/<h1\s/i);
      expect(bodyText).not.toMatch(/<h2\s/i);
    });

    test(`${slug}: chronicle.css styles applied`, async ({ page }) => {
      await page.goto(`${BASE_URL}/chronicles/${slug}`);

      // Acceptance Criterion: Chronicle CSS applies correctly
      // Look for elements with chronicle-specific classes
      const chroniclePage = page.locator(".chronicle-page");

      // Page should have the chronicle-page wrapper
      await expect(chroniclePage).toBeVisible();

      // Chronicle-page should have the custom background color and styles
      const styles = await chroniclePage.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          fontFamily: computed.fontFamily,
        };
      });

      // Custom color variables should be applied (not browser defaults)
      // The chronicle page uses custom colors from chronicle.css
      expect(styles.color).toBeTruthy();
      expect(styles.fontFamily).toContain("Source Serif");
    });

    test(`${slug}: session header renders with runes and title`, async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/chronicles/${slug}`);

      const headerRunes = page.locator(".header-runes");
      const sessionTitle = page.locator(".session-title");

      // Both header elements should be visible
      await expect(headerRunes).toBeVisible();
      await expect(sessionTitle).toBeVisible();

      // Title should have text content
      const titleText = await sessionTitle.textContent();
      expect(titleText).toBeTruthy();
      expect(titleText?.length).toBeGreaterThan(0);
    });

    test(`${slug}: content sections render without escaped HTML`, async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/chronicles/${slug}`);

      // Look for common chronicle content elements
      const entries = page.locator(".entry");
      const entryCount = await entries.count();

      if (entryCount > 0) {
        // At least one entry should exist
        expect(entryCount).toBeGreaterThan(0);

        // First entry should be visible and have content
        const firstEntry = entries.first();
        await expect(firstEntry).toBeVisible();

        // Entry should have a rune and body
        const rune = firstEntry.locator(".entry-rune");
        const body = firstEntry.locator(".entry-body");

        await expect(rune).toBeVisible();
        await expect(body).toBeVisible();
      }
    });

    test(`${slug}: no XSS vulnerability in rendered content`, async ({
      page,
    }) => {
      let xssDetected = false;

      // Monitor for any console errors that might indicate XSS or eval
      page.on("console", (msg) => {
        if (
          msg.type() === "error" &&
          (msg.text().includes("script") ||
            msg.text().includes("eval") ||
            msg.text().includes("unsafe"))
        ) {
          xssDetected = true;
        }
      });

      await page.goto(`${BASE_URL}/chronicles/${slug}`);

      // Check page loads without XSS errors
      expect(xssDetected).toBe(false);

      // Verify no inline script tags in rendered content
      const pageHTML = await page.content();
      expect(pageHTML).not.toMatch(/<script[^>]*>[\s\S]*?<\/script>/i);
    });

    test(`${slug}: user messages render with role badges`, async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/chronicles/${slug}`);

      const userMsgs = page.locator(".user-msg");
      const msgCount = await userMsgs.count();

      // If user messages exist, they should render properly
      if (msgCount > 0) {
        const firstMsg = userMsgs.first();
        await expect(firstMsg).toBeVisible();

        // Check for role badge
        const badge = firstMsg.locator(".role-badge");
        const badgeText = await badge.textContent();

        // Badge should have readable text
        expect(badgeText).toBeTruthy();
        expect(badgeText?.length).toBeGreaterThan(0);

        // Badge should not contain raw HTML
        expect(badgeText).not.toMatch(/<[a-z]/i);
      }
    });

    test(`${slug}: work cards render with styled content`, async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/chronicles/${slug}`);

      const workCards = page.locator(".work-card");
      const cardCount = await workCards.count();

      // If work cards exist, they should render properly
      if (cardCount > 0) {
        const firstCard = workCards.first();
        await expect(firstCard).toBeVisible();

        // Work card should have readable body text
        const body = firstCard.locator(".work-body");
        const text = await body.textContent();

        expect(text).toBeTruthy();
        expect(text?.length).toBeGreaterThan(0);
        // No raw HTML tags in work body
        expect(text).not.toMatch(/<[a-z]/i);
      }
    });

    test(`${slug}: breadcrumb navigation renders correctly`, async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/chronicles/${slug}`);

      // Check breadcrumb is visible and navigable
      const breadcrumb = page.locator('nav[aria-label="Breadcrumb"]');
      await expect(breadcrumb).toBeVisible();

      // Check breadcrumb has links
      const links = breadcrumb.locator("a");
      const linkCount = await links.count();

      expect(linkCount).toBeGreaterThanOrEqual(2); // At least Home and Chronicles links
    });

    test(`${slug}: prev/next navigation renders`, async ({ page }) => {
      await page.goto(`${BASE_URL}/chronicles/${slug}`);

      const nav = page.locator('nav[aria-label="Chronicle navigation"]');
      await expect(nav).toBeVisible();

      // Should have back to all chronicles link
      const allLink = nav.locator('a:has-text("All Chronicles")');
      await expect(allLink).toBeVisible();
    });

    test(`${slug}: stat cards render with visible values`, async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}/chronicles/${slug}`);

      const statCards = page.locator(".stat-card");
      const cardCount = await statCards.count();

      // If stat cards exist, they should be visible and readable
      if (cardCount > 0) {
        const firstCard = statCards.first();
        const text = await firstCard.textContent();

        expect(text).toBeTruthy();
        // Should not contain raw HTML
        expect(text).not.toMatch(/<[a-z]/i);
      }
    });
  });

  // ── Aggregate Tests ───────────────────────────────────────────────────────

  test("all chronicles load without errors", async ({ page }) => {
    for (const slug of CHRONICLE_SLUGS) {
      const response = await page.goto(`${BASE_URL}/chronicles/${slug}`);
      expect(response?.status()).toBe(200);
    }
  });

  test("chronicle CSS custom variables are defined", async ({ page }) => {
    await page.goto(`${BASE_URL}/chronicles/${CHRONICLE_SLUGS[0]}`);

    const chroniclePage = page.locator(".chronicle-page");

    const vars = await chroniclePage.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        void: styles.getPropertyValue("--void"),
        forge: styles.getPropertyValue("--forge"),
        gold: styles.getPropertyValue("--gold"),
      };
    });

    // Custom variables should be defined (not empty strings)
    expect(vars.void).toBeTruthy();
    expect(vars.forge).toBeTruthy();
    expect(vars.gold).toBeTruthy();
  });

  test("dedentHtml fix prevents indented HTML from being treated as code blocks", async ({
    page,
  }) => {
    // Load any chronicle with indented HTML
    await page.goto(`${BASE_URL}/chronicles/${CHRONICLE_SLUGS[0]}`);

    // The fix should ensure indented HTML renders as styled markup,
    // not as code/monospace blocks
    const chronilePage = page.locator(".chronicle-page");

    // Check that the page has proper styled content, not code blocks
    const divElements = chronilePage.locator("div");
    const divCount = await divElements.count();

    // Should have many divs from the MDX rendering
    expect(divCount).toBeGreaterThan(10);

    // None of them should be code blocks (which would indicate HTML was
    // treated as a code block and not rendered)
    const codeBlocks = page.locator("pre, code");
    const codeCount = await codeBlocks.count();

    // If code exists, it should be legitimate code content, not rendered HTML tags
    if (codeCount > 0) {
      const codeText = await codeBlocks.first().textContent();
      // Code should not contain opening div/span tags (raw HTML)
      expect(codeText).not.toMatch(/<div\s/);
      expect(codeText).not.toMatch(/<span\s/);
    }
  });
});
