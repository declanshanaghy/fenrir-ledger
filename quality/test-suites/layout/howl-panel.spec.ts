/**
 * HowlPanel Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates the HowlPanel component against the design spec:
 *   - Hidden when no urgent cards: no ᚲ bell and no "The Howl" header visible on desktop
 *   - Shows when urgent cards seeded: panel/bell appears with count
 *   - Urgent cards listed with card names and "days" remaining text
 *   - Most urgent first: card with fewer days remaining appears above card with more days
 *
 * Spec references:
 *   - development/frontend/src/components/layout/HowlPanel.tsx
 *   - AnimatedHowlPanel: desktop hidden lg:flex, only shown when hasUrgent
 *   - Mobile: bell button ᚲ in dashboard header (lg:hidden) when urgentCount > 0
 *   - UrgentRow: daysLabel shows "N days" for each urgent card
 *   - Sorted ascending by daysRemaining (fewest first = most urgent at top)
 *
 * Viewport strategy:
 *   - Desktop (1280px wide): desktop HowlPanel sidebar visible
 *   - Mobile (375px wide): desktop panel hidden; bell button (ᚲ) in header visible
 *
 * All assertions derived from the design spec — not from observed code output.
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
import { URGENT_CARDS } from "../helpers/seed-data";

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
// Suite: Hidden when no urgent cards (desktop viewport)
// ════════════════════════════════════════════════════════════════════════════

test.describe("HowlPanel — Hidden when no urgent cards (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("desktop HowlPanel is NOT visible when only active cards are seeded", async ({
    page,
  }) => {
    await setup(page, [
      makeCard({ cardName: "Calm Card A" }),
      makeCard({ cardName: "Calm Card B" }),
    ]);

    // Spec: AnimatedHowlPanel only renders hidden lg:flex div when hasUrgent.
    // When no urgent cards, AnimatePresence removes the motion.div from DOM.
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).not.toBeVisible();
  });

  test("mobile bell button (ᚲ) is NOT visible when only active cards are seeded", async ({
    page,
  }) => {
    await setup(page, [makeCard({ cardName: "Quiet Card" })]);

    // Spec: bell button in dashboard header is lg:hidden AND only rendered
    // when loaded && urgentCount > 0.  With zero urgent cards it never renders.
    const bellButton = page.locator(
      'button[aria-label*="urgent card"]'
    );
    await expect(bellButton).not.toBeAttached();
  });

  test("'The Howl' text is not visible on desktop with no urgent cards", async ({
    page,
  }) => {
    await setup(page, [makeCard({ cardName: "Silent Card" })]);

    // Spec: PanelHeader renders "The Howl" label only inside the HowlPanel aside.
    // Since the panel is removed from DOM when !hasUrgent, this text should be absent.
    const howlHeader = page.locator("text=The Howl");
    await expect(howlHeader).not.toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Shows when urgent cards exist (desktop viewport)
// ════════════════════════════════════════════════════════════════════════════

test.describe("HowlPanel — Shows with urgent cards (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("desktop HowlPanel aside is visible when URGENT_CARDS are seeded", async ({
    page,
  }) => {
    await setup(page, URGENT_CARDS);

    // Spec: AnimatedHowlPanel renders lg:flex motion.div when hasUrgent.
    // HowlPanel inside that div has aria-label="Urgent deadlines".
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible();
  });

  test("HowlPanel shows 'The Howl' heading when urgent cards exist (non-Ragnarok)", async ({
    page,
  }) => {
    // Use exactly 3 urgent cards — below the Ragnarök threshold of 5.
    // Spec: PanelHeader h2 text = "The Howl" when !ragnarokActive.
    // With ≥5 urgent cards Ragnarök activates and the heading changes to
    // "Ragnarök Approaches" — that is tested separately.
    await setup(page, [
      makeUrgentCard({ issuerId: "chase", cardName: "Below Threshold A" }),
      makeUrgentCard({ issuerId: "amex", cardName: "Below Threshold B" }),
      makePromoCard({ issuerId: "citibank", cardName: "Below Threshold C" }),
    ]);

    // Spec: PanelHeader h2 text = "The Howl" (when !ragnarokActive)
    await expect(page.locator("text=The Howl")).toBeVisible();
  });

  test("HowlPanel shows the ᚲ (Kenaz) rune in the panel header (non-Ragnarok)", async ({
    page,
  }) => {
    // Use 3 urgent cards — below the 5-card Ragnarök threshold.
    // Above threshold the rune changes to ᚠ (Fehu/fire) for Ragnarök mode.
    await setup(page, [
      makeUrgentCard({ issuerId: "chase", cardName: "Rune Test A" }),
      makeUrgentCard({ issuerId: "amex", cardName: "Rune Test B" }),
      makePromoCard({ issuerId: "citibank", cardName: "Rune Test C" }),
    ]);

    // Spec: PanelHeader renders ᚲ rune (torch) in normal mode
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toContainText("ᚲ");
  });

  test("HowlPanel shows 'Ragnarök Approaches' heading when ≥5 urgent cards (Ragnarök mode)", async ({
    page,
  }) => {
    // URGENT_CARDS has exactly 5 → triggers Ragnarök threshold (≥5)
    await setup(page, URGENT_CARDS);

    // Spec: PanelHeader h2 = "Ragnarök Approaches" when ragnarokActive
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible();
    await expect(howlPanel).toContainText("Ragnarök Approaches");
    // Spec: rune changes to ᚠ (Fehu) in Ragnarök mode
    await expect(howlPanel).toContainText("ᚠ");
  });

  test("urgent count badge shows the number of urgent cards", async ({ page }) => {
    await setup(page, URGENT_CARDS);

    // URGENT_CARDS has 5 cards: 3 fee_approaching + 2 promo_expiring
    // Spec: count badge data-slot="count" aria-label="{N} urgent cards"
    const countBadge = page.locator(
      '[aria-label="5 urgent cards"]'
    );
    await expect(countBadge).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Urgent cards listed with names and days remaining
// ════════════════════════════════════════════════════════════════════════════

test.describe("HowlPanel — Card names and days remaining", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("urgent card names appear in the HowlPanel", async ({ page }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Fee Due Immediately" }),
      makePromoCard({ cardName: "Bonus Expiring Soon" }),
    ]);

    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible();

    // Spec: UrgentRow renders card.cardName in p.font-heading
    await expect(howlPanel).toContainText("Fee Due Immediately");
    await expect(howlPanel).toContainText("Bonus Expiring Soon");
  });

  test("days remaining text is visible for urgent cards", async ({ page }) => {
    await setup(page, [makeUrgentCard({ cardName: "Days Test Card" })]);

    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible();

    // Spec: daysLabel format is "N days" (or "1 day" or "Overdue") displayed in
    // UrgentRow's days-remaining span (data-slot="count" inside a card row article).
    // makeUrgentCard sets annualFeeDate 30 days from now → "30 days"
    // Note: the panel header also has a data-slot="count" badge (the card count).
    // We target the days slot specifically within an article (card row).
    const cardRow = howlPanel.locator("article").first();
    await expect(cardRow).toBeVisible();
    const daysSlot = cardRow.locator('[data-slot="count"]');
    await expect(daysSlot).toBeVisible();
    const daysText = await daysSlot.textContent();
    expect(daysText).toMatch(/\d+\s+day|Overdue/);
  });

  test("type label 'Annual Fee' appears for fee_approaching cards", async ({
    page,
  }) => {
    await setup(page, [makeUrgentCard({ cardName: "Fee Label Card" })]);

    // Spec: UrgentRow typeLabel = "Annual Fee" when isFee = true
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toContainText("Annual Fee");
  });

  test("type label 'Promo Deadline' appears for promo_expiring cards", async ({
    page,
  }) => {
    await setup(page, [makePromoCard({ cardName: "Promo Label Card" })]);

    // Spec: UrgentRow typeLabel = "Promo Deadline" when !isFee
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toContainText("Promo Deadline");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Most urgent card appears first (sorting)
// ════════════════════════════════════════════════════════════════════════════

test.describe("HowlPanel — Sort order: most urgent first", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("card with fewer days remaining appears above card with more days remaining", async ({
    page,
  }) => {
    // Build two urgent cards with clearly different deadlines:
    //   Card A: 10 days (more urgent) — should appear FIRST
    //   Card B: 45 days (less urgent) — should appear SECOND
    // Spec: toUrgentRows sorts ascending by daysRemaining
    const urgentInTenDays = makeUrgentCard({
      cardName: "Urgent In Ten Days",
      annualFeeDate: new Date(
        Date.now() + 10 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });
    const urgentInFortyFiveDays = makeUrgentCard({
      cardName: "Urgent In Forty Five Days",
      annualFeeDate: new Date(
        Date.now() + 45 * 24 * 60 * 60 * 1000
      ).toISOString(),
    });

    await setup(page, [urgentInFortyFiveDays, urgentInTenDays]); // seeded in reverse order

    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible();

    // Get positions of the two card names within the panel
    const firstCardElem = howlPanel.locator('p.font-heading:has-text("Urgent In Ten Days")');
    const secondCardElem = howlPanel.locator('p.font-heading:has-text("Urgent In Forty Five Days")');

    await expect(firstCardElem).toBeVisible();
    await expect(secondCardElem).toBeVisible();

    const firstBox = await firstCardElem.boundingBox();
    const secondBox = await secondCardElem.boundingBox();

    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();

    // The 10-day card (more urgent) must appear above the 45-day card
    expect(firstBox!.y).toBeLessThan(secondBox!.y);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Mobile bell button (ᚲ)
// ════════════════════════════════════════════════════════════════════════════

test.describe("HowlPanel — Mobile bell button", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("ᚲ bell button is visible on mobile when urgent cards exist", async ({
    page,
  }) => {
    await setup(page, [makeUrgentCard({ cardName: "Mobile Urgent Card" })]);

    // Spec: mobile bell button is lg:hidden but visible on < lg viewports.
    // It renders only when loaded && urgentCount > 0.
    const bellButton = page.locator('button[aria-label*="urgent card"]');
    await expect(bellButton).toBeVisible();
  });

  test("ᚲ bell button shows the urgent count badge", async ({ page }) => {
    await setup(page, [
      makeUrgentCard({ cardName: "Mobile Fee Card A" }),
      makeUrgentCard({ cardName: "Mobile Fee Card B" }),
    ]);

    // Spec: badge span -top-1.5 -right-1.5 shows urgentCount
    const bellButton = page.locator('button[aria-label*="2 urgent"]');
    await expect(bellButton).toBeVisible();
  });

  test("bell button is NOT visible on mobile when only active cards seeded", async ({
    page,
  }) => {
    await setup(page, [makeCard({ cardName: "Quiet Mobile Card" })]);

    // Spec: button only rendered when urgentCount > 0
    const bellButton = page.locator('button[aria-label*="urgent card"]');
    await expect(bellButton).not.toBeAttached();
  });

  test("clicking bell button on mobile opens the HowlPanel bottom sheet", async ({
    page,
  }) => {
    await setup(page, [makeUrgentCard({ cardName: "Mobile Sheet Card" })]);

    const bellButton = page.locator('button[aria-label*="urgent card"]');
    await bellButton.click();

    // Spec: mobileOpen=true → AnimatedHowlPanel renders fixed bottom sheet.
    // The mobile sheet renders a second HowlPanel aside (the desktop panel
    // may also render even on mobile viewports when the component is mounted).
    // The mobile sheet has class "rounded-t-sm rounded-b-none" per AnimatedHowlPanel.
    // We target the mobile-specific aside with those rounded corner classes.
    const mobileSheet = page.locator('aside[aria-label="Urgent deadlines"].rounded-t-sm');
    await expect(mobileSheet).toBeVisible();

    // The seeded card should appear in the open sheet
    await expect(mobileSheet).toContainText("Mobile Sheet Card");
  });
});
