/**
 * Add Card Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the /cards/new flow against the design spec, not the implementation.
 * Every assertion is sourced from CardForm.tsx (Zod schema + JSX), constants.ts
 * (KNOWN_ISSUERS), and the product spec (required fields, redirect on save).
 *
 * Spec references:
 *   - CardForm.tsx Zod schema: issuerId required, cardName required, openDate required
 *   - CardForm.tsx onSubmit: calls router.push("/") on success
 *   - CardForm.tsx: Cancel button calls router.push("/")
 *   - constants.ts KNOWN_ISSUERS: the authoritative issuer list
 *   - page.tsx (/cards/new): heading "Forge a New Chain"
 *   - page.tsx (/cards/new): form rendered once status !== "loading" && householdId
 *
 * Data isolation: clearAllStorage() is called before each test. seedHousehold()
 * ensures the app has a valid householdId before the form loads.
 */

import { test, expect } from "@playwright/test";
import {
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ─── Shared setup ─────────────────────────────────────────────────────────────
// Every add-card test starts from a clean state with a known household.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  // Navigate directly — no card data needed for the add form
  await page.goto("/cards/new", { waitUntil: "networkidle" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Form Structure
// ════════════════════════════════════════════════════════════════════════════

test.describe("Add Card — Form Loads", () => {
  test("page heading is 'Forge a New Chain'", async ({ page }) => {
    // Spec: /cards/new page.tsx h1 = "Forge a New Chain" (Voice 2: atmospheric)
    const heading = page.locator("h1");
    await expect(heading).toContainText("Forge a New Chain");
  });

  test("issuer dropdown is present", async ({ page }) => {
    // Spec: CardForm.tsx — <SelectTrigger id="issuerId"> with "Select issuer" placeholder
    const issuerTrigger = page.locator("#issuerId");
    await expect(issuerTrigger).toBeVisible();
  });

  test("card name input is present", async ({ page }) => {
    // Spec: CardForm.tsx — <Input id="cardName" placeholder="e.g. Sapphire Preferred">
    const cardNameInput = page.locator("#cardName");
    await expect(cardNameInput).toBeVisible();
  });

  test("open date input is present", async ({ page }) => {
    // Spec: CardForm.tsx — <Input id="openDate" type="date">
    const openDateInput = page.locator("#openDate");
    await expect(openDateInput).toBeVisible();
  });

  test("submit button reads 'Add card' (not 'Save changes') for new card", async ({
    page,
  }) => {
    // Spec: CardForm.tsx — isEditMode ? "Save changes" : "Add card"
    // In new-card mode isEditMode === false
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toContainText("Add card");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Validation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Add Card — Validation Errors", () => {
  test("submitting empty form shows issuer validation error", async ({
    page,
  }) => {
    // Clear the auto-populated openDate so all required fields are empty
    await page.locator("#openDate").fill("");

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Spec: cardFormSchema — issuerId: z.string().min(1, "Issuer is required")
    // Note: issuerId is not in useForm defaultValues for new cards (only
    // openDate, annualFeeDate, etc. are pre-populated). RHF treats the
    // unregistered Select as undefined → Zod's z.string() fires with its
    // default message "Required" before the .min(1) custom message.
    // A <p class="text-destructive"> appears below the issuer trigger.
    const issuerError = page.locator("#issuerId ~ p.text-destructive, #issuerId + p.text-destructive").first();
    await expect(issuerError).toBeVisible();
  });

  test("submitting empty form shows 'Card name is required' error", async ({
    page,
  }) => {
    await page.locator("#openDate").fill("");
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Spec: cardFormSchema — cardName: z.string().min(1, "Card name is required")
    await expect(page.locator("text=Card name is required")).toBeVisible();
  });

  test("submitting empty form shows 'Open date is required' error", async ({
    page,
  }) => {
    await page.locator("#openDate").fill("");
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Spec: cardFormSchema — openDate: z.string().min(1, "Open date is required")
    await expect(page.locator("text=Open date is required")).toBeVisible();
  });

  test("providing issuer, name, and date clears all required-field errors", async ({
    page,
  }) => {
    // Fill only the required fields
    await page.locator("#issuerId").click();
    // Select first option (American Express) from the dropdown
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill("Test Validation Card");
    await page.locator("#openDate").fill("2024-01-15");

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // After a valid submission the form should navigate away — no error messages
    // should remain visible. We check by waiting for URL change.
    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/new");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Successful Card Creation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Add Card — Successful Creation", () => {
  test("saving a valid card redirects to dashboard (/)", async ({ page }) => {
    // Spec: CardForm.tsx onSubmit calls router.push("/") on success
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill("Saga Test Card");
    await page.locator("#openDate").fill("2024-06-01");

    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/new");
  });

  test("new card appears on dashboard after creation", async ({ page }) => {
    const uniqueName = `QA Card ${Date.now()}`;

    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill(uniqueName);
    await page.locator("#openDate").fill("2024-06-01");

    await page.locator('button[type="submit"]').click();

    await page.waitForURL("**/", { timeout: 5000 });

    // The card name must be visible on the dashboard after creation
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible();
  });

  test("saved card tile links to /cards/{id}/edit on dashboard", async ({
    page,
  }) => {
    const uniqueName = `Edit Link Card ${Date.now()}`;

    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();

    await page.locator("#cardName").fill(uniqueName);
    await page.locator("#openDate").fill("2024-06-01");

    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/", { timeout: 5000 });

    // After redirect, the card tile must exist with a link to an edit page
    const editLinks = page.locator('a[href*="/cards/"][href*="/edit"]');
    const count = await editLinks.count();
    expect(count).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Issuer Dropdown Options
// ════════════════════════════════════════════════════════════════════════════

test.describe("Add Card — Issuer Dropdown", () => {
  test("issuer dropdown contains Chase", async ({ page }) => {
    // Spec: KNOWN_ISSUERS (constants.ts) includes { id: "chase", name: "Chase" }
    await page.locator("#issuerId").click();
    // Scope to [role="option"] to avoid strict-mode clash with hidden native <option>
    await expect(page.locator('[role="option"]:has-text("Chase")')).toBeVisible();
  });

  test("issuer dropdown contains American Express", async ({ page }) => {
    // Spec: KNOWN_ISSUERS includes { id: "amex", name: "American Express" }
    await page.locator("#issuerId").click();
    await expect(page.locator('[role="option"]:has-text("American Express")')).toBeVisible();
  });

  test("issuer dropdown contains Capital One", async ({ page }) => {
    // Spec: KNOWN_ISSUERS includes { id: "capital_one", name: "Capital One" }
    await page.locator("#issuerId").click();
    await expect(page.locator('[role="option"]:has-text("Capital One")')).toBeVisible();
  });

  test("issuer dropdown contains Citibank", async ({ page }) => {
    // Spec: KNOWN_ISSUERS includes { id: "citibank", name: "Citibank" }
    await page.locator("#issuerId").click();
    await expect(page.locator('[role="option"]:has-text("Citibank")')).toBeVisible();
  });

  test("issuer dropdown contains Discover", async ({ page }) => {
    // Spec: KNOWN_ISSUERS includes { id: "discover", name: "Discover" }
    await page.locator("#issuerId").click();
    await expect(page.locator('[role="option"]:has-text("Discover")')).toBeVisible();
  });

  test("issuer dropdown contains Wells Fargo", async ({ page }) => {
    // Spec: KNOWN_ISSUERS includes { id: "wells_fargo", name: "Wells Fargo" }
    await page.locator("#issuerId").click();
    await expect(page.locator('[role="option"]:has-text("Wells Fargo")')).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5 — Cancel / Back Navigation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Add Card — Cancel Navigation", () => {
  test("Cancel button navigates back to dashboard", async ({ page }) => {
    // Spec: CardForm.tsx — Cancel <Button> calls router.push("/")
    const cancelBtn = page.locator('button:has-text("Cancel")');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/new");
  });

  test("browser back button returns to dashboard from /cards/new", async ({
    page,
  }) => {
    // Navigate to dashboard first so we have history
    await page.goto("/", { waitUntil: "networkidle" });
    await page.goto("/cards/new", { waitUntil: "networkidle" });

    await page.goBack({ waitUntil: "networkidle" });
    expect(page.url()).not.toContain("/cards/new");
  });
});
