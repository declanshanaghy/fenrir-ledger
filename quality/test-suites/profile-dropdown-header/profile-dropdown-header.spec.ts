import { test, expect } from "@playwright/test";
import {
  seedHousehold,
  seedAuthenticatedSession,
} from "../../fixtures/seed-household";

test.describe("Profile Dropdown Header", () => {
  test.beforeEach(async ({ page, context }) => {
    // Seed household and authenticated session
    const { household, user } = await seedHousehold(context);
    await seedAuthenticatedSession(page, user);

    // Navigate to ledger app
    await page.goto("/ledger");

    // Wait for avatar button to be visible
    await page
      .getByRole("button", { name: /Open user menu/ })
      .waitFor({ state: "visible" });
  });

  test("Profile info displays as non-interactive header with background", async ({
    page,
  }) => {
    // Open the dropdown
    await page.getByRole("button", { name: /Open user menu/ }).click();

    // Profile header should exist as a non-interactive section
    const profileHeader = page.locator('[aria-hidden="true"]').first();

    // Should have the subtle background styling
    await expect(profileHeader).toHaveClass(/bg-secondary\/30/);

    // Should have select-none and cursor-default (non-interactive styling)
    await expect(profileHeader).toHaveClass(/select-none/);
    await expect(profileHeader).toHaveClass(/cursor-default/);

    // Should NOT be a menu item
    await expect(profileHeader).not.toHaveAttribute("role", "menuitem");
  });

  test("Profile header contains avatar, name, email, and tagline", async ({
    page,
  }) => {
    // Open the dropdown
    await page.getByRole("button", { name: /Open user menu/ }).click();

    // Get the profile header div (first aria-hidden section)
    const profileHeader = page.locator('[aria-hidden="true"]').first();

    // Should contain avatar (image or rune fallback)
    const avatar = profileHeader.locator("img, [aria-label*='Anonymous user']");
    await expect(avatar).toBeVisible();

    // Should contain user name
    const name = profileHeader.locator("span").filter({ hasText: /\w+/ }).first();
    await expect(name).toBeVisible();

    // Should contain email (text-mono class indicates email)
    const email = profileHeader.locator("span.font-mono");
    await expect(email).toBeVisible();

    // Should contain tagline "The wolf is named."
    const tagline = profileHeader.locator("span").filter({
      hasText: "The wolf is named.",
    });
    await expect(tagline).toBeVisible();
  });

  test("Clear visual separator between header and menu items", async ({
    page,
  }) => {
    // Open the dropdown
    await page.getByRole("button", { name: /Open user menu/ }).click();

    // Find the separator (h-px bg-border div with role=separator)
    const separator = page.locator('[role="separator"]');

    // Separator should be visible and distinct
    await expect(separator).toBeVisible();
    await expect(separator).toHaveClass(/bg-border/);
    await expect(separator).toHaveClass(/h-px/);
  });

  test("Menu items appear below the separator", async ({ page }) => {
    // Open the dropdown
    await page.getByRole("button", { name: /Open user menu/ }).click();

    // Get all menu items
    const theme = page.getByRole("menuitem").filter({ hasText: "Theme" });
    const settings = page.getByRole("menuitem").filter({
      hasText: "Settings",
    });
    const signOut = page.getByRole("menuitem").filter({ hasText: "Sign out" });

    // All menu items should be visible
    await expect(theme).toBeVisible();
    await expect(settings).toBeVisible();
    await expect(signOut).toBeVisible();

    // Menu items should have role="menuitem"
    await expect(theme).toHaveAttribute("role", "menuitem");
    await expect(settings).toHaveAttribute("role", "menuitem");
    await expect(signOut).toHaveAttribute("role", "menuitem");
  });

  test("Dropdown closes when clicking a menu item (My Cards / Theme / Settings)", async ({
    page,
  }) => {
    // Open the dropdown
    const avatarButton = page.getByRole("button", { name: /Open user menu/ });
    await avatarButton.click();

    // Verify dropdown is open
    const userMenu = page.locator("#user-menu");
    await expect(userMenu).toBeVisible();

    // Get the separator to verify it's visible (dropdown is open)
    const separator = page.locator('[role="separator"]');
    await expect(separator).toBeVisible();

    // Click Theme to close
    await page.getByRole("menuitem").filter({ hasText: "Theme" }).click();

    // Wait a moment for any animations
    await page.waitForTimeout(200);

    // Dropdown should be closed (user-menu should not be visible)
    await expect(userMenu).not.toBeVisible();
  });

  test("Avatar renders correctly in header (not clickable)", async ({
    page,
  }) => {
    // Open the dropdown
    await page.getByRole("button", { name: /Open user menu/ }).click();

    // Get the profile header
    const profileHeader = page.locator('[aria-hidden="true"]').first();

    // Find avatar in header
    const avatar = profileHeader.locator("div").filter({ hasClass: /border/ });

    // Avatar should be visible
    await expect(avatar).toBeVisible();

    // Avatar should have rounded-full styling
    await expect(avatar).toHaveClass(/rounded-full/);

    // Avatar should not be a button (header is non-interactive)
    const avatarButton = profileHeader.locator("button");
    await expect(avatarButton).not.toBeVisible();
  });

  test("Mobile responsive - works at 375px viewport", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();

    // Seed and setup
    const { household, user } = await seedHousehold(context);
    await seedAuthenticatedSession(page, user);

    // Navigate to ledger
    await page.goto("/ledger");

    // Open dropdown
    await page.getByRole("button", { name: /Open user menu/ }).click();

    // Verify header is still visible and properly styled
    const profileHeader = page.locator('[aria-hidden="true"]').first();
    await expect(profileHeader).toBeVisible();

    // Verify separator is visible
    const separator = page.locator('[role="separator"]');
    await expect(separator).toBeVisible();

    // Verify menu items fit on screen
    const theme = page.getByRole("menuitem").filter({ hasText: "Theme" });
    await expect(theme).toBeVisible();

    await context.close();
  });

  test("Long email addresses do not overflow in header", async ({ page }) => {
    // Open the dropdown
    await page.getByRole("button", { name: /Open user menu/ }).click();

    // Get the email element
    const email = page.locator('[aria-hidden="true"]').first().locator("span.font-mono");

    // Should have truncate class to prevent overflow
    await expect(email).toHaveClass(/truncate/);

    // Should be visible and within bounds
    const boundingBox = await email.boundingBox();
    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      // Width should be reasonable (constrained by parent)
      expect(boundingBox.width).toBeLessThan(500);
    }
  });

  test("Separator is visible in both light and dark themes", async ({
    page,
  }) => {
    // Open dropdown and check light theme
    await page.getByRole("button", { name: /Open user menu/ }).click();
    let separator = page.locator('[role="separator"]');
    await expect(separator).toBeVisible();

    // Cycle theme to dark
    await page.getByRole("menuitem").filter({ hasText: "Theme" }).click();
    await page.waitForTimeout(300);

    // Open dropdown again
    await page.getByRole("button", { name: /Open user menu/ }).click();

    // Separator should still be visible
    separator = page.locator('[role="separator"]');
    await expect(separator).toBeVisible();

    // Should have bg-border class (applies in both themes)
    await expect(separator).toHaveClass(/bg-border/);
  });

  test("Profile header does not trigger any navigation on click", async ({
    page,
  }) => {
    const currentUrl = page.url();

    // Open dropdown
    await page.getByRole("button", { name: /Open user menu/ }).click();

    // Get profile header and click on it
    const profileHeader = page.locator('[aria-hidden="true"]').first();
    await profileHeader.click();

    // URL should remain the same (no navigation)
    expect(page.url()).toBe(currentUrl);

    // Dropdown should still be open
    const userMenu = page.locator("#user-menu");
    await expect(userMenu).toBeVisible();
  });
});
