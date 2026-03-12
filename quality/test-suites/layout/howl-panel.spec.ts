/**
 * Dashboard Tabs — The Howl Tab Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Slimmed to interactive behavior only:
 *   - Tab bar renders with both tabs
 *   - Default tab selection logic
 *   - Tab switching works
 *   - Card categorization (no duplication across tabs)
 *
 * Removed: rune content checks, badge count text, empty state copy,
 * mobile viewport tests, urgency bar label text, sort order, Ragnarok text.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedEntitlement,
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
  await page.goto("/ledger");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
  await seedEntitlement(page);
  await page.reload({ waitUntil: "load" });
}

// ════════════════════════════════════════════════════════════════════════════
// Suite: Tab bar renders
// ════════════════════════════════════════════════════════════════════════════

// "Tab bar renders" — REMOVED (Issue #610): Duplicated by dashboard-tabs and reverse-tab-order.

// ════════════════════════════════════════════════════════════════════════════
// Suite: Default tab selection
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — Default tab selection", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("The Howl tab is default when urgent cards exist", async ({ page }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Urgent Card" }),
      makeCard({ cardName: "Active Card" }),
    ]);

    const howlTab = page.locator('[role="tab"][id="tab-howl"]');
    await expect(howlTab).toHaveAttribute("aria-selected", "true");
  });

  test("Active tab is default when no urgent cards exist", async ({ page }) => {
    await setup(page, [
      makeCard({ cardName: "Active Card A" }),
      makeCard({ cardName: "Active Card B" }),
    ]);

    const activeTab = page.locator('[role="tab"][id="tab-active"]');
    await expect(activeTab).toHaveAttribute("aria-selected", "true");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Tab switching
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — Tab switching", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("clicking Active tab switches panel content", async ({ page }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Urgent Card" }),
      makeCard({ cardName: "Calm Card" }),
    ]);

    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    await expect(howlPanel).not.toHaveAttribute("hidden");

    const activeTab = page.locator('[role="tab"][id="tab-active"]');
    await activeTab.click();

    const activePanel = page.locator('[role="tabpanel"][id="panel-active"]');
    await expect(activePanel).not.toHaveAttribute("hidden");
    await expect(activePanel).toContainText("Calm Card");

    await expect(howlPanel).toHaveAttribute("hidden", "");
  });

  // "clicking back to Howl restores panel" — REMOVED (Issue #610): Inverse of forward switch.
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Card categorization (no duplication)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard Tabs — Card categorization", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("mixed cards: fee_approaching in Howl, active in Active — no duplication", async ({
    page,
  }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Urgent Fee Card" }),
      makeCard({ cardName: "Normal Active Card" }),
    ]);

    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    await expect(howlPanel).toContainText("Urgent Fee Card");
    const howlText = await howlPanel.textContent();
    expect(howlText).not.toContain("Normal Active Card");

    const activeTab = page.locator('[role="tab"][id="tab-active"]');
    await activeTab.click();
    const activePanel = page.locator('[role="tabpanel"][id="panel-active"]');
    const activeText = await activePanel.textContent();
    expect(activeText).toContain("Normal Active Card");
    expect(activeText).not.toContain("Urgent Fee Card");
  });
});
