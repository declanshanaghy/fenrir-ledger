/**
 * Close Card Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the card close flow against the design spec, not implementation behaviour.
 * Closing a card marks it status: "closed" with a closedAt timestamp and preserves
 * the record. It moves to Valhalla (/valhalla) and disappears from the dashboard.
 *
 * Spec references:
 *   - CardForm.tsx (line 558): Close Card button only rendered when
 *     isEditMode && initialValues?.status !== "closed"
 *   - CardForm.tsx Dialog: DialogTitle = "Close this card?"
 *   - CardForm.tsx Dialog: DialogDescription mentions the card name + "Closed Cards"
 *   - CardForm.tsx handleClose(): calls closeCard(householdId, id) then router.push("/")
 *   - storage.ts closeCard(): sets status = "closed", closedAt = now, preserves record
 *   - Dashboard.tsx: getCards() returns only non-closed cards (closed filter in storage)
 *   - CardForm.tsx: closed cards show Delete only — no Close Card button
 *
 * Data isolation: each test seeds its own card and clears storage.
 */

import { test, expect } from "@playwright/test";
import {
  makeCard,
  makeClosedCard,
  seedCards,
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ─── Shared setup ─────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await clearAllStorage(page);
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Close Card Button Visibility
// ════════════════════════════════════════════════════════════════════════════

test.describe("Close Card — Button Visibility", () => {
  test("Close Card button is visible on edit page for an active card", async ({
    page,
  }) => {
    // Spec: CardForm.tsx — Close Card rendered when isEditMode && status !== "closed"
    const card = makeCard({ cardName: "Active Card To Close", status: "active" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const closeBtn = page.locator('button:has-text("Close Card")').first();
    await expect(closeBtn).toBeVisible();
  });

  test("Close Card button is NOT present for an already-closed card", async ({
    page,
  }) => {
    // Spec: CardForm.tsx — Close Card only rendered when status !== "closed"
    // Closed cards show Delete only.
    const card = makeClosedCard({ cardName: "Already Closed Card" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const closeBtns = page.locator('button:has-text("Close Card")');
    await expect(closeBtns).toHaveCount(0);
  });

  test("Close Card button is NOT present on the add card form", async ({
    page,
  }) => {
    // Spec: CardForm.tsx — isEditMode === false for new cards; Close Card never shown
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.goto("/cards/new", { waitUntil: "networkidle" });

    const closeBtns = page.locator('button:has-text("Close Card")');
    await expect(closeBtns).toHaveCount(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Close Confirmation Dialog
// ════════════════════════════════════════════════════════════════════════════

test.describe("Close Card — Confirmation Dialog", () => {
  test("clicking Close Card opens a dialog with 'Close this card?' title", async ({
    page,
  }) => {
    // Spec: CardForm.tsx Dialog → <DialogTitle>Close this card?</DialogTitle>
    const card = makeCard({ cardName: "Dialog Test Card" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Close Card")').first().click();

    // Dialog must appear
    await expect(page.locator("text=Close this card?")).toBeVisible();
  });

  test("close dialog shows the card name in the description", async ({
    page,
  }) => {
    // Spec: CardForm.tsx Dialog description contains <strong>{initialValues?.cardName}</strong>
    const card = makeCard({ cardName: "Named Dialog Card" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Close Card")').first().click();

    // The card name must appear in the dialog description
    await expect(page.locator("text=Named Dialog Card")).toBeVisible();
  });

  test("close dialog has a Cancel button that dismisses without action", async ({
    page,
  }) => {
    // Spec: Dialog footer Cancel button → setCloseDialogOpen(false)
    const card = makeCard({ cardName: "Cancel Close Test" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Close Card")').first().click();
    await expect(page.locator("text=Close this card?")).toBeVisible();

    // Click Cancel in the dialog — NOT the form-level Cancel button
    // The dialog footer cancel is inside [role="dialog"]
    const dialogCancelBtn = page
      .locator('[role="dialog"] button:has-text("Cancel")')
      .first();
    await dialogCancelBtn.click();

    // Dialog must be dismissed — title no longer visible
    await expect(page.locator("text=Close this card?")).not.toBeVisible();
    // Still on the edit page
    expect(page.url()).toContain(`/cards/${card.id}/edit`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Confirm Close
// ════════════════════════════════════════════════════════════════════════════

test.describe("Close Card — Confirm Action", () => {
  test("confirming close redirects to dashboard", async ({ page }) => {
    // Spec: CardForm.tsx handleClose() → closeCard() + router.push("/")
    const card = makeCard({ cardName: "Card To Close" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Close Card")').first().click();
    await expect(page.locator("text=Close this card?")).toBeVisible();

    // Confirm the close via the dialog's confirm button
    const confirmBtn = page
      .locator('[role="dialog"] button:has-text("Close Card")')
      .last();
    await confirmBtn.click();

    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/");
  });

  test("closed card no longer appears in active dashboard grid", async ({
    page,
  }) => {
    // Spec: storage.ts getCards() filters out closed cards; Dashboard only receives active
    const card = makeCard({ cardName: "Soon To Be Closed" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Close Card")').first().click();
    await expect(page.locator("text=Close this card?")).toBeVisible();

    const confirmBtn = page
      .locator('[role="dialog"] button:has-text("Close Card")')
      .last();
    await confirmBtn.click();

    await page.waitForURL("**/", { timeout: 5000 });

    // The card name must NOT appear in the active dashboard
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Soon To Be Closed");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Cancel Close Keeps Card Active
// ════════════════════════════════════════════════════════════════════════════

test.describe("Close Card — Cancel Preserves Card", () => {
  test("cancelling close dialog keeps card visible on dashboard", async ({
    page,
  }) => {
    // Guard: closing the dialog without confirming must NOT change the card
    const card = makeCard({ cardName: "Should Remain Active" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Close Card")').first().click();
    await expect(page.locator("text=Close this card?")).toBeVisible();

    // Cancel the dialog
    const dialogCancelBtn = page
      .locator('[role="dialog"] button:has-text("Cancel")')
      .first();
    await dialogCancelBtn.click();

    // Navigate back to dashboard manually to verify the card is still there
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("text=Should Remain Active")).toBeVisible();
  });

  test("cancelling close leaves the card status unchanged (still active)", async ({
    page,
  }) => {
    // Guard: localStorage must still have status: "active" after cancel
    const card = makeCard({ cardName: "Status Must Stay Active", status: "active" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Close Card")').first().click();
    await expect(page.locator("text=Close this card?")).toBeVisible();

    await page
      .locator('[role="dialog"] button:has-text("Cancel")')
      .first()
      .click();

    // Read status directly from localStorage — must still be "active"
    const storedStatus = await page.evaluate(
      ({ key, cardId }: { key: string; cardId: string }) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const cards = JSON.parse(raw) as Array<{ id: string; status: string }>;
        return cards.find((c) => c.id === cardId)?.status ?? null;
      },
      {
        key: `fenrir_ledger:${ANONYMOUS_HOUSEHOLD_ID}:cards`,
        cardId: card.id,
      }
    );

    expect(storedStatus).toBe("active");
  });
});
