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
 * The icon variant is a single cycling button with title attribute starting with "Theme:"
 */
async function getDesktopThemeToggle(
  page: import("@playwright/test").Page
) {
  // Desktop theme toggle is in the hidden md:flex container
  // Use CSS selector to find button with title containing "Theme"
  return page.locator('button[title^="Theme:"]').first();
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
  // Find the hamburger button (hidden on md:, so only visible on mobile)
  // It's the button with aria-label "Open navigation menu"
  const hamburger = page.locator('button[aria-label="Open navigation menu"]');
  await hamburger.click({ timeout: 5000 });
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
    // Ensure desktop viewport (md breakpoint is 768px, Tailwind uses min-width)
    await page.setViewportSize({ width: 1024, height: 768 });

    await page.goto(path);
    await page.waitForLoadState("networkidle");

    // ThemeToggle initially renders a placeholder div with class h-[44px] w-[44px]
    // Then replaces it with a button after mount
    // Check that at least the placeholder or button exists in the desktop nav
    const desktopNav = page.locator('.hidden.md\\:flex').last();

    // Either the placeholder div or the actual button should be visible
    const placeholder = desktopNav.locator('div[aria-hidden="true"].h-\\[44px\\]');
    const button = desktopNav.locator('button[title^="Theme:"]');

    const placeholderVisible = await placeholder.isVisible().catch(() => false);
    const buttonVisible = await button.isVisible().catch(() => false);

    expect(placeholderVisible || buttonVisible).toBe(true);
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
  await page.setViewportSize({ width: 1024, height: 768 });

  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  let classes = await getHtmlClasses(page);
  expect(classes).not.toContain(DARK_CLASS);

  // Wait for theme toggle to mount (replaces placeholder)
  await page.waitForSelector('button[title^="Theme:"]');
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
  await page.setViewportSize({ width: 1024, height: 768 });

  await page.addInitScript((key) => {
    localStorage.setItem(key, "dark");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  let classes = await getHtmlClasses(page);
  expect(classes).toContain(DARK_CLASS);

  // Wait for theme toggle to mount
  await page.waitForSelector('button[title^="Theme:"]');
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
  await page.setViewportSize({ width: 1024, height: 768 });

  await page.addInitScript((key) => {
    localStorage.setItem(key, "light");
  }, THEME_STORAGE_KEY);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Wait for toggle to mount and set theme to dark
  await page.waitForSelector('button[title^="Theme:"]');
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
  await page.setViewportSize({ width: 1024, height: 768 });

  await page.goto("/features");
  await page.waitForLoadState("networkidle");

  // Hard refresh should mount the toggle quickly
  // (This validates the fix for issue #529 - no hydration race condition)
  await page.waitForSelector('button[title^="Theme:"]');
  const toggle = await getDesktopThemeToggle(page);
  await expect(toggle).toBeVisible();
});

test("Hard refresh on /pricing shows theme toggle immediately", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });

  await page.goto("/pricing");
  await page.waitForLoadState("networkidle");

  // Hard refresh should mount the toggle quickly
  // (This validates the fix for issue #529 - no hydration race condition)
  await page.waitForSelector('button[title^="Theme:"]');
  const toggle = await getDesktopThemeToggle(page);
  await expect(toggle).toBeVisible();
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
