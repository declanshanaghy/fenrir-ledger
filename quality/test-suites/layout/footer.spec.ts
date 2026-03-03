/**
 * Footer Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates the Footer component against the design spec:
 *   - Footer brand: "ᛟ FENRIR LEDGER" button visible
 *   - Footer tagline: "Break free. Harvest every reward. Let no chain hold."
 *   - Copyright year: "© 2026 Fenrir Ledger"
 *   - About modal: clicking "ᛟ FENRIR LEDGER" opens AboutModal
 *   - Team credits in About modal: Freya, Luna, FiremanDecko, Loki visible
 *
 * Spec references:
 *   - development/frontend/src/components/layout/Footer.tsx
 *   - development/frontend/src/components/layout/AboutModal.tsx
 *   - TEAM constant: Freya (Product Owner), Luna (UX Designer),
 *     FiremanDecko (Principal Engineer), Loki (QA)
 *
 * All assertions derived from the design spec — not from observed code output.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ════════════════════════════════════════════════════════════════════════════
// Setup
// ════════════════════════════════════════════════════════════════════════════

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.reload({ waitUntil: "load" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Footer brand and tagline
// ════════════════════════════════════════════════════════════════════════════

test.describe("Footer — Brand identity", () => {
  test("'ᛟ FENRIR LEDGER' button is visible in the footer", async ({ page }) => {
    // Spec: <button aria-label="About Fenrir Ledger">ᛟ FENRIR LEDGER</button>
    const footerBrand = page.locator(
      'footer button[aria-label="About Fenrir Ledger"]'
    );
    await expect(footerBrand).toBeVisible();
    await expect(footerBrand).toContainText("ᛟ FENRIR LEDGER");
  });

  test("full tagline 'Break free. Harvest every reward. Let no chain hold.' is in the footer", async ({
    page,
  }) => {
    // Spec: the <span> after the brand button contains the full tagline
    const footer = page.locator("footer").first();
    await expect(footer).toContainText(
      "Break free. Harvest every reward. Let no chain hold."
    );
  });

  test("footer tagline does NOT include 'Let no chain hold.' in the TopBar", async ({
    page,
  }) => {
    // Devil's Advocate: ensure "Let no chain hold." is exclusive to the footer.
    // TopBar tagline is "Break free. Harvest every reward." (no third clause).
    const header = page.locator("header").first();
    const headerText = await header.textContent();
    expect(headerText).not.toContain("Let no chain hold.");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Copyright notice
// ════════════════════════════════════════════════════════════════════════════

test.describe("Footer — Copyright", () => {
  test("footer shows '© 2026 Fenrir Ledger'", async ({ page }) => {
    // Spec: <span>© 2026 Fenrir Ledger</span> — current year per product spec
    const footer = page.locator("footer").first();
    await expect(footer).toContainText("2026 Fenrir Ledger");
  });

  test("© symbol is present with data-gleipnir='breath-of-a-fish' attribute", async ({
    page,
  }) => {
    // Spec: Easter egg #5 — copyright symbol is the Gleipnir Fragment 5 trigger
    const copyrightSpan = page.locator('[data-gleipnir="breath-of-a-fish"]');
    await expect(copyrightSpan).toBeAttached();
    await expect(copyrightSpan).toContainText("©");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Team colophon
// ════════════════════════════════════════════════════════════════════════════

test.describe("Footer — Team colophon", () => {
  test("team credits mention FiremanDecko, Freya, and Loki in the footer", async ({
    page,
  }) => {
    // Spec: "Forged by FiremanDecko · Guarded by Freya · Tested by Loki"
    const footer = page.locator("footer").first();
    await expect(footer).toContainText("FiremanDecko");
    await expect(footer).toContainText("Freya");
    await expect(footer).toContainText("Loki");
  });

  test("Loki element has data-loki-trigger attribute", async ({ page }) => {
    // Spec: Loki trigger element in footer colophon for Easter Egg #3 (Loki Mode)
    const lokiTrigger = page.locator("[data-loki-trigger]");
    await expect(lokiTrigger).toBeAttached();
    await expect(lokiTrigger).toContainText("Loki");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: About modal — opens from footer
// ════════════════════════════════════════════════════════════════════════════

test.describe("Footer — About modal", () => {
  test("clicking 'ᛟ FENRIR LEDGER' button opens the About modal", async ({
    page,
  }) => {
    // Spec: onClick={() => setAboutOpen(true)} in Footer component
    const footerBrand = page.locator(
      'footer button[aria-label="About Fenrir Ledger"]'
    );
    await footerBrand.click();

    // AboutModal uses Dialog with DialogTitle "About Fenrir Ledger"
    const aboutModal = page.locator('[role="dialog"]').filter({
      has: page.locator('[id^="radix-"]'),
    });
    // Simpler: check the dialog title is visible
    const dialogTitle = page.locator('text="About Fenrir Ledger"').first();
    await expect(dialogTitle).toBeVisible();
  });

  test("About modal contains all four team members: Freya, Luna, FiremanDecko, Loki", async ({
    page,
  }) => {
    // Spec: TEAM constant in AboutModal.tsx has all 4 members
    const footerBrand = page.locator(
      'footer button[aria-label="About Fenrir Ledger"]'
    );
    await footerBrand.click();

    // Wait for the dialog to open
    await expect(page.locator('text="About Fenrir Ledger"').first()).toBeVisible();

    // All four team names must appear in the modal
    const dialog = page.locator('[role="dialog"]').last();
    await expect(dialog).toContainText("Freya");
    await expect(dialog).toContainText("Luna");
    await expect(dialog).toContainText("FiremanDecko");
    await expect(dialog).toContainText("Loki");
  });

  test("About modal shows team roles", async ({ page }) => {
    // Spec: each TEAM member has a role — Product Owner, UX Designer, etc.
    const footerBrand = page.locator(
      'footer button[aria-label="About Fenrir Ledger"]'
    );
    await footerBrand.click();

    await expect(page.locator('text="About Fenrir Ledger"').first()).toBeVisible();

    const dialog = page.locator('[role="dialog"]').last();
    await expect(dialog).toContainText("Product Owner");
    await expect(dialog).toContainText("UX Designer");
    await expect(dialog).toContainText("Principal Engineer");
    await expect(dialog).toContainText("QA");
  });

  test("About modal shows Gleipnir ingredients section", async ({ page }) => {
    // Spec: "Gleipnir was made of:" section with all 6 impossible things
    const footerBrand = page.locator(
      'footer button[aria-label="About Fenrir Ledger"]'
    );
    await footerBrand.click();

    await expect(page.locator('text="About Fenrir Ledger"').first()).toBeVisible();

    const dialog = page.locator('[role="dialog"]').last();
    await expect(dialog).toContainText("Gleipnir was made of:");
    await expect(dialog).toContainText("The sound of a cat's footfall");
    await expect(dialog).toContainText("The beard of a woman");
    await expect(dialog).toContainText("The roots of a mountain");
    await expect(dialog).toContainText("The sinews of a bear");
    await expect(dialog).toContainText("The breath of a fish");
    await expect(dialog).toContainText("The spittle of a bird");
  });

  test("About modal can be closed with the Close button", async ({ page }) => {
    // Spec: DialogClose asChild with a Close button in the footer of the dialog
    const footerBrand = page.locator(
      'footer button[aria-label="About Fenrir Ledger"]'
    );
    await footerBrand.click();

    await expect(page.locator('text="About Fenrir Ledger"').first()).toBeVisible();

    // Click the explicit "Close" button in the dialog footer.
    // Radix DialogContent also renders an X close button with aria-label="Close",
    // which matches :has-text("Close"). Use the first match — the footer button
    // is first in DOM order within the dialog's flex layout.
    const closeButton = page.locator('[role="dialog"] button:has-text("Close")').first();
    await closeButton.click();

    // Dialog should be gone
    await expect(
      page.locator('text="About Fenrir Ledger"').first()
    ).not.toBeVisible();
  });

  test("About modal can be closed by pressing Escape", async ({ page }) => {
    // Spec: radix-ui Dialog dismisses on Escape by default
    const footerBrand = page.locator(
      'footer button[aria-label="About Fenrir Ledger"]'
    );
    await footerBrand.click();

    await expect(page.locator('text="About Fenrir Ledger"').first()).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(
      page.locator('text="About Fenrir Ledger"').first()
    ).not.toBeVisible();
  });
});
