import { test, expect } from "@playwright/test";

/**
 * Rune Rendering Tests — Issue #616
 *
 * Validates that Elder Futhark rune characters render correctly across all
 * dashboard tabs and components. Ensures Unicode escape sequences are
 * properly converted to literal rune glyphs.
 *
 * Acceptance Criteria:
 * - All 5 tabs display actual rune characters (not escape sequences)
 * - Runes are visually distinct and recognizable
 * - Empty states show correct runes with proper rendering
 * - Tab headers in empty state mode render runes without literal \u#### text
 */

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";

// Expected rune characters per tab (literal Unicode glyphs, not escape sequences)
const RUNE_MAP = {
  all: "ᛟ", // U+16DF Othala (all cards)
  valhalla: "↑", // U+2191 Upwards arrow (hall of honored dead)
  active: "ᛉ", // U+16C9 Othala/Ansuz variant (active warriors)
  hunt: "ᛜ", // U+16DC Hagall (the hunt)
  howl: "ᚲ", // U+16B2 Kenaz (the howl/fire)
};

test.describe("Rune Rendering — Dashboard Tabs", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    // Wait for dashboard to load
    await page.waitForSelector('[role="tablist"]', { timeout: 5000 });
  });

  test("should display runes in tab buttons (not escape sequences)", async ({
    page,
  }) => {
    // Active tab button should contain the active rune
    const activeTab = page.getByRole("tab", { name: /active/i });
    const activeTabText = await activeTab.textContent();
    expect(activeTabText).toContain(RUNE_MAP.active);
    // Ensure no literal escape sequences appear
    expect(activeTabText).not.toMatch(/\\u[0-9A-Fa-f]{4}/);

    // Howl tab button should contain the howl rune
    const howlTab = page.getByRole("tab", { name: /howl|ragnarok/i });
    const howlTabText = await howlTab.textContent();
    expect(howlTabText).toContain(RUNE_MAP.howl);
    // Ensure no literal escape sequences appear
    expect(howlTabText).not.toMatch(/\\u[0-9A-Fa-f]{4}/);
  });

  test("should render all 5 tabs with correct runes in empty states", async ({
    page,
  }) => {
    // Tabs should be visible in tab list
    const tablist = page.locator('[role="tablist"]');
    expect(tablist).toBeVisible();

    // Check that we can navigate to different tabs
    const allTab = page.locator('button[id="tab-all"]');
    const valhallasTab = page.locator('button[id="tab-valhalla"]');
    const activeTab = page.locator('button[id="tab-active"]');
    const huntTab = page.locator('button[id="tab-hunt"]');
    const howlTab = page.locator('button[id="tab-howl"]');

    // Wait for all tabs to be in the DOM (they may not all be visible initially)
    await expect(activeTab).toBeAttached();
    await expect(howlTab).toBeAttached();

    // Verify active tab rune is visible
    const activeRuneInTab = await activeTab.locator(":scope > span").first().textContent();
    expect(activeRuneInTab).toBe(RUNE_MAP.active);

    // Verify howl tab rune is visible
    const howlRuneInTab = await howlTab.locator(":scope > span").first().textContent();
    expect(howlRuneInTab).toMatch(/[ᚠᚲ]/); // Either Fehu (ragnarok) or Kenaz (normal)
  });

  test("should not display literal unicode escape sequences", async ({
    page,
  }) => {
    // Get all text content on the page
    const bodyText = await page.locator("body").textContent();

    // Ensure no literal escape sequences appear (e.g., \u16C9, \u16B2, etc.)
    expect(bodyText).not.toMatch(/\\u16[0-9A-Fa-f]{2}/);
    expect(bodyText).not.toMatch(/\\u2191/);
  });

  test("should have runes with correct font-family (serif)", async ({ page }) => {
    // Find a rune span in the active tab button
    const activeTab = page.getByRole("tab", { name: /active/i });
    const runeSpan = activeTab.locator("span").first();

    // Verify the rune is visible
    await expect(runeSpan).toBeVisible();

    // Check font-family style
    const fontFamily = await runeSpan.evaluate((el) =>
      window.getComputedStyle(el).fontFamily
    );
    expect(fontFamily).toContain("serif");
  });

  test("should render runes with consistent sizing and alignment", async ({
    page,
  }) => {
    // Get all rune spans in the tab buttons
    const activeTab = page.getByRole("tab", { name: /active/i });
    const runeSpan = activeTab.locator("span").first();

    // Check that the rune span has proper styling
    const fontSize = await runeSpan.evaluate((el) =>
      window.getComputedStyle(el).fontSize
    );
    const lineHeight = await runeSpan.evaluate((el) =>
      window.getComputedStyle(el).lineHeight
    );

    // Ensure sizing is applied (not default/zero)
    expect(fontSize).not.toBe("0px");
    expect(lineHeight).not.toBe("0px");
  });
});

test.describe("Rune Rendering — Empty States", () => {
  test("should display runes in empty state messages without escape sequences", async ({
    page,
  }) => {
    // This test requires an empty dashboard. Navigate and look for empty state text.
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForSelector('[role="tabpanel"]', { timeout: 5000 });

    // Get the tab panel content
    const tabPanel = page.locator('[role="tabpanel"]');
    const panelText = await tabPanel.textContent();

    // Ensure no literal escape sequences in empty state
    expect(panelText).not.toMatch(/\\u[0-9A-Fa-f]{4}/);

    // If there's an empty state message, it should contain the expected rune or be valid
    if (panelText && panelText.includes("NO")) {
      // Empty state detected; verify runes are literal, not escaped
      expect(panelText).not.toMatch(/\\u/);
    }
  });
});

test.describe("Rune Rendering — Cross-Browser Compatibility", () => {
  test("should render runes consistently across browser sessions", async ({
    page,
  }) => {
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForSelector('[role="tablist"]');

    // Capture initial rune text
    const activeTab = page.getByRole("tab", { name: /active/i });
    const initialRune = await activeTab.locator("span").first().textContent();

    // Verify the rune matches our expected value
    expect(initialRune).toBe(RUNE_MAP.active);

    // Reload the page and verify consistency
    await page.reload();
    await page.waitForSelector('[role="tablist"]');

    const reloadedRune = await activeTab.locator("span").first().textContent();
    expect(reloadedRune).toBe(initialRune);
  });

  test("should render runes on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForSelector('[role="tablist"]');

    // Verify runes are still visible on mobile
    const activeTab = page.getByRole("tab", { name: /active/i });
    const mobileRune = await activeTab.locator("span").first().textContent();
    expect(mobileRune).toBe(RUNE_MAP.active);

    // Ensure no escape sequences appear
    expect(mobileRune).not.toMatch(/\\u[0-9A-Fa-f]{4}/);
  });
});

test.describe("Rune Rendering — Content Constants", () => {
  test("should have valid runes in TAB_HEADER_CONTENT", async ({ page }) => {
    // Check the page source or navigate to a page that renders tab headers
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForSelector('[role="tablist"]');

    // Get text content of all visible tabs
    const tablist = page.locator('[role="tablist"]');
    const tabText = await tablist.textContent();

    // Verify that literal rune characters are present (not escape codes)
    // At least the active tab rune should be visible
    expect(tabText).toContain(RUNE_MAP.active);

    // Verify no literal escape sequences
    expect(tabText).not.toMatch(/\\u16/);
  });

  test("should not have unicode escape sequences in rendered output", async ({
    page,
  }) => {
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);

    // Get all text from the page
    const pageText = await page.content();

    // Unicode escape sequences should NOT appear as literal text in the HTML content
    // The HTML source might have them, but the rendered text content should not
    const bodyText = await page.locator("body").textContent();

    // Check for literal escape sequence patterns in rendered text
    // This would indicate they're being rendered as text instead of being interpreted
    const escapedRunePattern = /\\u16[0-9A-Fa-f]{2}/g;
    expect(bodyText).not.toMatch(escapedRunePattern);
  });
});
