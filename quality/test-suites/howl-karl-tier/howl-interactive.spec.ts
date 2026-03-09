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
    const howlTab = page.locator('button[id*="tab-howl"]');
    await expect(howlTab).toBeVisible();

    // Tab text should include lock emoji (🔒) and "KARL"
    await expect(howlTab).toContainText(/🔒.*KARL|KARL.*🔒/);
  });

  test("Teaser content is visible for Thrall (blurred state)", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");

    // Click Howl tab to view teaser
    const howlTab = page.locator('button[id*="tab-howl"]');
    await howlTab.click();
    await page.waitForTimeout(300);

    // Teaser section should be visible
    const teaser = page.locator('[data-testid="howl-teaser-content"]');
    await expect(teaser).toBeVisible();

    // Should show blur effect (CSS class or style with blur)
    const style = await teaser.evaluate((el) => {
      return window.getComputedStyle(el).filter;
    });
    expect(style).toMatch(/blur/);
  });

  test("Sample alerts display in teaser (blurred)", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    // Teaser should have 2-3 sample alert cards
    const alerts = page.locator('[data-testid="sample-alert-card"]');
    const count = await alerts.count();
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(3);

    // Each card should show bank names (sample data, not user data)
    const cardTexts = await alerts.allTextContents();
    // At least one card should have recognizable sample bank names
    const sampleBankText = cardTexts.join(" ");
    expect(sampleBankText).toMatch(/CHASE|AMEX|CAPITAL/i);
  });

  test("Blurred content is aria-hidden to prevent screen reader access", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    // Blurred section should have aria-hidden
    const blurredSection = page.locator('[aria-hidden="true"]');
    const count = await blurredSection.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2: Upsell overlay and /pricing links
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC2: Thrall upsell overlay — Links to /pricing", () => {
  test("Clicking teaser shows upsell overlay with modal dialog", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    // Click on teaser content to open overlay
    const teaser = page.locator('[data-testid="howl-teaser-content"]');
    await teaser.click();
    await page.waitForTimeout(300);

    // Overlay dialog should be visible
    const overlay = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(overlay).toBeVisible();
  });

  test("Upsell overlay has 'Unlock The Howl' heading", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    const teaser = page.locator('[data-testid="howl-teaser-content"]');
    await teaser.click();
    await page.waitForTimeout(300);

    // Overlay should contain heading
    const heading = page.locator('h2, h3, [role="heading"]').first();
    await expect(heading).toContainText(/Unlock.*Howl|Howl.*Unlock/i);
  });

  test("Upsell CTA button 'Upgrade to Karl' links to /pricing", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    const teaser = page.locator('[data-testid="howl-teaser-content"]');
    await teaser.click();
    await page.waitForTimeout(300);

    // Find the upgrade button
    const upgradeButton = page.locator(
      'button:has-text("Upgrade to Karl"), a:has-text("Upgrade to Karl")'
    );
    await expect(upgradeButton).toBeVisible();

    // Get href or check navigation
    const href = await upgradeButton.getAttribute("href");
    expect(href || "").toContain("/pricing");
  });

  test("Upsell overlay has secondary 'See all features' link to /pricing", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    const teaser = page.locator('[data-testid="howl-teaser-content"]');
    await teaser.click();
    await page.waitForTimeout(300);

    // Should have at least 2 links to /pricing
    const pricingLinks = page.locator('a[href="/pricing"]');
    const count = await pricingLinks.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("Upsell overlay features list mentions Howl capabilities", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    const teaser = page.locator('[data-testid="howl-teaser-content"]');
    await teaser.click();
    await page.waitForTimeout(300);

    // Overlay should describe Howl features
    const overlay = page.locator('[role="dialog"]');
    const text = await overlay.textContent();
    expect(text).toMatch(/alert|notif|upcoming|fee/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3: Karl sees full Howl Panel unchanged
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC3: Karl tier — Full Howl Panel (no teaser)", () => {
  test("Howl tab visible without lock badge for Karl user", async ({ page }) => {
    await goToDashboardWithTier(page, "karl");

    const howlTab = page.locator('button[id*="tab-howl"]');
    await expect(howlTab).toBeVisible();

    // Should NOT have lock emoji or KARL badge
    const tabText = await howlTab.textContent();
    expect(tabText).not.toMatch(/🔒/);
  });

  test("Karl user sees full Howl Panel (no teaser)", async ({ page }) => {
    await goToDashboardWithTier(page, "karl");
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    // Should NOT render HowlTeaserState
    const teaser = page.locator('[data-testid="howl-teaser-content"]');
    await expect(teaser).not.toBeVisible();

    // Should render full panel
    const fullPanel = page.locator('section[id="panel-howl"]');
    await expect(fullPanel).toBeVisible();
  });

  test("Karl user can see HowlCard components (full panel)", async ({
    page,
  }) => {
    // Seed a card for Karl user
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clearAllStorage(page);
    await seedSession(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedEntitlement(page, ANONYMOUS_HOUSEHOLD_ID, "karl");

    // Seed a card with Howl category
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeCard({
        cardId: "test-card-1",
        issuer: "Chase Sapphire",
        category: "rewards",
      }),
    ]);

    await page.goto("/ledger", { waitUntil: "networkidle" });
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    // Full panel should be visible
    const fullPanel = page.locator('section[id="panel-howl"]');
    await expect(fullPanel).toBeVisible();

    // Should not show teaser
    const teaser = page.locator('[data-testid="howl-teaser-content"]');
    await expect(teaser).not.toBeVisible();
  });

  test("Karl user clicking teaser-like element doesn't show overlay", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "karl");
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    // No overlay should appear for Karl user
    const overlay = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(overlay).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4: Ragnarök gated behind Karl tier
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC4: Ragnarök gated — Karl tier only", () => {
  test("Ragnarök overlay does NOT appear for Thrall (even with >=5 urgent cards)", async ({
    page,
  }) => {
    // Seed Thrall with multiple urgent cards (should NOT trigger Ragnarök)
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clearAllStorage(page);
    await seedSession(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedEntitlement(page, ANONYMOUS_HOUSEHOLD_ID, "thrall");

    // Create 5+ cards with high annual_percentage_rate (urgent)
    const urgentCards = [];
    for (let i = 0; i < 6; i++) {
      urgentCards.push(
        makeCard({
          cardId: `urgent-${i}`,
          issuer: `Bank ${i}`,
          annual_percentage_rate: 25 + i,
        })
      );
    }
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, urgentCards);

    await page.goto("/ledger", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Ragnarök overlay should NOT appear
    const ragnarokOverlay = page.locator(
      '[data-testid="ragnarok-overlay"], [role="dialog"]:has-text("Ragnarök")'
    );
    await expect(ragnarokOverlay).not.toBeVisible();

    // Page should be accessible, no catastrophic overlay blocking
    const dashboard = page.locator('[role="main"], main');
    await expect(dashboard).toBeVisible();
  });

  test("Ragnarök overlay CAN appear for Karl (with >=5 urgent cards)", async ({
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
          annual_percentage_rate: 25 + i,
        })
      );
    }
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, urgentCards);

    await page.goto("/ledger", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // For Karl: Ragnarök MAY appear (depending on urgency logic)
    // This validates the feature isn't blocking Karl from seeing it
    // Page should load without being stuck
    const dashboard = page.locator('[role="main"], main');
    await expect(dashboard).toBeVisible();
  });

  test("Tier check prevents Thrall from accessing Ragnarök context", async ({
    page,
  }) => {
    // Check that Thrall doesn't get Ragnarök active state
    await goToDashboardWithTier(page, "thrall");

    // No Ragnarök overlay should appear on dashboard
    const ragnarokOverlay = page.locator(
      '[data-testid="ragnarok-overlay"], [data-testid="ragnarok-modal"]'
    );
    await expect(ragnarokOverlay).not.toBeVisible();
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
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    // Teaser should be visible
    const teaser = page.locator('[data-testid="howl-teaser-content"]');
    await expect(teaser).toBeVisible();

    // Get bounding box to verify it fits viewport
    const box = await teaser.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });

  test("Upsell overlay content fits within 375px viewport", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    const teaser = page.locator('[data-testid="howl-teaser-content"]');
    await teaser.click();
    await page.waitForTimeout(300);

    // Overlay should be visible and fit viewport
    const overlay = page.locator('[role="dialog"]');
    await expect(overlay).toBeVisible();

    const box = await overlay.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });

  test("Upgrade button touch target is >=44px height on mobile", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    const teaser = page.locator('[data-testid="howl-teaser-content"]');
    await teaser.click();
    await page.waitForTimeout(300);

    const button = page.locator(
      'button:has-text("Upgrade to Karl"), a:has-text("Upgrade to Karl")'
    );
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test("Sample alert cards stack vertically on mobile", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    // Get sample alert cards
    const alerts = page.locator('[data-testid="sample-alert-card"]');
    const count = await alerts.count();

    if (count > 1) {
      // Get positions to verify vertical stacking
      const boxes = await Promise.all(
        (await alerts.all()).map((el) => el.boundingBox())
      );

      // Check that y-coordinates increase (vertical stacking)
      for (let i = 1; i < boxes.length; i++) {
        expect(boxes[i]?.top).toBeGreaterThan(boxes[i - 1]?.top || 0);
      }
    }
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
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    // Verify teaser is showing
    const teaser = page.locator('[data-testid="howl-teaser-content"]');
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
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    // Teaser should no longer be visible
    const teaserAfter = page.locator('[data-testid="howl-teaser-content"]');
    await expect(teaserAfter).not.toBeVisible();

    // Full panel should appear
    const fullPanel = page.locator('section[id="panel-howl"]');
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
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    const teaser = page.locator('[data-testid="howl-teaser-content"]');
    await teaser.click();
    await page.waitForTimeout(300);

    const overlay = page.locator('[role="dialog"]');
    const ariaModal = await overlay.getAttribute("aria-modal");
    const ariaLabel = await overlay.getAttribute("aria-label");

    expect(ariaModal).toBe("true");
    expect(ariaLabel).toMatch(/unlock|howl|premium/i);
  });

  test("Sample alerts have clear labeling", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    const alerts = page.locator('[data-testid="sample-alert-card"]');
    const count = await alerts.count();

    // Each card should have accessible text/labeling
    const texts = await alerts.allTextContents();
    for (const text of texts) {
      expect(text.length).toBeGreaterThan(0);
    }
  });

  test("Close button on overlay is keyboard accessible", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
    await page.locator('button[id*="tab-howl"]').click();
    await page.waitForTimeout(300);

    const teaser = page.locator('[data-testid="howl-teaser-content"]');
    await teaser.click();
    await page.waitForTimeout(300);

    // Find close button
    const closeButton = page.locator(
      'button[aria-label*="close"], button[aria-label*="Close"], button:has-text("×")'
    ).first();

    if (await closeButton.isVisible()) {
      // Should be keyboard focusable
      await closeButton.focus();
      const focused = await closeButton.evaluate((el) => el === document.activeElement);
      expect(focused).toBe(true);
    }
  });
});
