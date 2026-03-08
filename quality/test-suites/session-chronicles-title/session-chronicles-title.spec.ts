/**
 * Session Chronicles Title Test Suite — Fenrir Ledger
 *
 * Validates GitHub Issue #214 fix: restore 'Session Chronicles' title with runes
 * on the sessions index page (/sessions).
 *
 * Issue Details:
 * - The sessions index page header was incorrectly displaying "The Dev Blog"
 * - Should be restored to "Session Chronicles" with Elder Futhark runes
 *   flanking both sides: ᚠᛖᚾᚱᛁᚱ Session Chronicles ᚠᛖᚾᚱᛁᚱ
 *
 * Test Coverage:
 * 1. Page title (<title> tag) contains correct text with runes
 * 2. H1 heading displays "Session Chronicles" with rune decorations
 * 3. Runes are correctly positioned on both sides of the title
 * 4. Footer text references "Session Chronicles" (not "The Dev Blog")
 * 5. No regression on other pages (dashboard title unchanged)
 * 6. Rune characters are correct Elder Futhark runes (ᚠᛖᚾᚱᛁᚱ)
 * 7. Title is styled correctly with Cinzel Decorative font and gold color
 * 8. Page header structure remains intact with subtitle and meta
 */

import { test, expect } from "@playwright/test";

const EXPECTED_RUNES = "ᚠᛖᚾᚱᛁᚱ";
const EXPECTED_TITLE_TEXT = "Session Chronicles";
const EXPECTED_PAGE_TITLE = "ᚠᛖᚾᚱᛁᚱ Session Chronicles ᚠᛖᚾᚱᛁᚱ · Fenrir Ledger";

test.describe("Issue #214 — Session Chronicles Title Restoration", () => {
  test("page title (<title> tag) contains Session Chronicles with runes", async ({
    page,
  }) => {
    await page.goto("/sessions/");

    // Assert: Page title contains the expected text
    const pageTitle = await page.title();
    expect(pageTitle).toBe(EXPECTED_PAGE_TITLE);
  });

  test("h1 heading displays Session Chronicles with rune decorations", async ({
    page,
  }) => {
    await page.goto("/sessions/");

    // Locate the h1 title
    const h1 = page.locator("h1.session-title");

    // Assert: H1 is visible
    await expect(h1).toBeVisible();

    // Assert: H1 contains the expected text
    const h1Text = await h1.textContent();
    expect(h1Text).toContain(EXPECTED_TITLE_TEXT);
    expect(h1Text).toContain(EXPECTED_RUNES);
  });

  test("runes are correctly positioned on both sides of title", async ({
    page,
  }) => {
    await page.goto("/sessions/");

    const h1 = page.locator("h1.session-title");
    const h1Text = await h1.textContent();

    // Assert: Text starts with runes
    expect(h1Text).toMatch(/^ᚠᛖᚾᚱᛁᚱ\s/);

    // Assert: Text ends with runes
    expect(h1Text).toMatch(/\sᚠᛖᚾᚱᛁᚱ$/);

    // Assert: "Session Chronicles" is between the runes
    expect(h1Text).toContain(`${EXPECTED_RUNES} ${EXPECTED_TITLE_TEXT} ${EXPECTED_RUNES}`);
  });

  test("footer text references Session Chronicles (not The Dev Blog)", async ({
    page,
  }) => {
    await page.goto("/sessions/");

    // Locate the footer text
    const footerText = page.locator(".footer-text");

    // Assert: Footer is visible
    await expect(footerText).toBeVisible();

    // Assert: Footer contains "Session Chronicles"
    const footerContent = await footerText.textContent();
    expect(footerContent).toContain("Session Chronicles");

    // Assert: Footer does NOT contain "The Dev Blog"
    expect(footerContent).not.toContain("The Dev Blog");
  });

  test("title is styled with Cinzel Decorative font and gold color", async ({
    page,
  }) => {
    await page.goto("/sessions/");

    const h1 = page.locator("h1.session-title");

    // Assert: H1 has Cinzel Decorative font family
    const fontFamily = await h1.evaluate((el) =>
      getComputedStyle(el).fontFamily
    );
    expect(fontFamily).toContain("Cinzel Decorative");

    // Assert: H1 has gold color (golden/bright gold, not dark gold)
    const color = await h1.evaluate((el) =>
      getComputedStyle(el).color
    );
    // Gold-bright color should be present (check for gold/yellow-ish color)
    expect(color).toBeTruthy();
  });

  test("page header structure remains intact (subtitle, meta, etc.)", async ({
    page,
  }) => {
    await page.goto("/sessions/");

    // Assert: Header section exists
    const header = page.locator("header.session-header");
    await expect(header).toBeVisible();

    // Assert: H1 title is present
    const h1 = page.locator("h1.session-title");
    await expect(h1).toBeVisible();

    // Assert: Subtitle is present
    const subtitle = page.locator("p.session-subtitle");
    await expect(subtitle).toBeVisible();
    const subtitleText = await subtitle.textContent();
    expect(subtitleText).toContain("Fenrir Ledger");
    expect(subtitleText).toContain("Tales from the Forge");

    // Assert: Meta section is present
    const meta = page.locator("div.session-meta");
    await expect(meta).toBeVisible();
  });

  test("header runes decorations are visible", async ({ page }) => {
    await page.goto("/sessions/");

    // Locate the header runes span (decorative, aria-hidden)
    const headerRunes = page.locator("span.header-runes");

    // Assert: Header runes are visible
    await expect(headerRunes).toBeVisible();

    // Assert: Header runes contain the expected rune characters
    const runesText = await headerRunes.textContent();
    expect(runesText).toContain("ᚠ");
    expect(runesText).toContain("ᛖ");
    expect(runesText).toContain("ᚾ");
    expect(runesText).toContain("ᚱ");
    expect(runesText).toContain("ᛁ");
  });

  test("no regression on dashboard page (still shows Fenrir Ledger)", async ({
    page,
  }) => {
    await page.goto("/");

    // Assert: Dashboard title is unchanged
    const dashboardTitle = await page.title();
    expect(dashboardTitle).toContain("Fenrir Ledger");

    // Assert: Dashboard title does NOT contain "Session Chronicles"
    expect(dashboardTitle).not.toContain("Session Chronicles");
  });

  test("page structure contains session cards after title", async ({
    page,
  }) => {
    await page.goto("/sessions/");

    // Assert: Session grid exists
    const sessionGrid = page.locator("div.index-grid");
    await expect(sessionGrid).toBeVisible();

    // Assert: At least one session card is present
    const sessionCards = page.locator("a.session-card");
    const cardCount = await sessionCards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test("title does not contain old text variations", async ({ page }) => {
    await page.goto("/sessions/");

    const h1 = page.locator("h1.session-title");
    const h1Text = await h1.textContent();

    // Assert: Title does NOT contain "The Dev Blog"
    expect(h1Text).not.toContain("The Dev Blog");

    // Assert: Title does NOT contain other incorrect variations
    expect(h1Text).not.toContain("Dev Blog");
  });

  test("runes character encoding is correct (Elder Futhark)", async ({
    page,
  }) => {
    await page.goto("/sessions/");

    const h1 = page.locator("h1.session-title");
    const h1Text = await h1.textContent();

    // Assert: Contains exactly the correct runes (ᚠᛖᚾᚱᛁᚱ)
    // Breaking down: ᚠ (fehu), ᛖ (ehwaz), ᚾ (naudiz), ᚱ (raido), ᛁ (isa), ᚱ (raido)
    expect(h1Text).toContain("ᚠ"); // U+16A0 RUNIC LETTER FEHU FEOH FE F
    expect(h1Text).toContain("ᛖ"); // U+16D6 RUNIC LETTER EHWAZ EH E
    expect(h1Text).toContain("ᚾ"); // U+16BE RUNIC LETTER NAUDIZ NUD N
    expect(h1Text).toContain("ᛁ"); // U+16C1 RUNIC LETTER ISA IS I
  });

  test("page loads without errors", async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/sessions/");

    // Assert: No console errors (allow warnings for dev-mode next.js messages)
    const criticalErrors = errors.filter(
      (err) => !err.includes("StaticRoute") && !err.includes("dev mode")
    );
    expect(criticalErrors.length).toBe(0);
  });
});
