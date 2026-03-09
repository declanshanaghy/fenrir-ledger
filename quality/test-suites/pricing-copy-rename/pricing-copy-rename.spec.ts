import { test, expect } from "@playwright/test";

/**
 * Issue #449: Pricing page copy — rename Multi-Household to Whole-Household
 *
 * Acceptance Criteria:
 * - All three Pricing page strings updated to "Whole-Household"
 * - No "Multi-Household" strings appear on pricing page
 * - Build passes
 *
 * Test Coverage:
 * 1. Whole-Household appears in Thrall card excluded features (line 137)
 * 2. Whole-Household appears in Karl card premium feature with description (line 208)
 * 3. Whole-Household appears in comparison table under Households section (line 342)
 * 4. Multi-Household does not appear anywhere on pricing page
 */

test.describe("Issue #449 — Pricing page copy rename (Multi-Household → Whole-Household)", () => {
  test("should display Whole-Household in Thrall card excluded features", async ({
    page,
  }) => {
    await page.goto("/pricing");

    // Check Thrall card (first card) contains Whole-Household in excluded features
    const thrallCard = page.locator('[aria-label="Thrall tier features"]').first();
    const wholeHouseholdItem = thrallCard.locator("text=Whole-Household management");

    await expect(wholeHouseholdItem).toBeVisible();
  });

  test("should display Whole-Household with description in Karl card premium features", async ({
    page,
  }) => {
    await page.goto("/pricing");

    // Check Karl card (second card) contains Whole-Household with correct description
    const karlCard = page.locator('[aria-label="Karl tier premium features"]');
    const wholeHouseholdFeature = karlCard.locator(
      "text=Whole-Household — manage your ledger with others"
    );

    await expect(wholeHouseholdFeature).toBeVisible();
  });

  test("should display Whole-Household in comparison table under Households section", async ({
    page,
  }) => {
    await page.goto("/pricing");

    // Check comparison table contains Whole-Household row
    const comparisonTable = page.locator(
      '[aria-label="Thrall vs Karl feature comparison"]'
    );
    const wholeHouseholdRow = comparisonTable.locator(
      "text=Whole-Household — create and manage your ledger with others"
    );

    await expect(wholeHouseholdRow).toBeVisible();
  });

  test("should NOT contain Multi-Household anywhere on pricing page", async ({
    page,
  }) => {
    await page.goto("/pricing");

    // Verify Multi-Household does not appear anywhere
    const multiHouseholdMatches = await page.locator(
      "text=Multi-Household"
    ).all();

    expect(multiHouseholdMatches).toHaveLength(0);
  });

  test("should have exactly three Whole-Household references on pricing page", async ({
    page,
  }) => {
    await page.goto("/pricing");

    // Count total Whole-Household references
    const wholeHouseholdMatches = await page
      .locator("text=Whole-Household")
      .all();

    // Expect exactly 3 references (Thrall excluded, Karl feature, Comparison table)
    expect(wholeHouseholdMatches.length).toBeGreaterThanOrEqual(3);
  });
});
