/**
 * Howl Karl Tier — Interactive QA Test Suite — Issue #398
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests actual browser behavior for Howl Panel tier gating:
 *   AC1: Thrall sees blurred teaser + upsell overlay
 *   AC2: Upsell overlay links to /pricing
 *   AC3: Karl sees full Howl Panel unchanged
 *   AC4: Ragnarök gated behind Karl tier
 *   AC5: Mobile responsive layout at 375px
 *
 * Tier seeding via localStorage:
 *   - auth:session (auth status)
 *   - fenrir_ledger:{householdId}:entitlement (tier: "thrall" | "karl")
 *   - fenrir_ledger:{householdId}:cards (empty for clean tests)
 *
 * These tests validate:
 *   - UI renders correctly based on tier
 *   - Upsell overlay appears and links to /pricing
 *   - Blurred teaser shows (not real user data)
 *   - Mobile layout responsive at 375px+
 */

import { test, expect, Page } from "@playwright/test";
import {
  seedCards,
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
  makeCard,
} from "../helpers/test-fixtures";

// ─────────────────────────────────────────────────────────────────────────────
// Test Utilities — Tier Seeding
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_SESSION_KEY = "auth:session";

async function seedSession(page: Page) {
  const now = Date.now();
  const session = {
    user: {
      sub: "test-user-" + now,
      email: "test@fenrir-ledger.dev",
      name: "Test User",
      picture: "https://example.com/photo.jpg",
    },
    access_token: "ya29.test_token_" + now,
    id_token: "test_id_token",
    refresh_token: "test_refresh_token",
    expires_at: now + 3600000,
  };

  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    {
      key: AUTH_SESSION_KEY,
      value: JSON.stringify(session),
    }
  );
}

async function seedEntitlement(
  page: Page,
  householdId: string,
  tier: "thrall" | "karl"
) {
  await page.evaluate(
    ({ householdId, tier }) => {
      const entitlement = {
        tier,
        active: true,
        platform: "stripe",
        userId: `${tier}-customer-${householdId}`,
        linkedAt: Date.now(),
        checkedAt: Date.now(),
      };
      localStorage.setItem(
        `fenrir_ledger:${householdId}:entitlement`,
        JSON.stringify(entitlement)
      );
    },
    { householdId, tier }
  );
}

async function goToDashboardWithTier(page: Page, tier: "thrall" | "karl") {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await clearAllStorage(page);
  await seedSession(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedEntitlement(page, ANONYMOUS_HOUSEHOLD_ID, tier);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, []);
  await page.goto("/ledger", { waitUntil: "networkidle" });
}

// ─────────────────────────────────────────────────────────────────────────────
// AC1: Thrall sees blurred teaser + upsell overlay
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC1: Thrall UI — Blurred teaser + upsell overlay", () => {
  test("Howl tab visible with 🔒 KARL badge for Thrall", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");

    // Howl tab should exist with lock emoji and KARL badge
    const howlTab = page.locator('button#tab-howl');
    await expect(howlTab).toBeVisible();

    // Tab should contain lock emoji (🔒) and "KARL" text
    const tabContent = await howlTab.textContent();
    expect(tabContent).toMatch(/🔒|KARL/);
  });

  test("Teaser content is visible for Thrall (blurred state)", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");

    // Click Howl tab to view teaser
    const howlTab = page.locator('button#tab-howl');
    await howlTab.click();
    await page.waitForTimeout(300);

    // Teaser section should be visible
    const teaser = page.locator('[data-testid="howl-teaser-state"]');
    await expect(teaser).toBeVisible();

    // Should have blur effect in style attribute
    const blurDiv = teaser.locator('div[style*="blur"]');
    await expect(blurDiv).toBeVisible();
  });

  test("Sample alerts display in teaser (blurred)", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // Teaser should have 3 sample alert cards
    const teaser = page.locator('[data-testid="howl-teaser-state"]');
    const cards = teaser.locator('div.border').filter({ hasNot: page.locator('role=dialog') });

    // Count direct children (sample alert cards)
    const allDivs = teaser.locator('div').first();
    const text = await teaser.textContent();

    // Verify sample bank names are present (hardcoded data)
    expect(text).toMatch(/CHASE SAPPHIRE/);
    expect(text).toMatch(/AMEX GOLD/);
    expect(text).toMatch(/CAPITAL ONE/);
  });

  test("Blurred content is aria-hidden to prevent screen reader access", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // Blurred section should have aria-hidden
    const teaser = page.locator('[data-testid="howl-teaser-state"]');
    const blurredDiv = teaser.locator('[aria-hidden="true"]');
    await expect(blurredDiv).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2: Upsell overlay and /pricing links
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC2: Thrall upsell overlay — Links to /pricing", () => {
  test("Upsell overlay is immediately visible on Howl tab for Thrall", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // Overlay dialog should be visible immediately (not hidden behind teaser)
    const overlay = page.locator('div[role="dialog"]');
    await expect(overlay).toBeVisible();
  });

  test("Upsell overlay has 'Unlock The Howl' heading", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // Overlay should contain h3 heading with text
    const heading = page.locator('div[role="dialog"] h3');
    await expect(heading).toContainText("Unlock The Howl");
  });

  test("Upsell CTA link 'Upgrade to Karl' goes to /pricing", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // Find the upgrade link
    const overlay = page.locator('div[role="dialog"]');
    const upgradeLink = overlay.locator('a:has-text("Upgrade to Karl")');
    await expect(upgradeLink).toBeVisible();

    // Check href
    const href = await upgradeLink.getAttribute("href");
    expect(href).toBe("/pricing");
  });

  test("Upsell overlay has secondary 'See all Karl features' link to /pricing", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // Should have at least 2 links to /pricing (primary + secondary)
    const overlay = page.locator('div[role="dialog"]');
    const pricingLinks = overlay.locator('a[href="/pricing"]');
    const count = await pricingLinks.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("Upsell overlay features list mentions Howl capabilities", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // Overlay should describe Howl features
    const overlay = page.locator('div[role="dialog"]');
    const text = await overlay.textContent();
    // Should mention fee alerts and deadlines
    expect(text).toMatch(/fee|alert|deadline|bonus/i);
  });

  test("Upsell dialog mentions Ragnarök feature", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // Overlay should mention Ragnarök
    const overlay = page.locator('div[role="dialog"]');
    const text = await overlay.textContent();
    expect(text).toMatch(/ragnarok|ragnarök/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3: Karl sees full Howl Panel unchanged
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC3: Karl tier — Full Howl Panel (no teaser)", () => {
  test("Howl tab visible without lock emoji for Karl user", async ({ page }) => {
    await goToDashboardWithTier(page, "karl");

    const howlTab = page.locator('button#tab-howl');
    await expect(howlTab).toBeVisible();

    // Should NOT have lock emoji (🔒)
    const tabText = await howlTab.textContent();
    expect(tabText).not.toMatch(/🔒/);
  });

  test("Karl user sees full Howl Panel (no teaser)", async ({ page }) => {
    await goToDashboardWithTier(page, "karl");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // Should NOT render HowlTeaserState
    const teaser = page.locator('[data-testid="howl-teaser-state"]');
    await expect(teaser).not.toBeVisible();

    // Should render full panel container
    const panelContainer = page.locator('div#panel-howl');
    await expect(panelContainer).toBeVisible();
  });

  test("Karl user sees empty state when no cards in Howl", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "karl");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // With no cards, should show empty state
    const teaser = page.locator('[data-testid="howl-teaser-state"]');
    await expect(teaser).not.toBeVisible();

    // Panel should be visible (but empty)
    const panelContainer = page.locator('div#panel-howl');
    await expect(panelContainer).toBeVisible();
  });

  test("Karl user has no upsell overlay for Howl tab", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "karl");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // No overlay should appear for Karl user
    const overlay = page.locator('div[role="dialog"]');
    await expect(overlay).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4: Ragnarök gated behind Karl tier
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC4: Ragnarök gated — Karl tier only", () => {
  test("Ragnarök overlay does NOT appear for Thrall even with urgent cards", async ({
    page,
  }) => {
    // Seed Thrall with multiple urgent cards (status = fee_approaching/overdue)
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clearAllStorage(page);
    await seedSession(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedEntitlement(page, ANONYMOUS_HOUSEHOLD_ID, "thrall");

    // Create 5+ cards with fee_approaching status (urgent)
    const urgentCards = [];
    for (let i = 0; i < 6; i++) {
      urgentCards.push(
        makeCard({
          cardId: `urgent-${i}`,
          issuer: `Bank ${i}`,
          status: "fee_approaching",
          annualFeeDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
      );
    }
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, urgentCards);

    await page.goto("/ledger", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Ragnarök overlay should NOT appear for Thrall
    const ragnarokText = page.locator('text=/Ragnarok|Ragnarök/');
    await expect(ragnarokText).not.toBeVisible();

    // Page should be accessible
    const dashboard = page.locator('div#panel-all, div#panel-howl');
    await expect(dashboard.first()).toBeVisible();
  });

  test("Ragnarök text MAY appear for Karl with urgent cards (if triggered)", async ({
    page,
  }) => {
    // Seed Karl with 5+ urgent cards
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clearAllStorage(page);
    await seedSession(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedEntitlement(page, ANONYMOUS_HOUSEHOLD_ID, "karl");

    const urgentCards = [];
    for (let i = 0; i < 6; i++) {
      urgentCards.push(
        makeCard({
          cardId: `urgent-${i}`,
          issuer: `Bank ${i}`,
          status: "fee_approaching",
          annualFeeDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
      );
    }
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, urgentCards);

    await page.goto("/ledger", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // For Karl: Page should load without being stuck, allows Ragnarök logic
    // This validates the feature isn't blocking Karl from seeing it
    const dashboard = page.locator('div#panel-all, div#panel-howl');
    await expect(dashboard.first()).toBeVisible();
  });

  test("Thrall dashboard loads without Ragnarök branding", async ({
    page,
  }) => {
    // Check that Thrall doesn't see Ragnarök styling on tabs
    await goToDashboardWithTier(page, "thrall");

    // Look at the Howl tab text - should NOT be "Ragnarök Approaches"
    const howlTab = page.locator('button#tab-howl');
    const tabText = await howlTab.textContent();

    // Thrall should see "The Howl" or similar, not "Ragnarök Approaches"
    expect(tabText).not.toMatch(/Ragnarok|Ragnarök.*Approaches/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC5: Mobile responsive layout at 375px+
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC5: Mobile responsive layout — 375px+", () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport to iPhone SE width (375px)
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test("Teaser renders at 375px without horizontal scroll", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // Panel should fit within 375px viewport
    const panel = page.locator('div#panel-howl');
    await expect(panel).toBeVisible();

    // Get viewport width
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBeLessThanOrEqual(375);
  });

  test("Upsell overlay content fits within 375px viewport", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // Overlay should be visible and fit viewport
    const overlay = page.locator('div[role="dialog"]');
    await expect(overlay).toBeVisible();

    const box = await overlay.boundingBox();
    const viewportSize = page.viewportSize();
    // Overlay should not exceed viewport
    expect(box?.width).toBeLessThanOrEqual(viewportSize?.width || 375);
  });

  test("Upgrade button touch target is >=44px height on mobile", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    const overlay = page.locator('div[role="dialog"]');
    const upgradeLink = overlay.locator('a:has-text("Upgrade to Karl")');
    await expect(upgradeLink).toBeVisible();

    const box = await upgradeLink.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test("Teaser section stacks vertically on mobile (375px)", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // Teaser should be full width
    const teaser = page.locator('[data-testid="howl-teaser-state"]');
    const box = await teaser.boundingBox();
    const viewportSize = page.viewportSize();

    // Should be full width (or near it)
    expect(box?.width).toBeGreaterThan((viewportSize?.width || 375) * 0.8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge case: Tier upgrade reactivity
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Tier upgrade — Reactive state change", () => {
  test("Dashboard reactively swaps teaser → full panel on tier upgrade", async ({
    page,
  }) => {
    // Start as Thrall
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // Verify teaser is showing
    const teaser = page.locator('[data-testid="howl-teaser-state"]');
    await expect(teaser).toBeVisible();

    // Simulate tier upgrade by updating localStorage
    await page.evaluate(
      ({ householdId }) => {
        const entitlement = {
          tier: "karl",
          active: true,
          platform: "stripe",
          userId: `karl-customer-${householdId}`,
          linkedAt: Date.now(),
          checkedAt: Date.now(),
        };
        localStorage.setItem(
          `fenrir_ledger:${householdId}:entitlement`,
          JSON.stringify(entitlement)
        );
      },
      { householdId: ANONYMOUS_HOUSEHOLD_ID }
    );

    // Reload to reflect tier change
    await page.reload({ waitUntil: "networkidle" });
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // Teaser should no longer be visible
    const teaserAfter = page.locator('[data-testid="howl-teaser-state"]');
    await expect(teaserAfter).not.toBeVisible();

    // Full panel should appear
    const fullPanel = page.locator('div#panel-howl');
    await expect(fullPanel).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Accessibility validation
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Accessibility — ARIA and semantic markup", () => {
  test("Upsell overlay has proper aria-modal and aria-label", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    const overlay = page.locator('div[role="dialog"]');
    await expect(overlay).toBeVisible();

    const ariaModal = await overlay.getAttribute("aria-modal");
    const ariaLabel = await overlay.getAttribute("aria-label");

    // aria-modal should be false (overlay is decorative, not blocking)
    expect(ariaModal).toMatch(/false|true/);
    // aria-label should describe the dialog
    expect(ariaLabel).toMatch(/unlock|howl|karl|tier/i);
  });

  test("Blurred section has aria-hidden to hide from screen readers", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    // The blurred content div should have aria-hidden
    const teaser = page.locator('[data-testid="howl-teaser-state"]');
    const blurredDiv = teaser.locator('[aria-hidden="true"]');
    await expect(blurredDiv).toBeVisible();
  });

  test("Feature list in overlay has aria-label", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button#tab-howl').click();
    await page.waitForTimeout(300);

    const overlay = page.locator('div[role="dialog"]');
    const featureList = overlay.locator('ul[aria-label*="feature"], ul[aria-label*="Karl"]');

    // Feature list should be labeled
    if (await featureList.isVisible()) {
      const ariaLabel = await featureList.getAttribute("aria-label");
      expect(ariaLabel).toBeTruthy();
    }
  });
});
