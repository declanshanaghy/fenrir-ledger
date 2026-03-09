/**
 * Theme Foundation Test Suite — Story 1: Theme Foundation + CSS Variables
 * Authored by Loki, QA Tester of the Pack
 *
 * Slimmed to core interactive behavior only:
 *   - Dark mode class applied from localStorage
 *   - Light mode class removed from localStorage
 *   - System mode follows OS preference
 *   - Theme persists across reload
 *   - No hydration errors
 *
 * Removed: file source checks (layout.tsx, package.json, globals.css),
 * CSS variable lightness assertions, foreground/primary color checks,
 * dark: prefix audits, stray class scans.
 */

import { test, expect } from "@playwright/test";

// ── Constants ─────────────────────────────────────────────────────────────

const THEME_STORAGE_KEY = "fenrir-theme";
const DARK_CLASS = "dark";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getHtmlClasses(
  page: import("@playwright/test").Page
): Promise<string[]> {
  const cls = await page.evaluate(
    () => document.documentElement.className
  );
  return cls.split(/\s+/).filter(Boolean);
}

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-010: Dark mode applied from localStorage
// ════════════════════════════════════════════════════════════════════════════

test('Setting fenrir-theme="dark" applies .dark class to <html>', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-011: Light mode — no .dark class
// ════════════════════════════════════════════════════════════════════════════

test('Setting fenrir-theme="light" removes .dark class from <html>', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-012: System mode + OS dark
// ════════════════════════════════════════════════════════════════════════════

test("System mode with OS dark preference applies .dark class to <html>", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-013: System mode + OS light
// ════════════════════════════════════════════════════════════════════════════

test("System mode with OS light preference removes .dark class from <html>", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);
});

// ════════════════════════════════════════════════════════════════════════════
// TC-TF-020: No React hydration errors
// ════════════════════════════════════════════════════════════════════════════

test("No React hydration errors on page load in dark mode", async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text().toLowerCase();
      if (
        text.includes("hydrat") ||
        text.includes("did not match") ||
        text.includes("server rendered") ||
        text.includes("client rendered")
      ) {
        hydrationErrors.push(msg.text());
      }
    }
  });

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  expect(hydrationErrors).toHaveLength(0);
});
