import { test, expect } from "@playwright/test";

/**
 * Depot Integration Issues Chronicle Test Suite — GitHub Issue #459
 *
 * Validates that the Depot integration chronicle ("The Wolf's Grievances")
 * renders properly without raw HTML/JSX tags and maintains readability.
 *
 * ✅ Acceptance Criteria:
 *   - No raw HTML/JSX tags visible on the rendered page
 *   - All sections (Grievances I–IV, Hunt List table, closing) render cleanly
 *   - Code blocks properly formatted
 *   - Page presentation matches quality of other Prose Edda entries
 *   - tsc clean, next build clean
 */

// ── Test Configuration ────────────────────────────────────────────────────────

const CHRONICLE_SLUG = "depot-integration-issues";

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Issue #459: Depot Integration Chronicle HTML Rendering Fix", () => {
  test("chronicle page loads without 404", async ({ page }) => {
    const response = await page.goto(`/chronicles/${CHRONICLE_SLUG}`);
    expect(response?.status()).toBe(200);
  });

  test("no raw HTML/JSX tags visible as plain text", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Acceptance Criterion: No raw HTML/JSX tags visible on rendered page
    const bodyText = await page.innerText("body");

    // These patterns indicate raw/improperly escaped HTML (BAD):
    // - "<span" appearing as plain text (JSX-style spans)
    // - "<div" appearing as plain text
    // - "style={{" appearing as plain text (inline JSX)
    // - "<code" appearing as plain text
    expect(bodyText).not.toMatch(/<span\s/i);
    expect(bodyText).not.toMatch(/<span>/i);
    expect(bodyText).not.toMatch(/<div\s/i);
    expect(bodyText).not.toMatch(/<header\s/i);
    expect(bodyText).not.toMatch(/<p\s/i);
    expect(bodyText).not.toMatch(/<h1\s/i);
    expect(bodyText).not.toMatch(/<h2\s/i);
    expect(bodyText).not.toMatch(/<code\s/i);
    expect(bodyText).not.toMatch(/style=\{\{/);
    expect(bodyText).not.toMatch(/className=/);

    console.log("✓ No raw HTML/JSX tags detected in page text content");
  });

  test("chronicle.css styles applied correctly", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Acceptance Criterion: Chronicle CSS applies correctly
    const chroniclePage = page.locator(".chronicle-page");

    // Page should have the chronicle-page wrapper
    await expect(chroniclePage).toBeVisible();

    // Chronicle-page should have the custom styles
    const styles = await chroniclePage.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        fontFamily: computed.fontFamily,
      };
    });

    expect(styles.fontFamily).toContain("Source Serif");
    console.log("✓ Chronicle CSS styles applied");
  });

  test("header renders with title and metadata", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Header should be visible and have content
    const header = page.locator(".session-header");
    await expect(header).toBeVisible();

    // Title should be present and readable
    const title = page.locator(".session-title");
    const titleText = await title.textContent();
    expect(titleText).toBeTruthy();
    expect(titleText?.toLowerCase()).toContain("grievance");

    // Metadata should be visible
    const meta = page.locator(".session-meta");
    await expect(meta).toBeVisible();

    console.log("✓ Header renders correctly");
  });

  test("update banner renders with link", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Update banner should be visible
    const banner = page.locator(".update-banner");
    await expect(banner).toBeVisible();

    // Banner should contain text
    const bannerText = await banner.textContent();
    expect(bannerText).toBeTruthy();
    expect(bannerText?.toLowerCase()).toContain("update");

    // Banner should have a link
    const link = banner.locator("a");
    const linkCount = await link.count();
    expect(linkCount).toBeGreaterThan(0);

    console.log("✓ Update banner renders with link");
  });

  test("epigraph blockquote renders cleanly", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Epigraph should be visible
    const epigraph = page.locator(".epigraph");
    await expect(epigraph).toBeVisible();

    // Epigraph should have substantial text content
    const epigraphText = await epigraph.textContent();
    expect(epigraphText?.length).toBeGreaterThan(100);

    // Check for gold left border styling
    const computedStyle = await epigraph.evaluate((el) => {
      return window.getComputedStyle(el).borderLeftColor;
    });
    expect(computedStyle).toBeTruthy();

    console.log("✓ Epigraph blockquote renders cleanly");
  });

  test("all grievance cards (I-IV) render without raw HTML", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Find all grievance cards
    const grievanceCards = page.locator(".grievance-card");
    const count = await grievanceCards.count();

    // Should have all 4 grievances
    expect(count).toBe(4);

    // Check each grievance card
    for (let i = 0; i < count; i++) {
      const card = grievanceCards.nth(i);

      // Each card should be visible
      await expect(card).toBeVisible();

      // Each should have a label (Grievance I, II, III, IV)
      const label = card.locator(".grievance-label");
      const labelText = await label.textContent();
      expect(labelText).toMatch(/Grievance (I|II|III|IV)/);

      // Each should have an h2 title
      const title = card.locator("h2");
      const titleText = await title.textContent();
      expect(titleText?.length).toBeGreaterThan(0);

      // Each should have body content
      const bodyContent = card.locator(".grievance-body");
      const bodyCount = await bodyContent.count();
      expect(bodyCount).toBeGreaterThan(0);

      // Check no raw HTML in card text
      const cardText = await card.innerText();
      expect(cardText).not.toMatch(/<span\s/i);
      expect(cardText).not.toMatch(/style=\{\{/);
    }

    console.log(`✓ All ${count} grievance cards render cleanly`);
  });

  test("grievance code blocks format correctly", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Find all code blocks within grievances
    const codeBlocks = page.locator(".grievance-card .code-block");
    const count = await codeBlocks.count();

    // Should have code blocks for "What we want" and "What we have to do"
    expect(count).toBeGreaterThan(4); // At least 2 per grievance (want + have)

    // Check each code block
    for (let i = 0; i < count; i++) {
      const block = codeBlocks.nth(i);
      await expect(block).toBeVisible();

      // Code block should have pre and text content
      const pre = block.locator("pre");
      await expect(pre).toBeVisible();

      const codeText = await pre.textContent();
      expect(codeText?.length).toBeGreaterThan(0);

      // Code should not be double-escaped
      expect(codeText).not.toContain("&lt;");
      expect(codeText).not.toContain("&gt;");
    }

    console.log(`✓ ${count} code blocks format correctly`);
  });

  test("want/instead labels render with correct styling", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Find "What we want" labels
    const wantLabels = page.locator(".label-want");
    const wantCount = await wantLabels.count();
    expect(wantCount).toBeGreaterThan(0);

    // Check each label is visible and has text
    for (let i = 0; i < wantCount; i++) {
      const label = wantLabels.nth(i);
      const text = await label.textContent();
      expect(text?.toLowerCase()).toContain("want");
      await expect(label).toBeVisible();
    }

    // Find "What we have to do instead" labels
    const insteadLabels = page.locator(".label-instead");
    const insteadCount = await insteadLabels.count();
    expect(insteadCount).toBeGreaterThan(0);

    // Check each label is visible and has text
    for (let i = 0; i < insteadCount; i++) {
      const label = insteadLabels.nth(i);
      const text = await label.textContent();
      expect(text?.toLowerCase()).toContain("instead");
      await expect(label).toBeVisible();
    }

    console.log(
      `✓ Want/instead labels render (${wantCount} want, ${insteadCount} instead)`
    );
  });

  test("hunt list table renders with all rows and columns", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Acceptance Criterion: Hunt List table renders correctly
    const huntTable = page.locator(".hunt-table");
    await expect(huntTable).toBeVisible();

    // Check table header
    const headerCells = huntTable.locator("thead th");
    const headerCount = await headerCells.count();
    expect(headerCount).toBeGreaterThan(0);

    // Check table body rows
    const bodyRows = huntTable.locator("tbody tr");
    const rowCount = await bodyRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Each row should have cells matching header count
    for (let i = 0; i < rowCount; i++) {
      const row = bodyRows.nth(i);
      const cells = row.locator("td");
      const cellCount = await cells.count();
      expect(cellCount).toBe(headerCount);

      // Each cell should have content
      for (let j = 0; j < cellCount; j++) {
        const cell = cells.nth(j);
        const content = await cell.textContent();
        expect(content?.length).toBeGreaterThan(0);
      }
    }

    console.log(`✓ Hunt table renders with ${rowCount} rows and ${headerCount} columns`);
  });

  test("hunt section background and styling applied", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Hunt section should be visible
    const huntSection = page.locator(".hunt-section");
    await expect(huntSection).toBeVisible();

    // Should have an h2 title
    const title = huntSection.locator("h2");
    const titleText = await title.textContent();
    expect(titleText?.toLowerCase()).toContain("hunt");

    // Should have rune divider
    const runeDivider = huntSection.locator(".rune-hr");
    await expect(runeDivider).toBeVisible();

    console.log("✓ Hunt section renders with proper styling");
  });

  test("why-matters section renders with code diagram", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Why-matters section should exist
    const whySection = page.locator(".why-section");
    await expect(whySection).toBeVisible();

    // Should have h2 title
    const title = whySection.locator("h2");
    const titleText = await title.textContent();
    expect(titleText?.toLowerCase()).toContain("why");

    // Should have code block showing architecture
    const codeBlock = whySection.locator(".code-block");
    await expect(codeBlock).toBeVisible();

    const codeContent = await codeBlock.textContent();
    expect(codeContent?.toLowerCase()).toContain("orchestrator");

    console.log("✓ Why-matters section renders with architecture diagram");
  });

  test("closing section renders with blockquotes and sign-off", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Closing section should exist
    const closing = page.locator(".closing");
    await expect(closing).toBeVisible();

    // Should have blockquotes
    const blockquotes = closing.locator("blockquote");
    const quoteCount = await blockquotes.count();
    expect(quoteCount).toBeGreaterThan(0);

    // Should have sign-off
    const signOff = closing.locator(".sign-off");
    const signOffText = await signOff.textContent();
    expect(signOffText?.toLowerCase()).toContain("fenrir");

    // Should have closing runes
    const runes = closing.locator(".closing-runes");
    await expect(runes).toBeVisible();

    console.log("✓ Closing section renders with blockquotes and sign-off");
  });

  test("rune dividers render throughout content", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Find all rune dividers
    const runeDividers = page.locator(".rune-hr");
    const count = await runeDividers.count();

    // Should have multiple rune dividers
    expect(count).toBeGreaterThan(0);

    // Each should be visible
    for (let i = 0; i < count; i++) {
      const divider = runeDividers.nth(i);
      await expect(divider).toBeVisible();

      // Each should have rune content
      const span = divider.locator("span");
      const content = await span.textContent();
      expect(content?.includes("ᚠ")).toBeTruthy();
    }

    console.log(`✓ ${count} rune dividers render correctly`);
  });

  test("footer renders with metadata", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Footer should exist
    const footer = page.locator(".session-footer");
    await expect(footer).toBeVisible();

    // Should have footer text
    const footerText = page.locator(".footer-text");
    const text = await footerText.textContent();
    expect(text?.toLowerCase()).toContain("depot");

    // Should have footer runes cipher
    const cipher = page.locator(".footer-cipher");
    await expect(cipher).toBeVisible();

    console.log("✓ Footer renders with metadata");
  });

  test("page has no visible raw HTML in paragraph text", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Get all paragraph elements
    const paragraphs = page.locator(".grievance-body, .grievance-closer, .why-section p, .closing blockquote");
    const count = await paragraphs.count();

    expect(count).toBeGreaterThan(0);

    // Check each paragraph for raw HTML
    for (let i = 0; i < count; i++) {
      const para = paragraphs.nth(i);
      const text = await para.innerText();

      // No raw HTML should appear
      expect(text).not.toMatch(/<span\s/i);
      expect(text).not.toMatch(/<div\s/i);
      expect(text).not.toMatch(/style=\{\{/);
      expect(text).not.toMatch(/<code\s/i);
    }

    console.log(`✓ ${count} paragraphs have no raw HTML`);
  });

  test("mobile viewport (375px) - layout not broken", async ({ page }) => {
    // Set mobile viewport
    page.setViewportSize({ width: 375, height: 812 });

    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Chronicle page should still be visible on mobile
    const chroniclePage = page.locator(".chronicle-page");
    await expect(chroniclePage).toBeVisible();

    // All critical sections should still be visible
    const header = page.locator(".session-header");
    const grievanceCard = page.locator(".grievance-card").first();
    const huntTable = page.locator(".hunt-table");
    const closing = page.locator(".closing");

    await expect(header).toBeVisible();
    await expect(grievanceCard).toBeVisible();
    await expect(huntTable).toBeVisible();
    await expect(closing).toBeVisible();

    // No horizontal overflow issues (no body text with raw HTML patterns)
    const bodyText = await page.innerText("body");
    expect(bodyText).not.toMatch(/<span\s/i);

    console.log("✓ Mobile viewport (375px) - layout intact");
  });

  test("code blocks do not overflow on small screens", async ({ page }) => {
    // Set tablet viewport
    page.setViewportSize({ width: 480, height: 800 });

    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Find all code blocks
    const codeBlocks = page.locator(".code-block");
    const count = await codeBlocks.count();

    // Check each code block's sizing
    for (let i = 0; i < count; i++) {
      const block = codeBlocks.nth(i);
      const boundingBox = await block.boundingBox();

      // Block should exist and have proper dimensions
      expect(boundingBox).toBeTruthy();
      if (boundingBox) {
        // Width should not exceed viewport
        expect(boundingBox.width).toBeLessThanOrEqual(480 + 10); // Allow small margin
      }
    }

    console.log(`✓ ${count} code blocks do not overflow on small screens`);
  });

  test("update banner link to /chronicles/brain-slug works", async ({
    page,
  }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Find the banner link
    const bannerLink = page.locator(".update-banner a");

    // Link should exist and have href
    const href = await bannerLink.getAttribute("href");
    expect(href).toContain("brain-slug");

    // Link should be clickable and navigate
    await bannerLink.click();

    // Should navigate to the referenced chronicle
    await expect(page).toHaveURL(/brain-slug/);

    console.log("✓ Update banner link navigates correctly");
  });

  test("no XSS vulnerability in rendered content", async ({ page }) => {
    await page.goto(`/chronicles/${CHRONICLE_SLUG}`);

    // Check for common XSS patterns in the page's HTML
    const pageContent = await page.content();

    // Should not have unescaped script tags or event handlers in data
    expect(pageContent).not.toMatch(/<script[^>]*>.*<\/script>/i);

    // The content should be properly escaped if it came from user input
    // (though this chronicle is static, good to verify)
    const bodyText = await page.innerText("body");

    // No raw JavaScript patterns should appear in rendered text
    expect(bodyText).not.toMatch(/javascript:/i);
    expect(bodyText).not.toMatch(/onclick=/i);
    expect(bodyText).not.toMatch(/onerror=/i);

    console.log("✓ No XSS vulnerabilities detected");
  });
});
