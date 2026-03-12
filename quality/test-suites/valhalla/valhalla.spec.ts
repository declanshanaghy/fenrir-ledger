/**
 * Valhalla Page Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Slimmed to interactive behavior only:
 *   - Page loads and displays heading
 *   - Closed cards display as tombstone entries
 *   - Active cards excluded from Valhalla
 *   - Deleted cards excluded from Valhalla
 *   - Filter bar appears/hides based on card presence
 *   - View full record link works
 *
 * Removed: empty state copy text, rune content, date text,
 * specific badge text, link-back copy.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedHousehold,
  makeCard,
  makeClosedCard,
  makeUrgentCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

async function setupAndGotoValhalla(page: Parameters<typeof clearAllStorage>[0]) {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
}

// ════════════════════════════════════════════════════════════════════════════
// Suite: Page loads
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Page heading", () => {
  test("displays 'Valhalla' heading", async ({ page }) => {
    await setupAndGotoValhalla(page);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    const heading = page.locator("h1").first();
    await expect(heading).toContainText("Valhalla");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Closed cards display
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Closed cards display", () => {
  test("shows tombstone entries for closed cards with their names", async ({
    page,
  }) => {
    await setupAndGotoValhalla(page);
    const closedCards = [
      makeClosedCard({ cardName: "Honored Card Alpha" }),
      makeClosedCard({ cardName: "Honored Card Beta" }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, closedCards);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    await expect(
      page.locator('article[aria-label="Closed card: Honored Card Alpha"]')
    ).toBeVisible();
    await expect(
      page.locator('article[aria-label="Closed card: Honored Card Beta"]')
    ).toBeVisible();
  });

  test("tombstone shows 'View full record' link", async ({ page }) => {
    await setupAndGotoValhalla(page);
    const card = makeClosedCard({ cardName: "Linkable Tombstone" });
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    const tombstone = page.locator('article[aria-label="Closed card: Linkable Tombstone"]');
    const viewLink = tombstone.locator('a[href*="/cards/"]');
    await expect(viewLink).toBeVisible();
  });

  test("filter bar appears when closed cards exist", async ({ page }) => {
    await setupAndGotoValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeClosedCard({ cardName: "Filter Test Card" }),
    ]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    const issuerFilter = page.locator('select[aria-label="Filter by issuer"]');
    const sortFilter = page.locator('select[aria-label="Sort order"]');
    await expect(issuerFilter).toBeVisible();
    await expect(sortFilter).toBeVisible();
  });

  test("filter bar is hidden when Valhalla is empty", async ({ page }) => {
    await setupAndGotoValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, []);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    const issuerFilter = page.locator('select[aria-label="Filter by issuer"]');
    await expect(issuerFilter).not.toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Active cards excluded
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Active cards excluded", () => {
  test("active cards do not appear in Valhalla", async ({ page }) => {
    await setupAndGotoValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeCard({ cardName: "Still Active Card" }),
      makeUrgentCard({ cardName: "Urgent Active Card" }),
    ]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    await expect(page.locator('article[aria-label^="Closed card:"]')).toHaveCount(0);
    await expect(page.locator('[aria-label="Valhalla is empty"]')).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Deleted cards excluded
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Deleted cards excluded", () => {
  test("a card with deletedAt set does not appear in Valhalla", async ({
    page,
  }) => {
    await setupAndGotoValhalla(page);
    const deletedClosedCard = makeClosedCard({
      cardName: "Erased From Memory",
      deletedAt: new Date().toISOString(),
    });
    const honestClosedCard = makeClosedCard({ cardName: "Honored Dead" });

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [deletedClosedCard, honestClosedCard]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    await expect(
      page.locator('article[aria-label="Closed card: Erased From Memory"]')
    ).not.toBeAttached();

    await expect(
      page.locator('article[aria-label="Closed card: Honored Dead"]')
    ).toBeVisible();
  });

  test("only-deleted card shows empty Valhalla", async ({ page }) => {
    await setupAndGotoValhalla(page);
    const deletedCard = makeClosedCard({
      cardName: "Ghost Card",
      deletedAt: new Date().toISOString(),
    });
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [deletedCard]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    await expect(page.locator('[aria-label="Valhalla is empty"]')).toBeVisible();
    await expect(page.locator('article[aria-label^="Closed card:"]')).toHaveCount(0);
  });
});
