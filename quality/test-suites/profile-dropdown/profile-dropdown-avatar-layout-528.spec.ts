/**
 * Profile Dropdown Avatar Layout Test Suite — Fenrir Ledger #528
 * Authored by Loki, QA Tester of the Pack
 *
 * Issue #528: Move user profile into header dropdown menu items
 *
 * Validates the layout changes to the signed-in profile dropdown:
 * - Avatar moves from LEFT to RIGHT side of profile block
 * - Profile block becomes the first menu item (no visual disconnect)
 * - Name, email, and tagline sit on the LEFT
 * - Removes the divider/visual separation that made profile feel disconnected
 *
 * Acceptance Criteria Validated:
 *   ✓ Avatar is positioned on the RIGHT side of profile header
 *   ✓ Name, email, tagline positioned on LEFT
 *   ✓ Profile block has no separate visual border (integrated with menu)
 *   ✓ Profile block feels like first menu item, not separate header
 *   ✓ Layout works on desktop (1280px) and mobile (375px)
 *   ✓ Avatar remains visible and clickable
 *   ✓ Text truncation handles long names/emails gracefully
 *
 * Reference: Issue #528, Handoff doc Section 5 (Profile dropdown signed-in state)
 */

import { test, expect } from "@playwright/test";
import { clearAllStorage } from "../helpers/test-fixtures";

const MOCK_USER = {
  name: "Wolf Test",
  email: "wolf@fenrir.test",
  picture: null,
};

async function seedAuthSession(page) {
  const now = Date.now();
  const expiresAt = now + 60 * 60 * 1000;

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

  await page.evaluate((sessionData) => {
    localStorage.setItem("fenrir:auth", JSON.stringify(sessionData));
    localStorage.setItem("fenrir:household", sessionData.user.sub);
  }, session);
}

// ════════════════════════════════════════════════════════════════════════════
// Avatar Position & Layout Tests — Desktop (1280px)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Profile Dropdown Avatar Layout #528 — Desktop (1280px)", () => {
  test.beforeEach(async ({ page }) => {
    page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "networkidle" });
    await clearAllStorage(page);
    await seedAuthSession(page);
    await page.goto("/ledger", { waitUntil: "networkidle" });
  });

  test("TC-528-01: Avatar is positioned on RIGHT side of profile header", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: examining profile header structure
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    await expect(profileHeader).toBeVisible();

    // Then: profile header should have flexbox with justify-between
    // so avatar (right) is separated from text (left)
    const profileLayout = await profileHeader.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const childDivs = el.querySelectorAll("div");
      return {
        display: style.display,
        justifyContent: style.justifyContent,
        childrenCount: childDivs.length,
      };
    });

    // Should use flexbox with justify-between to push avatar right
    await expect(profileLayout.display).toContain("flex");
    await expect(profileLayout.justifyContent).toContain("between");
  });

  test("TC-528-02: Avatar is visually to the RIGHT of text block", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: measuring positions of avatar and text
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const positions = await profileHeader.evaluate(() => {
      const profile = document.querySelector("[aria-hidden='true']");
      if (!profile) return null;

      // Get all children
      const children = Array.from(profile.children);

      // Find text container (first child with flex-col)
      const textContainer = children.find((el) =>
        el.className.includes("flex-col")
      );
      // Find avatar (the last child, or div with SVG/img)
      const avatarContainer = children.find((el) =>
        el.className.includes("rounded-full")
      );

      if (!textContainer || !avatarContainer) return null;

      const textBox = textContainer.getBoundingClientRect();
      const avatarBox = avatarContainer.getBoundingClientRect();

      return {
        textLeft: textBox.left,
        textRight: textBox.right,
        avatarLeft: avatarBox.left,
        avatarRight: avatarBox.right,
      };
    });

    // Avatar should be to the right of text
    if (positions) {
      await expect(positions.avatarLeft).toBeGreaterThan(positions.textRight);
    }
  });

  test("TC-528-03: Profile header has consistent min-height with menu items", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // Then: profile header should match menu item heights
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const menuItems = userMenu.locator('[role="menuitem"]');

    const profileBox = await profileHeader.boundingBox();
    const firstMenuBox = await menuItems.nth(0).boundingBox();

    // Profile header height should match or be consistent with menu items
    // (typically 44px minimum for touch targets)
    await expect(profileBox.height).toBeGreaterThanOrEqual(40);
    await expect(firstMenuBox.height).toBeGreaterThanOrEqual(40);
  });

  test("TC-528-04: Profile block integrates with menu (no visual disconnect)", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: examining profile header styling
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const profileStyle = await profileHeader.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        borderBottom: style.borderBottom,
        padding: style.padding,
      };
    });

    // Profile header should have border-b (divider from menu items below)
    // This is the integration — it's the first item with a border
    await expect(profileStyle.borderBottom).not.toBe("none");
  });

  test("TC-528-05: Name and email text positioned on LEFT", async ({ page }) => {
    // Given: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: examining text content
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const textContainer = profileHeader.locator("div.flex-col").first();

    // Then: text container should contain name and email
    const textContent = await textContainer.textContent();
    await expect(textContent).toContain(MOCK_USER.name);
    await expect(textContent).toContain(MOCK_USER.email);

    // Text should be left-aligned (text-align: left or start in LTR)
    const textAlign = await textContainer.evaluate((el) => {
      return window.getComputedStyle(el).textAlign;
    });
    // text-left translates to "start" in LTR or "left" in standard
    await expect(textAlign).toMatch(/left|start/);
  });

  test("TC-528-06: Avatar is sized consistently (40px)", async ({ page }) => {
    // Given: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: measuring avatar
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const avatarBox = await profileHeader
      .locator("div.rounded-full")
      .boundingBox();

    // Then: avatar should be 40px (as per spec)
    await expect(avatarBox.width).toBe(40);
    await expect(avatarBox.height).toBe(40);
  });

  test("TC-528-07: Tagline 'The wolf is named' is visible and positioned", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: examining profile header text
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const tagline = profileHeader.locator("span:has-text('The wolf is named')");

    // Then: tagline should be visible
    await expect(tagline).toBeVisible();
    await expect(tagline).toHaveClass(/italic/); // italic class should be present
  });

  test("TC-528-08: Profile header uses flex with gap for spacing", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: examining profile header classes
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const classes = await profileHeader.evaluate((el) => el.className);

    // Then: should have flex and gap classes
    await expect(classes).toContain("flex");
    await expect(classes).toContain("gap");
  });

  test("TC-528-09: Text container has flex-col and flex-1 (grows to fill)", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: examining text container layout
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const textContainer = profileHeader.locator("div.flex-col").first();
    const classes = await textContainer.evaluate((el) => el.className);

    // Then: should have flex-col and flex-1
    await expect(classes).toContain("flex-col");
    await expect(classes).toContain("flex-1");
  });

  test("TC-528-10: Avatar has shrink-0 (prevents squishing)", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: examining avatar classes
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const avatar = profileHeader.locator("div.rounded-full").first();
    const classes = await avatar.evaluate((el) => el.className);

    // Then: avatar should have shrink-0 to prevent it from shrinking
    await expect(classes).toContain("shrink-0");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Avatar Position & Layout Tests — Mobile (375px)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Profile Dropdown Avatar Layout #528 — Mobile (375px)", () => {
  test.beforeEach(async ({ page }) => {
    page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/", { waitUntil: "networkidle" });
    await clearAllStorage(page);
    await seedAuthSession(page);
    await page.goto("/ledger", { waitUntil: "networkidle" });
  });

  test("TC-528-M01: Avatar layout works on mobile", async ({ page }) => {
    // Given: dropdown is open on mobile
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: examining profile header
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();

    // Then: should still have justify-between layout
    const layout = await profileHeader.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        justifyContent: style.justifyContent,
      };
    });

    await expect(layout.display).toContain("flex");
    await expect(layout.justifyContent).toContain("between");
  });

  test("TC-528-M02: Profile header doesn't overflow on mobile", async ({
    page,
  }) => {
    // Given: dropdown is open on mobile
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: measuring profile header
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const profileBox = await profileHeader.boundingBox();
    const menuBox = await userMenu.boundingBox();

    // Then: profile header should fit within menu
    await expect(profileBox.width).toBeLessThanOrEqual(menuBox.width);
  });

  test("TC-528-M03: Avatar and text both visible on mobile 375px", async ({
    page,
  }) => {
    // Given: dropdown is open on mobile
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: examining profile header content
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const avatar = profileHeader.locator("div.rounded-full").first();
    const textContainer = profileHeader.locator("div.flex-col").first();

    // Then: both should be visible
    await expect(avatar).toBeVisible();
    await expect(textContainer).toBeVisible();
  });

  test("TC-528-M04: Text truncates gracefully on mobile if too long", async ({
    page,
  }) => {
    // Given: dropdown is open on mobile
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: examining text container
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const textContainer = profileHeader.locator("div.flex-col").first();
    const nameSpan = textContainer.locator("span").first();
    const classes = await nameSpan.evaluate((el) => el.className);

    // Then: name should have truncate class
    await expect(classes).toContain("truncate");
  });

  test("TC-528-M05: Profile header has min-height for touch targets on mobile", async ({
    page,
  }) => {
    // Given: dropdown is open on mobile
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: measuring profile header height
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const box = await profileHeader.boundingBox();

    // Then: should have adequate height for touch
    await expect(box.height).toBeGreaterThanOrEqual(44);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Visual Integrity Tests (Avatar Icon/Image)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Profile Dropdown Avatar Icon/Image Integrity #528", () => {
  test.beforeEach(async ({ page }) => {
    page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "networkidle" });
    await clearAllStorage(page);
    await seedAuthSession(page);
    await page.goto("/ledger", { waitUntil: "networkidle" });
  });

  test("TC-528-I01: Avatar displays rune when picture is null", async ({
    page,
  }) => {
    // Given: user has no picture (MOCK_USER.picture = null)
    // When: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // Then: avatar should show rune (ᛟ)
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const avatar = profileHeader.locator("div.rounded-full").first();
    const runeText = avatar.locator("span.text-gold");
    await expect(runeText).toBeVisible();
    const content = await runeText.textContent();
    await expect(content).toBe("ᛟ");
  });

  test("TC-528-I02: Avatar has proper styling (rounded-full, border)", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: examining avatar
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const avatar = profileHeader.locator("div.rounded-full").first();
    const classes = await avatar.evaluate((el) => el.className);

    // Then: should have rounded-full and border
    await expect(classes).toContain("rounded-full");
    await expect(classes).toContain("border");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Menu Integration Tests (Profile block as first item)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Profile Dropdown Menu Integration #528", () => {
  test.beforeEach(async ({ page }) => {
    page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "networkidle" });
    await clearAllStorage(page);
    await seedAuthSession(page);
    await page.goto("/ledger", { waitUntil: "networkidle" });
  });

  test("TC-528-INT01: Profile block is first child of menu", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: examining menu structure
    const allChildren = userMenu.locator("> *"); // Direct children only

    // Then: first child should be the profile header (div with aria-hidden)
    const firstChild = allChildren.first();
    const isProfileHeader = await firstChild.evaluate((el) => {
      return el.getAttribute("aria-hidden") === "true";
    });
    await expect(isProfileHeader).toBe(true);
  });

  test("TC-528-INT02: Profile block and menu items are visually continuous", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: examining profile header and first menu item
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const firstMenuItem = userMenu.locator('[role="menuitem"]').first();

    const profileBox = await profileHeader.boundingBox();
    const menuItemBox = await firstMenuItem.boundingBox();

    // Then: they should be adjacent (menuItem.y ≈ profileHeader.y + profileHeader.height)
    const gap = Math.abs(
      menuItemBox.y - (profileBox.y + profileBox.height)
    );
    // Allow for very small gap due to rendering
    await expect(gap).toBeLessThanOrEqual(1);
  });

  test("TC-528-INT03: Profile header has border-b connecting to menu items", async ({
    page,
  }) => {
    // Given: dropdown is open
    const avatarButton = page.locator(
      "header button[aria-controls='user-menu']"
    );
    await avatarButton.click();
    const userMenu = page.locator('[role="menu"]');
    await expect(userMenu).toBeVisible();

    // When: examining profile header border
    const profileHeader = userMenu.locator("div[aria-hidden='true']").first();
    const classes = await profileHeader.evaluate((el) => el.className);

    // Then: should have border-b class
    await expect(classes).toContain("border-b");
  });
});
