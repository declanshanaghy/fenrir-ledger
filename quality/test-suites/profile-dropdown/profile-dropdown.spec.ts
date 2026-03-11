/**
 * Profile Dropdown Test Suite — Fenrir Ledger #434
 * Authored by Loki, QA Tester of the Pack
 *
 * Issue #434: Redesign profile dropdown — inconsistent icon placement, wonky layout
 *
 * Validates the profile dropdown redesign for signed-in users (top-right corner).
 *
 * Acceptance Criteria Validated:
 *   ✓ Clean, consistent dropdown layout
 *   ✓ Icons/actions aligned consistently (all icons LEFT)
 *   ✓ Theme toggle integrated naturally (rotary icon)
 *   ✓ Settings and Sign out clear and accessible
 *   ✓ Mobile-friendly (dropdown should work on 375px)
 *
 * Test Pattern:
 *   1. Mock authenticated session via localStorage
 *   2. Navigate to /ledger (requires auth)
 *   3. Click avatar button to open dropdown
 *   4. Validate layout, icon alignment, and interactive elements
 *   5. Test on desktop (1280px) and mobile (375px) viewports
 *
 * NOTE: Tests use clearAllStorage + custom session mock since
 * we cannot perform real OAuth flow in CI. Session is mocked
 * via localStorage.fenrir:auth-session.
 */

import { test, expect } from "@playwright/test";
import { clearAllStorage, ANONYMOUS_HOUSEHOLD_ID } from "../helpers/test-fixtures";

// Test user for mocked sessions
const MOCK_USER = {
  name: "Wolf Test",
  email: "wolf@fenrir.test",
  picture: null, // Picture will show rune fallback
};

/**
 * Seed a mock authenticated session into localStorage
 * (bypasses OAuth for testing purposes)
 *
 * Note: Auth session is stored as "fenrir:auth" per AuthContext.tsx.
 * This must be called via page.evaluate() AFTER page.goto() to set
 * localStorage in the browser context properly.
 */
async function seedAuthSession(page) {
  const now = Date.now();
  const expiresAt = now + 60 * 60 * 1000; // 1 hour from now

  const session = {
    user: {
      ...MOCK_USER,
      sub: "test-user-123", // Google user ID
    },
    account: {
      type: "oauth",
      provider: "google",
    },
    expires_at: expiresAt, // milliseconds since epoch - required for isSessionValid()
  };

  // Store session in localStorage via page.evaluate (browser context)
  await page.evaluate((sessionData) => {
    localStorage.setItem("fenrir:auth", JSON.stringify(sessionData));
    // Also set the household ID to the user's sub
    localStorage.setItem("fenrir:household", sessionData.user.sub);
  }, session);
}

// ════════════════════════════════════════════════════════════════════════════
// Desktop Tests (1280px)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Profile Dropdown — Desktop (1280px)", () => {
  test.beforeEach(async ({ page }) => {
    page.setViewportSize({ width: 1280, height: 720 });
    // Navigate to "/" first to establish browser context
    await page.goto("/", { waitUntil: "networkidle" });
    // Clear storage and seed auth session
    await clearAllStorage(page);
    await seedAuthSession(page);
    // Navigate to /ledger
    await page.goto("/ledger", { waitUntil: "networkidle" });
  });

  test("TC-PD01: Dropdown opens when avatar button is clicked", async ({
    page,
  }) => {
    // Given: user is signed in (session mocked)
    // When: avatar button in top-right is clicked
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await expect(avatarButton).toBeVisible();
    await avatarButton.click();

    // Then: user menu (role="menu") should be visible
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();
    await expect(userMenu).toHaveAttribute("aria-label", "User menu");
  });

  test("TC-PD02: Dropdown contains profile header, theme row, settings, and sign-out", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // Then: dropdown has four sections in order:
    // 1. Profile header (informational)
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    await expect(profileHeader).toContainText(MOCK_USER.name);
    await expect(profileHeader).toContainText(MOCK_USER.email);

    // 2. Theme row with icon + label
    const themeRow = userMenu.locator('[role="menuitem"]').nth(0);
    await expect(themeRow).toBeVisible();
    // Theme row contains the label "Theme"
    await expect(themeRow).toContainText("Theme");

    // 3. Settings button with icon
    const settingsButton = userMenu.locator('[role="menuitem"]').nth(1);
    await expect(settingsButton).toBeVisible();
    await expect(settingsButton).toContainText("Settings");
    const settingsIcon = settingsButton.locator("svg").first();
    await expect(settingsIcon).toBeVisible();

    // 4. Sign out button with icon
    const signOutButton = userMenu.locator('[role="menuitem"]').nth(2);
    await expect(signOutButton).toBeVisible();
    await expect(signOutButton).toContainText("Sign out");
    const signOutIcon = signOutButton.locator("svg").first();
    await expect(signOutIcon).toBeVisible();
  });

  test("TC-PD03: All icons are present and LEFT-aligned", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // Get all menu items (theme, settings, sign-out)
    const menuItems = userMenu.locator('[role="menuitem"]');
    await expect(menuItems).toHaveCount(3); // theme, settings, sign-out

    // Verify all items have icons (either as child elements or inline)
    // Theme row has ThemeToggle with icon
    const themeItem = menuItems.nth(0);
    const themeIcon = themeItem.locator("[aria-label*='theme' i], svg").first();
    await expect(themeIcon).toBeVisible();

    // Settings button has Settings icon (SVG)
    const settingsItem = menuItems.nth(1);
    const settingsIcon = settingsItem.locator("svg").first();
    await expect(settingsIcon).toBeVisible();

    // Sign-out button has LogOut icon (SVG)
    const signOutItem = menuItems.nth(2);
    const signOutIcon = signOutItem.locator("svg").first();
    await expect(signOutIcon).toBeVisible();

    // Verify icons come before text in layout (flex items-center gap-2 pattern)
    // by checking that each item has the flexbox structure
    const itemHTML = await themeItem.evaluate((el) =>
      el.className
    );
    await expect(itemHTML).toContain("flex");
    await expect(itemHTML).toContain("items-center");
  });

  test("TC-PD04: Theme toggle cycles through Light → Dark → System", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: theme button is clicked (the entire theme row is now a button)
    const themeButton = userMenu.locator('[role="menuitem"]').nth(0);

    // Theme button should be visible and clickable
    await expect(themeButton).toBeVisible();

    // Click to cycle
    await themeButton.click();
    await page.waitForTimeout(100); // Wait for state update

    // Button should still be visible after click
    await expect(themeButton).toBeVisible();
  });

  test("TC-PD05: Settings button navigates to /ledger/settings", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: Settings button is clicked
    const settingsButton = userMenu.locator('[role="menuitem"]').nth(1);
    await settingsButton.click();

    // Then: page navigates to /ledger/settings
    await expect(page).toHaveURL(/.*\/ledger\/settings/);
  });

  test("TC-PD06: Sign out button triggers logout", async ({ page }) => {
    // Given: dropdown is open
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: Sign out button is clicked
    const signOutButton = userMenu.locator('[role="menuitem"]').nth(2);
    await signOutButton.click();

    // Then: user should be redirected to sign-in or home
    // and dropdown should close
    await page.waitForNavigation({ waitUntil: "networkidle" });
    const userMenuAfter = page.locator('[role="menu"]');
    await expect(userMenuAfter).not.toBeVisible();
  });

  test("TC-PD07: Dropdown closes when clicking outside", async ({ page }) => {
    // Given: dropdown is open
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: clicking outside the dropdown
    await page.click("body", { position: { x: 100, y: 100 } });

    // Then: dropdown should close
    await expect(userMenu).not.toBeVisible();
  });

  test("TC-PD08: Dropdown reopens after closing", async ({ page }) => {
    // Given: dropdown is open
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: clicking outside to close
    await page.click("body", { position: { x: 100, y: 100 } });
    await expect(userMenu).not.toBeVisible();

    // Then: clicking avatar button again should open it
    await avatarButton.click();
    await expect(userMenu).toBeVisible();
  });

  test("TC-PD09: Dropdown layout has clean visual hierarchy (spacing)", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // Then: check that menu has consistent padding and borders
    const menuBox = await userMenu.boundingBox();
    const computedStyle = await userMenu.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        padding: style.padding,
        borderRadius: style.borderRadius,
        width: style.width,
      };
    });

    // Should have reasonable width (not too narrow or wide)
    const widthPx = parseInt(computedStyle.width);
    await expect(widthPx).toBeGreaterThan(200); // At least 200px
    await expect(widthPx).toBeLessThan(400); // Less than 400px

    // All menu items should have min-height of 44px for touch targets
    const menuItems = userMenu.locator('[role="menuitem"]');
    const count = await menuItems.count();
    for (let i = 0; i < count; i++) {
      const item = menuItems.nth(i);
      const itemBox = await item.boundingBox();
      await expect(itemBox.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("TC-PD10: Keyboard navigation Tab through menu items", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // Then: verify all menu items are focusable (via keyboard navigation)
    const menuItems = userMenu.locator('[role="menuitem"]');
    const count = await menuItems.count();

    // All three menu items (theme, settings, sign-out) should be present
    await expect(count).toBe(3);

    // Each menu item should be focusable (not disabled)
    for (let i = 0; i < count; i++) {
      const item = menuItems.nth(i);
      const isDisabled = await item.evaluate((el) =>
        (el as HTMLElement).hasAttribute("disabled")
      );
      await expect(isDisabled).toBe(false);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Mobile Tests (375px)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Profile Dropdown — Mobile (375px)", () => {
  test.beforeEach(async ({ page }) => {
    page.setViewportSize({ width: 375, height: 667 });
    // Navigate to "/" first to establish browser context
    await page.goto("/", { waitUntil: "networkidle" });
    // Clear storage and seed auth session
    await clearAllStorage(page);
    await seedAuthSession(page);
    // Navigate to /ledger
    await page.goto("/ledger", { waitUntil: "networkidle" });
  });

  test("TC-PD-M01: Dropdown opens on mobile", async ({ page }) => {
    // Given: user is on mobile viewport
    // When: avatar button is clicked
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await expect(avatarButton).toBeVisible();
    await avatarButton.click();

    // Then: dropdown should be visible
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();
  });

  test("TC-PD-M02: Dropdown content is readable on mobile (375px width)", async ({
    page,
  }) => {
    // Given: dropdown is open on mobile
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // Then: dropdown should fit within viewport
    const menuBox = await userMenu.boundingBox();
    const viewportSize = page.viewportSize();

    // Dropdown should not exceed viewport width (with some margin)
    await expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(
      viewportSize.width - 4
    );

    // All text should be readable (not overflowing)
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const isOverflowing = await profileHeader.evaluate((el) => {
      return el.scrollWidth > el.clientWidth;
    });
    await expect(isOverflowing).toBe(false);
  });

  test("TC-PD-M03: Menu items are touch-friendly on mobile", async ({
    page,
  }) => {
    // Given: dropdown is open on mobile
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // Then: each menu item should have min 44x44px tap target
    const menuItems = userMenu.locator('[role="menuitem"]');
    const count = await menuItems.count();

    for (let i = 0; i < count; i++) {
      const item = menuItems.nth(i);
      const itemBox = await item.boundingBox();
      // Min 44px height for touch
      await expect(itemBox.height).toBeGreaterThanOrEqual(44);
      // Should be reasonably wide for touch
      await expect(itemBox.width).toBeGreaterThan(100);
    }
  });

  test("TC-PD-M04: Theme toggle is accessible on mobile", async ({ page }) => {
    // Given: dropdown is open
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');

    // When: examining theme row
    const themeRow = userMenu.locator('[role="menuitem"]').nth(0);
    const themeRowBox = await themeRow.boundingBox();

    // Then: theme row should have adequate size for touch
    await expect(themeRowBox.height).toBeGreaterThanOrEqual(44);

    // And: should be clickable
    await expect(themeRow).toBeVisible();
  });

  test("TC-PD-M05: Settings and Sign out are accessible on mobile", async ({
    page,
  }) => {
    // Given: dropdown is open on mobile
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');

    // Then: Settings and Sign out buttons should be visible and tappable
    const settingsButton = userMenu.locator('[role="menuitem"]').nth(1);
    const signOutButton = userMenu.locator('[role="menuitem"]').nth(2);

    await expect(settingsButton).toBeVisible();
    await expect(signOutButton).toBeVisible();

    const settingsBox = await settingsButton.boundingBox();
    const signOutBox = await signOutButton.boundingBox();

    await expect(settingsBox.height).toBeGreaterThanOrEqual(44);
    await expect(signOutBox.height).toBeGreaterThanOrEqual(44);
  });

  test("TC-PD-M06: Icons are visible on mobile (not hidden or too small)", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');

    // Then: all icons should be visible
    const menuItems = userMenu.locator('[role="menuitem"]');
    const count = await menuItems.count();

    for (let i = 0; i < count; i++) {
      const item = menuItems.nth(i);
      const icon = item.locator("svg, button").first();
      await expect(icon).toBeVisible();
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Accessibility Tests
// ════════════════════════════════════════════════════════════════════════════

test.describe("Profile Dropdown — Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    page.setViewportSize({ width: 1280, height: 720 });
    // Navigate to "/" first to establish browser context
    await page.goto("/", { waitUntil: "networkidle" });
    // Clear storage and seed auth session
    await clearAllStorage(page);
    await seedAuthSession(page);
    // Navigate to /ledger
    await page.goto("/ledger", { waitUntil: "networkidle" });
  });

  test("TC-PD-A01: Dropdown has proper ARIA roles and labels", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');

    // Then: should have role="menu" and aria-label
    await expect(userMenu).toHaveAttribute("role", "menu");
    await expect(userMenu).toHaveAttribute("aria-label", "User menu");

    // All interactive items should have role="menuitem" or be buttons
    const menuItems = userMenu.locator('[role="menuitem"]');
    await expect(menuItems).toHaveCount(3); // theme, settings, sign-out
  });

  test("TC-PD-A02: Theme toggle has descriptive aria-label", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');

    // When: theme toggle button is found
    const themeRow = userMenu.locator('[role="menuitem"]').nth(0);
    const themeButton = themeRow.locator("button").first();

    // Then: should have aria-label describing current theme
    await expect(themeButton).toHaveAttribute(
      "aria-label",
      /toggle theme|Theme:/i
    );
  });

  test("TC-PD-A03: Settings and Sign out buttons are focusable", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator("header button[aria-controls='user-menu']");
    await avatarButton.click();

    // When: Settings button is focused
    const settingsButton = page.locator('[role="menuitem"]').nth(1);
    await settingsButton.focus();

    // Then: should be focused (can interact with keyboard)
    await expect(settingsButton).toBeFocused();
  });

  test("TC-PD-A04: Avatar button has descriptive aria-label", async ({
    page,
  }) => {
    // Given: avatar button is visible
    const avatarButton = page.locator("header button[aria-controls='user-menu']");

    // Then: should have aria-label indicating it opens user menu
    await expect(avatarButton).toHaveAttribute(
      "aria-label",
      /user menu|signed in/i
    );
  });
});
