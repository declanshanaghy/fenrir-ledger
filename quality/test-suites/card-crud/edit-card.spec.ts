/**
 * Card Edit Test Suite (card-crud) — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the /cards/[id]/edit page against the design spec.
 * Every assertion is sourced from CardForm.tsx and the edit page.tsx —
 * never from current implementation behaviour.
 *
 * Spec references:
 *   - /cards/[id]/edit page.tsx: h1 = card.cardName
 *   - /cards/[id]/edit page.tsx: subtitle p = "Card record"
 *   - CardForm.tsx (edit mode): isEditMode = true when initialValues is provided
 *   - CardForm.tsx: defaultValues.cardName = initialValues.cardName (pre-populated)
 *   - CardForm.tsx: defaultValues.issuerId = initialValues.issuerId (pre-populated)
 *   - CardForm.tsx: submit button text = "Save changes" in edit mode
 *   - CardForm.tsx: Cancel button calls router.push("/")
 *   - CardForm.tsx: onSubmit → saveCard(card) → router.push("/")
 *   - storage.ts: saveCard() persists updated fields to localStorage
 *   - CardForm.tsx: all text inputs (cardName, creditLimit, annualFee, notes) are editable
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
// Suite 1 — Form Renders with Pre-Populated Data
// ════════════════════════════════════════════════════════════════════════════

test.describe("Edit Card (card-crud) — Pre-populated Fields", () => {
  test("edit page heading shows the card name", async ({ page }) => {
    // Spec: /cards/[id]/edit page.tsx — h1 = {card.cardName}
    const card = makeCard({ cardName: "Mjolnir Mastercard" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const heading = page.locator("h1");
    await expect(heading).toContainText("Mjolnir Mastercard");
  });

  test("page subtitle reads 'Card record'", async ({ page }) => {
    // Spec: /cards/[id]/edit page.tsx — subtitle p = "Card record"
    const card = makeCard({ cardName: "Yggdrasil Visa" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await expect(page.locator("text=Card record")).toBeVisible();
  });

  test("card name input is pre-populated from stored card", async ({ page }) => {
    // Spec: CardForm.tsx — defaultValues.cardName = initialValues.cardName
    const card = makeCard({ cardName: "Bifrost Platinum" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const cardNameInput = page.locator("#cardName");
    await expect(cardNameInput).toHaveValue("Bifrost Platinum");
  });

  test("issuer dropdown shows the stored issuer", async ({ page }) => {
    // Spec: CardForm.tsx — defaultValues.issuerId = initialValues.issuerId
    // SelectTrigger renders the human-readable issuer name
    const card = makeCard({ issuerId: "amex" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const issuerTrigger = page.locator("#issuerId");
    await expect(issuerTrigger).toContainText("American Express");
  });

  test("submit button reads 'Save changes' in edit mode", async ({ page }) => {
    // Spec: CardForm.tsx — isEditMode ? "Save changes" : "Add card"
    const card = makeCard();
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toContainText("Save changes");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Form Fields Are Editable
// ════════════════════════════════════════════════════════════════════════════

test.describe("Edit Card (card-crud) — Editable Fields", () => {
  test("card name input is editable", async ({ page }) => {
    // Spec: CardForm.tsx — <Input id="cardName"> is not disabled in edit mode
    const card = makeCard({ cardName: "Before Edit" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const cardNameInput = page.locator("#cardName");
    await expect(cardNameInput).toBeEditable();
    await cardNameInput.fill("After Edit");
    await expect(cardNameInput).toHaveValue("After Edit");
  });

  test("notes field is editable", async ({ page }) => {
    // Spec: CardForm.tsx — <Textarea id="notes"> is present and editable
    const card = makeCard({ notes: "Original note" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const notesField = page.locator("#notes");
    await expect(notesField).toBeEditable();
    await notesField.fill("Updated note");
    await expect(notesField).toHaveValue("Updated note");
  });

  test("save button is present and not disabled by default", async ({ page }) => {
    // Spec: CardForm.tsx — submit button is enabled when form is valid with pre-populated data
    const card = makeCard();
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const saveBtn = page.locator('button[type="submit"]');
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeEnabled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Save Functionality
// ════════════════════════════════════════════════════════════════════════════

test.describe("Edit Card (card-crud) — Save", () => {
  test("saving card redirects to dashboard", async ({ page }) => {
    // Spec: CardForm.tsx onSubmit — calls saveCard(card) then router.push("/")
    const card = makeCard({ cardName: "Redirect Test Card" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/");
  });

  test("updated card name persists and appears on dashboard", async ({
    page,
  }) => {
    // Spec: saveCard() writes to localStorage; dashboard reads it on next load
    const card = makeCard({ cardName: "Name Before Save" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const updatedName = `Name After Save ${Date.now()}`;
    await page.locator("#cardName").fill(updatedName);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/", { timeout: 5000 });
    // Use first() — with 5-tab dashboard, the same card name can appear in
    // multiple tab panels (e.g. active tab + All tab), causing strict mode failures.
    await expect(page.locator(`text=${updatedName}`).first()).toBeVisible();
  });

  test("old card name is replaced (not duplicated) after rename", async ({
    page,
  }) => {
    // Guard: renaming must not leave a ghost copy of the old name
    const originalName = `OriginalCardCrud${Date.now()}`;
    const card = makeCard({ cardName: originalName });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const newName = `RenamedCardCrud${Date.now()}`;
    await page.locator("#cardName").fill(newName);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/", { timeout: 5000 });

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain(originalName);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Cancel Without Saving
// ════════════════════════════════════════════════════════════════════════════

test.describe("Edit Card (card-crud) — Cancel", () => {
  test("Cancel button is visible", async ({ page }) => {
    // Spec: CardForm.tsx — Cancel button always rendered in edit mode
    const card = makeCard();
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const cancelBtn = page.locator('button:has-text("Cancel")');
    await expect(cancelBtn).toBeVisible();
  });

  test("Cancel navigates to dashboard without saving", async ({ page }) => {
    // Spec: CardForm.tsx — Cancel button → router.push("/")
    const card = makeCard({ cardName: "Do Not Persist This" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator("#cardName").fill("This Should Be Discarded");
    await page.locator('button:has-text("Cancel")').click();

    await page.waitForURL("**/", { timeout: 5000 });
    // Original name must still show — the edit was never saved.
    // Use first() — with 5-tab dashboard, card names can appear in multiple panels.
    await expect(page.locator("text=Do Not Persist This").first()).toBeVisible();
  });

  test("unsaved field edits do not persist after cancel", async ({ page }) => {
    // Guard: localStorage must not be written when Cancel is clicked
    const originalName = "PersistGuard Original";
    const card = makeCard({ cardName: originalName });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    await page.locator("#cardName").fill("Discarded Edit");
    await page.locator('button:has-text("Cancel")').click();

    await page.waitForURL("**/", { timeout: 5000 });

    // Re-open edit page — original value must be intact
    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });
    const cardNameInput = page.locator("#cardName");
    await expect(cardNameInput).toHaveValue(originalName);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5 — Edge Cases
// ════════════════════════════════════════════════════════════════════════════

test.describe("Edit Card (card-crud) — Edge Cases", () => {
  test("unknown card ID redirects to dashboard", async ({ page }) => {
    // Spec: /cards/[id]/edit page.tsx — if !found, router.replace("/")
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.goto("/ledger/cards/totally-nonexistent-card-id-xyz/edit", {
      waitUntil: "networkidle",
    });

    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/");
  });

  test("edit form is responsive at 375px viewport", async ({ page }) => {
    // Spec: team norms — minimum 375px. Edit page must be usable on mobile.
    const card = makeCard({ cardName: "Mobile Responsive Card" });
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "networkidle" });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/ledger/cards/${card.id}/edit`, { waitUntil: "networkidle" });

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();

    const saveBtn = page.locator('button[type="submit"]');
    await expect(saveBtn).toBeVisible();
  });
});
