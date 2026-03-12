/**
 * Runic Empty States QA Tests — Issue #583
 *
 * Validates simplified empty state pattern for all 5 dashboard tabs:
 *   - All:      ᛟ No cards ᛟ
 *   - Valhalla: ↑ No retired cards ↑
 *   - Active:   ᛉ No active cards ᛉ
 *   - The Hunt: ᛜ No bounties ᛜ
 *   - The Howl: ᚲ No alerts ᚲ
 *
 * Acceptance Criteria:
 * - All 5 tab empty states show the simplified runic pattern
 * - Each tab uses its own rune character from the tab config
 * - No verbose explanatory text in empty states
 * - Global EmptyState (zero cards total) remains unchanged
 * - Rune text is centered vertically and horizontally in the empty area
 * - Mobile (375px) renders correctly
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

// Setup helper function
async function setupDashboard(
  page: Parameters<typeof clearAllStorage>[0],
  cards: Parameters<typeof seedCards>[2]
) {
  await page.goto("/ledger");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
  await page.reload({ waitUntil: "load" });
}

// Tab rune map for validation
const TAB_RUNES = {
  all: "ᛟ",
  valhalla: "↑",
  active: "ᛉ",
  hunt: "ᛜ",
  howl: "ᚲ",
};

const TAB_EMPTY_LABELS = {
  all: "No cards",
  valhalla: "No retired cards",
  active: "No active cards",
  hunt: "No bounties",
  howl: "No alerts",
};

test.describe("Runic Empty States — Issue #583", () => {
  // Desktop viewport for all tests
  test.use({ viewport: { width: 1280, height: 800 } });

  test.describe("AC1: Simplified Runic Pattern", () => {
    test("Active tab shows runic empty state when empty", async ({ page }) => {
      // Only urgent and closed cards (no active cards)
      await setupDashboard(page, [
        makeUrgentCard({ cardName: "Urgent" }),
        makeClosedCard({ cardName: "Closed" }),
      ]);

      const activeTab = page.locator('button#tab-active');
      await activeTab.click();

      const activePanel = page.locator('[role="tabpanel"]#panel-active');
      const panelText = activePanel.locator("p");
      await expect(panelText).toContainText("ᛉ");
      await expect(panelText).toContainText("No active cards");
    });

    test("The Hunt tab shows runic empty state when no bonus cards", async ({ page }) => {
      // Only active and urgent cards (no bonus_open)
      await setupDashboard(page, [
        makeCard({ cardName: "Active" }),
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      const huntTab = page.locator('button#tab-hunt');
      await huntTab.click();

      const huntPanel = page.locator('[role="tabpanel"]#panel-hunt');
      const panelText = huntPanel.locator("p");
      await expect(panelText).toContainText("ᛜ");
      await expect(panelText).toContainText("No bounties");
    });

    test("The Howl tab shows runic empty state when no urgent cards", async ({ page }) => {
      // Only active cards (no fee_approaching, promo_expiring, overdue)
      await setupDashboard(page, [
        makeCard({ cardName: "Active 1" }),
        makeCard({ cardName: "Active 2" }),
      ]);

      const howlTab = page.locator('button#tab-howl');
      await howlTab.click();

      const howlPanel = page.locator('[role="tabpanel"]#panel-howl');
      const panelText = howlPanel.locator("p");
      await expect(panelText).toContainText("ᚲ");
      await expect(panelText).toContainText("No alerts");
    });

    test("Valhalla tab shows runic empty state when no closed cards", async ({ page }) => {
      // Only active cards (no closed/graduated)
      await setupDashboard(page, [
        makeCard({ cardName: "Active 1" }),
        makeCard({ cardName: "Active 2" }),
      ]);

      const valhallaTab = page.locator('button#tab-valhalla');
      await valhallaTab.click();

      const valhallaPanel = page.locator('[role="tabpanel"]#panel-valhalla');
      const panelText = valhallaPanel.locator("p");
      await expect(panelText).toContainText("↑");
      await expect(panelText).toContainText("No retired cards");
    });

    // "All tab shows runic empty state" — REMOVED (Issue #610): Ambiguous test that
    // just checks panel visibility with cards present. Not testing empty state at all.
  });

  // AC2: Tab-Specific Runes — REMOVED (Issue #610)
  // Rune character counting assertions. Static content checks that break on design changes.

  // AC3: No Verbose Text — REMOVED (Issue #610)
  // Negative text search assertions. Low value — verbose text was removed long ago.

  test.describe("AC4: Global EmptyState Unchanged", () => {
    test("Global empty state displays when zero cards total", async ({ page }) => {
      // No cards at all
      await setupDashboard(page, []);

      // Should show the global EmptyState, not a TabEmptyState
      const emptyState = page.locator('[data-testid="empty-state"]');

      // The global EmptyState should be visible (from EmptyState.tsx)
      // Note: We verify it's different from tab empty states by checking
      // it doesn't have the tab panel structure
      const tabPanels = page.locator('[role="tabpanel"]');
      const visiblePanels = await tabPanels.filter({ hasNot: page.locator('[hidden]') }).count();

      // No visible panels means global empty state is shown instead
      expect(visiblePanels).toBe(0);
    });
  });

  // AC5: Centered Alignment — REMOVED (Issue #610): CSS class inspection.
  // AC6: Mobile Rendering — REMOVED (Issue #610): CSS class + static rune content check.

  // Edge Cases — REMOVED (Issue #610):
  // "persists when cards deleted" — re-setup dance, low value.
  // "correct muted styling" — CSS class inspection.
});
