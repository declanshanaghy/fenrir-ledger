/**
 * Theme Toggle UI Test Suite — Story 2: ThemeToggle Component + TopBar Integration
 * Authored by Loki, QA Tester of the Pack
 *
 * Slimmed to interactive behavior only:
 *   - Toggle switches theme (dark/light) via public-facing toggle
 *   - Preference persists in localStorage
 *   - Correct class applied to html element
 *   - First load defaults to OS preference, then pins explicit choice (Ref #556)
 *   - No "System" option (Ref #556)
 *
 * Note: Uses the marketing page theme toggle (icon button variant) for testing
 * since it's publicly visible. The dropdown theme toggle is tested via the ledger page.
 *
 * Removed: file existence checks, hex color audits, dark: prefix scans,
 * parchment lightness assertions, ARIA attribute checks, design doc validation.
 */

import { test, expect } from "@playwright/test";

// ── Constants ─────────────────────────────────────────────────────────────

const THEME_STORAGE_KEY = "fenrir-theme";
const DARK_CLASS = "dark";
const TOGGLE_ROLE = "radiogroup";
const TOGGLE_ARIA_LABEL = "Theme";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getHtmlClasses(
  page: import("@playwright/test").Page
): Promise<string[]> {
  const cls = await page.evaluate(
    () => document.documentElement.className
  );
  return cls.split(/\s+/).filter(Boolean);
}

async function openUpsellPanel(page: import("@playwright/test").Page) {
  // Click the avatar button to open the upsell panel
  const avatarBtn = page.locator("button[aria-label*='Sign in to sync']").first();
  await avatarBtn.click();
  // Wait for panel to appear
  await page.waitForSelector("[id*='anon-upsell']", { state: "visible", timeout: 5000 });
}

async function findThemeToggleButton(page: import("@playwright/test").Page) {
  // Find the theme toggle button by aria-label
  // Icon variant: "Theme: Light. Click to switch to Dark." or "Theme: Dark. Click to switch to Light."
  return page.locator("button[aria-label*='Theme:']").first();
}

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-003: Clicking theme toggle applies .dark class to <html>
// ════════════════════════════════════════════════════════════════════════════

test("Clicking theme toggle button cycles to dark and applies .dark class to <html>", async ({
  page,
}) => {
  // Start in light mode
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  let classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);

  // Open the upsell panel which contains the theme toggle
  await openUpsellPanel(page);

  // Click the theme toggle button
  const themeButton = await findThemeToggleButton(page);
  await expect(themeButton).toBeVisible();
  await themeButton.click();

  // Wait for theme change
  await page.waitForTimeout(200);

  // Should now be in dark mode
  classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-004: Clicking theme toggle removes .dark class from <html>
// ════════════════════════════════════════════════════════════════════════════

test("Clicking theme toggle button cycles to light and removes .dark class from <html>", async ({
  page,
}) => {
  // Start in dark mode
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  let classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  // Open the upsell panel which contains the theme toggle
  await openUpsellPanel(page);

  // Click the theme toggle button
  const themeButton = await findThemeToggleButton(page);
  await expect(themeButton).toBeVisible();
  await themeButton.click();

  // Wait for theme change
  await page.waitForTimeout(200);

  // Should now be in light mode
  classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-005: No "System" option in toggle (Ref #556)
// ════════════════════════════════════════════════════════════════════════════

test("No System option exists in the theme toggle — only Dark and Light", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Open the upsell panel to see the theme toggle
  await openUpsellPanel(page);

  // Check that "system" option is not present in the UI
  const systemRadio = page.getByRole("radio", { name: /system/i });
  await expect(systemRadio).toHaveCount(0);

  // Verify the toggle button exists and is visible
  const themeButton = await findThemeToggleButton(page);
  await expect(themeButton).toBeVisible();
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-007: Theme persists after page reload
// ════════════════════════════════════════════════════════════════════════════

test("Dark theme persists after page reload via localStorage key fenrir-theme", async ({
  page,
}) => {
  // Start with light theme
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Open panel and click theme toggle to switch to dark
  await openUpsellPanel(page);
  const themeButton = await findThemeToggleButton(page);
  await themeButton.click();
  await page.waitForTimeout(200);

  let classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  // Verify localStorage was updated
  const stored = await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY);
  expect(stored).toBe("dark");

  // Reload and verify dark theme persists
  await page.reload({ waitUntil: "networkidle" });

  classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-006: First load detects OS preference and pins it (Ref #556)
// ════════════════════════════════════════════════════════════════════════════

test("First load detects OS dark preference and pins to dark", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // ThemeToggle effect should resolve "system" → "dark" and persist it
  // Allow a moment for the effect to fire
  await page.waitForTimeout(500);

  const stored = await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY);
  expect(stored).toBe("dark");

  const classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);
});
