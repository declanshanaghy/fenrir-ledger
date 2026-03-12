/**
 * Dashboard Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the main dashboard view (/) against the design spec, not against
 * whatever the code currently happens to produce. Every assertion traces back
 * to a specific requirement in the product-design-brief, EmptyState.tsx,
 * Dashboard.tsx, CardTile.tsx, or StatusBadge.tsx.
 *
 * Spec references:
 *   - EmptyState.tsx: heading "Before Gleipnir was forged" + "Add Card" link
 *   - Dashboard.tsx:  summary header "{N} cards" / "{N} need attention"
 *   - CardTile.tsx:   Link href="/ledger/cards/{id}/edit", cardName, issuerName
 *   - StatusBadge.tsx: STATUS_LABELS = { active: "Active", fee_approaching: "Fee Due Soon", … }
 *   - constants.ts:   STATUS_LABELS record (authoritative badge text source)
 *
 * Data isolation: each test clears localStorage and seeds its own state before
 * navigating. Tests never depend on data left by a previous test.
 */

import { test, expect } from "@playwright/test";
import {
  seedCards,
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";
import {
  EMPTY_CARDS,
  FEW_CARDS,
  URGENT_CARDS,
} from "../helpers/seed-data";

// ─── Shared beforeEach ────────────────────────────────────────────────────────
// Each test overrides this with its own card set via beforeEach at the
// describe level where needed. The top-level beforeEach just navigates and
// clears storage so the base state is deterministic.

test.beforeEach(async ({ page }) => {
  await page.goto("/ledger");
  await clearAllStorage(page);
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Empty State
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard — Empty State", () => {
  // No cards seeded — EmptyState component must render.

  test("shows the Gleipnir heading when no cards exist", async ({ page }) => {
    // Seed household only — no cards
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, EMPTY_CARDS);
    await page.reload({ waitUntil: "load" });

    // Spec: EmptyState.tsx h2 begins "Before" and contains "Gleipnir was forged"
    // The heading includes two myth-link anchors (Gleipnir, Fenrir) so we
    // match the surrounding text nodes, not the whole string.
    const heading = page.locator("h2");
    await expect(heading).toContainText("Before");
    await expect(heading).toContainText("Gleipnir");
    await expect(heading).toContainText("was forged");
  });

  test("Add Card link is present and points to /cards/new on empty state", async ({
    page,
  }) => {
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, EMPTY_CARDS);
    await page.reload({ waitUntil: "load" });

    // Spec: EmptyState.tsx renders <Link href="/ledger/cards/new">Add Card</Link>
    const addCardLink = page.locator('a[href="/ledger/cards/new"]').first();
    await expect(addCardLink).toBeVisible();
    await expect(addCardLink).toContainText("Add Card");
  });

  test("no card tiles are rendered when zero cards are seeded", async ({
    page,
  }) => {
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, EMPTY_CARDS);
    await page.reload({ waitUntil: "load" });

    // Dashboard renders EmptyState when cards.length === 0 — no card links
    // to /cards/{id}/edit should exist
    const editLinks = page.locator('a[href*="/ledger/cards/"][href*="/edit"]');
    await expect(editLinks).toHaveCount(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Card Grid Renders
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard — Card Grid", () => {
  test("renders FEW_CARDS (3 cards) with correct card names", async ({
    page,
  }) => {
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "load" });

    // Spec: CardTile.tsx renders <CardTitle>{card.cardName}</CardTitle>
    // FEW_CARDS = [Sapphire Preferred, Platinum, Venture Rewards]
    await expect(page.getByText("Sapphire Preferred").first()).toBeVisible();
    await expect(page.getByText("Platinum").first()).toBeVisible();
    await expect(page.getByText("Venture Rewards").first()).toBeVisible();
  });

  // "renders exactly 3 card tiles" — REMOVED (Issue #610): Redundant with name visibility above.
  // "renders MANY_CARDS (10 cards)" — REMOVED (Issue #610): Count check, low regression value.
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Summary Stats
// ════════════════════════════════════════════════════════════════════════════

// Suite 3 — Summary Stats: REMOVED (Issue #610)
// Card count, singular/plural labels, "needs attention" text — all static label
// logic that can be unit tested. Body text searches are fragile and low value.

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Status Badges
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard — Status Badges", () => {
  test("active cards show 'Active' badge", async ({ page }) => {
    // FEW_CARDS are all status: "active"
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "load" });

    // Spec: STATUS_LABELS.active = "Active" (constants.ts, authoritative)
    // StatusBadge renders <Badge>{label}</Badge> where label = STATUS_LABELS[status]
    // Scope to "All" tab to avoid 5-tab duplication
    const allPanel = page.locator('[aria-labelledby="tab-all"]');
    const activeBadges = allPanel.locator('[aria-label="Card status: Active"]');
    const count = await activeBadges.count();
    // All 3 FEW_CARDS are active
    expect(count).toBe(3);
  });

  test("fee_approaching cards show 'Fee Due Soon' badge", async ({ page }) => {
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, URGENT_CARDS);
    await page.reload({ waitUntil: "load" });

    // Spec: STATUS_LABELS.fee_approaching = "Fee Due Soon" (constants.ts)
    // Scope to "All" tab to avoid 5-tab duplication
    const allPanel = page.locator('[aria-labelledby="tab-all"]');
    const feeBadges = allPanel.locator('[aria-label="Card status: Fee Due Soon"]');
    const count = await feeBadges.count();
    // URGENT_CARDS has 3 fee_approaching cards
    expect(count).toBe(3);
  });

  test("promo_expiring cards show 'Promo Expiring' badge", async ({ page }) => {
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, URGENT_CARDS);
    await page.reload({ waitUntil: "load" });

    // Spec: STATUS_LABELS.promo_expiring = "Promo Expiring" (constants.ts)
    // Scope to "All" tab to avoid 5-tab duplication
    const allPanel = page.locator('[aria-labelledby="tab-all"]');
    const promoBadges = allPanel.locator('[aria-label="Card status: Promo Expiring"]');
    const count = await promoBadges.count();
    // URGENT_CARDS has 2 promo_expiring cards
    expect(count).toBe(2);
  });

});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5 — Card Tile Navigation Links
// ════════════════════════════════════════════════════════════════════════════

test.describe("Dashboard — Card Tile Links", () => {
  test("each card tile links to /cards/{id}/edit", async ({ page }) => {
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "load" });

    // Spec: CardTile.tsx wraps content in <Link href={`/cards/${card.id}/edit`}>
    // Each FEW_CARDS entry has a unique ID — verify the link pattern exists
    // Click "All" tab first since default tab is Howl or Active
    await page.locator('#tab-all').click();
    const allPanel = page.locator('[aria-labelledby="tab-all"]');
    for (const card of FEW_CARDS) {
      const tileLink = allPanel.locator(`a[href="/ledger/cards/${card.id}/edit"]`);
      await expect(tileLink).toBeVisible();
    }
  });

  test("clicking a card tile navigates to the correct edit URL", async ({
    page,
  }) => {
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "load" });

    const firstCard = FEW_CARDS[0]!;
    const tileLink = page.locator(`a[href="/ledger/cards/${firstCard.id}/edit"]`).first();
    await tileLink.click();

    // After click, URL must be the edit page for that specific card
    await page.waitForURL(`**/cards/${firstCard.id}/edit`);
    expect(page.url()).toContain(`/cards/${firstCard.id}/edit`);
  });

  test("Add Card button in header navigates to /cards/new", async ({ page }) => {
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "load" });

    // Spec: page.tsx renders <Link href="/ledger/cards/new">Add Card</Link> in the header
    const addCardBtn = page.locator('a[href="/ledger/cards/new"]').first();
    await expect(addCardBtn).toBeVisible();
    await addCardBtn.click();

    await page.waitForURL("**/cards/new");
    expect(page.url()).toContain("/ledger/cards/new");
  });
});
