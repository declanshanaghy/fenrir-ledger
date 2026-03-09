/**
 * Thrall Pricing Copy Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates GitHub Issue #408: Rename Thrall tier 'Single household' to 'Single User'
 * and remove all struck-out/disabled items from Thrall tier card.
 *
 * Acceptance Criteria:
 * 1. Thrall tier copy changed from "Single household" to "Single User" everywhere it appears
 * 2. All struck-out/disabled feature items removed from Thrall tier card
 * 3. Thrall card only shows what's included, not what's missing
 * 4. Karl tier card unchanged
 * 5. No changes to Karl tier copy (household feature coming later)
 *
 * Data isolation: Tests are read-only navigation tests, no data seeding needed.
 * Each test is independent and validates a specific acceptance criterion.
 */

import { test, expect } from "@playwright/test";

test.describe("Issue #408 — Thrall Pricing Copy Fixes", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to pricing page
    await page.goto("/pricing");
    // Wait for page to load
    await page.waitForLoadState("networkidle");
  });

  test("AC1: Thrall tier shows 'Single User' in tier card (not 'Single household')", async ({
    page,
  }) => {
    // Find the Thrall tier card by locating the heading "Thrall"
    const thrallCard = page.locator('h2:has-text("Thrall")').first().locator("..");

    // Within Thrall card, verify "Single User" appears in features list
    const thrallFeatures = thrallCard.locator('[aria-label="Thrall tier features"]');
    await expect(thrallFeatures).toContainText("Single User");

    // Verify "Single household" does NOT appear in the features
    await expect(thrallFeatures).not.toContainText("Single household");
  });

  test("AC1b: Comparison table shows 'Single User' for Thrall", async ({ page }) => {
    // Locate the comparison table
    const comparisonTable = page.locator(
      '[aria-label="Thrall vs Karl feature comparison"]'
    );

    // Find the row containing "Single User"
    const singleUserRow = comparisonTable.locator("text=Single User").first();

    // Verify it exists
    await expect(singleUserRow).toBeVisible();

    // Verify no "Single household" text in table
    const singleHouseholdElements = await page.locator("text=Single household").all();
    expect(singleHouseholdElements).toHaveLength(0);
  });

  test("AC2: Thrall tier card has no struck-out/disabled items", async ({ page }) => {
    // Get the Thrall tier card
    const thrallCard = page.locator('h2:has-text("Thrall")').first().locator("..");

    // Get all feature items in Thrall card
    const thrallFeatures = thrallCard.locator('[aria-label="Thrall tier features"] li');

    // Check each feature
    const features = await thrallFeatures.allTextContents();

    // Expected Thrall features (from code: annual fee, sign-up bonus, velocity, the Howl preview, single user, google sign-in)
    const expectedFeatures = [
      "Annual fee tracking with 60-day warnings",
      "Sign-up bonus & minimum spend tracking",
      "Velocity management",
      "The Howl",
      "Single User",
      "Google sign-in",
    ];

    // Verify we have the right features
    expect(features.length).toBe(6);
    features.forEach((feature) => {
      expect(expectedFeatures.some((exp) => feature.includes(exp))).toBeTruthy();
    });

    // Verify NO Karl-only features are shown (struck-out or otherwise)
    const karlOnlyFeatures = [
      "Valhalla",
      "Cloud Sync",
      "Multi-Household",
      "Smart Import",
      "Data Export",
      "full proactive alerts",
    ];

    features.forEach((feature) => {
      karlOnlyFeatures.forEach((karlFeature) => {
        expect(feature).not.toContain(karlFeature);
      });
    });
  });

  test("AC3: Thrall card only shows included features, no 'not included' markers", async ({
    page,
  }) => {
    // Get Thrall card
    const thrallCard = page.locator('h2:has-text("Thrall")').first().locator("..");

    // Get all feature list items
    const thrallFeatures = thrallCard.locator('[aria-label="Thrall tier features"] li');

    // Each feature should have a checkmark (✓), no dashes (—)
    const featureCount = await thrallFeatures.count();
    expect(featureCount).toBe(6);

    // Each item should have a check icon
    for (let i = 0; i < featureCount; i++) {
      const item = thrallFeatures.nth(i);
      const checkIcon = item.locator('[aria-label="Included"]');
      await expect(checkIcon).toBeVisible();
    }
  });

  test("AC4: Karl tier card is unchanged and still shows all premium features", async ({
    page,
  }) => {
    // Get the Karl tier card
    const karlCard = page.locator('h2:has-text("Karl")').first().locator("..");

    // Verify Karl card exists and has "Most Popular" badge
    const badge = karlCard.locator("text=Most Popular");
    await expect(badge).toBeVisible();

    // Get Karl features
    const karlFeatures = karlCard.locator('[aria-label="Karl tier premium features"]');

    // Verify key Karl features are present
    const expectedKarlFeatures = [
      "Valhalla",
      "The Howl",
      "Cloud Sync",
      "Multi-Household",
      "Smart Import",
      "Data Export",
      "Support the project",
    ];

    for (const feature of expectedKarlFeatures) {
      await expect(karlFeatures).toContainText(feature);
    }
  });

  test("AC5: Karl tier copy unchanged - no reference to 'Single household'", async ({
    page,
  }) => {
    // Get the Karl tier card
    const karlCard = page.locator('h2:has-text("Karl")').first().locator("..");

    // Get the card text content
    const cardText = await karlCard.textContent();

    // "Single household" should NOT appear in Karl card
    expect(cardText).not.toContain("Single household");

    // Karl should still say "Multi-Household" for multiple households feature
    const karlFeatures = karlCard.locator('[aria-label="Karl tier premium features"]');
    await expect(karlFeatures).toContainText("Multi-Household");
  });

  test("Comparison table: Thrall 'Single User' marked as included (✓)", async ({
    page,
  }) => {
    // Find the "Single User" row in comparison table
    const comparisonTable = page.locator(
      '[aria-label="Thrall vs Karl feature comparison"]'
    );

    const singleUserRow = comparisonTable
      .locator("tr")
      .filter({ has: page.locator("text=Single User") })
      .first();

    // Get the Thrall column (2nd column with checkmark)
    const thrallCell = singleUserRow.locator("td").nth(1);
    const checkIcon = thrallCell.locator('[aria-label="Included"]');

    // Should have included checkmark
    await expect(checkIcon).toBeVisible();
  });

  test("Comparison table: Multi-Household marked as Karl-only (not in Thrall)", async ({
    page,
  }) => {
    // Find the "Multi-Household" row
    const comparisonTable = page.locator(
      '[aria-label="Thrall vs Karl feature comparison"]'
    );

    const multiHouseholdRow = comparisonTable
      .locator("tr")
      .filter({ has: page.locator("text=Multi-Household") })
      .first();

    // Thrall column (2nd column) should have "not included" (—)
    const thrallCell = multiHouseholdRow.locator("td").nth(1);
    const notIncludedIcon = thrallCell.locator('[aria-label="Not included"]');
    await expect(notIncludedIcon).toBeVisible();

    // Karl column (3rd column) should have included (✓)
    const karlCell = multiHouseholdRow.locator("td").nth(2);
    const includedIcon = karlCell.locator('[aria-label="Included"]');
    await expect(includedIcon).toBeVisible();
  });

  test("Comparison table: 'Households' section header exists", async ({ page }) => {
    // Find the "Households" section header in table
    const comparisonTable = page.locator(
      '[aria-label="Thrall vs Karl feature comparison"]'
    );

    // Look for the section header with "Households"
    const householdsHeader = comparisonTable.locator("text=Households");
    await expect(householdsHeader).toBeVisible();
  });

  test("Page visually contains no struck-through text on Thrall card", async ({
    page,
  }) => {
    // Get Thrall card
    const thrallCard = page.locator('h2:has-text("Thrall")').first().locator("..");

    // Check for any text-decoration: line-through on features
    const thrallFeatures = thrallCard.locator('[aria-label="Thrall tier features"]');

    // Get computed styles
    const featureSpans = thrallFeatures.locator("span");
    const count = await featureSpans.count();

    for (let i = 0; i < count; i++) {
      const span = featureSpans.nth(i);
      const textDecoration = await span.evaluate((el) => {
        return window.getComputedStyle(el).textDecoration;
      });

      // Should not be line-through
      expect(textDecoration).not.toContain("line-through");
    }
  });
});
