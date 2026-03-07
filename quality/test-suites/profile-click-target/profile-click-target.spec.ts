/**
 * Test suite for GitHub Issue #230: Make entire profile area clickable in top bar
 *
 * Acceptance Criteria:
 * - [x] Entire profile area (email + avatar) is a single click target
 * - [x] Click anywhere in the region opens the user menu/dropdown
 * - [x] Hover state covers the full region (not just the avatar)
 * - [x] Touch target meets 44px minimum height on mobile
 * - [x] Cursor shows pointer over the entire region
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

const AUTH_HOUSEHOLD_ID = "auth-test-household-id";

/**
 * Seeds a fake authenticated session into localStorage.
 * The session uses AUTH_HOUSEHOLD_ID as the user's sub (householdId).
 */
async function seedFakeAuth(page: any): Promise<void> {
  await page.evaluate((householdId: string) => {
    const fakeSession = {
      access_token: "fake-access-token",
      id_token: "fake-id-token",
      expires_at: Date.now() + 3_600_000,
      user: {
        sub: householdId,
        email: "test@example.com",
        name: "Test User",
        picture: "",
      },
    };
    localStorage.setItem("fenrir:auth", JSON.stringify(fakeSession));
  }, AUTH_HOUSEHOLD_ID);
}

test.describe("Profile Click Target (#230)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  });

  test("entire profile button wraps email + avatar + caret (signed-in)", async ({
    page,
  }) => {
    await seedFakeAuth(page);
    await seedHousehold(page, AUTH_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('[aria-label*="Open user menu"]', {
      timeout: 10000,
    });

    const profileButton = page.locator('[aria-label*="Open user menu"]');
    await expect(profileButton).toBeVisible();

    const tagName = await profileButton.evaluate((el) => el.tagName);
    expect(tagName).toBe("BUTTON");

    const emailInButton = profileButton.locator('text="test@example.com"');
    await expect(emailInButton).toBeVisible();

    const avatarInButton = profileButton.locator('div[aria-label]').or(
      profileButton.locator('img[alt*="profile"]')
    );
    await expect(avatarInButton).toBeVisible();

    const caretInButton = profileButton.locator('text="▾"');
    await expect(caretInButton).toBeVisible();
  });

  test("clicking email text opens user menu (signed-in)", async ({ page }) => {
    await seedFakeAuth(page);
    await seedHousehold(page, AUTH_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('[aria-label*="Open user menu"]', {
      timeout: 10000,
    });

    const userMenu = page.locator('#user-menu');
    await expect(userMenu).not.toBeVisible();

    const emailText = page.locator('text="test@example.com"').first();
    await emailText.click();

    await expect(userMenu).toBeVisible();
  });

  test("clicking avatar opens user menu (signed-in)", async ({ page }) => {
    await seedFakeAuth(page);
    await seedHousehold(page, AUTH_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('[aria-label*="Open user menu"]', {
      timeout: 10000,
    });

    const userMenu = page.locator('#user-menu');
    await expect(userMenu).not.toBeVisible();

    const profileButton = page.locator('[aria-label*="Open user menu"]');
    const avatar = profileButton.locator('div').first();
    await avatar.click();

    await expect(userMenu).toBeVisible();
  });

  test("clicking dropdown caret opens user menu (signed-in)", async ({
    page,
  }) => {
    await seedFakeAuth(page);
    await seedHousehold(page, AUTH_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('[aria-label*="Open user menu"]', {
      timeout: 10000,
    });

    const userMenu = page.locator('#user-menu');
    await expect(userMenu).not.toBeVisible();

    const profileButton = page.locator('[aria-label*="Open user menu"]');
    const caret = profileButton.locator('text="▾"');
    await caret.click();

    await expect(userMenu).toBeVisible();
  });

  test("hover state covers entire profile region (signed-in)", async ({
    page,
  }) => {
    await seedFakeAuth(page);
    await seedHousehold(page, AUTH_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('[aria-label*="Open user menu"]', {
      timeout: 10000,
    });

    const profileButton = page.locator('[aria-label*="Open user menu"]');

    const beforeHover = await profileButton.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
      };
    });

    const emailText = profileButton.locator('text="test@example.com"');
    await emailText.hover();

    const afterHover = await profileButton.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
      };
    });

    expect(beforeHover.backgroundColor).not.toBe(afterHover.backgroundColor);
  });

  test("touch target meets 44px minimum height (signed-in)", async ({
    page,
  }) => {
    await seedFakeAuth(page);
    await seedHousehold(page, AUTH_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('[aria-label*="Open user menu"]', {
      timeout: 10000,
    });

    const profileButton = page.locator('[aria-label*="Open user menu"]');
    const box = await profileButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("cursor shows pointer over entire region (signed-in)", async ({
    page,
  }) => {
    await seedFakeAuth(page);
    await seedHousehold(page, AUTH_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('[aria-label*="Open user menu"]', {
      timeout: 10000,
    });

    const profileButton = page.locator('[aria-label*="Open user menu"]');
    const cursorStyle = await profileButton.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.cursor;
    });

    expect(cursorStyle).toBe("pointer");
  });

  test("anonymous state: avatar click opens upsell panel", async ({ page }) => {
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('[aria-label="Sign in to sync your data"]', {
      timeout: 10000,
    });

    const anonymousButton = page.locator(
      '[aria-label="Sign in to sync your data"]'
    );
    await expect(anonymousButton).toBeVisible();

    const upsellPanel = page.locator('#anon-upsell-panel');
    await expect(upsellPanel).not.toBeVisible();

    await anonymousButton.click();
    await expect(upsellPanel).toBeVisible();
  });

  test("anonymous state: touch target meets 44px minimum", async ({ page }) => {
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('[aria-label="Sign in to sync your data"]', {
      timeout: 10000,
    });

    const anonymousButton = page.locator(
      '[aria-label="Sign in to sync your data"]'
    );

    const box = await anonymousButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("profile button has proper ARIA attributes", async ({ page }) => {
    await seedFakeAuth(page);
    await seedHousehold(page, AUTH_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('[aria-label*="Open user menu"]', {
      timeout: 10000,
    });

    const profileButton = page.locator('[aria-label*="Open user menu"]');
    await expect(profileButton).toHaveAttribute("aria-haspopup", "true");
    await expect(profileButton).toHaveAttribute("aria-expanded", "false");
    await expect(profileButton).toHaveAttribute("aria-controls", "user-menu");

    await profileButton.click();
    await expect(profileButton).toHaveAttribute("aria-expanded", "true");
  });

  test("clicking padding area opens menu (edge case)", async ({ page }) => {
    await seedFakeAuth(page);
    await seedHousehold(page, AUTH_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('[aria-label*="Open user menu"]', {
      timeout: 10000,
    });

    const profileButton = page.locator('[aria-label*="Open user menu"]');
    const userMenu = page.locator('#user-menu');
    await expect(userMenu).not.toBeVisible();

    const box = await profileButton.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.click(box!.x + 4, box!.y + box!.height / 2);
    await expect(userMenu).toBeVisible();
  });

  test("mobile viewport: profile button remains clickable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await seedFakeAuth(page);
    await seedHousehold(page, AUTH_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('[aria-label*="Open user menu"]', {
      timeout: 10000,
    });

    const profileButton = page.locator('[aria-label*="Open user menu"]');
    const userMenu = page.locator('#user-menu');

    const box = await profileButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await profileButton.click();
    await expect(userMenu).toBeVisible();
  });
});
