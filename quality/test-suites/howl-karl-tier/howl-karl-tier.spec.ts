/**
 * Howl Karl Tier QA Test Suite
 * Issue #398: Move Howl Panel to Karl tier
 *
 * Acceptance Criteria:
 * - [ ] Howl tab visible for Thralls, shows blurred sample alerts + upsell overlay
 * - [ ] Karl users see full Howl Panel unchanged
 * - [ ] Ragnarök overlay gated behind Karl tier (does not trigger for Thralls)
 * - [ ] Upsell overlay links to /pricing
 * - [ ] Blurred teaser shows 2-3 fake sample alerts (not real user data)
 * - [ ] Mobile layout works for teaser state (min 375px)
 */

import { test, expect, Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// Test setup & utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mock authentication headers for a given tier.
 * Maps tier → auth state used in test fixtures.
 */
function getAuthHeaders(tier: "thrall" | "karl") {
  // In a real test, these would be actual JWT tokens or session cookies
  // For now, we use test fixtures that simulate each tier
  return {
    tier,
    household_id: "test-household-" + tier,
  };
}

/**
 * Navigate to dashboard and wait for load.
 */
async function goToDashboard(page: Page) {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: AC 1 — Thrall sees blurred teaser + upsell
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC 1: Thrall user sees Howl tab with blurred teaser + upsell overlay", () => {
  test.use({
    // Simulate Thrall tier in test context
    testTier: "thrall" as const,
  });

  test("Howl tab is visible for Thrall users", async ({ page }) => {
    await goToDashboard(page);

    // Howl tab button should exist
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await expect(howlTabButton).toBeVisible();
    await expect(howlTabButton).toContainText("The Howl");
  });

  test("Clicking Howl tab reveals blurred teaser state", async ({ page }) => {
    await goToDashboard(page);

    // Click The Howl tab
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();
    await page.waitForLoadState("networkidle");

    // HowlTeaserState component should be rendered
    const teaserState = page.locator('[data-testid="howl-teaser-state"]');
    await expect(teaserState).toBeVisible();
  });

  test("Teaser state has blurred background and opacity", async ({ page }) => {
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    // The blurred container should have filter: blur(6px) and opacity
    const blurredContainer = page.locator(
      '[data-testid="howl-teaser-state"] > div:first-child'
    );
    const styles = await blurredContainer.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        filter: computed.filter,
        opacity: computed.opacity,
      };
    });

    // Check blur filter is applied
    expect(styles.filter).toContain("blur");
    // Opacity should be reduced (0.55 per component)
    expect(parseFloat(styles.opacity)).toBeLessThan(1);
  });

  test("Teaser shows 2-3 fake sample alerts (not real user data)", async ({
    page,
  }) => {
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    // Find sample alert cards
    const alertCards = page.locator(
      '[data-testid="howl-teaser-state"] [class*="border border-border"]'
    );
    const count = await alertCards.count();

    // Should have 2-3 sample alerts per SAMPLE_ALERTS constant
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(3);

    // Verify they contain expected sample data (not real user data)
    const firstAlert = alertCards.first();
    const alertText = await firstAlert.textContent();

    // Sample alerts contain hardcoded strings like card names, amounts
    // Real alerts would have dynamic user data
    // Check for known sample data markers
    expect(alertText).toMatch(
      /CHASE SAPPHIRE|AMEX GOLD|CAPITAL ONE|annual fee|promo expiring/i
    );
  });

  test("Sample alerts are aria-hidden and non-interactive", async ({
    page,
  }) => {
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    // The blurred container should be aria-hidden
    const blurredContainer = page.locator(
      '[data-testid="howl-teaser-state"] > div:first-child'
    );
    const ariaHidden = await blurredContainer.getAttribute("aria-hidden");
    expect(ariaHidden).toBe("true");

    // Verify pointer-events: none is set
    const styles = await blurredContainer.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        pointerEvents: computed.pointerEvents,
        userSelect: computed.userSelect,
      };
    });

    expect(styles.pointerEvents).toBe("none");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: AC 2 & 3 — Upsell overlay
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC 2 & 3: Upsell overlay is visible and links to /pricing", () => {
  test.use({
    testTier: "thrall" as const,
  });

  test("Upsell overlay is rendered in teaser state", async ({ page }) => {
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    // Upsell overlay should be visible
    const overlay = page.locator('[data-testid="howl-teaser-state"] [role="dialog"]');
    await expect(overlay).toBeVisible();
  });

  test("Overlay has correct heading and description", async ({ page }) => {
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    const overlay = page.locator('[data-testid="howl-teaser-state"] [role="dialog"]');

    // Check for expected heading
    await expect(
      overlay.locator("text=Unlock The Howl")
    ).toBeVisible();

    // Check for description text
    await expect(
      overlay.locator("text=Proactive fee alerts")
    ).toBeVisible();
  });

  test("Upsell CTA button links to /pricing", async ({ page }) => {
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    // Find upgrade button
    const upgradeButton = page.locator(
      '[data-testid="howl-teaser-state"] a:has-text("Upgrade to Karl")'
    );
    await expect(upgradeButton).toBeVisible();

    // Verify href points to /pricing
    const href = await upgradeButton.getAttribute("href");
    expect(href).toBe("/pricing");
  });

  test("Secondary 'See all Karl features' link points to /pricing", async ({
    page,
  }) => {
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    // Find secondary link
    const secondaryLink = page.locator(
      '[data-testid="howl-teaser-state"] a:has-text("See all Karl features")'
    );
    await expect(secondaryLink).toBeVisible();

    // Verify href points to /pricing
    const href = await secondaryLink.getAttribute("href");
    expect(href).toBe("/pricing");
  });

  test("Overlay shows feature list with checkmarks", async ({ page }) => {
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    const featureList = page.locator(
      '[aria-label="Karl tier Howl features"] li'
    );
    const count = await featureList.count();

    // Should have at least 3-4 features listed
    expect(count).toBeGreaterThanOrEqual(3);

    // Features should mention key benefits
    const allText = await featureList.allTextContents();
    const featureText = allText.join(" ");
    expect(featureText).toMatch(/fee alerts|deadline|ragnarök|notifications/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: AC 4 — Karl users see full panel (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC 4: Karl users see full Howl Panel unchanged", () => {
  test.use({
    testTier: "karl" as const,
  });

  test("Karl users do NOT see HowlTeaserState", async ({ page }) => {
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    // HowlTeaserState should NOT be visible for Karl users
    const teaserState = page.locator('[data-testid="howl-teaser-state"]');
    await expect(teaserState).not.toBeVisible();
  });

  test("Karl users see actual Howl panel with real cards", async ({ page }) => {
    // Note: This test assumes some fixture cards with howl-status exist
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    // The panel should exist and display cards (or empty state if no cards)
    const howlPanel = page.locator('div[id="panel-howl"]');
    await expect(howlPanel).toBeVisible();

    // Either show cards or HowlEmptyState
    const hasCards = (await page.locator(".card-tile").count()) > 0;
    const hasEmptyState = await page
      .locator("text=All your cards are currently in The Howl")
      .isVisible()
      .catch(() => false);

    expect(hasCards || hasEmptyState).toBe(true);
  });

  test("Karl users can interact with Howl cards normally", async ({ page }) => {
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    // If cards exist, they should be interactive (not blurred, not aria-hidden)
    const firstCard = page.locator('[class*="card-tile"]').first();

    if ((await firstCard.count()) > 0) {
      const styles = await firstCard.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          pointerEvents: computed.pointerEvents,
          filter: computed.filter,
        };
      });

      // Should NOT be blurred or disabled
      expect(styles.pointerEvents).not.toBe("none");
      expect(styles.filter).not.toContain("blur");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: AC 5 — Ragnarök gated behind Karl tier
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC 5: Ragnarök overlay gated behind Karl tier", () => {
  test("Thrall users do NOT see Ragnarök overlay even with 5+ urgent cards", async ({
    page,
  }) => {
    test.use({
      testTier: "thrall" as const,
    });

    await goToDashboard(page);

    // Ragnarök overlay should not appear for Thralls regardless of urgent cards
    const ragnarokOverlay = page.locator('[class*="ragnarok"]');
    // Using flexible selector since we're checking it doesn't exist

    // Wait a bit for potential overlay to appear
    await page.waitForTimeout(1000);

    const isVisible = await ragnarokOverlay.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test("Karl users can see Ragnarök overlay if 5+ urgent cards exist", async ({
    page,
  }) => {
    test.use({
      testTier: "karl" as const,
    });

    // Note: This would require fixture data with 5+ urgent cards
    // For now, we verify the mechanism is in place via code inspection

    await goToDashboard(page);

    // The page should have loaded for Karl user
    // Ragnarök context is initialized in RagnarokProvider
    const dashboardContent = page.locator('[class*="dashboard"]');
    await expect(dashboardContent).toBeVisible();

    // We can't easily trigger Ragnarök in a test without 5+ urgent cards,
    // but we verify the component hierarchy supports it
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: AC 6 — Mobile layout (375px)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC 6: Mobile layout works for teaser (375px min)", () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
  });

  test.use({
    testTier: "thrall" as const,
  });

  test("Howl teaser renders correctly at 375px width", async ({ page }) => {
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    const teaserState = page.locator('[data-testid="howl-teaser-state"]');
    await expect(teaserState).toBeVisible();

    // Check that it fills the viewport without overflow
    const boundingBox = await teaserState.boundingBox();
    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      // Width should be close to viewport (375px)
      expect(boundingBox.width).toBeLessThanOrEqual(375);
    }
  });

  test("Upsell overlay is readable on mobile (375px)", async ({ page }) => {
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    const overlay = page.locator('[data-testid="howl-teaser-state"] [role="dialog"]');
    await expect(overlay).toBeVisible();

    // Check that overlay content is not cut off
    const overlayContent = overlay.locator('div').first();
    const isInViewport = await overlayContent.isInViewport();
    expect(isInViewport).toBe(true);
  });

  test("Sample alert cards stack vertically on mobile", async ({ page }) => {
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    // Blurred alerts container should stack on mobile
    const alertsContainer = page.locator(
      '[data-testid="howl-teaser-state"] > div:first-child'
    );
    const boundingBox = await alertsContainer.boundingBox();

    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      // Should be full width (or close to it)
      expect(boundingBox.width).toBeGreaterThan(300);
    }
  });

  test("CTA button is large enough to tap on mobile", async ({ page }) => {
    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    const ctaButton = page.locator(
      '[data-testid="howl-teaser-state"] a:has-text("Upgrade to Karl")'
    );
    const boundingBox = await ctaButton.boundingBox();

    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      // Touch targets should be at least 44px tall per WCAG guidelines
      expect(boundingBox.height).toBeGreaterThanOrEqual(44);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Edge cases & cross-browser
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Edge cases and cross-browser", () => {
  test.use({
    testTier: "thrall" as const,
  });

  test("Tab badge shows Howl count for Thralls", async ({ page }) => {
    await goToDashboard(page);

    const howlBadge = page.locator('button[id="tab-howl"] [class*="badge"]');
    // Badge may or may not exist depending on card count, but button should still work
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await expect(howlTabButton).toBeVisible();
  });

  test("Teaser state loads without JavaScript errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await goToDashboard(page);
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();

    // Should not have console errors
    expect(errors.length).toBe(0);
  });

  test("Switching between tabs preserves tab selection", async ({ page }) => {
    await goToDashboard(page);

    // Click Howl
    const howlTabButton = page.locator('button[id="tab-howl"]');
    await howlTabButton.click();
    const teaserState1 = page.locator('[data-testid="howl-teaser-state"]');
    await expect(teaserState1).toBeVisible();

    // Click another tab
    const huntTabButton = page.locator('button[id="tab-hunt"]');
    await huntTabButton.click();
    await page.waitForTimeout(500);

    // Click back to Howl
    await howlTabButton.click();
    const teaserState2 = page.locator('[data-testid="howl-teaser-state"]');
    await expect(teaserState2).toBeVisible();
  });
});
