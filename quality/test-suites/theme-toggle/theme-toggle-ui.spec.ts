/**
 * Theme Toggle UI Test Suite
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests:
 *   1. Dark theme persists after page reload via localStorage
 *   2. Clicking Light radio on marketing page switches html to light theme (Issue #848 AC#1)
 */

import { test, expect } from "@playwright/test";

const THEME_STORAGE_KEY = "fenrir-theme";
const DARK_CLASS = "dark";

async function getHtmlClasses(
  page: import("@playwright/test").Page
): Promise<string[]> {
  const cls = await page.evaluate(
    () => document.documentElement.className
  );
  return cls.split(/\s+/).filter(Boolean);
}

// AC#1: Clicking the theme toggle switches between dark and light modes (Issue #848)
test("Clicking Light radio button on marketing page switches to light theme", async ({
  page,
}) => {
  // Start in dark theme
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Verify we start dark
  let classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  // Click the Light radio button in the inline theme toggle
  const lightButton = page.getByRole("radio", { name: "Light" });
  await lightButton.first().click();

  // Theme should have switched — html element no longer has "dark" class
  classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);

  // localStorage should now reflect "light"
  const storedTheme = await page.evaluate(
    (key) => localStorage.getItem(key),
    THEME_STORAGE_KEY
  );
  expect(storedTheme).toBe("light");
});

test("Dark theme persists after page reload via localStorage", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/ledger");
  await page.waitForLoadState("networkidle");

  let classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  await page.reload({ waitUntil: "load" });

  classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);
});
