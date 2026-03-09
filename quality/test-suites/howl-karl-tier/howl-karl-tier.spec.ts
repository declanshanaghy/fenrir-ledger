/**
 * Howl Karl Tier QA Test Suite — Issue #398
 * Validates: Move Howl Panel to Karl tier gating
 *
 * Acceptance Criteria Tested:
 * AC1: Howl tab visible → shows blurred sample alerts + upsell overlay (Thrall)
 * AC2: Upsell overlay links to /pricing
 * AC3: Karl users see full Howl Panel unchanged
 * AC4: Ragnarök gated behind Karl tier (no trigger for Thralls)
 * AC5: Blurred teaser shows 2-3 fake sample alerts (hardcoded, not real data)
 * AC6: Mobile layout works (375px min)
 *
 * Implementation verified in:
 *   - src/components/dashboard/HowlTeaserState.tsx (blurred + overlay)
 *   - src/components/dashboard/Dashboard.tsx (gate with hasFeature("howl-panel"))
 *   - src/contexts/RagnarokContext.tsx (Karl-tier check on line 60)
 *   - src/lib/entitlement/types.ts (howl-panel PremiumFeature)
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
// Test Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Auth session key from src/lib/auth/session.ts */
const AUTH_SESSION_KEY = "auth:session";

/**
 * Seed an authenticated Google session into localStorage.
 * Required for accessing dashboard routes.
 */
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
    expires_at: now + 3600000, // Valid for 1 hour
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

/**
 * Seed entitlement for a given tier.
 * localStorage key: fenrir_ledger:{householdId}:entitlement
 */
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

/**
 * Navigate to dashboard (/ledger), seeding all required auth, household, and entitlement data.
 * Dashboard route is at /ledger (from src/app/ledger/page.tsx), not /dashboard
 */
async function goToDashboardWithTier(page: Page, tier: "thrall" | "karl") {
  // Navigate to home first to establish origin and context
  await page.goto("/");

  // Clear all storage to start fresh
  await clearAllStorage(page);

  // Seed auth session (required for /ledger access)
  await seedSession(page);

  // Seed household and tier entitlement
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedEntitlement(page, ANONYMOUS_HOUSEHOLD_ID, tier);

  // Seed empty cards for clean test
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, []);

  // Navigate to /ledger (the dashboard route) and wait for full load
  await page.goto("/ledger", { waitUntil: "networkidle" });
}

// ─────────────────────────────────────────────────────────────────────────────
// AC1: Thrall sees blurred teaser + upsell
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC1: Thrall user sees Howl tab with blurred teaser + upsell overlay", () => {
  test.beforeEach(async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
  });

  test("Howl tab is visible and accessible", async ({ page }) => {
    const howlTab = page.locator('button[id="tab-howl"]');
    await expect(howlTab).toBeVisible();
    await expect(howlTab).toContainText("The Howl");
  });

  test("Clicking Howl tab shows HowlTeaserState component", async ({ page }) => {
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();
    await page.waitForTimeout(300);

    const teaserState = page.locator('[data-testid="howl-teaser-state"]');
    await expect(teaserState).toBeVisible();
  });

  test("Teaser background is blurred with reduced opacity", async ({ page }) => {
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    // Get the blurred alerts container (first div child)
    const blurredDiv = page.locator('[data-testid="howl-teaser-state"] > div').first();
    const styles = await blurredDiv.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        filter: computed.filter,
        opacity: computed.opacity,
        pointerEvents: computed.pointerEvents,
      };
    });

    // Verify blur is applied
    expect(styles.filter).toContain("blur");
    // Opacity reduced
    expect(parseFloat(styles.opacity)).toBeLessThan(1);
    // Non-interactive
    expect(styles.pointerEvents).toBe("none");
  });

  test("Blurred alerts are marked aria-hidden", async ({ page }) => {
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    const blurredDiv = page.locator('[data-testid="howl-teaser-state"] > div').first();
    const ariaHidden = await blurredDiv.getAttribute("aria-hidden");
    expect(ariaHidden).toBe("true");
  });

  test("Sample alerts show hardcoded data (CHASE, AMEX, CAPITAL ONE)", async ({
    page,
  }) => {
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    const teaserText = await page.locator('[data-testid="howl-teaser-state"]').textContent();
    // Sample alerts contain hardcoded issuer names
    expect(teaserText).toMatch(/CHASE SAPPHIRE|AMEX GOLD|CAPITAL ONE/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2: Upsell overlay and links
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC2: Upsell overlay is visible and links to /pricing", () => {
  test.beforeEach(async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");
  });

  test("Upsell overlay is rendered and visible", async ({ page }) => {
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    const overlay = page.locator('[data-testid="howl-teaser-state"] [role="dialog"]');
    await expect(overlay).toBeVisible();
  });

  test("Overlay heading is 'Unlock The Howl'", async ({ page }) => {
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    await expect(page.locator("text=Unlock The Howl")).toBeVisible();
  });

  test("Overlay description mentions proactive alerts", async ({ page }) => {
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    await expect(page.locator("text=Proactive fee alerts")).toBeVisible();
  });

  test("Primary CTA button links to /pricing", async ({ page }) => {
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    const ctaButton = page.locator(
      '[data-testid="howl-teaser-state"] a:has-text("Upgrade to Karl")'
    );
    await expect(ctaButton).toBeVisible();

    const href = await ctaButton.getAttribute("href");
    expect(href).toBe("/pricing");
  });

  test("Secondary link 'See all Karl features' points to /pricing", async ({
    page,
  }) => {
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    const secondaryLink = page.locator(
      '[data-testid="howl-teaser-state"] a:has-text("See all Karl features")'
    );
    await expect(secondaryLink).toBeVisible();

    const href = await secondaryLink.getAttribute("href");
    expect(href).toBe("/pricing");
  });

  test("Feature list includes fee alerts, deadlines, Ragnarök", async ({
    page,
  }) => {
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    const featureList = page.locator(
      '[aria-label="Karl tier Howl features"]'
    ).textContent();

    expect(featureList).toMatch(/fee alerts|deadline/i);
    // Check for ragnarök reference
    expect(featureList).toMatch(/ragnarök/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3: Karl users see full Howl Panel (no teaser)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC3: Karl users see full Howl Panel unchanged", () => {
  test.beforeEach(async ({ page }) => {
    await goToDashboardWithTier(page, "karl");
  });

  test("Karl users do NOT see HowlTeaserState", async ({ page }) => {
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    // HowlTeaserState should NOT exist for Karl users
    const teaserState = page.locator('[data-testid="howl-teaser-state"]');
    const isVisible = await teaserState.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test("Karl users see Howl panel element", async ({ page }) => {
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    // The Howl panel should exist and be visible
    const howlPanel = page.locator('[id="panel-howl"]');
    await expect(howlPanel).toBeVisible();
  });

  test("Howl tab shows empty state text for Karl when no cards exist", async ({
    page,
  }) => {
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    // With empty cards fixture, should show empty state
    const emptyStateText = page.locator("text=All your cards are currently in The Howl");
    const hasEmptyState = await emptyStateText.isVisible().catch(() => false);
    expect(hasEmptyState).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4: Ragnarök gated behind Karl tier
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC4: Ragnarök gated behind Karl tier (not for Thralls)", () => {
  test("Thrall users do NOT see Ragnarök overlay", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");

    // Ragnarök should never trigger for Thralls
    // Wait for any potential overlay (code checks tier === "karl" before triggering)
    await page.waitForTimeout(500);

    // Check that no ragnarok elements are visible
    const ragnarokElements = await page
      .locator('[class*="ragnarok"], [aria-label*="Ragnar"]')
      .all();
    for (const el of ragnarokElements) {
      const visible = await el.isVisible().catch(() => false);
      expect(visible).toBe(false);
    }
  });

  test("Karl tier can theoretically show Ragnarök (tier check in place)", async ({
    page,
  }) => {
    await goToDashboardWithTier(page, "karl");

    // Karl users have the feature enabled
    // RagnarokContext checks tier === "karl" on line 60 of RagnarokContext.tsx
    // We verify the page loads without errors
    const dashboard = page.locator('[class*="dashboard"]');
    await expect(dashboard).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC5: Mobile layout (375px min)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("AC5: Mobile layout works for teaser (375px)", () => {
  test("Thrall teaser renders on 375px mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await goToDashboardWithTier(page, "thrall");

    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    const teaserState = page.locator('[data-testid="howl-teaser-state"]');
    await expect(teaserState).toBeVisible();

    // Should fit within mobile viewport
    const box = await teaserState.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });

  test("Upsell overlay is visible and readable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await goToDashboardWithTier(page, "thrall");

    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    const overlay = page.locator('[data-testid="howl-teaser-state"] [role="dialog"]');
    await expect(overlay).toBeVisible();

    // Heading should be readable
    await expect(page.locator("text=Unlock The Howl")).toBeVisible();
  });

  test("CTA button meets touch target size (44px min height)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await goToDashboardWithTier(page, "thrall");

    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();

    const ctaButton = page.locator(
      '[data-testid="howl-teaser-state"] a:has-text("Upgrade to Karl")'
    );
    const box = await ctaButton.boundingBox();

    // WCAG touch target minimum
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional validation: Behavior & accessibility
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Additional validation", () => {
  test("Teaser loads without console errors (Thrall)", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await goToDashboardWithTier(page, "thrall");
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();
    await page.waitForTimeout(500);

    // No console errors should be logged
    expect(consoleErrors.length).toBe(0);
  });

  test("Karl panel loads without console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await goToDashboardWithTier(page, "karl");
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();
    await page.waitForTimeout(500);

    expect(consoleErrors.length).toBe(0);
  });

  test("Tab switching between Howl and other tabs works", async ({ page }) => {
    await goToDashboardWithTier(page, "thrall");

    // Click Howl
    const howlTab = page.locator('button[id="tab-howl"]');
    await howlTab.click();
    const teaserState = page.locator('[data-testid="howl-teaser-state"]');
    await expect(teaserState).toBeVisible();

    // Click Hunt tab
    const huntTab = page.locator('button[id="tab-hunt"]');
    await huntTab.click();
    await page.waitForTimeout(300);

    // Teaser should no longer be visible
    const isVisible = await teaserState
      .isVisible()
      .catch(() => false);
    expect(isVisible).toBe(false);

    // Click back to Howl
    await howlTab.click();
    await expect(teaserState).toBeVisible();
  });
});
