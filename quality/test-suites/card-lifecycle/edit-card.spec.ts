/**
 * Edit Card Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the /cards/[id]/edit page against the design spec.
 * Every assertion traces back to a specific requirement in CardForm.tsx,
 * the edit page page.tsx, or storage.ts (field persistence contract).
 *
 * Spec references:
 *   - /cards/[id]/edit page.tsx: heading = card.cardName, subtitle "Card record"
 *   - CardForm.tsx (edit mode): isEditMode = true, fields pre-populated from initialValues
 *   - CardForm.tsx: submit button reads "Save changes" in edit mode
 *   - CardForm.tsx: Cancel button calls router.push("/")
 *   - CardForm.tsx: onSubmit calls saveCard(card) then router.push("/")
 *   - storage.ts: saveCard() persists updated fields to localStorage
 *   - isoToLocalDateString(): converts stored ISO dates to YYYY-MM-DD for <input type="date">
 *
 * Data isolation: each test seeds its own card and clears storage first.
 */

import { test, expect } from "@playwright/test";
import {
  makeCard,
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
// Suite 1 — Pre-populated Fields
// ════════════════════════════════════════════════════════════════════════════

test.describe("Edit Card — Pre-populated Fields", () => {
  test("page heading shows the card name", async ({ page }) => {
    // Spec: /cards/[id]/edit page.tsx — h1 = {card.cardName}
    const card = makeCard({ cardName: "Odin's Reserve", issuerId: "chase" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const heading = page.locator("h1");
    await expect(heading).toContainText("Odin's Reserve");
  });

  test("page subtitle reads 'Card record'", async ({ page }) => {
    // Spec: /cards/[id]/edit page.tsx — subtitle p = "Card record"
    const card = makeCard({ cardName: "Thor's Hammer Card" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await expect(page.locator("text=Card record")).toBeVisible();
  });

  test("card name input is pre-populated with the stored card name", async ({
    page,
  }) => {
    // Spec: CardForm.tsx defaultValues.cardName = initialValues.cardName
    const card = makeCard({ cardName: "Freya's Folly" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const cardNameInput = page.locator("#cardName");
    await expect(cardNameInput).toHaveValue("Freya's Folly");
  });

  test("issuer dropdown shows the stored issuer", async ({ page }) => {
    // Spec: CardForm.tsx defaultValues.issuerId = initialValues.issuerId
    // The SelectTrigger renders the selected issuer name (not id) as its visible value
    const card = makeCard({ issuerId: "amex" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    // The SelectTrigger for issuerId should display "American Express"
    const issuerTrigger = page.locator("#issuerId");
    await expect(issuerTrigger).toContainText("American Express");
  });

  test("submit button reads 'Save changes' in edit mode", async ({ page }) => {
    // Spec: CardForm.tsx — isEditMode ? "Save changes" : "Add card"
    const card = makeCard();
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toContainText("Save changes");
  });

  test("unknown card ID redirects to dashboard", async ({ page }) => {
    // Spec: /cards/[id]/edit page.tsx — if !found, router.replace("/")
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto("/cards/nonexistent-id-that-does-not-exist/edit", {
      waitUntil: "networkidle",
    });

    // Must redirect to /
    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Edit and Save
// ════════════════════════════════════════════════════════════════════════════

test.describe("Edit Card — Save Changes", () => {
  test("updating card name and saving redirects to dashboard", async ({
    page,
  }) => {
    // Spec: CardForm.tsx onSubmit — saves card and calls router.push("/")
    const card = makeCard({ cardName: "Original Name" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator("#cardName").fill("Updated Name");
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/");
  });

  test("updated card name is visible on dashboard after save", async ({
    page,
  }) => {
    // Spec: saveCard() persists to localStorage; dashboard reads it on load
    const card = makeCard({ cardName: "Before Update" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const newName = `After Update ${Date.now()}`;
    await page.locator("#cardName").fill(newName);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/", { timeout: 5000 });

    // The dashboard must show the updated name
    await expect(page.locator(`text=${newName}`)).toBeVisible();
  });

  test("original card name no longer appears after rename", async ({ page }) => {
    // Guard: the old name must be replaced, not duplicated
    const originalName = "OriginalUniqueCardName";
    const card = makeCard({ cardName: originalName });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const newName = `RenamedUniqueCardName ${Date.now()}`;
    await page.locator("#cardName").fill(newName);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/", { timeout: 5000 });

    // Original name must NOT appear
    const body = await page.locator("body").innerText();
    expect(body).not.toContain(originalName);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Cancel Without Saving
// ════════════════════════════════════════════════════════════════════════════

test.describe("Edit Card — Cancel Without Saving", () => {
  test("Cancel button navigates to dashboard without saving changes", async ({
    page,
  }) => {
    // Spec: CardForm.tsx Cancel button → router.push("/")
    const card = makeCard({ cardName: "Do Not Change Me" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    // Dirty the form without saving
    await page.locator("#cardName").fill("Changed But Cancelled");

    const cancelBtn = page.locator('button:has-text("Cancel")');
    await cancelBtn.click();

    await page.waitForURL("**/", { timeout: 5000 });

    // Dashboard must still show the original name
    await expect(page.locator("text=Do Not Change Me")).toBeVisible();
  });

  test("browser back from edit page returns to dashboard", async ({ page }) => {
    const card = makeCard({ cardName: "Back Button Test" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);

    // Go to dashboard first so there is history
    await page.goto("/", { waitUntil: "networkidle" });
    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.goBack({ waitUntil: "networkidle" });

    // Wait for navigation to complete and check we're back on dashboard
    await page.waitForURL(/\/$/, { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/");
  });

  test("unsaved edits do not persist after cancel", async ({ page }) => {
    // Guard: localStorage must not be written when Cancel is clicked
    const originalName = "PersistenceTest Original";
    const card = makeCard({ cardName: originalName });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator("#cardName").fill("This Should Not Save");
    await page.locator('button:has-text("Cancel")').click();

    await page.waitForURL("**/", { timeout: 5000 });

    // Re-navigate to the edit page — original name must still be there
    await page.goto(`/cards/${card.id}/edit`, { waitUntil: "networkidle" });
    const cardNameInput = page.locator("#cardName");
    await expect(cardNameInput).toHaveValue(originalName);
  });
});
