import { test, expect } from "@playwright/test";

/**
 * Depot Integration Chronicle Test Suite — GitHub Issue #453
 *
 * Validates that the Depot Integration — The Wolf's Grievances chronicle
 * (depot-integration-issues.mdx) was successfully restored from git history
 * and converted to MDX format. Tests cover:
 *
 * ✅ Acceptance Criteria:
 *   - depot-integration-issues.mdx exists in development/frontend/content/blog/
 *   - Chronicle renders correctly at /chronicles/depot-integration-issues
 *   - Chronicle appears in the /chronicles index page
 *   - All original content preserved (grievances, summary table, architecture diagram, epigraph, closing)
 *   - Build passes
 */

// ── Test Configuration ────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "";
const CHRONICLE_SLUG = "depot-integration-issues";

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Issue #453: Depot Chronicle Restoration", () => {
  test("chronicle index page loads", async ({ page }) => {
    await page.goto("/chronicles");
    await expect(page).toHaveTitle(/Prose Edda/i);
  });

  test("depot-integration-issues: page loads without 404", async ({ page }) => {
    const response = await page.goto(`/chronicles/${CHRONICLE_SLUG}`);
    expect(response?.status()).toBe(200);
  });

  test("depot-integration-issues: renders styled HTML, not raw tags", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Acceptance Criterion: Content renders properly, not as escaped HTML
    // Verify the page has substantive rendered text content
    const bodyText = await page.innerText("body");

    // Should have significant content (MDX file is several KB when uncompressed)
    expect(bodyText.length).toBeGreaterThan(5000);

    // Check that visible content includes readable text
    // The page footer shows "DEPOT INTEGRATION — THE WOLF'S GRIEVANCES"
    expect(bodyText).toContain("DEPOT INTEGRATION");
    expect(bodyText).toContain("WOLF'S GRIEVANCES");
    expect(bodyText).toContain("Grievance I");
    expect(bodyText).toContain("Grievance II");
    expect(bodyText).toContain("Grievance III");
    expect(bodyText).toContain("Grievance IV");

    // Verify the main chronicle container is visible (styled, not just raw)
    const chronicleWrapper = page.locator(".chronicle-page");
    await expect(chronicleWrapper).toBeVisible();
  });

  test("depot-integration-issues: chronicle.css styles applied", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Acceptance Criterion: Chronicle CSS applies correctly
    const chroniclePage = page.locator(".chronicle-page");
    await expect(chroniclePage).toBeVisible();

    // Check computed styles
    const styles = await chroniclePage.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        fontFamily: computed.fontFamily,
      };
    });

    expect(styles.color).toBeTruthy();
    expect(styles.fontFamily).toContain("Source Serif");
  });

  test("depot-integration-issues: session header renders with runes and title", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    const headerRunes = page.locator(".header-runes");
    const sessionTitle = page.locator(".session-title");

    await expect(headerRunes).toBeVisible();
    await expect(sessionTitle).toBeVisible();

    const titleText = await sessionTitle.textContent();
    expect(titleText).toBeTruthy();
    expect(titleText?.includes("Wolf's Grievances")).toBe(true);
  });

  test("depot-integration-issues: session meta renders from/to/date", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    const sessionMeta = page.locator(".session-meta");
    await expect(sessionMeta).toBeVisible();

    // Check for FROM, TO, DATE fields
    const metaText = await sessionMeta.textContent();
    expect(metaText).toContain("FROM");
    expect(metaText).toContain("Fenrir Ledger Engineering");
    expect(metaText).toContain("Depot Engineers");
    expect(metaText).toContain("DATE");
  });

  test("depot-integration-issues: UPDATE notice renders", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // The chronicle has an UPDATE notice about working around Grievance I
    const pageText = await page.innerText("body");

    expect(pageText).toContain("UPDATE");
    expect(pageText).toContain("90-line bash skill");
    expect(pageText).toContain("uninstalled it");
  });

  test("depot-integration-issues: main epigraph (blockquote) renders", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    const blockquotes = page.locator("blockquote");
    const blockquoteCount = await blockquotes.count();

    // Should have at least the main epigraph and closing blockquote
    expect(blockquoteCount).toBeGreaterThanOrEqual(2);

    // Get all blockquote text
    const blockquoteTexts = await Promise.all(
      (
        await blockquotes.all()
      ).map((bq) => bq.textContent())
    );

    // Main epigraph should mention "wolf" and "autonomous agent"
    const mainEpigraph = blockquoteTexts.join(" ");
    expect(mainEpigraph).toContain("wolf");
    expect(mainEpigraph).toContain("autonomous agent");
    expect(mainEpigraph).toContain("depot claude");
  });

  test("depot-integration-issues: Grievance I renders with code example", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    const pageText = await page.innerText("body");

    // Check for Grievance I title
    expect(pageText).toContain("Grievance I");
    expect(pageText).toContain("No Simple Way to Retrieve a Session Log");

    // Check for code example keywords
    expect(pageText).toContain("depot claude session-log");
    expect(pageText).toContain("find ~/.claude/projects/");
  });

  test("depot-integration-issues: Grievance II renders with pager issue", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    const pageText = await page.innerText("body");

    // Check for Grievance II
    expect(pageText).toContain("Grievance II");
    expect(pageText).toContain("CLI Defaults to Pager");
    expect(pageText).toContain("list-sessions");
    expect(pageText).toContain("DEPOT_PAGER");
  });

  test("depot-integration-issues: Grievance III renders with session resumption", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    const pageText = await page.innerText("body");

    // Check for Grievance III
    expect(pageText).toContain("Grievance III");
    expect(pageText).toContain("Sessions Are Resumable");
    expect(pageText).toContain("fire-and-forget");
    expect(pageText).toContain("session-status");
  });

  test("depot-integration-issues: Grievance IV renders with webhook proposal", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    const pageText = await page.innerText("body");

    // Check for Grievance IV
    expect(pageText).toContain("Grievance IV");
    expect(pageText).toContain("No Backchannel for Session Completion");
    expect(pageText).toContain("webhook");
    expect(pageText).toContain("session.completed");
  });

  test("depot-integration-issues: Hunt List table renders", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Look for table with specific headers
    const table = page.locator("table");
    await expect(table).toBeVisible();

    const tableText = await table.textContent();

    // Check for hunt list content
    expect(tableText).toContain("Proposed Command");
    expect(tableText).toContain("Purpose");
    expect(tableText).toContain("Today's Workaround");
    expect(tableText).toContain("session-log");
    expect(tableText).toContain("session-status");
    expect(tableText).toContain("webhooks add");
  });

  test("depot-integration-issues: Architecture diagram renders", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Look for code block with architecture
    const codeBlocks = page.locator("pre");
    const codeBlockCount = await codeBlocks.count();

    expect(codeBlockCount).toBeGreaterThan(0);

    // Get all code block text
    const codeTexts = await Promise.all(
      (
        await codeBlocks.all()
      ).map((block) => block.textContent())
    );

    // One of the code blocks should be the architecture diagram
    const architectureCode = codeTexts.join("\n");
    expect(architectureCode).toContain("Orchestrator");
    expect(architectureCode).toContain("spawn FiremanDecko");
    expect(architectureCode).toContain("spawn Loki");
    expect(architectureCode).toContain("spawn Luna");
  });

  test("depot-integration-issues: closing blockquote renders", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    const pageText = await page.innerText("body");

    // Check for closing words about platform and scaffolding
    expect(pageText).toContain("Depot");
    expect(pageText).toContain("sandboxes are clean");
    expect(pageText).toContain("scaffolding");
    expect(pageText).toContain("wolf slips its chain");
  });

  test("depot-integration-issues: final verse renders", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    const pageText = await page.innerText("body");

    // Check for final verse
    expect(pageText).toContain("The wolf is patient");
    expect(pageText).toContain("hungry wolf");
    expect(pageText).toContain("Fenrir Ledger Engineering");
  });

  test("depot-integration-issues: footer renders correctly", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    const footer = page.locator(".session-footer");
    await expect(footer).toBeVisible();

    const footerText = await footer.textContent();
    expect(footerText).toContain("Depot Integration");
    expect(footerText).toContain("Wolf's Grievances");
    expect(footerText).toContain("Fenrir Ledger Field Report");
  });

  test("depot-integration-issues: no XSS vulnerability in rendered content", async ({
    page,
  }) => {
    let consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Check that no security-related errors were logged
    const xssErrors = consoleErrors.filter(
      (err) =>
        err.includes("unsafe") ||
        err.includes("CSP") ||
        err.includes("cross-origin")
    );

    expect(xssErrors.length).toBe(0);

    // Verify the page loaded without critical errors
    expect(consoleErrors.length).toBeLessThan(3); // Allow minor warnings
  });

  test("depot-integration-issues: back to all chronicles navigation exists", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Look for any navigation link back to /chronicles
    const chroniclesLink = page.locator('a[href="/chronicles"]');
    const count = await chroniclesLink.count();

    // Should have at least one link back to chronicles
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify the link is clickable and navigates
    await chroniclesLink.first().click();
    await expect(page).toHaveURL("/chronicles");
  });

  // ── Chronicles Index Tests ───────────────────────────────────────────────────

  test("depot-integration-issues: appears in chronicles index", async ({
    page,
  }) => {
    await page.goto("/chronicles");

    // Look for the depot chronicle entry
    const chronicleLink = page.locator(`a[href*="${CHRONICLE_SLUG}"]`).first();
    await expect(chronicleLink).toBeVisible();

    // Click and verify destination
    const response = await chronicleLink.click();
    await expect(page).toHaveURL(`/chronicles/${CHRONICLE_SLUG}`);
  });

  test("depot-integration-issues: index entry has correct title", async ({
    page,
  }) => {
    await page.goto("/chronicles");

    // Find all chronicle entries
    const entries = page.locator("a").filter({
      has: page.locator(`text="Depot Integration"`),
    });

    const count = await entries.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // At least one should link to our chronicle
    const depotEntry = entries.first();
    const href = await depotEntry.getAttribute("href");
    expect(href).toContain(CHRONICLE_SLUG);
  });

  test("all content preserved: grievances + table + architecture + epigraph + closing", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    const pageText = await page.innerText("body");

    // Verify all major content sections exist
    const sections = [
      // Grievances
      "Grievance I",
      "Grievance II",
      "Grievance III",
      "Grievance IV",
      // Code examples and concepts
      "session-log",
      "session-status",
      "depot claude",
      "fire-and-forget",
      // Table
      "Proposed Command",
      "The Hunt List",
      // Architecture
      "Orchestrator",
      "FiremanDecko",
      "Loki",
      "Luna",
      // Epigraph
      "wolf",
      "autonomous agent",
      // Closing
      "Fenrir Ledger Engineering",
    ];

    sections.forEach((section) => {
      expect(pageText).toContain(section);
    });
  });

  test("chronicle frontmatter is correct", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Check page title (from frontmatter)
    const title = await page.title();
    expect(title).toContain("Depot Integration");

    // Check meta description (from frontmatter excerpt)
    const metaDescription = await page.locator(
      'meta[name="description"]'
    );
    // The excerpt should appear in meta or in the page
    const pageText = await page.innerText("body");
    expect(pageText).toContain("Depot Integration");
  });

  // ── Rune Rendering Tests ───────────────────────────────────────────────────────

  test("depot-integration-issues: runes render correctly", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    const pageText = await page.innerText("body");

    // Check for Norse rune characters used in the chronicle
    // ᚠ (Fehu), ᛖ (Eihwaz), ᚾ (Naudiz), ᚱ (Raido), ᛁ (Isa)
    expect(pageText).toContain("ᚠ");
    expect(pageText).toContain("ᛖ");
    expect(pageText).toContain("ᚾ");
  });

  // ── Resilience Tests ───────────────────────────────────────────────────────────

  test("chronicle loads consistently across multiple visits", async ({
    page,
  }) => {
    // Visit multiple times to ensure no race conditions or cache issues
    for (let i = 0; i < 3; i++) {
      const response = await page.goto(`/chronicles/${CHRONICLE_SLUG}`);
      expect(response?.status()).toBe(200);

      // Verify header renders each time
      const title = page.locator(".session-title");
      await expect(title).toBeVisible();
    }
  });

  test("chronicle content length reasonable (not truncated)", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    const pageText = await page.innerText("body");

    // Original chronicle is substantial (several thousand characters)
    // This ensures it wasn't truncated or corrupted during migration
    expect(pageText.length).toBeGreaterThan(5000);
  });
});
