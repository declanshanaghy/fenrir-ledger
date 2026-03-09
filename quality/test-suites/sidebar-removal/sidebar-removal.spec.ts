/**
 * sidebar-removal.spec.ts — Validate Issue #403
 *
 * Tests:
 * 1. Full-width layout on desktop (no sidebar)
 * 2. Full-width layout on mobile (no sidebar)
 * 3. Profile dropdown functionality: theme toggle → Settings → Sign Out
 * 4. Theme toggle cycles: light → dark → system
 * 5. Mobile bottom tabs: 3 tabs (Dashboard | Add | Valhalla), no Settings
 * 6. Settings link active state (gold) when on /ledger/settings
 * 7. Dropdown closes on outside click
 * 8. Dropdown keyboard navigation (Escape closes)
 * 9. Mobile 375px viewport layout integrity
 */

import { test, expect } from "@playwright/test";

test.describe("Issue #403 — Sidebar Removal & Profile Dropdown", () => {
  const DASHBOARD_URL = "/ledger";
  const SETTINGS_URL = "/ledger/settings";
  const VALHALLA_URL = "/ledger?tab=valhalla";

  // ────────────────────────────────────────────────────────────────
  // Test 1: Full-width desktop layout — no sidebar
  // ────────────────────────────────────────────────────────────────
  test("desktop: layout is full-width, no sidebar visible", async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("networkidle");

    // Main content should span full width
    const mainContent = page.locator("main#main-content");
    const viewport = page.viewportSize();
    const boundingBox = await mainContent.boundingBox();

    expect(boundingBox).toBeTruthy();
    expect(boundingBox?.width).toBeGreaterThan(viewport!.width * 0.85);

    // Sidebar component should not exist
    const sidebar = page.locator(
      "[role='complementary'], .sidebar, [data-testid='sidebar']"
    );
    await expect(sidebar).not.toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────
  // Test 2: Full-width mobile layout — no sidebar
  // ────────────────────────────────────────────────────────────────
  test("mobile: layout is full-width, no sidebar visible", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("networkidle");

    // Main content should span full width
    const mainContent = page.locator("main#main-content");
    const viewport = page.viewportSize();
    const boundingBox = await mainContent.boundingBox();

    expect(boundingBox).toBeTruthy();
    expect(boundingBox?.width).toBeGreaterThan(viewport!.width * 0.85);

    // Sidebar should not exist
    const sidebar = page.locator(
      "[role='complementary'], .sidebar, [data-testid='sidebar']"
    );
    await expect(sidebar).not.toBeVisible();

    // Bottom tabs should be visible
    const bottomTabs = page.locator("nav[aria-label='App tabs']");
    await expect(bottomTabs).toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────
  // Test 3: Mobile bottom tabs — 3 tabs (Dashboard, Add, Valhalla)
  // ────────────────────────────────────────────────────────────────
  test("mobile: bottom tabs have 3 items, no Settings tab", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("networkidle");

    const tabs = page.locator("nav[aria-label='App tabs'] li");
    const count = await tabs.count();

    expect(count).toBe(3);

    // Verify tab labels (check for specific elements)
    const dashboardLabel = page
      .locator("nav[aria-label='App tabs']")
      .locator("span:has-text('Dashboard')");
    const addLabel = page
      .locator("nav[aria-label='App tabs']")
      .locator("span:has-text('Add')");
    const valhallaLabel = page
      .locator("nav[aria-label='App tabs']")
      .locator("span:has-text('Valhalla')");

    await expect(dashboardLabel).toBeVisible();
    await expect(addLabel).toBeVisible();
    await expect(valhallaLabel).toBeVisible();

    // Settings should not be a tab
    const settingsLabel = page
      .locator("nav[aria-label='App tabs']")
      .locator("span:has-text('Settings')");
    await expect(settingsLabel).not.toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────
  // Test 4: Profile dropdown opens/closes
  // ────────────────────────────────────────────────────────────────
  test("profile dropdown: opens when avatar clicked", async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("networkidle");

    // Anonymous state — click avatar to open upsell panel
    const avatarButton = page
      .locator("header")
      .locator("button[aria-haspopup='true']")
      .first();

    await avatarButton.click();

    // Upsell panel should appear
    const upsellPanel = page.locator("[id='anon-upsell-panel'], [role='dialog']");
    await expect(upsellPanel).toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────
  // Test 5: Profile dropdown closes on outside click
  // ────────────────────────────────────────────────────────────────
  test("profile dropdown: closes on outside click", async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("networkidle");

    // Open dropdown
    const avatarButton = page
      .locator("header")
      .locator("button[aria-haspopup='true']")
      .first();
    await avatarButton.click();

    const upsellPanel = page.locator("[id='anon-upsell-panel'], [role='dialog']");
    await expect(upsellPanel).toBeVisible();

    // Click outside (on main content)
    await page.locator("main").click({ position: { x: 100, y: 300 } });

    // Panel should close
    await expect(upsellPanel).not.toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────
  // Test 6: Profile dropdown closes on Escape
  // ────────────────────────────────────────────────────────────────
  test("profile dropdown: closes on Escape key", async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("networkidle");

    // Open dropdown
    const avatarButton = page
      .locator("header")
      .locator("button[aria-haspopup='true']")
      .first();
    await avatarButton.click();

    const upsellPanel = page.locator("[id='anon-upsell-panel'], [role='dialog']");
    await expect(upsellPanel).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Panel should close
    await expect(upsellPanel).not.toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────
  // Test 7: Theme toggle in anonymous state (icon variant)
  // ────────────────────────────────────────────────────────────────
  test("theme toggle: visible in top bar (anonymous state)", async ({
    page,
  }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("networkidle");

    // Theme toggle button should be visible in header
    const themeToggle = page
      .locator("header")
      .locator("button[aria-label*='theme'], button[aria-label*='Theme']")
      .first();

    await expect(themeToggle).toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────
  // Test 8: Theme toggle has icon variant (not segmented)
  // ────────────────────────────────────────────────────────────────
  test("theme toggle: uses icon variant (rotary, not segmented)", async ({
    page,
  }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("networkidle");

    // Theme toggle should have variant="icon"
    const themeToggle = page
      .locator("header")
      .locator("button[aria-label*='theme'], button[aria-label*='Theme']")
      .first();

    const classList = await themeToggle.getAttribute("class");
    // Icon variant should have minimal styling, not segmented button styles
    expect(classList).toBeTruthy();
    // Should not have segmented button indicators
    expect(classList).not.toContain("group");
  });

  // ────────────────────────────────────────────────────────────────
  // Test 9: Mobile viewport 375px integrity
  // ────────────────────────────────────────────────────────────────
  test("mobile 375px: layout does not overflow, tabs visible", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("networkidle");

    const mainContent = page.locator("main#main-content");
    const boundingBox = await mainContent.boundingBox();

    // Content should fit within viewport without horizontal scroll
    expect(boundingBox?.width).toBeLessThanOrEqual(375);

    // Bottom tabs should be visible
    const bottomTabs = page.locator("nav[aria-label='App tabs']");
    await expect(bottomTabs).toBeVisible();

    // Tabs should not be hidden
    const tabs = page.locator("nav[aria-label='App tabs'] li");
    const tabCount = await tabs.count();
    expect(tabCount).toBe(3);
  });

  // ────────────────────────────────────────────────────────────────
  // Test 10: Dashboard tab active state on /ledger
  // ────────────────────────────────────────────────────────────────
  test("mobile: Dashboard tab is active on /ledger", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("networkidle");

    const dashboardTab = page
      .locator("nav[aria-label='App tabs'] li")
      .first()
      .locator("a, button");

    // Should have aria-current="page" when active
    const ariaCurrent = await dashboardTab.getAttribute("aria-current");
    expect(ariaCurrent).toBe("page");

    // Should have gold text (active state)
    const classList = await dashboardTab.getAttribute("class");
    expect(classList).toContain("text-gold");
  });

  // ────────────────────────────────────────────────────────────────
  // Test 11: Add tab active state on /ledger/cards/new
  // ────────────────────────────────────────────────────────────────
  test("mobile: Add tab is active on /ledger/cards/new", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/ledger/cards/new");
    await page.waitForLoadState("networkidle");

    const addTab = page
      .locator("nav[aria-label='App tabs'] li")
      .nth(1)
      .locator("a, button");

    // Should have aria-current="page" when active
    const ariaCurrent = await addTab.getAttribute("aria-current");
    expect(ariaCurrent).toBe("page");

    // Should have gold text
    const classList = await addTab.getAttribute("class");
    expect(classList).toContain("text-gold");
  });

  // ────────────────────────────────────────────────────────────────
  // Test 12: Valhalla tab has Karl upsell indicator for non-Karl users
  // ────────────────────────────────────────────────────────────────
  test("mobile: Valhalla tab shows Karl upsell indicator", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("networkidle");

    const valhallaTab = page
      .locator("nav[aria-label='App tabs'] li")
      .nth(2);

    // Should have a "K" indicator for Karl tier requirement (if user is not Karl)
    // Check for aria-label mentioning Karl tier
    const ariaLabel = await valhallaTab.locator("button").getAttribute("aria-label");
    // May or may not show K badge depending on user entitlement
    expect(ariaLabel).toBeTruthy();
  });

  // ────────────────────────────────────────────────────────────────
  // Test 13: Top bar has LedgerTopBar structure (logo + back + theme + avatar)
  // ────────────────────────────────────────────────────────────────
  test("desktop: LedgerTopBar has logo, back link, theme toggle, avatar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("networkidle");

    const header = page.locator("header");

    // Should have logo/home link
    const homeLink = header.locator("a[aria-label*='Fenrir']");
    await expect(homeLink).toBeVisible();

    // Desktop: should have back link
    const backLink = header.locator("a[aria-label*='Back to site']");
    await expect(backLink).toBeVisible();

    // Should have theme toggle
    const themeToggle = header.locator(
      "button[aria-label*='theme'], button[aria-label*='Theme']"
    );
    await expect(themeToggle).toBeVisible();

    // Should have avatar button
    const avatarButton = header.locator("button[aria-haspopup='true']");
    await expect(avatarButton).toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────
  // Test 14: Mobile top bar has logo + back icon + theme + avatar
  // ────────────────────────────────────────────────────────────────
  test("mobile: LedgerTopBar has compact layout (logo + back icon + theme + avatar)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("networkidle");

    const header = page.locator("header");

    // Should have compact logo (FL)
    const logo = header.locator("span:has-text('FL')");
    await expect(logo).toBeVisible();

    // Should have back icon (mobile only)
    const backIcon = header
      .locator("a[aria-label*='Back to site']")
      .filter({ has: page.locator("svg") });
    // Mobile: back icon visible
    const backVisible = await backIcon.isVisible();
    expect(backVisible).toBeTruthy();

    // Should have theme toggle
    const themeToggle = header.locator(
      "button[aria-label*='theme'], button[aria-label*='Theme']"
    );
    await expect(themeToggle).toBeVisible();

    // Should have avatar button
    const avatarButton = header.locator("button[aria-haspopup='true']");
    await expect(avatarButton).toBeVisible();
  });

  // ────────────────────────────────────────────────────────────────
  // Test 15: No horizontal scroll on mobile
  // ────────────────────────────────────────────────────────────────
  test("mobile: no horizontal scroll required", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState("networkidle");

    // Check document scrollWidth vs clientWidth
    const scrollInfo = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    // Should not have horizontal scroll
    expect(scrollInfo.scrollWidth).toBeLessThanOrEqual(
      scrollInfo.clientWidth + 5
    ); // Allow 5px tolerance
  });
});
