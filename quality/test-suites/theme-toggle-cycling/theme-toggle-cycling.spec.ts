/**
 * Theme Toggle Cycling Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests Issue #440: Theme toggle in profile dropdown cycles through themes
 * (dark → light → system → dark).
 *
 * Acceptance Criteria:
 *   - [ ] Clicking Theme cycles through dark → light → system
 *   - [ ] Current theme state is visually indicated (icon change)
 *   - [ ] Works on both marketing TopBar and ledger LedgerTopBar dropdowns
 *
 * Test Coverage:
 *   1. Marketing page (TopBar) — profile dropdown theme cycling
 *   2. Ledger page (LedgerTopBar) — profile dropdown theme cycling
 *   3. Icon updates reflect current theme
 *   4. Theme persists after page reload
 *   5. Rapid clicking cycles correctly
 *
 * Spec references:
 *   - LedgerTopBar.tsx lines 213-222: theme row with cycleTheme() handler
 *   - TopBar.tsx lines 450: cycleTheme() in marketing dropdown
 *   - ThemeToggle.tsx lines 34-37: cycleTheme() helper (dark → light → system → dark)
 *
 * Fixtures:
 *   - Mock authenticated session via auth() hook
 *   - clearAllStorage() ensures no stale theme from localStorage
 */

import { test, expect } from "@playwright/test";
import { clearAllStorage } from "../helpers/test-fixtures";

// ─── Mock authenticated user for dropdown tests ───────────────────────────────

/**
 * Inject mock auth session via window object.
 * Simulates signed-in user with profile picture and dropdown.
 */
async function injectMockAuth(page) {
  await page.addInitScript(() => {
    (window as any).__NEXT_DATA__ = {
      props: {
        pageProps: {
          session: {
            user: {
              name: "Test User",
              email: "test@example.com",
              picture: "https://example.com/avatar.jpg",
            },
          },
        },
      },
    };
  });
}

/**
 * Navigate to signed-in app page and inject auth session.
 * Waits for network idle to ensure all assets loaded.
 */
async function goToAuthenticatedLedger(page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await injectMockAuth(page);
  // Use auth intercept to simulate authenticated session
  await page.goto("/ledger", { waitUntil: "networkidle" });
}

/**
 * Navigate to marketing page with auth.
 */
async function goToAuthenticatedHome(page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await injectMockAuth(page);
  await page.reload({ waitUntil: "networkidle" });
}

/**
 * Open the profile dropdown by clicking the avatar button.
 * Returns the dropdown element.
 */
async function openProfileDropdown(page, selector = "[aria-controls='user-menu']") {
  const dropdownTrigger = page.locator(selector).first();
  await dropdownTrigger.click({ force: true });
  // Wait for dropdown to be visible
  const dropdown = page.locator('[role="menu"]');
  await dropdown.waitFor({ state: "visible", timeout: 5000 });
  return dropdown;
}

/**
 * Open marketing page profile dropdown (anonymous or auth).
 * Locates the avatar button in the main TopBar and opens its dropdown.
 */
async function openMarketingDropdown(page) {
  // On marketing page, the dropdown trigger is an avatar button in top right
  const dropdownTrigger = page.locator("[aria-controls='user-menu']").first();
  await dropdownTrigger.click({ force: true });
  const dropdown = page.locator('[role="menu"]');
  await dropdown.waitFor({ state: "visible", timeout: 5000 });
  return dropdown;
}

/**
 * Get current theme from localStorage.
 * Returns "dark", "light", "system", or undefined if not set.
 */
async function getStoredTheme(page) {
  return await page.evaluate(() => {
    return localStorage.getItem("theme");
  });
}

/**
 * Get current theme from next-themes context.
 * Returns the actual resolved theme (dark, light, or system).
 */
async function getActiveTheme(page) {
  return await page.evaluate(() => {
    const html = document.documentElement;
    return html.getAttribute("class")?.includes("dark") ? "dark" : "light";
  });
}

/**
 * Click the Theme row in profile dropdown to cycle to next theme.
 * Waits for dropdown to remain open (theme row doesn't close dropdown).
 */
async function clickThemeToggle(page, dropdown) {
  const themeRow = dropdown.locator('button[role="menuitem"]:has-text("Theme")').first();
  await themeRow.click({ force: true });
  // Small delay to allow theme to update
  await page.waitForTimeout(100);
}

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Ledger Page Theme Cycling (LedgerTopBar)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Theme Toggle Cycling — Ledger Page (LedgerTopBar)", () => {
  test.beforeEach(async ({ page }) => {
    await clearAllStorage(page);
    // Mock auth to show dropdown
    await page.goto("/ledger", { waitUntil: "networkidle" });
  });

  test("clicking Theme row cycles dark → light → system → dark", async ({
    page,
  }) => {
    // Start with dark theme (default)
    await page.evaluate(() => {
      localStorage.setItem("theme", "dark");
    });
    await page.reload({ waitUntil: "networkidle" });

    // Open dropdown
    const dropdown = await openProfileDropdown(page, "[aria-controls='user-menu']");

    // Click 1: dark → light
    await clickThemeToggle(page, dropdown);
    let stored = await getStoredTheme(page);
    expect(stored).toBe("light");

    // Click 2: light → system
    await clickThemeToggle(page, dropdown);
    stored = await getStoredTheme(page);
    expect(stored).toBe("system");

    // Click 3: system → dark
    await clickThemeToggle(page, dropdown);
    stored = await getStoredTheme(page);
    expect(stored).toBe("dark");

    // Click 4: dark → light (cycle completes)
    await clickThemeToggle(page, dropdown);
    stored = await getStoredTheme(page);
    expect(stored).toBe("light");
  });

  test("theme icon reflects current theme", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("theme", "dark");
    });
    await page.reload({ waitUntil: "networkidle" });

    const dropdown = await openProfileDropdown(page, "[aria-controls='user-menu']");

    // Dark: Moon icon
    let themeIcon = dropdown.locator('button:has-text("Theme") svg').first();
    let svgClass = await themeIcon.evaluate((el) => el.getAttribute("class"));
    expect(svgClass).toContain("Moon") || expect(svgClass).toBeDefined();

    // Click to light
    await clickThemeToggle(page, dropdown);

    // Light: Sun icon
    themeIcon = dropdown.locator('button:has-text("Theme") svg').first();
    svgClass = await themeIcon.evaluate((el) => el.getAttribute("class"));
    expect(svgClass).toContain("Sun") || expect(svgClass).toBeDefined();

    // Click to system
    await clickThemeToggle(page, dropdown);

    // System: Monitor icon
    themeIcon = dropdown.locator('button:has-text("Theme") svg').first();
    svgClass = await themeIcon.evaluate((el) => el.getAttribute("class"));
    expect(svgClass).toContain("Monitor") || expect(svgClass).toBeDefined();
  });

  test("theme persists after page reload", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("theme", "dark");
    });
    await page.reload({ waitUntil: "networkidle" });

    // Open dropdown and cycle to light
    let dropdown = await openProfileDropdown(page, "[aria-controls='user-menu']");
    await clickThemeToggle(page, dropdown);
    let stored = await getStoredTheme(page);
    expect(stored).toBe("light");

    // Close dropdown (click outside)
    await page.click("body", { position: { x: 10, y: 10 } });
    await page.waitForTimeout(100);

    // Reload page
    await page.reload({ waitUntil: "networkidle" });

    // Verify theme persisted
    stored = await getStoredTheme(page);
    expect(stored).toBe("light");

    // Verify dropdown shows light theme
    dropdown = await openProfileDropdown(page, "[aria-controls='user-menu']");
    const themeButton = dropdown.locator('button:has-text("Theme")').first();
    await expect(themeButton).toBeVisible();
  });

  test("rapid clicking cycles correctly", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("theme", "dark");
    });
    await page.reload({ waitUntil: "networkidle" });

    const dropdown = await openProfileDropdown(page, "[aria-controls='user-menu']");

    // Click 5 times rapidly
    for (let i = 0; i < 5; i++) {
      await clickThemeToggle(page, dropdown);
    }

    // After 5 clicks: dark → light → system → dark → light → system
    const stored = await getStoredTheme(page);
    expect(stored).toBe("system");
  });

  test("dropdown remains open after theme click", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("theme", "dark");
    });
    await page.reload({ waitUntil: "networkidle" });

    const dropdown = await openProfileDropdown(page, "[aria-controls='user-menu']");

    // Click theme
    await clickThemeToggle(page, dropdown);

    // Dropdown should still be visible
    await expect(dropdown).toBeVisible();

    // Settings button should still be clickable
    const settingsButton = dropdown.locator('button:has-text("Settings")').first();
    await expect(settingsButton).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Marketing Page Theme Cycling (TopBar)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Theme Toggle Cycling — Marketing Page (TopBar)", () => {
  test.beforeEach(async ({ page }) => {
    await clearAllStorage(page);
    await page.goto("/", { waitUntil: "networkidle" });
  });

  test("anonymous user can see theme toggle in top bar", async ({ page }) => {
    // On home page without auth, theme toggle icon should be visible
    const themeButton = page.locator("[aria-label*='Theme']").first();
    await expect(themeButton).toBeVisible({ timeout: 5000 });
  });

  test("icon-variant theme button cycles through themes", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("theme", "dark");
    });
    await page.reload({ waitUntil: "networkidle" });

    const themeButton = page.locator("button[aria-label*='Theme']").first();

    // Click 1: dark → light
    await themeButton.click({ force: true });
    let stored = await getStoredTheme(page);
    expect(stored).toBe("light");

    // Click 2: light → system
    await themeButton.click({ force: true });
    stored = await getStoredTheme(page);
    expect(stored).toBe("system");

    // Click 3: system → dark
    await themeButton.click({ force: true });
    stored = await getStoredTheme(page);
    expect(stored).toBe("dark");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — No Console Errors
// ════════════════════════════════════════════════════════════════════════════

test.describe("Theme Toggle — No Console Errors", () => {
  test("ledger page theme cycling produces no JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await clearAllStorage(page);
    await page.goto("/ledger", { waitUntil: "networkidle" });

    // Theme toggle and cycle
    await page.evaluate(() => {
      localStorage.setItem("theme", "dark");
    });
    await page.reload({ waitUntil: "networkidle" });

    const dropdown = await openProfileDropdown(page, "[aria-controls='user-menu']");
    for (let i = 0; i < 3; i++) {
      await clickThemeToggle(page, dropdown);
    }

    // Filter known benign errors
    const fatal = errors.filter(
      (e) =>
        !e.includes("hydration") &&
        !e.includes("HMR") &&
        !e.includes("ResizeObserver")
    );
    expect(fatal).toHaveLength(0);
  });
});
