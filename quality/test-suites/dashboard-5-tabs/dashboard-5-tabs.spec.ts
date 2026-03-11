/**
 * Dashboard 5-Tabs QA Tests — Issue #352
 *
 * Validates the expansion from 2 tabs (Howl + Active) to 5 tabs:
 * The Howl, The Hunt, Active, Valhalla, All
 *
 * Test coverage:
 *   1. All 5 tabs render with correct cards per status
 *   2. Tab selection persists in localStorage across reload
 *   3. /valhalla route returns 404 (standalone page removed)
 *   4. ARIA keyboard navigation (ArrowLeft/Right between tabs)
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedHousehold,
  makeCard,
  makeUrgentCard,
  makePromoCard,
  makeClosedCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ─── Setup Helper ──────────────────────────────────────────────────────────

async function setupDashboard(
  page: Parameters<typeof clearAllStorage>[0],
  cards: Parameters<typeof seedCards>[2]
) {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
  await page.reload({ waitUntil: "networkidle" });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe("Dashboard 5-Tabs QA — Issue #352", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: All 5 tabs render with correct cards per status
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-1: Five tabs render in correct order with correct cards", async ({
    page,
  }) => {
    // Setup: Create one card per tab to verify they appear in the right place
    const howlCard = makeUrgentCard({ cardName: "Fee Due Card" });
    const huntCard = makeCard({
      cardName: "Bonus Card",
      status: "bonus_open",
    });
    const activeCard = makeCard({ cardName: "Active Card" });
    const valhallaCard = makeClosedCard({ cardName: "Closed Card" });

    await setupDashboard(page, [
      howlCard,
      huntCard,
      activeCard,
      valhallaCard,
    ]);

    // Verify all 5 tabs exist in the correct order
    const tabs = page.locator('button[id^="tab-"]');
    const tabIds = await tabs.evaluateAll((elements) =>
      elements.map((el) => el.id)
    );

    expect(tabIds).toEqual([
      "tab-howl",
      "tab-hunt",
      "tab-active",
      "tab-valhalla",
      "tab-all",
    ]);

    // Verify The Howl tab contains the fee_approaching card
    await page.locator('button#tab-howl').click();
    const howlPanel = page.locator('[role="tabpanel"]#panel-howl');
    await expect(howlPanel.locator("text=Fee Due Card")).toBeVisible();

    // Verify The Hunt tab contains the bonus_open card
    await page.locator('button#tab-hunt').click();
    const huntPanel = page.locator('[role="tabpanel"]#panel-hunt');
    await expect(huntPanel.locator("text=Bonus Card")).toBeVisible();

    // Verify Active tab contains the active card
    await page.locator('button#tab-active').click();
    const activePanel = page.locator('[role="tabpanel"]#panel-active');
    await expect(activePanel.locator("text=Active Card")).toBeVisible();

    // Verify Valhalla tab contains the closed card
    await page.locator('button#tab-valhalla').click();
    const valhallaPanel = page.locator('[role="tabpanel"]#panel-valhalla');
    await expect(valhallaPanel.locator("text=Closed Card")).toBeVisible();

    // Verify All tab contains all 4 cards
    await page.locator('button#tab-all').click();
    const allPanel = page.locator('[role="tabpanel"]#panel-all');
    await expect(allPanel.locator("text=Fee Due Card")).toBeVisible();
    await expect(allPanel.locator("text=Bonus Card")).toBeVisible();
    await expect(allPanel.locator("text=Active Card")).toBeVisible();
    await expect(allPanel.locator("text=Closed Card")).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Tab selection persists in localStorage across reload
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-2: Tab selection persists in localStorage across reload", async ({
    page,
  }) => {
    const testCards = [
      makeUrgentCard({ cardName: "Urgent" }),
      makeCard({ cardName: "Active" }),
      makeClosedCard({ cardName: "Closed" }),
    ];

    await setupDashboard(page, testCards);

    // Click to Valhalla tab (should persist)
    const valhallaTab = page.locator('button#tab-valhalla');
    await valhallaTab.click();
    await expect(valhallaTab).toHaveAttribute("aria-selected", "true");

    // Reload the page
    await page.reload({ waitUntil: "networkidle" });

    // Verify Valhalla tab is still selected after reload
    const valhallaTabAfterReload = page.locator('button#tab-valhalla');
    await expect(valhallaTabAfterReload).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // Verify the Valhalla panel is visible with the closed card
    const valhallaPanel = page.locator('[role="tabpanel"]#panel-valhalla');
    await expect(valhallaPanel).not.toHaveAttribute("hidden");
    // Verify at least one card is visible in the Valhalla panel
    const cards = valhallaPanel.locator('[data-testid^="card-"]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);

    // Switch to All tab and verify persistence
    await page.locator('button#tab-all').click();
    await page.reload({ waitUntil: "networkidle" });

    const allTabAfterSecondReload = page.locator('button#tab-all');
    await expect(allTabAfterSecondReload).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: /valhalla route redirects to dashboard with ?tab=valhalla
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-3: /valhalla route redirects to dashboard with Valhalla tab selected", async ({
    page,
  }) => {
    // Setup: Add a closed card so Valhalla tab has content
    const testCards = [
      makeClosedCard({ cardName: "Old Card" }),
      makeCard({ cardName: "Active Card" }),
    ];
    await setupDashboard(page, testCards);

    // Navigate to the old /valhalla route
    await page.goto("/ledger/valhalla", { waitUntil: "networkidle" });

    // Should redirect to the dashboard with ?tab=valhalla in URL
    expect(page.url()).toContain("/?tab=valhalla");

    // Valhalla tab should be selected
    const valhallaTab = page.locator('button#tab-valhalla');
    await expect(valhallaTab).toHaveAttribute("aria-selected", "true");

    // Valhalla panel should display the closed card
    const valhallaPanel = page.locator('[role="tabpanel"]#panel-valhalla');
    await expect(valhallaPanel.locator("text=Old Card")).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: ARIA keyboard navigation (ArrowLeft/Right between tabs)
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-4: Keyboard navigation (ArrowLeft/Right) moves between tabs", async ({
    page,
  }) => {
    const testCards = [
      makeUrgentCard({ cardName: "Urgent" }),
      makeCard({ cardName: "Active" }),
    ];

    await setupDashboard(page, testCards);

    // Start at Howl tab by clicking it
    const howlTab = page.locator('button#tab-howl');
    await howlTab.click();
    await expect(howlTab).toHaveAttribute("aria-selected", "true");

    // Press ArrowRight to move to Hunt tab
    await page.keyboard.press("ArrowRight");
    const huntTab = page.locator('button#tab-hunt');
    await expect(huntTab).toHaveAttribute("aria-selected", "true");

    // Press ArrowRight again to move to Active tab
    await page.keyboard.press("ArrowRight");
    const activeTab = page.locator('button#tab-active');
    await expect(activeTab).toHaveAttribute("aria-selected", "true");

    // Press ArrowLeft to move back to Hunt tab
    await page.keyboard.press("ArrowLeft");
    await expect(huntTab).toHaveAttribute("aria-selected", "true");

    // Press ArrowLeft again to move back to Howl tab
    await page.keyboard.press("ArrowLeft");
    await expect(howlTab).toHaveAttribute("aria-selected", "true");

    // Test wrapping: ArrowLeft from Howl should go to All (last tab)
    await page.keyboard.press("ArrowLeft");
    const allTab = page.locator('button#tab-all');
    await expect(allTab).toHaveAttribute("aria-selected", "true");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Additional: Closed cards appear in Valhalla (not filtered out)
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-5: Closed cards appear in Valhalla tab and All tab", async ({
    page,
  }) => {
    const closedCards = [
      makeClosedCard({ cardName: "Closed 1" }),
      makeClosedCard({ cardName: "Closed 2" }),
      makeCard({ cardName: "Active Card" }),
    ];

    await setupDashboard(page, closedCards);

    // Click to Valhalla tab
    await page.locator('button#tab-valhalla').click();
    const valhallaPanel = page.locator('[role="tabpanel"]#panel-valhalla');

    // Both closed cards should be visible
    await expect(valhallaPanel.locator("text=Closed 1")).toBeVisible();
    await expect(valhallaPanel.locator("text=Closed 2")).toBeVisible();

    // Active card should NOT be in Valhalla
    const activeInValhalla = valhallaPanel.locator("text=Active Card");
    expect(await activeInValhalla.count()).toBe(0);

    // Both closed cards should be in All tab
    await page.locator('button#tab-all').click();
    const allPanel = page.locator('[role="tabpanel"]#panel-all');
    await expect(allPanel.locator("text=Closed 1")).toBeVisible();
    await expect(allPanel.locator("text=Closed 2")).toBeVisible();
    await expect(allPanel.locator("text=Active Card")).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Additional: bonus_open cards appear in The Hunt tab
  // ──────────────────────────────────────────────────────────────────────────

  test("TC-6: bonus_open cards appear in The Hunt tab only", async ({
    page,
  }) => {
    const cards = [
      makeCard({
        cardName: "Card with Bonus",
        status: "bonus_open",
      }),
      makeCard({ cardName: "Regular Active" }),
    ];

    await setupDashboard(page, cards);

    // Click to Hunt tab
    await page.locator('button#tab-hunt').click();
    const huntPanel = page.locator('[role="tabpanel"]#panel-hunt');

    // bonus_open card should be here
    await expect(huntPanel.locator("text=Card with Bonus")).toBeVisible();

    // Regular active card should NOT be in Hunt
    const activeInHunt = huntPanel.locator("text=Regular Active");
    expect(await activeInHunt.count()).toBe(0);

    // Click to Active tab
    await page.locator('button#tab-active').click();
    const activePanel = page.locator('[role="tabpanel"]#panel-active');

    // Regular active card should be here
    await expect(activePanel.locator("text=Regular Active")).toBeVisible();

    // bonus_open card should NOT be in Active
    const bonusInActive = activePanel.locator("text=Card with Bonus");
    expect(await bonusInActive.count()).toBe(0);
  });
});
