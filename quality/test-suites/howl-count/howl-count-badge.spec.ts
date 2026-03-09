/**
 * Dashboard Tabs — Howl Count Badge — Issue #280 / #279
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates that the Howl tab badge accurately reflects the count of
 * cards with Howl-eligible statuses.
 * Slimmed to core interactive behavior only.
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

function makeOverdueCard(overrides: Record<string, unknown> = {}) {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 5);

  return {
    id: `card-${Math.random().toString(36).slice(2, 9)}`,
    householdId: ANONYMOUS_HOUSEHOLD_ID,
    cardName: (overrides.cardName as string) || "Overdue Card",
    issuerId: (overrides.issuerId as string) || "chase",
    annualFee: (overrides.annualFee as number) ?? 9500,
    annualFeeDate: pastDate.toISOString(),
    creditLimit: (overrides.creditLimit as number) ?? 1000000,
    status: "overdue",
    notes: (overrides.notes as string) ?? "",
    signUpBonus: null,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Suite: Howl tab badge count
// ════════════════════════════════════════════════════════════════════════════

test.describe("Howl tab badge — Issue #280/#279 fix", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("Howl tab badge shows correct count for mixed urgent statuses", async ({
    page,
  }) => {
    await setup(page, [
      makeUrgentCard({ issuerId: "chase", cardName: "Sapphire Preferred" }),
      makePromoCard({ issuerId: "amex", cardName: "Platinum" }),
      makeOverdueCard({ issuerId: "capital_one", cardName: "Sapphire Reserved" }),
    ]);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    const badge = howlTab.locator('span[aria-label="3 cards"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("3");
  });

  test("Howl tab badge does not include active cards in count", async ({ page }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Fee" }),
      makePromoCard({ cardName: "Promo" }),
      makeOverdueCard({ cardName: "Overdue" }),
      makeCard({ cardName: "Active 1" }),
      makeCard({ cardName: "Active 2" }),
      makeCard({ cardName: "Active 3" }),
    ]);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    const badge = howlTab.locator('span[aria-label="3 cards"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("3");
  });

  test("Howl tab badge updates correctly with single overdue card", async ({ page }) => {
    await setup(page, [makeOverdueCard({ cardName: "Overdue Fee Card" })]);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    const badge = howlTab.locator('span[aria-label="1 card"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("1");
  });
});
