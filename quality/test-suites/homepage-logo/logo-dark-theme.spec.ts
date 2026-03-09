/**
 * Hero Logo Dark Theme Test — Issue #406: Dark-mode drop-shadow styling
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates:
 *   - Logo has drop-shadow filter in dark mode
 *   - Logo renders without shadow in light mode
 *   - Dark theme shadow has blue glow (rgba(91,158,201,0.2))
 */

import { test, expect } from "@playwright/test";

// ── Constants ─────────────────────────────────────────────────────────────

const THEME_STORAGE_KEY = "fenrir-theme";
const DARK_CLASS = "dark";
const HERO_SECTION = '[aria-label="Hero"]';

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
// TC-LOG-004: Logo has drop-shadow filter in dark mode
// ════════════════════════════════════════════════════════════════════════════

test("Hero logo has dark-mode drop-shadow filter with blue glow", async ({
  page,
}) => {
  // Set dark theme before loading page
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  const hero = page.locator(HERO_SECTION);
  const logo = hero.locator("img");

  const filter = await logo.evaluate(
    (el: HTMLImageElement) => window.getComputedStyle(el).filter
  );

  // Verify drop-shadow filter is applied
  expect(filter).toContain("drop-shadow");
  // Verify blue glow color in filter (rgba format)
  expect(filter).toContain("rgba(91, 158, 201, 0.2)");
});

// ════════════════════════════════════════════════════════════════════════════
// TC-LOG-005: Logo renders without drop-shadow in light mode
// ════════════════════════════════════════════════════════════════════════════

test("Hero logo has no drop-shadow filter in light mode", async ({ page }) => {
  // Set light theme before loading page
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);

  const hero = page.locator(HERO_SECTION);
  const logo = hero.locator("img");

  const filter = await logo.evaluate(
    (el: HTMLImageElement) => window.getComputedStyle(el).filter
  );

  // Verify no drop-shadow filter in light mode
  expect(filter === "none" || filter === "").toBeTruthy();
});
