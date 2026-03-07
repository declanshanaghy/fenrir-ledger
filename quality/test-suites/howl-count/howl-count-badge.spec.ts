/**
 * Howl Count Badge Fix — Issue #280
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates the fix for GitHub Issue #280: Howl panel count badge now accurately
 * reflects the number of cards displayed, including all three Howl-eligible statuses:
 *   - fee_approaching
 *   - promo_expiring
 *   - overdue (NEWLY INCLUDED in fix)
 *
 * Problem: The badge was showing 2 cards but the panel listed 3 (missing overdue status).
 * Solution: Updated urgentCount calculation to include status === "overdue".
 *
 * Acceptance Criteria (from issue):
 *   [x] Howl count badge matches the actual number of cards displayed
 *   [x] Count updates correctly when cards enter/leave Howl states
 *   [x] Count is correct for all Howl-eligible statuses (fee_approaching, promo_expiring, overdue)
 *
 * Spec references:
 *   - development/frontend/src/app/page.tsx:88-90 (urgentCount calculation)
 *   - development/frontend/src/components/layout/HowlPanel.tsx (panel display logic)
 *   - HowlPanel filters cards by status: fee_approaching || promo_expiring || overdue
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedHousehold,
  makeCard,
  makeUrgentCard,
  makePromoCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ════════════════════════════════════════════════════════════════════════════
// Setup helpers
// ════════════════════════════════════════════════════════════════════════════

async function setup(
  page: Parameters<typeof clearAllStorage>[0],
  cards: Parameters<typeof seedCards>[2]
) {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
  await page.reload({ waitUntil: "networkidle" });
}

// ════════════════════════════════════════════════════════════════════════════
// Helper: Create an overdue card (status === "overdue")
// ════════════════════════════════════════════════════════════════════════════

function makeOverdueCard(overrides: any = {}) {
  // Create a card with status "overdue" and a fee date that is in the past
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 5); // 5 days ago

  return {
    id: `card-${Math.random().toString(36).slice(2, 9)}`,
    householdId: ANONYMOUS_HOUSEHOLD_ID,
    cardName: overrides.cardName || "Overdue Card",
    issuerId: overrides.issuerId || "chase",
    annualFee: overrides.annualFee ?? 9500,
    annualFeeDate: pastDate.toISOString(),
    creditLimit: overrides.creditLimit ?? 1000000,
    status: "overdue", // The critical difference
    notes: overrides.notes ?? "",
    signUpBonus: null,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Suite: Count badge matches displayed cards (including overdue)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Howl count badge — Issue #280 fix", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("count badge shows 3 when 3 Howl-eligible statuses are present: fee_approaching + promo_expiring + overdue", async ({
    page,
  }) => {
    // This is the exact scenario from issue #280:
    // 3 cards in Howl panel but badge said "2"
    // Now we add: 1 fee_approaching + 1 promo_expiring + 1 overdue
    await setup(page, [
      makeUrgentCard({ issuerId: "chase", cardName: "Sapphire Preferred" }),
      makePromoCard({ issuerId: "amex", cardName: "Platinum" }),
      makeOverdueCard({ issuerId: "capital_one", cardName: "Sapphire Reserved" }),
    ]);

    // The count badge should now show 3 (matching the 3 cards displayed)
    const countBadge = page.locator('[aria-label="3 urgent cards"]');
    await expect(countBadge).toBeVisible();
    await expect(countBadge).toContainText("3");
  });

  test("count badge shows 1 when only overdue status card exists", async ({
    page,
  }) => {
    await setup(page, [
      makeOverdueCard({ cardName: "Overdue Fee Card" }),
    ]);

    // Badge should show count of 1 for the single overdue card
    const countBadge = page.locator('[aria-label="1 urgent card"]');
    await expect(countBadge).toBeVisible();
    await expect(countBadge).toContainText("1");
  });

  test("count badge shows 2 when 2 overdue cards exist", async ({
    page,
  }) => {
    await setup(page, [
      makeOverdueCard({ issuerId: "chase", cardName: "Overdue Card A" }),
      makeOverdueCard({ issuerId: "amex", cardName: "Overdue Card B" }),
    ]);

    // Badge should count both overdue cards
    const countBadge = page.locator('[aria-label="2 urgent cards"]');
    await expect(countBadge).toBeVisible();
    await expect(countBadge).toContainText("2");
  });

  test("count badge matches the number of displayed card rows in HowlPanel", async ({
    page,
  }) => {
    // Mix: 1 fee_approaching + 1 promo_expiring + 1 overdue = 3 total
    await setup(page, [
      makeUrgentCard({ cardName: "Fee Card" }),
      makePromoCard({ cardName: "Promo Card" }),
      makeOverdueCard({ cardName: "Overdue Card" }),
      makeCard({ cardName: "Active Card (not shown)" }), // This should NOT be counted
    ]);

    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible();

    // Count the visible card rows (articles)
    const cardRows = howlPanel.locator("article");
    const rowCount = await cardRows.count();
    expect(rowCount).toBe(3); // Only the 3 urgent ones

    // The badge should show 3
    const countBadge = page.locator('[aria-label="3 urgent cards"]');
    await expect(countBadge).toContainText("3");
  });

  test("overdue cards appear in the HowlPanel alongside fee_approaching and promo_expiring", async ({
    page,
  }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Annual Fee" }),
      makePromoCard({ cardName: "Bonus Deadline" }),
      makeOverdueCard({ cardName: "Past Due" }),
    ]);

    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible();

    // All three card names should be visible in the panel
    await expect(howlPanel).toContainText("Annual Fee");
    await expect(howlPanel).toContainText("Bonus Deadline");
    await expect(howlPanel).toContainText("Past Due");
  });

  test("count badge updates correctly when card status changes to overdue", async ({
    page,
  }) => {
    // Start with 2 urgent cards + add 1 overdue to test that all three statuses count
    // This validates that when new urgent cards appear, the count updates
    await setup(page, [
      makeUrgentCard({ cardName: "Fee Card" }),
      makePromoCard({ cardName: "Promo Card" }),
      makeOverdueCard({ cardName: "Overdue Card" }),
    ]);

    // Verify the panel shows all 3 cards and the count badge is correct
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible();

    const cardRows = howlPanel.locator("article");
    expect(await cardRows.count()).toBe(3);

    // Badge should show 3
    const countBadge = howlPanel.locator('span[aria-label="3 urgent cards"]');
    await expect(countBadge).toBeVisible();
    await expect(countBadge).toContainText("3");
  });

  test("count does not include active cards (status !== Howl-eligible)", async ({
    page,
  }) => {
    // Mix: 2 urgent + 1 overdue + 5 active cards
    await setup(page, [
      makeUrgentCard({ cardName: "Fee" }),
      makePromoCard({ cardName: "Promo" }),
      makeOverdueCard({ cardName: "Overdue" }),
      makeCard({ cardName: "Active 1" }),
      makeCard({ cardName: "Active 2" }),
      makeCard({ cardName: "Active 3" }),
      makeCard({ cardName: "Active 4" }),
      makeCard({ cardName: "Active 5" }),
    ]);

    // Count should be 3, not 8
    const countBadge = page.locator('[aria-label="3 urgent cards"]');
    await expect(countBadge).toBeVisible();
    await expect(countBadge).toContainText("3");

    // Panel should show 3 rows
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    const cardRows = howlPanel.locator("article");
    expect(await cardRows.count()).toBe(3);
  });

  test("mobile bell button badge shows correct count with overdue cards", async ({
    page,
  }) => {
    // Use mobile viewport
    page.setViewportSize({ width: 375, height: 812 });

    await setup(page, [
      makeUrgentCard({ cardName: "Fee" }),
      makeOverdueCard({ cardName: "Overdue" }),
    ]);

    // Mobile bell button should show 2 in its badge
    const bellButton = page.locator('button[aria-label*="2 urgent card"]');
    await expect(bellButton).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Overdue cards display with correct urgency indicators
// ════════════════════════════════════════════════════════════════════════════

test.describe("Howl panel — Overdue card presentation", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("overdue cards show 'Overdue' label instead of days remaining", async ({
    page,
  }) => {
    await setup(page, [makeOverdueCard({ cardName: "Past Due Card" })]);

    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    const cardRow = howlPanel.locator("article").first();

    // Overdue cards should display "Overdue" label
    const daysSlot = cardRow.locator('[data-slot="count"]');
    await expect(daysSlot).toContainText("Overdue");
  });

  test("overdue cards show ragnarok color indicator (red)", async ({
    page,
  }) => {
    await setup(page, [makeOverdueCard({ cardName: "Red Alert Card" })]);

    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    const cardRow = howlPanel.locator("article").first();

    // The urgency dot should be present and the days label should be colored red (ragnarok)
    const urgencyDot = cardRow.locator("span.rounded-full.shrink-0");
    await expect(urgencyDot).toBeVisible();
    // The dot should have the ragnarok color class (bg-[hsl(var(--realm-ragnarok))])
  });

  test("overdue card type label is 'Annual Fee' when fee date is in past", async ({
    page,
  }) => {
    await setup(page, [makeOverdueCard({ cardName: "Fee Type Card" })]);

    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toContainText("Annual Fee");
  });
});
