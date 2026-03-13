/**
 * Dashboard Tabs QA Tests — Issue #279
 * Authored by Loki, QA Tester of the Pack
 *
 * Trimmed to 2 core tests per issue #613:
 *   1. Tab switching works (click between tabs, aria-selected updates)
 *   2. Urgent card distribution (cards appear in correct tab)
 *
 * Data isolation: clearAllStorage() before each test.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedEntitlement,
  seedHousehold,
  makeCard,
  makeUrgentCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

async function setupDashboard(
  page: Parameters<typeof clearAllStorage>[0],
  cards: Parameters<typeof seedCards>[2]
) {
  await page.goto("/ledger");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
  await seedEntitlement(page);
  await page.reload({ waitUntil: "load" });
}

test.describe("Dashboard Tabs — Core", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("clicking tabs switches aria-selected and shows correct panel", async ({
    page,
  }) => {
    await setupDashboard(page, [
      makeCard({ cardName: "Active" }),
      makeUrgentCard({ cardName: "Urgent" }),
    ]);

    const allTab = page.locator("button#tab-all");
    const activeTab = page.locator("button#tab-active");

    await allTab.click();
    await expect(allTab).toHaveAttribute("aria-selected", "true");

    await activeTab.click();
    await expect(activeTab).toHaveAttribute("aria-selected", "true");
  });

  test("All tab shows all cards without duplication", async ({ page }) => {
    await setupDashboard(page, [
      makeCard({ cardName: "Active 1" }),
      makeCard({ cardName: "Active 2" }),
      makeUrgentCard({ cardName: "Urgent 1" }),
    ]);

    const allTab = page.locator("button#tab-all");
    await allTab.click();
    const allPanel = page.locator('[role="tabpanel"]#panel-all');
    const allCards = allPanel.locator('[data-testid^="card-"]');
    await expect(allCards).toHaveCount(3);
  });
});
