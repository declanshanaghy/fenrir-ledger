/**
 * Dashboard Tabs — Howl Count Badge — Issue #280 / #279
 * Authored by Loki, QA Tester of the Pack
 *
 * Updated for Issue #279 (tabbed dashboard redesign):
 * The Howl count badge is now in the tab bar, not in a sidebar header.
 *
 * Validates that the tab badge in The Howl tab accurately reflects the count of
 * cards with Howl-eligible statuses: fee_approaching, promo_expiring, overdue.
 *
 * Spec references:
 *   - development/frontend/src/components/dashboard/Dashboard.tsx
 *   - ux/wireframes/app/dashboard-tabs.html
 *   - Issue #280 (original count fix: include overdue in count)
 *   - Issue #279 (tab redesign: badge is now in tab bar)
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

function makeOverdueCard(overrides: Record<string, unknown> = {}) {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 5); // 5 days ago

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

  test("Howl tab badge shows 3 when fee_approaching + promo_expiring + overdue present", async ({
    page,
  }) => {
    await setup(page, [
      makeUrgentCard({ issuerId: "chase", cardName: "Sapphire Preferred" }),
      makePromoCard({ issuerId: "amex", cardName: "Platinum" }),
      makeOverdueCard({ issuerId: "capital_one", cardName: "Sapphire Reserved" }),
    ]);

    // The Howl tab badge should show 3
    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    const badge = howlTab.locator('span[aria-label="3 cards"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("3");
  });

  test("Howl tab badge shows 1 when only overdue card exists", async ({ page }) => {
    await setup(page, [makeOverdueCard({ cardName: "Overdue Fee Card" })]);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    const badge = howlTab.locator('span[aria-label="1 card"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("1");
  });

  test("Howl tab badge shows 2 when 2 overdue cards exist", async ({ page }) => {
    await setup(page, [
      makeOverdueCard({ issuerId: "chase", cardName: "Overdue Card A" }),
      makeOverdueCard({ issuerId: "amex", cardName: "Overdue Card B" }),
    ]);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    const badge = howlTab.locator('span[aria-label="2 cards"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("2");
  });

  test("Howl tab badge does not include active cards", async ({ page }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Fee" }),
      makePromoCard({ cardName: "Promo" }),
      makeOverdueCard({ cardName: "Overdue" }),
      makeCard({ cardName: "Active 1" }),
      makeCard({ cardName: "Active 2" }),
      makeCard({ cardName: "Active 3" }),
    ]);

    // Count should be 3, not 6
    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    const badge = howlTab.locator('span[aria-label="3 cards"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("3");
  });

  test("overdue cards appear in The Howl tab panel", async ({ page }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Annual Fee" }),
      makePromoCard({ cardName: "Bonus Deadline" }),
      makeOverdueCard({ cardName: "Past Due" }),
    ]);

    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    await expect(howlPanel).not.toHaveAttribute("hidden");

    await expect(howlPanel).toContainText("Annual Fee");
    await expect(howlPanel).toContainText("Bonus Deadline");
    await expect(howlPanel).toContainText("Past Due");
  });

  test("overdue card shows urgency bar with 'OVERDUE' label", async ({ page }) => {
    await setup(page, [makeOverdueCard({ cardName: "Past Due Card" })]);

    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    await expect(howlPanel).not.toHaveAttribute("hidden");

    const urgencyBar = howlPanel.locator('[data-testid="urgency-bar"]').first();
    await expect(urgencyBar).toBeVisible();
    await expect(urgencyBar).toContainText("OVERDUE");
  });

  test("Active tab badge shows count of non-urgent cards only", async ({ page }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Fee" }),
      makePromoCard({ cardName: "Promo" }),
      makeOverdueCard({ cardName: "Overdue" }),
      makeCard({ cardName: "Active 1" }),
      makeCard({ cardName: "Active 2" }),
    ]);

    const activeTab = page.locator('[role="tab"][id="tab-active"]');
    const badge = activeTab.locator('span[aria-label="2 cards"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("2");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Overdue cards display correctly in Howl tab
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — Overdue card presentation", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("overdue cards show 'OVERDUE' label in urgency bar", async ({ page }) => {
    await setup(page, [makeOverdueCard({ cardName: "Past Due Card" })]);

    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    const urgencyBar = howlPanel.locator('[data-testid="urgency-bar"]').first();
    await expect(urgencyBar).toContainText("OVERDUE");
  });

  test("overdue card urgency bar shows days past text", async ({ page }) => {
    await setup(page, [makeOverdueCard({ cardName: "Red Alert Card" })]);

    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    const urgencyBar = howlPanel.locator('[data-testid="urgency-bar"]').first();
    // Overdue: shows "N days past"
    await expect(urgencyBar).toContainText("past");
  });
});
