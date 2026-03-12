/**
 * Theme Toggle UI Test Suite
 * Authored by Loki, QA Tester of the Pack
 *
 * Trimmed to 1 core test per issue #613:
 *   1. Dark theme persists after page reload via localStorage
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
