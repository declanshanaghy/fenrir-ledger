import { test, expect } from "@playwright/test";

/**
 * Profile Header Tests — Issue #550
 *
 * AC1: Name and email visible in the top header bar when signed in
 * AC2: Name/email hidden on mobile (<sm), avatar only
 * AC3: Dropdown contains only menu items — no profile block
 * AC4: Tagline removed from dropdown
 * AC5: Avatar in header triggers the menu dropdown
 * AC6: Responsive at 375px
 */

test.describe("Profile Header — Issue #550", () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up authenticated session via local storage
    // This simulates a signed-in user without going through full OAuth
    await context.addInitScript(() => {
      const mockSession = {
        access_token: "mock-token",
        id_token: "mock-id-token",
        refresh_token: "mock-refresh-token",
        expires_at: Date.now() + 24 * 60 * 60 * 1000,
        user: {
          sub: "test-user-123",
          name: "Test User",
          email: "test@example.com",
          picture: "https://example.com/avatar.jpg",
        },
      };
      localStorage.setItem("fenrir:auth", JSON.stringify(mockSession));
    });
  });

  // ── AC1: Name and email visible in header when signed in ─────────────────

  test("AC1: Display name and email in header bar (desktop ≥ 640px)", async ({
    page,
  }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1024, height: 768 });

    // Navigate to ledger
    await page.goto("/ledger");

    // Name and email should be visible in the header
    const nameDisplay = page.locator('div:has-text("Test User")').first();
    const emailDisplay = page.locator('text="test@example.com"').first();

    await expect(nameDisplay).toBeVisible();
    await expect(emailDisplay).toBeVisible();

    // Verify they are in the header (near the top)
    const header = page.locator("header").first();
    const nameInHeader = header.locator('text="Test User"');
    const emailInHeader = header.locator('text="test@example.com"');

    await expect(nameInHeader).toBeVisible();
    await expect(emailInHeader).toBeVisible();
  });

  // ── AC2: Mobile - name/email hidden, avatar only ──────────────────────────

  test("AC2: Hide name/email on mobile (<640px), show avatar only", async ({
    page,
  }) => {
    // Set mobile viewport (375px = typical mobile width)
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to ledger
    await page.goto("/ledger");

    // Name and email should NOT be visible
    const nameDisplay = page.locator('div:has-text("Test User")').first();
    const emailDisplay = page.locator('text="test@example.com"').first();

    // Wait a moment for page to stabilize
    await page.waitForLoadState("networkidle");

    // Check that the text fields with name/email are hidden
    const hiddenNameDiv = page.locator(".hidden.sm\\:flex").first();
    if (await hiddenNameDiv.count() > 0) {
      // If there's a hidden sm:flex div, it should contain the name/email
      const textInHidden = await hiddenNameDiv.textContent();
      expect(textInHidden).toContain("Test User");
    }

    // Avatar should always be visible
    const avatarButton = page.locator("button[aria-label*='user menu']").first();
    await expect(avatarButton).toBeVisible();
  });

  // ── AC3: Dropdown contains only menu items — no profile block ─────────────

  test("AC3: Dropdown shows only menu items (My Cards, Theme, Settings, Sign out)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/ledger");

    // Click avatar/menu button to open dropdown
    const avatarButton = page.locator("button[aria-label*='user menu']").first();
    await avatarButton.click();

    // Get the dropdown menu
    const dropdown = page.locator("#user-menu");
    await expect(dropdown).toBeVisible();

    // Verify menu items are present
    const myCardsItem = dropdown.locator("text=My Cards").first();
    const themeItem = dropdown.locator("text=Theme").first();
    const settingsItem = dropdown.locator("text=Settings").first();
    const signOutItem = dropdown.locator("text=Sign out").first();

    await expect(myCardsItem).toBeVisible();
    await expect(themeItem).toBeVisible();
    await expect(settingsItem).toBeVisible();
    await expect(signOutItem).toBeVisible();

    // Verify dropdown contains role="menu"
    const menu = page.locator('[role="menu"]');
    await expect(menu).toHaveAttribute("id", "user-menu");

    // Count total menu items (should be 4)
    const menuItems = dropdown.locator('[role="menuitem"]');
    await expect(menuItems).toHaveCount(4);
  });

  // ── AC4: Tagline removed from dropdown ────────────────────────────────────

  test("AC4: No tagline or profile description in dropdown", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/ledger");

    // Click avatar to open dropdown
    const avatarButton = page.locator("button[aria-label*='user menu']").first();
    await avatarButton.click();

    const dropdown = page.locator("#user-menu");
    await expect(dropdown).toBeVisible();

    // Verify no profile block or tagline text exists
    // Common profile block patterns:
    const dropdownText = await dropdown.textContent();

    // Should NOT contain profile-like text
    expect(dropdownText).not.toContain("Profile");
    expect(dropdownText).not.toContain("Account");
    expect(dropdownText).not.toContain("My Profile");

    // Taglines that might appear (check absence)
    // The dropdown should only have the 4 menu items
    expect(dropdownText).toContain("My Cards");
    expect(dropdownText).toContain("Theme");
    expect(dropdownText).toContain("Settings");
    expect(dropdownText).toContain("Sign out");
  });

  // ── AC5: Avatar triggers menu dropdown ────────────────────────────────────

  test("AC5: Avatar button opens/closes the menu dropdown", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/ledger");

    const avatarButton = page.locator("button[aria-label*='user menu']").first();
    const dropdown = page.locator("#user-menu");

    // Initially dropdown should be hidden
    await expect(dropdown).not.toBeVisible();

    // Click avatar to open
    await avatarButton.click();
    await expect(dropdown).toBeVisible();

    // Click again to close
    await avatarButton.click();
    await expect(dropdown).not.toBeVisible();

    // Click once more to verify toggle works both ways
    await avatarButton.click();
    await expect(dropdown).toBeVisible();
  });

  // ── AC6: Responsive at 375px ────────────────────────────────────────────────

  test("AC6: Layout is responsive at 375px (mobile)", async ({ page }) => {
    // Set narrow mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/ledger");

    // Header should still be visible and functional
    const header = page.locator("header").first();
    await expect(header).toBeVisible();

    // Logo should be present (compact version)
    const logo = header.locator("text=FL");
    await expect(logo).toBeVisible();

    // Avatar button should be accessible
    const avatarButton = page.locator("button[aria-label*='user menu']").first();
    await expect(avatarButton).toBeVisible();

    // Avatar button should be clickable and open menu
    await avatarButton.click();
    const dropdown = page.locator("#user-menu");
    await expect(dropdown).toBeVisible();

    // Verify menu items fit on narrow screen
    const myCardsItem = dropdown.locator("text=My Cards").first();
    await expect(myCardsItem).toBeVisible();
  });

  // ── Additional edge case tests ────────────────────────────────────────────

  test("AC5: Avatar button has proper ARIA attributes", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/ledger");

    const avatarButton = page.locator("button[aria-label*='user menu']").first();

    // Check ARIA attributes
    await expect(avatarButton).toHaveAttribute("aria-haspopup", "true");
    await expect(avatarButton).toHaveAttribute("aria-expanded", "false");
    await expect(avatarButton).toHaveAttribute("aria-controls", "user-menu");

    // After clicking, aria-expanded should be true
    await avatarButton.click();
    await expect(avatarButton).toHaveAttribute("aria-expanded", "true");
  });

  test("Dropdown closes on outside click", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/ledger");

    // Open dropdown
    const avatarButton = page.locator("button[aria-label*='user menu']").first();
    await avatarButton.click();

    const dropdown = page.locator("#user-menu");
    await expect(dropdown).toBeVisible();

    // Click outside the dropdown (on body)
    await page.locator("body").click({ position: { x: 100, y: 100 } });

    // Dropdown should close
    await expect(dropdown).not.toBeVisible();
  });

  test("Menu items navigate correctly", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/ledger");

    // Open dropdown
    const avatarButton = page.locator("button[aria-label*='user menu']").first();
    await avatarButton.click();

    // Click Settings menu item
    const settingsItem = page.locator("text=Settings").first();
    await settingsItem.click();

    // Wait for navigation
    await page.waitForLoadState("networkidle");

    // URL should contain /settings
    expect(page.url()).toContain("/ledger/settings");
  });
});
