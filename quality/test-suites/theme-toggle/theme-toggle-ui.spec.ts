/**
 * Theme Toggle UI Test Suite — Story 2: ThemeToggle Component + TopBar Integration
 * Authored by Loki, QA Tester of the Pack
 *
 * Slimmed to interactive behavior only:
 *   - Toggle switches theme (dark/light)
 *   - Preference persists in localStorage
 *   - Correct class applied to html element
 *   - First load defaults to OS preference, then pins explicit choice (Ref #556)
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

async function openAnonPanel(page: import("@playwright/test").Page) {
  const avatarBtn = page.locator('[aria-controls="anon-upsell-panel"]');
  await avatarBtn.click();
  await page.waitForSelector('[role="dialog"]', { state: "visible" });
}

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-003: Clicking "Dark" applies .dark class to <html>
// ════════════════════════════════════════════════════════════════════════════

test("Clicking the Dark option applies .dark class to <html> immediately", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  let classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);

  await openAnonPanel(page);

  const toggle = page.getByRole(TOGGLE_ROLE, { name: TOGGLE_ARIA_LABEL });
  const darkOption = toggle.getByRole("radio", { name: /dark/i });
  await darkOption.click();

  classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-004: Clicking "Light" removes .dark class from <html>
// ════════════════════════════════════════════════════════════════════════════

test("Clicking the Light option removes .dark class from <html> immediately", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  let classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  await openAnonPanel(page);

  const toggle = page.getByRole(TOGGLE_ROLE, { name: TOGGLE_ARIA_LABEL });
  const lightOption = toggle.getByRole("radio", { name: /light/i });
  await lightOption.click();

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

  await openAnonPanel(page);

  const toggle = page.getByRole(TOGGLE_ROLE, { name: TOGGLE_ARIA_LABEL });
  const radios = toggle.getByRole("radio");
  await expect(radios).toHaveCount(2);

  await expect(toggle.getByRole("radio", { name: /light/i })).toBeVisible();
  await expect(toggle.getByRole("radio", { name: /dark/i })).toBeVisible();
  await expect(toggle.getByRole("radio", { name: /system/i })).toHaveCount(0);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-007: Theme persists after page reload
// ════════════════════════════════════════════════════════════════════════════

test("Dark theme persists after page reload via localStorage key fenrir-theme", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await openAnonPanel(page);

  const toggle = page.getByRole(TOGGLE_ROLE, { name: TOGGLE_ARIA_LABEL });
  const darkOption = toggle.getByRole("radio", { name: /dark/i });
  await darkOption.click();

  let classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  const stored = await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY);
  expect(stored).toBe("dark");

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
