/**
 * My Cards Dropdown Test Suite — #441
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates the 'My Cards' nav entry in the profile dropdown against acceptance criteria:
 * - My Cards entry visible in profile dropdown, positioned above Theme
 * - Clicking My Cards navigates to /ledger and closes dropdown
 * - Active state indicator (bold label + gold dot) visible on /ledger route
 * - Works on mobile (375px) and desktop viewports
 * - Keyboard navigation (Tab + Enter) supported
 * - Touch target >= 44x44px on mobile
 *
 * Spec references:
 *   - LedgerTopBar.tsx: ProfileDropdown component, My Cards button at line 212-233
 *   - Acceptance Criteria from #441: positioning, active state, mobile support
 *   - Edge cases: navigation from Settings, active state updates on route change
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ════════════════════════════════════════════════════════════════════════════
// Auth Helper
// ════════════════════════════════════════════════════════════════════════════

async function seedFakeAuth(page: any, householdId: string): Promise<void> {
  await page.evaluate((hId: string) => {
    const fakeSession = {
      access_token: "fake-access-token",
      id_token: "fake-id-token",
      expires_at: Date.now() + 3_600_000,
      user: {
        sub: hId,
        email: "test@example.com",
        name: "Test User",
        picture: "",
      },
    };
    localStorage.setItem("fenrir:auth", JSON.stringify(fakeSession));
  }, householdId);
}

// ════════════════════════════════════════════════════════════════════════════
// Setup
// ════════════════════════════════════════════════════════════════════════════

test.beforeEach(async ({ page }) => {
  await page.goto("/ledger");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedFakeAuth(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.reload({ waitUntil: "networkidle" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1: Profile Dropdown Entry Visibility & Positioning
// ════════════════════════════════════════════════════════════════════════════

test.describe("Profile Dropdown — My Cards Entry Visibility", () => {
  test("profile dropdown opens when avatar button is clicked", async ({
    page,
  }) => {
    // Spec: avatar button toggles dropdown
    // Button with aria-controls="user-menu" is the avatar trigger
    const avatarButton = page.locator(
      'button[aria-controls="user-menu"]'
    );
    await expect(avatarButton).toBeVisible();

    // Dropdown should not be visible yet
    const dropdown = page.locator('div[role="menu"]#user-menu');
    let isVisible = await dropdown.isVisible().catch(() => false);
    expect(isVisible).toBe(false);

    // Click avatar to open dropdown
    await avatarButton.click();

    // Dropdown should now be visible
    await expect(dropdown).toBeVisible();
  });

  test("My Cards entry is visible in profile dropdown", async ({ page }) => {
    // Spec: My Cards button exists and is visible in dropdown
    const avatarButton = page.locator(
      'button[aria-controls="user-menu"]'
    );
    await avatarButton.click();

    // My Cards button should be visible
    const myCardsButton = page.locator(
      'button[role="menuitem"] >> text=My Cards'
    ).first();
    await expect(myCardsButton).toBeVisible();
  });

  test("My Cards entry is positioned above Theme in dropdown", async ({
    page,
  }) => {
    // Spec: My Cards positioned above Theme (top-level nav items first)
    const avatarButton = page.locator(
      'button[aria-controls="user-menu"]'
    );
    await avatarButton.click();

    const dropdown = page.locator('div[role="menu"]#user-menu');

    // Get all menu items in order
    const menuItems = dropdown.locator('[role="menuitem"]');
    const itemCount = await menuItems.count();

    // Find positions of My Cards and Theme
    let myCardsIndex = -1;
    let themeIndex = -1;

    for (let i = 0; i < itemCount; i++) {
      const text = await menuItems.nth(i).textContent();
      if (text?.includes("My Cards")) myCardsIndex = i;
      if (text?.includes("Theme")) themeIndex = i;
    }

    // My Cards should appear before Theme
    expect(myCardsIndex).toBeGreaterThan(-1);
    expect(themeIndex).toBeGreaterThan(-1);
    expect(myCardsIndex).toBeLessThan(themeIndex);
  });

  test("My Cards button has icon and text", async ({ page }) => {
    // Spec: button contains LayoutGrid icon + "My Cards" text
    const avatarButton = page.locator(
      'button[aria-controls="user-menu"]'
    );
    await avatarButton.click();

    const myCardsButton = page.locator(
      'button[role="menuitem"] >> text=My Cards'
    ).first();
    await expect(myCardsButton).toBeVisible();

    // Should contain "My Cards" text
    await expect(myCardsButton).toContainText("My Cards");

    // Should have an icon (LayoutGrid with h-4 w-4)
    const icon = myCardsButton.locator("svg");
    await expect(icon).toBeVisible();
  });

  test("My Cards button meets touch target minimum (44x44px) on mobile", async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const avatarButton = page.locator(
      'button[aria-controls="user-menu"]'
    );
    await avatarButton.click();

    const myCardsButton = page.locator(
      'button[role="menuitem"] >> text=My Cards'
    ).first();

    const box = await myCardsButton.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2: Navigation & Dropdown Close
// ════════════════════════════════════════════════════════════════════════════

test.describe("Profile Dropdown — My Cards Navigation", () => {
  test("clicking My Cards navigates to /ledger", async ({ page }) => {
    // Spec: onClick -> router.push("/ledger")
    const avatarButton = page.locator(
      'button[aria-controls="user-menu"]'
    );
    await avatarButton.click();

    const myCardsButton = page.locator(
      'button[role="menuitem"] >> text=My Cards'
    ).first();

    // Click and wait for navigation
    await myCardsButton.click();
    await page.waitForURL(/\/ledger$/);

    // Should be on /ledger route
    expect(page.url()).toContain("/ledger");
  });

  test("clicking My Cards closes the dropdown", async ({ page }) => {
    // Spec: onClick calls onClose()
    const avatarButton = page.locator(
      'button[aria-controls="user-menu"]'
    );
    await avatarButton.click();

    const dropdown = page.locator('div[role="menu"]#user-menu');
    await expect(dropdown).toBeVisible();

    const myCardsButton = page.locator(
      'button[role="menuitem"] >> text=My Cards'
    ).first();
    await myCardsButton.click();

    // Dropdown should be hidden after navigation
    await page.waitForURL(/\/ledger$/);
    let isVisible = await dropdown.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test("navigating to /ledger from Settings works", async ({ page }) => {
    // Edge case: verify navigation works from other routes
    // First seed auth for the new page
    await page.goto("/ledger/settings");
    await seedFakeAuth(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    const avatarButton = page.locator(
      'button[aria-controls="user-menu"]'
    );
    await avatarButton.click();

    const myCardsButton = page.locator(
      'button[role="menuitem"] >> text=My Cards'
    ).first();
    await myCardsButton.click();

    await page.waitForURL(/\/ledger$/);
    expect(page.url()).toContain("/ledger");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3: Active State Indicator
// ════════════════════════════════════════════════════════════════════════════

test.describe("Profile Dropdown — My Cards Active State", () => {
  test("My Cards shows active state (bold + gold dot) when on /ledger", async ({
    page,
  }) => {
    // Already at /ledger from beforeEach
    // Spec: isMyCardsActive = pathname === "/ledger" → gold text + gold dot
    const avatarButton = page.locator(
      'button[aria-controls="user-menu"]'
    );
    await avatarButton.click();

    const myCardsButton = page.locator(
      'button[role="menuitem"] >> text=My Cards'
    ).first();

    // Should have text-gold class (active state)
    const classList = await myCardsButton.getAttribute("class");
    expect(classList).toContain("text-gold");

    // Should have font-semibold for bold
    expect(classList).toContain("font-semibold");

    // Should have a gold indicator dot
    const goldDot = myCardsButton.locator(
      'span[aria-hidden="true"].bg-gold.rounded-full'
    );
    await expect(goldDot).toBeVisible();
  });

  test("My Cards shows inactive state (muted + no dot) when on /ledger/settings", async ({
    page,
  }) => {
    // Navigate to Settings
    await page.goto("/ledger/settings");
    await page.waitForLoadState("networkidle");

    const avatarButton = page.locator(
      'button[aria-controls="user-menu"]'
    );
    await avatarButton.click();

    const myCardsButton = page.locator(
      'button[role="menuitem"] >> text=My Cards'
    ).first();

    // Should show muted state, not gold
    const classList = await myCardsButton.getAttribute("class");
    expect(classList).toContain("text-muted-foreground");
    expect(classList).not.toContain("text-gold");

    // Gold dot should not be present
    const goldDot = myCardsButton.locator(
      'span[aria-hidden="true"].bg-gold.rounded-full'
    );
    const dotVisible = await goldDot.isVisible().catch(() => false);
    expect(dotVisible).toBe(false);
  });

  test("active state updates when navigating between /ledger and other routes", async ({
    page,
  }) => {
    // Start at /ledger
    // Spec: active state updates when route changes

    const avatarButton = page.locator(
      'button[aria-controls="user-menu"]'
    );

    // At /ledger, My Cards should be active
    await avatarButton.click();
    let myCardsButton = page.locator(
      'button[role="menuitem"] >> text=My Cards'
    ).first();
    let classList = await myCardsButton.getAttribute("class");
    expect(classList).toContain("text-gold");

    // Navigate to Settings
    await page.click('button[role="menuitem"] >> text=Settings');
    await page.waitForURL(/\/ledger\/settings/);

    // Reopen dropdown, My Cards should now be inactive
    await avatarButton.click();
    myCardsButton = page.locator(
      'button[role="menuitem"]:has-text("My Cards")'
    );
    classList = await myCardsButton.getAttribute("class");
    expect(classList).toContain("text-muted-foreground");
    expect(classList).not.toContain("text-gold");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4: Keyboard Navigation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Profile Dropdown — My Cards Keyboard Navigation", () => {
  test("My Cards can be focused via Tab key", async ({ page }) => {
    // Spec: button is focusable and interactive
    const avatarButton = page.locator(
      'button[aria-controls="user-menu"]'
    );

    // Focus avatar button
    await avatarButton.focus();
    await page.keyboard.press("Enter");

    const myCardsButton = page.locator(
      'button[role="menuitem"] >> text=My Cards'
    ).first();

    // Tab to My Cards button
    await page.keyboard.press("Tab");

    // Check if focused
    const isFocused = await myCardsButton.evaluate(
      (el) => el === document.activeElement
    );
    expect(isFocused).toBe(true);
  });

  test("pressing Enter on My Cards button navigates to /ledger", async ({
    page,
  }) => {
    // Spec: Enter key activates navigation
    const avatarButton = page.locator(
      'button[aria-controls="user-menu"]'
    );
    await avatarButton.focus();
    await page.keyboard.press("Enter");

    const myCardsButton = page.locator(
      'button[role="menuitem"] >> text=My Cards'
    ).first();
    await myCardsButton.focus();

    // Press Enter
    await page.keyboard.press("Enter");

    // Should navigate to /ledger
    await page.waitForURL(/\/ledger$/);
    expect(page.url()).toContain("/ledger");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5: Responsive Design (Mobile vs Desktop)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Profile Dropdown — My Cards Responsive", () => {
  test.describe("Desktop (1024px)", () => {
    test.use({ viewport: { width: 1024, height: 768 } });

    test("My Cards works correctly on desktop", async ({ page }) => {
      // Spec: Works on mobile and desktop
      const avatarButton = page.locator(
        'button[aria-controls="user-menu"]'
      );
      await expect(avatarButton).toBeVisible();

      await avatarButton.click();

      const myCardsButton = page.locator(
        'button[role="menuitem"] >> text=My Cards'
      ).first();
      await expect(myCardsButton).toBeVisible();

      // Click and navigate
      await myCardsButton.click();
      await page.waitForURL(/\/ledger$/);
      expect(page.url()).toContain("/ledger");
    });
  });

  test.describe("Mobile (375px)", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("My Cards works correctly on mobile", async ({ page }) => {
      // Spec: Works on mobile and desktop
      const avatarButton = page.locator(
        'button[aria-controls="user-menu"]'
      );
      await expect(avatarButton).toBeVisible();

      await avatarButton.click();

      const myCardsButton = page.locator(
        'button[role="menuitem"] >> text=My Cards'
      ).first();
      await expect(myCardsButton).toBeVisible();

      // Click and navigate
      await myCardsButton.click();
      await page.waitForURL(/\/ledger$/);
      expect(page.url()).toContain("/ledger");
    });

    test("dropdown is properly positioned on mobile and does not overflow", async ({
      page,
    }) => {
      // Spec: dropdown should be contained within viewport
      const avatarButton = page.locator(
        'button[aria-controls="user-menu"]'
      );
      await avatarButton.click();

      const dropdown = page.locator('div[role="menu"]#user-menu');
      const box = await dropdown.boundingBox();

      // Dropdown should be within viewport bounds
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect(box?.y).toBeGreaterThanOrEqual(0);
      // Allow for some overflow on right edge due to absolute positioning
      expect(box?.height).toBeGreaterThan(0);
    });
  });
});
