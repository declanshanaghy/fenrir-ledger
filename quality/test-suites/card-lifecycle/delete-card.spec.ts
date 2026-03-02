/**
 * Delete Card Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the card delete flow against the design spec, not implementation behaviour.
 * Deleting a card is a hard delete — the record is removed from localStorage
 * permanently and cannot be recovered. This is a destructive action and requires
 * confirmation via a dialog.
 *
 * Spec references:
 *   - CardForm.tsx (line 590): Delete card button rendered in edit mode (both
 *     active AND closed cards can be deleted)
 *   - CardForm.tsx Dialog: DialogTitle = "Delete this card?"
 *   - CardForm.tsx Dialog: DialogDescription mentions the card name + "cannot be undone"
 *   - CardForm.tsx handleDelete(): calls deleteCard(householdId, id) then router.push("/")
 *   - storage.ts deleteCard(): removes the card from the cards array entirely
 *   - Dashboard: card must not appear after deletion (no record preserved)
 *   - CardForm.tsx: closed cards (status === "closed") show Delete button only
 *     (no Close Card button), so delete-from-closed path is also covered here
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
// Suite 1 — Delete Button Visibility
// ════════════════════════════════════════════════════════════════════════════

test.describe("Delete Card — Button Visibility", () => {
  test("Delete card button is visible for an active card on its edit page", async ({
    page,
  }) => {
    // Spec: CardForm.tsx — Delete card button rendered in edit mode for non-closed cards
    const card = makeCard({ cardName: "Active Delete Target", status: "active" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    // The delete trigger button text is "Delete card" (lowercase d per CardForm.tsx)
    const deleteBtn = page.locator('button:has-text("Delete card")').first();
    await expect(deleteBtn).toBeVisible();
  });

  test("Delete card button is also visible for a closed card", async ({
    page,
  }) => {
    // Spec: CardForm.tsx — closed cards render Delete card button (no Close Card)
    const card = makeClosedCard({ cardName: "Closed Delete Target" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const deleteBtn = page.locator('button:has-text("Delete card")').first();
    await expect(deleteBtn).toBeVisible();
  });

  test("Delete card button is NOT present on the add card form", async ({
    page,
  }) => {
    // Spec: CardForm.tsx — isEditMode === false → delete button never rendered
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.goto("/cards/new", { waitUntil: "networkidle" });

    const deleteBtns = page.locator('button:has-text("Delete card")');
    await expect(deleteBtns).toHaveCount(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Delete Confirmation Dialog
// ════════════════════════════════════════════════════════════════════════════

test.describe("Delete Card — Confirmation Dialog", () => {
  test("clicking Delete card opens a dialog with 'Delete this card?' title", async ({
    page,
  }) => {
    // Spec: CardForm.tsx Dialog → <DialogTitle>Delete this card?</DialogTitle>
    const card = makeCard({ cardName: "Dialog Delete Test" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Delete card")').first().click();

    await expect(page.locator("text=Delete this card?")).toBeVisible();
  });

  test("delete dialog shows the card name in the description", async ({
    page,
  }) => {
    // Spec: CardForm.tsx Dialog description: "permanently remove {cardName} from your portfolio"
    const card = makeCard({ cardName: "Named Delete Card" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Delete card")').first().click();

    await expect(page.locator("text=Named Delete Card")).toBeVisible();
  });

  test("delete dialog mentions 'cannot be undone'", async ({ page }) => {
    // Spec: DialogDescription = "This cannot be undone." (destructive action warning)
    const card = makeCard({ cardName: "Undoable Warning Card" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Delete card")').first().click();

    await expect(page.locator("text=cannot be undone")).toBeVisible();
  });

  test("Cancel in delete dialog dismisses without deleting", async ({ page }) => {
    // Spec: Dialog footer Cancel → setDeleteDialogOpen(false)
    const card = makeCard({ cardName: "Cancel Delete Test" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Delete card")').first().click();
    await expect(page.locator("text=Delete this card?")).toBeVisible();

    // Click Cancel inside the dialog
    const dialogCancelBtn = page
      .locator('[role="dialog"] button:has-text("Cancel")')
      .first();
    await dialogCancelBtn.click();

    // Dialog must be dismissed
    await expect(page.locator("text=Delete this card?")).not.toBeVisible();
    // Still on the edit page — card was not deleted
    expect(page.url()).toContain(`/cards/${card.id}/edit`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Confirm Delete
// ════════════════════════════════════════════════════════════════════════════

test.describe("Delete Card — Confirm Action", () => {
  test("confirming delete redirects to dashboard", async ({ page }) => {
    // Spec: CardForm.tsx handleDelete() → deleteCard() + router.push("/")
    const card = makeCard({ cardName: "Card To Delete" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Delete card")').first().click();
    await expect(page.locator("text=Delete this card?")).toBeVisible();

    // Confirm delete — the confirm button in the dialog reads "Delete"
    const confirmBtn = page
      .locator('[role="dialog"] button:has-text("Delete")')
      .last();
    await confirmBtn.click();

    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/");
  });

  test("deleted card no longer appears on dashboard", async ({ page }) => {
    // Spec: storage.ts deleteCard() removes the card; dashboard re-reads on load
    const card = makeCard({ cardName: "Permanently Gone Card" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Delete card")').first().click();
    await expect(page.locator("text=Delete this card?")).toBeVisible();

    const confirmBtn = page
      .locator('[role="dialog"] button:has-text("Delete")')
      .last();
    await confirmBtn.click();

    await page.waitForURL("**/", { timeout: 5000 });

    // The card name must NOT appear anywhere on the dashboard
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Permanently Gone Card");
  });

  test("deleted card is removed from localStorage entirely", async ({
    page,
  }) => {
    // Spec: deleteCard() removes the card entry from the stored array
    const card = makeCard({ cardName: "Storage Delete Verify" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Delete card")').first().click();
    await expect(page.locator("text=Delete this card?")).toBeVisible();

    await page
      .locator('[role="dialog"] button:has-text("Delete")')
      .last()
      .click();

    await page.waitForURL("**/", { timeout: 5000 });

    // Verify directly in localStorage — card must not exist
    const found = await page.evaluate(
      ({ key, cardId }: { key: string; cardId: string }) => {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const cards = JSON.parse(raw) as Array<{ id: string }>;
        return cards.some((c) => c.id === cardId);
      },
      {
        key: `fenrir_ledger:${ANONYMOUS_HOUSEHOLD_ID}:cards`,
        cardId: card.id,
      }
    );

    expect(found).toBe(false);
  });

  test("deleting one card does not remove other cards", async ({ page }) => {
    // Guard: deleteCard() must only remove the targeted card
    const cardToDelete = makeCard({ cardName: "Delete This One" });
    const cardToKeep = makeCard({ cardName: "Keep This One" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [cardToDelete, cardToKeep]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${cardToDelete.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Delete card")').first().click();
    await expect(page.locator("text=Delete this card?")).toBeVisible();

    await page
      .locator('[role="dialog"] button:has-text("Delete")')
      .last()
      .click();

    await page.waitForURL("**/", { timeout: 5000 });

    // The kept card must still appear
    await expect(page.locator("text=Keep This One")).toBeVisible();
    // The deleted card must not
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Delete This One");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Cancel Delete Keeps Card
// ════════════════════════════════════════════════════════════════════════════

test.describe("Delete Card — Cancel Preserves Card", () => {
  test("cancelling delete dialog keeps card on dashboard", async ({ page }) => {
    // Guard: dismissing the dialog must not trigger deleteCard()
    const card = makeCard({ cardName: "Survived The Dialog" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Delete card")').first().click();
    await expect(page.locator("text=Delete this card?")).toBeVisible();

    await page
      .locator('[role="dialog"] button:has-text("Cancel")')
      .first()
      .click();

    // Navigate to dashboard and verify card is still there
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("text=Survived The Dialog")).toBeVisible();
  });

  test("card remains accessible via edit URL after cancel", async ({ page }) => {
    // Guard: navigating back to edit page after cancel must not 404 or redirect
    const card = makeCard({ cardName: "Still Editable After Cancel" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button:has-text("Delete card")').first().click();
    await expect(page.locator("text=Delete this card?")).toBeVisible();

    await page
      .locator('[role="dialog"] button:has-text("Cancel")')
      .first()
      .click();

    // Re-navigate to the same edit URL — should still load
    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });
    expect(page.url()).toContain(`/cards/${card.id}/edit`);

    // The card name must be pre-populated (not a redirect to /)
    await expect(page.locator("#cardName")).toHaveValue(
      "Still Editable After Cancel"
    );
  });
});
