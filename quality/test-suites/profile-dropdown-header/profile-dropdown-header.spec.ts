import { test, expect } from "@playwright/test";
import { clearAllStorage } from "../helpers/test-fixtures";

// Mock test user for authenticated session
const MOCK_USER = {
  name: "Wolf Tester",
  email: "wolf.tester@fenrir.test",
  picture: null,
};

/**
 * Seed a mock authenticated session into localStorage
 * (bypasses OAuth for testing purposes)
 */
async function seedAuthSession(page: any) {
  const now = Date.now();
  const expiresAt = now + 60 * 60 * 1000; // 1 hour from now

  const session = {
    user: {
      ...MOCK_USER,
      sub: "test-user-123",
    },
    account: {
      type: "oauth",
      provider: "google",
    },
    expires_at: expiresAt,
  };

  await page.evaluate((sessionData: any) => {
    localStorage.setItem("fenrir:auth", JSON.stringify(sessionData));
    localStorage.setItem("fenrir:household", sessionData.user.sub);
  }, session);
}

test.describe("Profile Dropdown Header", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app to establish browser context
    await page.goto("/", { waitUntil: "networkidle" });
    // Clear storage and seed auth session
    await clearAllStorage(page);
    await seedAuthSession(page);
    // Navigate to ledger
    await page.goto("/ledger", { waitUntil: "networkidle" });
  });

  test("Profile info displays as non-interactive header with background", async ({
    page,
  }) => {
    // Open the dropdown
    const avatarButton = page.locator("button[aria-controls='user-menu']");
    await expect(avatarButton).toBeVisible();
    await avatarButton.click();

    // Verify dropdown is open
    const userMenu = page.locator("#user-menu");
    await expect(userMenu).toBeVisible();

    // Profile header should exist as a non-interactive section
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    await expect(profileHeader).toBeVisible();

    // Should have proper styling (select-none, cursor-default)
    await expect(profileHeader).toHaveClass(/select-none/);
    await expect(profileHeader).toHaveClass(/cursor-default/);

    // Should NOT be a menu item
    await expect(profileHeader).not.toHaveAttribute("role", "menuitem");
  });

  test("Profile header contains avatar, name, email, and tagline", async ({
    page,
  }) => {
    // Open the dropdown
    const avatarButton = page.locator("button[aria-controls='user-menu']");
    await avatarButton.click();

    // Get the profile header div (first aria-hidden section)
    const userMenu = page.locator("#user-menu");
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    await expect(profileHeader).toBeVisible();

    // Should contain user name (Wolf Tester)
    await expect(profileHeader).toContainText(MOCK_USER.name);

    // Should contain email
    await expect(profileHeader).toContainText(MOCK_USER.email);

    // Should contain tagline "The wolf is named."
    await expect(profileHeader).toContainText("The wolf is named.");

    // Should contain avatar (rune fallback since picture is null)
    const rune = profileHeader.locator("span").filter({ hasText: "ᛟ" });
    await expect(rune).toBeVisible();
  });

  test("Clear visual separator between header and menu items", async ({
    page,
  }) => {
    // Open the dropdown
    const avatarButton = page.locator("button[aria-controls='user-menu']");
    await avatarButton.click();

    // Find the profile header which has border-b for visual separation
    const userMenu = page.locator("#user-menu");
    const profileHeader = userMenu.locator('div[aria-hidden="true"]').first();

    // Profile header should have border-b for separation
    await expect(profileHeader).toBeVisible();
    await expect(profileHeader).toHaveClass(/border-b/);
    await expect(profileHeader).toHaveClass(/border-border/);
  });

  test("Menu items appear below the separator", async ({ page }) => {
    // Open the dropdown
    const avatarButton = page.locator("button[aria-controls='user-menu']");
    await avatarButton.click();

    const userMenu = page.locator("#user-menu");

    // Get all menu items
    const theme = userMenu.locator('[role="menuitem"]').filter({ hasText: "Theme" });
    const settings = userMenu.locator('[role="menuitem"]').filter({
      hasText: "Settings",
    });
    const signOut = userMenu.locator('[role="menuitem"]').filter({
      hasText: "Sign out",
    });

    // All menu items should be visible
    await expect(theme).toBeVisible();
    await expect(settings).toBeVisible();
    await expect(signOut).toBeVisible();

    // Menu items should have role="menuitem"
    await expect(theme).toHaveAttribute("role", "menuitem");
    await expect(settings).toHaveAttribute("role", "menuitem");
    await expect(signOut).toHaveAttribute("role", "menuitem");
  });

  test("Dropdown closes when clicking a navigation menu item", async ({ page }) => {
    // Open the dropdown
    const avatarButton = page.locator("button[aria-controls='user-menu']");
    await avatarButton.click();

    // Verify dropdown is open
    const userMenu = page.locator("#user-menu");
    await expect(userMenu).toBeVisible();

    // Click Settings (which calls onClose)
    const settings = userMenu.locator('[role="menuitem"]').filter({ hasText: "Settings" });
    await settings.click();

    // Wait a moment for navigation/animations
    await page.waitForTimeout(300);

    // Dropdown should be closed
    await expect(userMenu).not.toBeVisible();
  });

  test("Avatar renders correctly in header", async ({ page }) => {
    // Open the dropdown
    const avatarButton = page.locator("button[aria-controls='user-menu']");
    await avatarButton.click();

    // Get the profile header
    const userMenu = page.locator("#user-menu");
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    await expect(profileHeader).toBeVisible();

    // Should contain rune (since picture is null)
    const rune = profileHeader.locator("span").filter({ hasText: "ᛟ" });
    await expect(rune).toBeVisible();

    // Avatar container should have expected classes
    const avatarContainer = rune.locator("..");
    await expect(avatarContainer).toHaveClass(/rounded-full/);
    await expect(avatarContainer).toHaveClass(/border/);
  });

  test("Mobile responsive - works at 375px viewport", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();

    // Navigate to app to establish browser context
    await page.goto("/", { waitUntil: "networkidle" });
    // Clear storage and seed auth session
    await clearAllStorage(page);
    await seedAuthSession(page);
    // Navigate to ledger
    await page.goto("/ledger", { waitUntil: "networkidle" });

    // Open dropdown
    const avatarButton = page.locator("button[aria-controls='user-menu']");
    await avatarButton.click();

    // Verify dropdown is open
    const userMenu = page.locator("#user-menu");
    await expect(userMenu).toBeVisible();

    // Verify header is still visible and properly styled
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    await expect(profileHeader).toBeVisible();

    // Verify separator is visible
    const separator = userMenu.locator('[role="separator"]');
    await expect(separator).toBeVisible();

    // Verify menu items fit on screen
    const theme = userMenu.locator('[role="menuitem"]').filter({ hasText: "Theme" });
    await expect(theme).toBeVisible();

    await context.close();
  });

  test("Long email addresses do not overflow in header", async ({ page }) => {
    // Open the dropdown
    const avatarButton = page.locator("button[aria-controls='user-menu']");
    await avatarButton.click();

    // Get the email element (font-mono but not the rune, has muted-foreground color)
    const userMenu = page.locator("#user-menu");
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const email = profileHeader.locator("span.text-muted-foreground.font-mono");

    await expect(email).toBeVisible();

    // Should have truncate class to prevent overflow
    await expect(email).toHaveClass(/truncate/);

    // Should be visible and within reasonable bounds
    const boundingBox = await email.boundingBox();
    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      // Width should be reasonable (constrained by parent w-64)
      expect(boundingBox.width).toBeLessThan(256 + 32); // w-64 + padding
    }
  });

  test("Separator has correct styling and is always visible", async ({
    page,
  }) => {
    // Open dropdown
    const avatarButton = page.locator("button[aria-controls='user-menu']");
    await avatarButton.click();

    // Verify separator exists and has correct styling
    const userMenu = page.locator("#user-menu");
    const separator = userMenu.locator('[role="separator"]');

    await expect(separator).toBeVisible();
    await expect(separator).toHaveClass(/bg-border/);
    await expect(separator).toHaveClass(/h-px/);

    // Separator should create clear visual separation
    const boundingBox = await separator.boundingBox();
    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      // Should be a thin line (1px height)
      expect(boundingBox.height).toBeLessThanOrEqual(2);
    }
  });

  test("Profile header does not trigger any navigation on click", async ({
    page,
  }) => {
    const currentUrl = page.url();

    // Open dropdown
    const avatarButton = page.locator("button[aria-controls='user-menu']");
    await avatarButton.click();

    // Get profile header and click on it
    const userMenu = page.locator("#user-menu");
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    await profileHeader.click();

    // URL should remain the same (no navigation)
    expect(page.url()).toBe(currentUrl);

    // Dropdown should still be open
    await expect(userMenu).toBeVisible();
  });
});
