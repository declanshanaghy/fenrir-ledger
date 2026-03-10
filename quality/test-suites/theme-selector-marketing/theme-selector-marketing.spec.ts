/**
 * Theme Selector on Marketing Pages Test Suite — Issue #529
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates that the theme selector is visible on initial load of marketing pages
 * (/,  /features, /pricing) and persists across navigation.
 *
 * Root cause: Dual mounted guards in MarketingNavbar created hydration race condition.
 * Fix: Consolidate mounted logic, reuse shared ThemeToggle component.
 *
 * Acceptance criteria:
 *   1. Theme toggle visible on initial load of marketing pages (desktop + mobile)
 *   2. Theme selector works (switches theme, persists in localStorage)
 *   3. Theme persists across marketing page navigation
 *   4. Hard refresh on /features and /pricing shows toggle
 *   5. Mobile viewport theme toggle accessible in overlay menu
 */

import { test, expect } from "@playwright/test";

// ── Constants ─────────────────────────────────────────────────────────────

const THEME_STORAGE_KEY = "fenrir-theme";
const DARK_CLASS = "dark";
const MARKETING_PAGES = [
  { path: "/", name: "home" },
  { path: "/features", name: "features" },
  { path: "/pricing", name: "pricing" },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getHtmlClasses(
  page: import("@playwright/test").Page
): Promise<string[]> {
  const cls = await page.evaluate(
    () => document.documentElement.className
  );
  return cls.split(/\s+/).filter(Boolean);
}

/**
 * Get the theme toggle button from desktop nav (icon variant)
 * The icon variant is a single cycling button with aria-label starting with "Theme:"
 */
async function getDesktopThemeToggle(
  page: import("@playwright/test").Page
) {
  // Desktop theme toggle is a cycling icon button in the right nav area
  // Aria-label format: "Theme: {current.label}. Click to switch to {next.label}."
  return page.getByRole("button", { name: /^Theme:/ });
}

/**
 * Get the theme toggle element from mobile overlay
 * The mobile overlay uses the inline radiogroup variant
 */
async function getMobileThemeToggle(
  page: import("@playwright/test").Page
) {
  // In the mobile overlay, theme toggle is a radiogroup
  const overlay = page.locator('[role="dialog"]');
  return overlay.getByRole("radiogroup", { name: /theme/i });
}

/**
 * Open mobile nav overlay
 */
async function openMobileNav(page: import("@playwright/test").Page) {
  const hamburger = page.getByRole("button", { name: /open navigation/i });
  await hamburger.click();
  await page.waitForSelector('[role="dialog"]', { state: "visible" });
}

/**
 * Close mobile nav overlay
 */
async function closeMobileNav(page: import("@playwright/test").Page) {
  const closeBtn = page.getByRole("button", { name: /close navigation/i });
  await closeBtn.click();
  await page.waitForSelector('[role="dialog"]', { state: "hidden" });
}

// ════════════════════════════════════════════════════════════════════════════
// TC-529-001: Theme toggle visible on initial load (desktop)
// ════════════════════════════════════════════════════════════════════════════

for (const { path, name } of MARKETING_PAGES) {
  test(`Theme toggle visible on initial load of ${name} (${path}) — desktop`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    // Verify toggle is rendered in desktop nav
    // Desktop uses the icon variant (single cycling button)
    const toggle = await getDesktopThemeToggle(page);
    await expect(toggle).toBeVisible();
  });
}

// ════════════════════════════════════════════════════════════════════════════
// TC-529-002: Theme toggle visible on initial load (mobile)
// ════════════════════════════════════════════════════════════════════════════

for (const { path, name } of MARKETING_PAGES) {
  test(`Theme toggle visible on initial load of ${name} (${path}) — mobile`, async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    // Open mobile overlay
    await openMobileNav(page);

    // Verify toggle is in the overlay
    const toggle = await getMobileThemeToggle(page);
    await expect(toggle).toBeVisible();

    // Verify it has radio buttons
    const options = toggle.getByRole("radio");
    const count = await options.count();
    expect(count).toBeGreaterThan(0);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// TC-529-003: Theme selector switches theme (desktop)
// ════════════════════════════════════════════════════════════════════════════

test("Theme selector switches from light to dark (desktop)", async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  let classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);

  // Click toggle button (icon variant cycles through themes)
  // From light, clicking should cycle to dark
  const toggle = await getDesktopThemeToggle(page);
  await toggle.click();

  // Verify .dark class applied
  classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  // Verify localStorage persisted
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    THEME_STORAGE_KEY
  );
  expect(stored).toBe("dark");
});

test("Theme selector switches from dark to light (desktop)", async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  let classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  // Click toggle button (icon variant cycles: dark → light)
  const toggle = await getDesktopThemeToggle(page);
  await toggle.click();

  // Verify .dark class removed
  classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);

  // Verify localStorage persisted
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    THEME_STORAGE_KEY
  );
  expect(stored).toBe("light");
});

// ════════════════════════════════════════════════════════════════════════════
// TC-529-004: Theme persists across marketing page navigation
// ════════════════════════════════════════════════════════════════════════════

test("Theme persists when navigating from home to features to pricing", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Set theme to dark by clicking toggle
  let toggle = await getDesktopThemeToggle(page);
  await toggle.click();

  let classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  // Navigate to features
  await page.goto("/features");
  await page.waitForLoadState("networkidle");

  classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  // Navigate to pricing
  await page.goto("/pricing");
  await page.waitForLoadState("networkidle");

  classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  // Verify localStorage still has dark
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    THEME_STORAGE_KEY
  );
  expect(stored).toBe("dark");
});

// ════════════════════════════════════════════════════════════════════════════
// TC-529-005: Hard refresh shows theme toggle immediately (no placeholder)
// ════════════════════════════════════════════════════════════════════════════

test("Hard refresh on /features shows theme toggle immediately", async ({
  page,
}) => {
  await page.goto("/features");
  await page.waitForLoadState("networkidle");

  // Toggle should be visible immediately, not in placeholder state
  const toggle = await getDesktopThemeToggle(page);
  await expect(toggle).toBeVisible();

  // Verify radio buttons are present
  const darkOption = toggle.getByRole("radio", { name: /dark/i });
  await expect(darkOption).toBeVisible();
});

test("Hard refresh on /pricing shows theme toggle immediately", async ({
  page,
}) => {
  await page.goto("/pricing");
  await page.waitForLoadState("networkidle");

  // Toggle should be visible immediately, not in placeholder state
  const toggle = await getDesktopThemeToggle(page);
  await expect(toggle).toBeVisible();

  // Verify radio buttons are present
  const lightOption = toggle.getByRole("radio", { name: /light/i });
  await expect(lightOption).toBeVisible();
});

// ════════════════════════════════════════════════════════════════════════════
// TC-529-006: Mobile overlay theme toggle works
// ════════════════════════════════════════════════════════════════════════════

test("Mobile overlay theme toggle switches theme", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  let classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);

  // Open mobile nav and switch to dark
  await openMobileNav(page);

  const toggle = await getMobileThemeToggle(page);
  // Mobile overlay uses radiogroup variant, so we can select the dark radio
  const darkOption = toggle.getByRole("radio", { name: /dark/i });
  await darkOption.click();

  // Verify .dark class applied
  classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  // Verify localStorage persisted
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    THEME_STORAGE_KEY
  );
  expect(stored).toBe("dark");
});

// ════════════════════════════════════════════════════════════════════════════
// TC-529-007: Theme toggle remains visible when navigating within mobile
// ════════════════════════════════════════════════════════════════════════════

test("Mobile theme toggle accessible across navigation", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });

  // Start at home
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await openMobileNav(page);
  let toggle = await getMobileThemeToggle(page);
  await expect(toggle).toBeVisible();
  await closeMobileNav(page);

  // Navigate to features via the nav link
  const featuresLink = page.getByRole("link", { name: "Features" }).first();
  await featuresLink.click();
  await page.waitForLoadState("networkidle");

  await openMobileNav(page);
  toggle = await getMobileThemeToggle(page);
  await expect(toggle).toBeVisible();
  await closeMobileNav(page);

  // Navigate to pricing via the nav link
  const pricingLink = page.getByRole("link", { name: "Pricing" }).first();
  await pricingLink.click();
  await page.waitForLoadState("networkidle");

  await openMobileNav(page);
  toggle = await getMobileThemeToggle(page);
  await expect(toggle).toBeVisible();
});
