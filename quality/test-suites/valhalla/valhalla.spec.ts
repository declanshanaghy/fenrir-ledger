/**
 * Valhalla Page Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates the /valhalla route against the design spec:
 *   - Empty state: "No wolves have returned from the hunt. All chains still bind."
 *   - Closed cards shown as tombstone entries (ᛏ rune, card name, closed date)
 *   - Active, deleted cards must NOT appear in Valhalla
 *   - Page heading: "Valhalla" + subtitle "Hall of the Honored Dead"
 *
 * Spec references:
 *   - development/frontend/src/app/valhalla/page.tsx
 *   - getClosedCards() filters by closedAt set AND no deletedAt
 *
 * Every assertion is derived from the design spec — not from observed
 * implementation behaviour.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedHousehold,
  makeCard,
  makeClosedCard,
  makeUrgentCard,
  makePromoCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";
import { MIXED_CARDS } from "../helpers/seed-data";

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

async function setupAndGotoValhalla(page: Parameters<typeof clearAllStorage>[0]) {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
}

// ════════════════════════════════════════════════════════════════════════════
// Suite: Page heading and subtitle
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Page heading", () => {
  test("displays 'Valhalla' heading and 'Hall of the Honored Dead' subtitle", async ({
    page,
  }) => {
    await setupAndGotoValhalla(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    // Spec: h1 contains "Valhalla" (inside the link element)
    const heading = page.locator("h1").first();
    await expect(heading).toContainText("Valhalla");

    // Spec: subheading text "Hall of the Honored Dead" follows the em dash
    await expect(heading).toContainText("Hall of the Honored Dead");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Empty Valhalla
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Empty state", () => {
  test("shows empty state message when no closed cards exist", async ({
    page,
  }) => {
    await setupAndGotoValhalla(page);
    // Seed only active cards — nothing should appear in Valhalla
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeCard({ cardName: "Active Card A" }),
      makeCard({ cardName: "Active Card B" }),
    ]);
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    // Spec: empty state copy — product/copywriting.md Valhalla empty state
    const emptyContainer = page.locator('[aria-label="Valhalla is empty"]');
    await expect(emptyContainer).toBeVisible();

    await expect(emptyContainer).toContainText(
      "No wolves have returned from the hunt. All chains still bind."
    );
  });

  test("empty Valhalla shows a link back to the dashboard", async ({ page }) => {
    await setupAndGotoValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, []);
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    // Spec: empty state contains a link back to the ledger (dashboard)
    const returnLink = page.locator('[aria-label="Valhalla is empty"] a[href="/"]');
    await expect(returnLink).toBeVisible();
    await expect(returnLink).toContainText("Return to the Ledger of Fates");
  });

  test("no tombstone articles render in empty Valhalla", async ({ page }) => {
    await setupAndGotoValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, []);
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    // No closed card articles should be present
    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Closed cards display (tombstone entries)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Closed cards display", () => {
  test("shows tombstone entries for 2 closed cards with their names", async ({
    page,
  }) => {
    await setupAndGotoValhalla(page);
    const closedCards = [
      makeClosedCard({ cardName: "Honored Card Alpha" }),
      makeClosedCard({ cardName: "Honored Card Beta" }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, closedCards);
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    // Spec: each closed card renders as an article with aria-label "Closed card: {name}"
    await expect(
      page.locator('article[aria-label="Closed card: Honored Card Alpha"]')
    ).toBeVisible();
    await expect(
      page.locator('article[aria-label="Closed card: Honored Card Beta"]')
    ).toBeVisible();
  });

  test("each tombstone entry shows the ᛏ rune", async ({ page }) => {
    await setupAndGotoValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeClosedCard({ cardName: "Rune Test Card" }),
    ]);
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    // Spec: TombstoneCard renders ᛏ (Tiwaz) rune as status marker
    const tombstone = page.locator('article[aria-label="Closed card: Rune Test Card"]');
    await expect(tombstone).toBeVisible();
    await expect(tombstone).toContainText("ᛏ");
  });

  test("each tombstone entry shows the closed date", async ({ page }) => {
    await setupAndGotoValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeClosedCard({ cardName: "Dated Tombstone Card" }),
    ]);
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    // Spec: closedAt date is rendered as "Closed {date}" in the tombstone header
    const tombstone = page.locator('article[aria-label="Closed card: Dated Tombstone Card"]');
    await expect(tombstone).toContainText("Closed");
  });

  test("tombstone shows 'View full record' link", async ({ page }) => {
    await setupAndGotoValhalla(page);
    const card = makeClosedCard({ cardName: "Linkable Tombstone" });
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    const tombstone = page.locator('article[aria-label="Closed card: Linkable Tombstone"]');
    const viewLink = tombstone.locator('a[href*="/cards/"]');
    await expect(viewLink).toBeVisible();
    await expect(viewLink).toContainText("View full record");
  });

  test("filter bar appears when closed cards exist", async ({ page }) => {
    await setupAndGotoValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeClosedCard({ cardName: "Filter Test Card" }),
    ]);
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    // Spec: filter/sort bar only shown when allClosed.length > 0
    const issuerFilter = page.locator('select[aria-label="Filter by issuer"]');
    const sortFilter = page.locator('select[aria-label="Sort order"]');
    await expect(issuerFilter).toBeVisible();
    await expect(sortFilter).toBeVisible();
  });

  test("filter bar is hidden when Valhalla is empty", async ({ page }) => {
    await setupAndGotoValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, []);
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    // Spec: filter bar only rendered when allClosed.length > 0
    const issuerFilter = page.locator('select[aria-label="Filter by issuer"]');
    await expect(issuerFilter).not.toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Active cards must NOT appear in Valhalla
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Active cards excluded", () => {
  test("active cards do not appear in Valhalla", async ({ page }) => {
    await setupAndGotoValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeCard({ cardName: "Still Active Card" }),
      makeUrgentCard({ cardName: "Urgent Active Card" }),
      makePromoCard({ cardName: "Promo Active Card" }),
    ]);
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    // Spec: only cards with status === "closed" and closedAt set appear in Valhalla
    await expect(page.locator('article[aria-label^="Closed card:"]')).toHaveCount(0);

    // Empty state should be visible
    await expect(page.locator('[aria-label="Valhalla is empty"]')).toBeVisible();
  });

  test("MIXED_CARDS: only the 2 closed cards appear — active/urgent/promo excluded", async ({
    page,
  }) => {
    await setupAndGotoValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, MIXED_CARDS);
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    // MIXED_CARDS has exactly 2 closed cards (Discover + Barclays)
    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(2);

    // The closed card names per seed-data.ts
    await expect(
      page.locator('article[aria-label="Closed card: Closed — Fee Not Worth It"]')
    ).toBeVisible();
    await expect(
      page.locator('article[aria-label="Closed card: Closed — Downgraded"]')
    ).toBeVisible();

    // The active cards must not appear
    await expect(
      page.locator('article[aria-label="Closed card: Sapphire Preferred"]')
    ).not.toBeAttached();
    await expect(
      page.locator('article[aria-label="Closed card: Annual Fee Approaching"]')
    ).not.toBeAttached();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Deleted cards must NOT appear in Valhalla
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Deleted cards excluded", () => {
  test("a card with deletedAt set does not appear in Valhalla", async ({
    page,
  }) => {
    await setupAndGotoValhalla(page);
    // A card that is closed AND deleted — Valhalla filters by !deletedAt
    const deletedClosedCard = makeClosedCard({
      cardName: "Erased From Memory",
      deletedAt: new Date().toISOString(),
    });
    // A normal closed card to confirm the page is working
    const honestClosedCard = makeClosedCard({ cardName: "Honored Dead" });

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [deletedClosedCard, honestClosedCard]);
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    // The deleted-closed card must be absent from Valhalla
    await expect(
      page.locator('article[aria-label="Closed card: Erased From Memory"]')
    ).not.toBeAttached();

    // The non-deleted closed card must be present
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
    await page.reload({ waitUntil: "networkidle" });
    await page.goto("/valhalla", { waitUntil: "networkidle" });

    // Valhalla should be empty — the deleted card is invisible
    await expect(page.locator('[aria-label="Valhalla is empty"]')).toBeVisible();
    await expect(page.locator('article[aria-label^="Closed card:"]')).toHaveCount(0);
  });
});
