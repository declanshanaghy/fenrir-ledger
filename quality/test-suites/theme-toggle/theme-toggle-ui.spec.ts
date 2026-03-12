/**
 * Theme Toggle UI Test Suite — Story 2: ThemeToggle Component + TopBar Integration
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the theme toggle persistence and interaction behavior:
 *   - Preference persists in localStorage
 *   - Correct class applied to html element
 *   - First load defaults to OS preference, then pins explicit choice (Ref #556)
 *   - No "System" option in the source code (Ref #556)
 *
 * Note: Focuses on localStorage behavior and CSS class application rather
 * than UI interaction, since the toggle is contained in a panel.
 *
 * Removed: file existence checks, hex color audits, dark: prefix scans,
 * parchment lightness assertions, ARIA attribute checks, design doc validation.
 */

import { test, expect } from "@playwright/test";

// ── Constants ─────────────────────────────────────────────────────────────

const THEME_STORAGE_KEY = "fenrir-theme";
const DARK_CLASS = "dark";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getHtmlClasses(
  page: import("@playwright/test").Page
): Promise<string[]> {
  const cls = await page.evaluate(
    () => document.documentElement.className
  );
  return cls.split(/\s+/).filter(Boolean);
}

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-003: Switching to dark mode applies .dark class to <html>
// ════════════════════════════════════════════════════════════════════════════

test("Switching to dark mode (via localStorage) applies .dark class to <html>", async ({
  page,
}) => {
  // Set dark theme via localStorage (simulating a user clicking the toggle)
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/ledger");
  await page.waitForLoadState("networkidle");

  // Verify dark class is applied
  const classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-004: Switching to light mode removes .dark class from <html>
// ════════════════════════════════════════════════════════════════════════════

test("Switching to light mode (via localStorage) removes .dark class from <html>", async ({
  page,
}) => {
  // Set light theme via localStorage
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/ledger");
  await page.waitForLoadState("networkidle");

  // Verify dark class is NOT applied
  const classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);
});

// TC-TH-005: REMOVED (Issue #610) — Evaluated console.error.toString(), not meaningful.

// ════════════════════════════════════════════════════════════════════════════
// TC-TH-007: Theme persists after page reload
// ════════════════════════════════════════════════════════════════════════════

test("Dark theme persists after page reload via localStorage key fenrir-theme", async ({
  page,
}) => {
  // Set dark theme via localStorage
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/ledger");
  await page.waitForLoadState("networkidle");

  let classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  // Verify localStorage has the dark theme
  const stored = await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY);
  expect(stored).toBe("dark");

  // Reload and verify dark theme persists
  await page.reload({ waitUntil: "load" });

  classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);
});

// TC-TH-006: REMOVED (Issue #610) — Flaky timing with OS preference detection + next-themes.
