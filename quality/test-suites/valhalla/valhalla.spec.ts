/**
 * Valhalla Tab Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the Valhalla tab on the dashboard (Issue #352 — 5-tab expansion).
 * Valhalla shows closed/graduated cards as CardTile components.
 * The standalone /valhalla route was removed in Issue #377;
 * it now redirects to /ledger?tab=valhalla.
 *
 * Valhalla is Karl-gated — seedEntitlement("karl") is required.
 *
 * Slimmed to interactive behavior only:
 *   - Tab loads and displays closed cards
 *   - Active cards excluded from Valhalla tab
 *   - Deleted cards excluded from Valhalla tab
 *   - Empty state shown when no closed cards
 *   - Edit link works on closed cards
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedHousehold,
  seedEntitlement,
  makeCard,
  makeClosedCard,
  makeUrgentCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

async function setupValhalla(page: Parameters<typeof clearAllStorage>[0]) {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedEntitlement(page, "karl", true);
}

async function gotoValhalla(page: Parameters<typeof clearAllStorage>[0]) {
  await page.goto("/ledger?tab=valhalla", { waitUntil: "networkidle" });
}

// ════════════════════════════════════════════════════════════════════════════
// Suite: Tab loads
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Tab heading", () => {
  test("displays Valhalla tab selected on dashboard", async ({ page }) => {
    await setupValhalla(page);
    await gotoValhalla(page);

    const valhallaTab = page.locator("button#tab-valhalla");
    await expect(valhallaTab).toBeVisible();
    await expect(valhallaTab).toHaveAttribute("aria-selected", "true");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Closed cards display
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Closed cards display", () => {
  test("shows closed cards with their names in Valhalla tab", async ({
    page,
  }) => {
    await setupValhalla(page);
    const closedCards = [
      makeClosedCard({ cardName: "Honored Card Alpha" }),
      makeClosedCard({ cardName: "Honored Card Beta" }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, closedCards);
    await page.reload({ waitUntil: "networkidle" });
    await gotoValhalla(page);

    const valhallaPanel = page.locator("#panel-valhalla");
    await expect(valhallaPanel.locator("text=Honored Card Alpha")).toBeVisible();
    await expect(valhallaPanel.locator("text=Honored Card Beta")).toBeVisible();
  });

  test("closed card has edit link", async ({ page }) => {
    await setupValhalla(page);
    const card = makeClosedCard({ cardName: "Linkable Card" });
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });
    await gotoValhalla(page);

    const valhallaPanel = page.locator("#panel-valhalla");
    const editLink = valhallaPanel.locator('a[href*="/cards/"]');
    await expect(editLink).toBeVisible();
  });

  test("empty state shows 'Valhalla is quiet' when no closed cards", async ({ page }) => {
    await setupValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, []);
    await page.reload({ waitUntil: "networkidle" });
    await gotoValhalla(page);

    const valhallaPanel = page.locator("#panel-valhalla");
    await expect(valhallaPanel.locator("text=Valhalla is quiet")).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Active cards excluded
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Active cards excluded", () => {
  test("active cards do not appear in Valhalla tab", async ({ page }) => {
    await setupValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeCard({ cardName: "Still Active Card" }),
      makeUrgentCard({ cardName: "Urgent Active Card" }),
    ]);
    await page.reload({ waitUntil: "networkidle" });
    await gotoValhalla(page);

    const valhallaPanel = page.locator("#panel-valhalla");
    await expect(valhallaPanel.locator("text=Valhalla is quiet")).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Deleted cards excluded
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Deleted cards excluded", () => {
  test("a card with deletedAt set does not appear in Valhalla tab", async ({
    page,
  }) => {
    await setupValhalla(page);
    const deletedClosedCard = makeClosedCard({
      cardName: "Erased From Memory",
      deletedAt: new Date().toISOString(),
    });
    const honestClosedCard = makeClosedCard({ cardName: "Honored Dead" });

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [deletedClosedCard, honestClosedCard]);
    await page.reload({ waitUntil: "networkidle" });
    await gotoValhalla(page);

    const valhallaPanel = page.locator("#panel-valhalla");
    await expect(
      valhallaPanel.locator("text=Erased From Memory")
    ).not.toBeVisible();
    await expect(
      valhallaPanel.locator("text=Honored Dead")
    ).toBeVisible();
  });

  test("only-deleted card shows empty Valhalla", async ({ page }) => {
    await setupValhalla(page);
    const deletedCard = makeClosedCard({
      cardName: "Ghost Card",
      deletedAt: new Date().toISOString(),
    });
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [deletedCard]);
    await page.reload({ waitUntil: "networkidle" });
    await gotoValhalla(page);

    const valhallaPanel = page.locator("#panel-valhalla");
    await expect(valhallaPanel.locator("text=Valhalla is quiet")).toBeVisible();
  });
});
