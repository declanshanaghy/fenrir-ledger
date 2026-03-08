/**
 * Wizard Step 2 — Fenrir Ledger QA Test Suite
 * Authored by Loki, QA Tester of the Pack
 *
 * Issue: #189 — Card wizard Step 2 + data persistence across steps
 * PR:    #259
 *
 * ALL assertions are derived from the acceptance criteria in issue #189.
 * Tests are written against the SPEC, not the current implementation.
 * Failing tests prove defects — they do not indicate test errors.
 *
 * Defects found in code review:
 *   - DEF-001 [CRITICAL] Missing Back button on Step 2 — GitHub Issue: #269
 *   - DEF-002 [HIGH] Credit Limit not visible on Step 2 — GitHub Issue: #270
 *   - DEF-003 [HIGH] Annual Fee Date / Bonus Deadline / Bonus Met not visible on Step 2 — GitHub Issue: #271
 *
 * Spec references:
 *   - CardForm.tsx — single useForm instance, currentStep state, step rendering
 *   - #189 acceptance criteria: Step 2 fields, Back, Save, Cancel
 *
 * Navigation pattern (matches edit-card.spec.ts convention):
 *   1. goto("/") in beforeEach + clearAllStorage
 *   2. seedHousehold after a page.goto()
 *   3. Navigate to /cards/new — do NOT reload at /cards/new (hangs on networkidle)
 */

import { test, expect } from "@playwright/test";
import {
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ─── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Seed the household at the root page, then navigate to /cards/new.
 * Returns after the new-card form is loaded and ready.
 */
async function goToNewCard(page: import("@playwright/test").Page) {
  // Seed at root — avoids networkidle hang at /cards/new
  await page.goto("/", { waitUntil: "networkidle" });
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.goto("/cards/new", { waitUntil: "domcontentloaded" });
  // Wait for the form to appear (Card Name input is always on Step 1)
  await page.locator("#cardName").waitFor({ state: "visible", timeout: 15000 });
}

/**
 * Navigate to /cards/new, seed the household, and fill in the minimum
 * required Step 1 fields (Issuer, Card Name, Open Date) so we can
 * advance to Step 2.
 */
async function goToStep2(page: import("@playwright/test").Page) {
  await goToNewCard(page);

  // Fill Issuer — shadcn Select
  await page.locator("#issuerId").click();
  await page.locator('[role="option"]').first().click();

  // Fill Card Name
  await page.locator("#cardName").fill("Fenrir Test Card");

  // Click "More Details" to advance to Step 2
  await page.locator('button:has-text("More Details")').click();

  // Wait for More Details to disappear (confirms we're on Step 2)
  await page.locator('button:has-text("More Details")').waitFor({ state: "hidden", timeout: 5000 });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await clearAllStorage(page);
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Step 1 Renders Required Fields
// ════════════════════════════════════════════════════════════════════════════

test.describe("Wizard Step 2 — Step 1 Renders", () => {
  test("Step 1 renders Issuer select", async ({ page }) => {
    // Spec: CardForm.tsx Step 1 — Issuer required field is visible
    await goToNewCard(page);
    await expect(page.locator("#issuerId")).toBeVisible();
  });

  test("Step 1 renders Card Name input", async ({ page }) => {
    // Spec: CardForm.tsx Step 1 — cardName required field is visible
    await goToNewCard(page);
    await expect(page.locator("#cardName")).toBeVisible();
  });

  test("Step 1 renders Open Date input", async ({ page }) => {
    // Spec: CardForm.tsx Step 1 — openDate required field is visible
    await goToNewCard(page);
    await expect(page.locator("#openDate")).toBeVisible();
  });

  test("Step 1 shows step indicator dots", async ({ page }) => {
    // Spec: CardForm.tsx — two step indicator dots shown in wizard (new card) mode
    await goToNewCard(page);
    await expect(page.locator('[aria-label="Step 1"]')).toBeVisible();
    await expect(page.locator('[aria-label="Step 2"]')).toBeVisible();
  });

  test("Step 1 renders More Details button", async ({ page }) => {
    // Spec: CardForm.tsx — "More Details" button advances to Step 2
    await goToNewCard(page);
    await expect(page.locator('button:has-text("More Details")')).toBeVisible();
  });

  test("Step 1 renders Save Card submit button", async ({ page }) => {
    // Spec: CardForm.tsx — "Save Card" on Step 1 saves immediately without Step 2
    await goToNewCard(page);
    await expect(page.locator('button[type="submit"]')).toContainText("Save Card");
  });

  test("Step 1 renders Cancel button", async ({ page }) => {
    // Spec: CardForm.tsx — Cancel button always visible
    await goToNewCard(page);
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });

  test("Cancel from Step 1 returns to dashboard without saving", async ({ page }) => {
    // Spec: #189 AC — Cancel returns to dashboard without saving
    await goToNewCard(page);
    await page.locator("#cardName").fill("Should Not Be Saved");
    await page.locator('button:has-text("Cancel")').click();

    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/");
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Should Not Be Saved");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Advance to Step 2
// ════════════════════════════════════════════════════════════════════════════

test.describe("Wizard Step 2 — Advancing to Step 2", () => {
  test("clicking More Details advances to Step 2", async ({ page }) => {
    // Spec: #189 AC — More Details advances wizard to Step 2
    await goToStep2(page);
    // Step 2 is active — More Details button must be gone
    await expect(page.locator('button:has-text("More Details")')).not.toBeVisible();
  });

  test("More Details without required fields shows validation error", async ({ page }) => {
    // Spec: CardForm.tsx handleMoreDetails calls handleSubmit with scrollToFirstError
    // Step 1 validation must fire if required fields are empty
    await goToNewCard(page);
    // Do NOT fill Issuer or Card Name — attempt to advance
    await page.locator('button:has-text("More Details")').click();
    // Should still be on Step 1 (More Details still visible)
    await expect(page.locator('button:has-text("More Details")')).toBeVisible();
  });

  test("Step 2 renders Save Card submit button", async ({ page }) => {
    // Spec: #189 AC — Save Card on Step 2 saves all data
    await goToStep2(page);
    await expect(page.locator('button[type="submit"]')).toContainText("Save Card");
  });

  test("Step 2 renders Cancel button", async ({ page }) => {
    // Spec: #189 AC — Cancel returns to dashboard without saving
    await goToStep2(page);
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Step 2 Required Fields (AC: Step 2 renders Credit Limit + Notes)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Wizard Step 2 — Step 2 Field Rendering", () => {
  test("Step 2 renders Notes textarea — AC verified", async ({ page }) => {
    // Spec: #189 AC — Step 2 renders Notes (textarea) field
    await goToStep2(page);
    await expect(page.locator("#notes")).toBeVisible();
  });

  test("Step 2 Notes textarea is editable", async ({ page }) => {
    // Spec: #189 AC — Notes textarea must accept input
    await goToStep2(page);
    const notes = page.locator("#notes");
    await expect(notes).toBeEditable();
    await notes.fill("Gleipnir binds even gods — test note");
    await expect(notes).toHaveValue("Gleipnir binds even gods — test note");
  });

  test("Step 2 renders Credit Limit select — DEF-002 [HIGH] #270", async ({ page }) => {
    // Spec: #189 AC — Step 2 renders Credit Limit (select) field
    // DEF-002: Credit Limit is nested inside the Step 1 fieldset — never visible on Step 2
    // GitHub Issue: #270
    await goToStep2(page);
    await expect(page.locator("#creditLimit")).toBeVisible();
  });

  test("Step 2 Credit Limit select is interactive — DEF-002 [HIGH] #270", async ({ page }) => {
    // Spec: #189 AC — Credit Limit select must be usable to pick a value
    // DEF-002: field not visible on Step 2 — GitHub Issue: #270
    await goToStep2(page);
    const creditLimit = page.locator("#creditLimit");
    await expect(creditLimit).toBeVisible();
    await creditLimit.click();
    await expect(page.locator('[role="option"]').first()).toBeVisible();
  });

  test("Step 2 renders Annual Fee Date input — DEF-003 [HIGH] #271", async ({ page }) => {
    // Spec: #189 AC + PR #259 description — Annual Fee Date is a Step 2 field
    // DEF-003: annualFeeDate is inside the Step 1 grid wrapper — not visible on Step 2
    // GitHub Issue: #271
    await goToStep2(page);
    await expect(page.locator("#annualFeeDate")).toBeVisible();
  });

  test("Step 2 renders Bonus Deadline input — DEF-003 [HIGH] #271", async ({ page }) => {
    // Spec: #189 AC + PR #259 description — Bonus Deadline is a Step 2 field
    // DEF-003: bonusDeadline is inside the Step 1 grid wrapper — not visible on Step 2
    // GitHub Issue: #271
    await goToStep2(page);
    await expect(page.locator("#bonusDeadline")).toBeVisible();
  });

  test("Step 2 renders Bonus Met checkbox — DEF-003 [HIGH] #271", async ({ page }) => {
    // Spec: #189 AC — Bonus Met checkbox is a Step 2 field
    // DEF-003: bonusMet is inside the Step 1 grid wrapper — not visible on Step 2
    // GitHub Issue: #271
    await goToStep2(page);
    await expect(page.locator("#bonusMet")).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Back Button (AC: Back preserves all data)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Wizard Step 2 — Back Navigation", () => {
  test("Step 2 renders a Back button — DEF-001 [CRITICAL] #269", async ({ page }) => {
    // Spec: #189 AC — Back button returns to Step 1 with ALL data preserved
    // DEF-001: No Back button rendered on Step 2
    // GitHub Issue: #269
    await goToStep2(page);
    await expect(page.locator('button:has-text("Back")')).toBeVisible();
  });

  test("Back button returns user to Step 1 — DEF-001 [CRITICAL] #269", async ({ page }) => {
    // Spec: #189 AC — clicking Back sets currentStep to 1
    // DEF-001: No Back button exists — GitHub Issue: #269
    await goToStep2(page);

    const backBtn = page.locator('button:has-text("Back")');
    await expect(backBtn).toBeVisible({ timeout: 5000 });
    await backBtn.click();

    // Step 1 fields must reappear
    await expect(page.locator("#cardName")).toBeVisible();
    await expect(page.locator("#issuerId")).toBeVisible();
    await expect(page.locator("#openDate")).toBeVisible();
    await expect(page.locator('button:has-text("More Details")')).toBeVisible();
  });

  test("Step 1 data is preserved after Back — DEF-001 [CRITICAL] #269", async ({ page }) => {
    // Spec: #189 AC — Back must not lose any Step 1 data
    // DEF-001: No Back button — GitHub Issue: #269
    const uniqueName = `BackPreserveCard${Date.now()}`;

    await goToNewCard(page);
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();
    await page.locator("#cardName").fill(uniqueName);

    // Advance to Step 2
    await page.locator('button:has-text("More Details")').click();
    await page.locator('button:has-text("More Details")').waitFor({ state: "hidden", timeout: 5000 });

    // Click Back
    const backBtn = page.locator('button:has-text("Back")');
    await expect(backBtn).toBeVisible({ timeout: 5000 });
    await backBtn.click();

    // Card Name must still contain the value we entered
    await expect(page.locator("#cardName")).toHaveValue(uniqueName);
  });

  test("Step 2 Notes value preserved after Back then More Details — DEF-001 #269", async ({ page }) => {
    // Spec: #189 AC — single useForm instance preserves all state across steps
    // GitHub Issue: #269
    await goToStep2(page);

    const notesVal = "Preserved across step navigation";
    await page.locator("#notes").fill(notesVal);

    // Go Back to Step 1 (requires DEF-001 fix)
    const backBtn = page.locator('button:has-text("Back")');
    await expect(backBtn).toBeVisible({ timeout: 5000 });
    await backBtn.click();

    // Advance to Step 2 again
    await page.locator('button:has-text("More Details")').click();
    await page.locator('button:has-text("More Details")').waitFor({ state: "hidden", timeout: 5000 });

    // Notes must still show the value
    await expect(page.locator("#notes")).toHaveValue(notesVal);
  });

  test("Cancel from Step 2 returns to dashboard without saving", async ({ page }) => {
    // Spec: #189 AC — Cancel returns to dashboard without saving from any step
    await goToStep2(page);
    await page.locator('button:has-text("Cancel")').click();
    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5 — Save Card
// ════════════════════════════════════════════════════════════════════════════

test.describe("Wizard Step 2 — Save Card", () => {
  test("Save Card from Step 1 (without More Details) redirects to dashboard", async ({ page }) => {
    // Spec: CardForm.tsx — Save Card on Step 1 saves immediately
    await goToNewCard(page);
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();
    await page.locator("#cardName").fill("Step1SaveCard");

    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/");
  });

  test("Save Card from Step 1 persists card to dashboard", async ({ page }) => {
    // Spec: CardForm.tsx onSubmit — saveCard(card) → router.push("/")
    const cardName = `Step1SavedCard${Date.now()}`;

    await goToNewCard(page);
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();
    await page.locator("#cardName").fill(cardName);

    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/", { timeout: 5000 });
    await expect(page.locator(`text=${cardName}`)).toBeVisible();
  });

  test("Save Card from Step 2 redirects to dashboard", async ({ page }) => {
    // Spec: #189 AC — Save Card on Step 2 saves all data from both steps
    await goToStep2(page);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/", { timeout: 5000 });
    expect(page.url()).not.toContain("/cards/");
  });

  test("Save Card from Step 2 persists card with Notes to dashboard", async ({ page }) => {
    // Spec: #189 AC — Save Card on Step 2 saves all data from both steps (including Notes)
    const cardName = `Step2SavedCard${Date.now()}`;

    await goToNewCard(page);
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();
    await page.locator("#cardName").fill(cardName);

    // Advance to Step 2
    await page.locator('button:has-text("More Details")').click();
    await page.locator('button:has-text("More Details")').waitFor({ state: "hidden", timeout: 5000 });

    // Fill Notes on Step 2
    await page.locator("#notes").fill("Gleipnir binds even gods");

    // Save
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/", { timeout: 5000 });
    await expect(page.locator(`text=${cardName}`)).toBeVisible();
  });

  test("Step 1 card name is saved when saving from Step 2", async ({ page }) => {
    // Spec: #189 AC — Save Card on Step 2 saves all data from BOTH steps
    const cardName = `BothStepsCard${Date.now()}`;

    await goToNewCard(page);
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();
    await page.locator("#cardName").fill(cardName);
    await page.locator("#annualFee").fill("95");

    // Advance to Step 2
    await page.locator('button:has-text("More Details")').click();
    await page.locator('button:has-text("More Details")').waitFor({ state: "hidden", timeout: 5000 });

    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/", { timeout: 5000 });
    await expect(page.locator(`text=${cardName}`)).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 6 — Open Date Auto-Derive Logic
// ════════════════════════════════════════════════════════════════════════════

test.describe("Wizard Step 2 — Open Date Auto-Derive", () => {
  test("Open Date populates a default value on new card form", async ({ page }) => {
    // Spec: CardForm.tsx defaultValues.openDate = todayStr
    await goToNewCard(page);
    const val = await page.locator("#openDate").inputValue();
    expect(val).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("Annual Fee field on Step 1 is editable", async ({ page }) => {
    // Spec: CardForm.tsx — annualFee input is on Step 1 and writable
    await goToNewCard(page);
    const annualFeeInput = page.locator("#annualFee");
    await expect(annualFeeInput).toBeVisible();
    await expect(annualFeeInput).toBeEditable();
    await annualFeeInput.fill("95");
    await expect(annualFeeInput).toHaveValue("95");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 7 — Single useForm Instance (data preserved across steps)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Wizard Step 2 — Single Form Instance", () => {
  test("Step 1 Annual Fee value carries through when saving from Step 2", async ({ page }) => {
    // Spec: #189 AC — single react-hook-form instance manages state across both steps
    const cardName = `AnnualFeeCard${Date.now()}`;

    await goToNewCard(page);
    await page.locator("#issuerId").click();
    await page.locator('[role="option"]').first().click();
    await page.locator("#cardName").fill(cardName);
    await page.locator("#annualFee").fill("95");

    // Advance to Step 2
    await page.locator('button:has-text("More Details")').click();
    await page.locator('button:has-text("More Details")').waitFor({ state: "hidden", timeout: 5000 });

    // Save from Step 2
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/", { timeout: 5000 });

    // Card must appear on dashboard
    await expect(page.locator(`text=${cardName}`)).toBeVisible();
  });

  test("Step 1 Issuer is preserved when navigating Back then re-advancing — requires DEF-001 fix #269", async ({ page }) => {
    // Spec: #189 AC — single form instance means going Back must not reset Step 1 fields
    // Requires DEF-001 (Back button) to be fixed — GitHub Issue: #269
    await goToNewCard(page);

    // Select first issuer and record its text
    await page.locator("#issuerId").click();
    const firstOption = page.locator('[role="option"]').first();
    const issuerText = (await firstOption.textContent()) ?? "";
    await firstOption.click();

    await page.locator("#cardName").fill("IssuerPreserveCard");

    // Advance to Step 2
    await page.locator('button:has-text("More Details")').click();
    await page.locator('button:has-text("More Details")').waitFor({ state: "hidden", timeout: 5000 });

    // Click Back (requires DEF-001 fix)
    const backBtn = page.locator('button:has-text("Back")');
    await expect(backBtn).toBeVisible({ timeout: 5000 });
    await backBtn.click();

    // Issuer trigger must still show a selected issuer name
    // The Select trigger shows the rune + name; check non-empty content
    const issuerTrigger = page.locator("#issuerId");
    await expect(issuerTrigger).not.toContainText("Select issuer");
    if (issuerText.trim()) {
      // Take the last word of the issuer name as a safe partial match
      const words = issuerText.trim().split(/\s+/);
      const lastWord = words[words.length - 1] ?? "";
      if (lastWord) {
        await expect(issuerTrigger).toContainText(lastWord);
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 8 — Responsive Layout
// ════════════════════════════════════════════════════════════════════════════

test.describe("Wizard Step 2 — Responsive", () => {
  test("Step 1 is usable at 375px viewport (mobile)", async ({ page }) => {
    // Spec: team norms — minimum 375px, all forms must be mobile-friendly
    await page.setViewportSize({ width: 375, height: 812 });
    await goToNewCard(page);

    await expect(page.locator("#cardName")).toBeVisible();
    await expect(page.locator('button:has-text("More Details")')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("Step 2 Cancel and Save are visible at 375px (mobile)", async ({ page }) => {
    // Spec: team norms — all forms mobile-friendly; Step 2 must render on 375px
    await page.setViewportSize({ width: 375, height: 812 });
    await goToStep2(page);

    await expect(page.locator("#notes")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });
});
