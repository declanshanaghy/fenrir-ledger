/**
 * Accessibility Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests derived from WCAG 2.1 AA requirements and the Fenrir Ledger
 * product design brief. Every assertion is grounded in the spec —
 * not in what the code currently does.
 *
 * Covers:
 *   - Page landmark structure (main, nav, footer, header)
 *   - Heading hierarchy on each route
 *   - Form field labelling and required-field marking
 *   - Keyboard navigation: Tab order and Enter activation
 *   - Screen reader support: status badge text, aria-live regions
 *
 * Seeding pattern: all card data is written to localStorage before
 * page.reload() so the app reads the expected state on first render.
 *
 * NOTE: baseURL is provided by playwright.config.ts.
 * Tests use page.goto(path) — no hardcoded host or port.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  seedCards,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";
import { FEW_CARDS, URGENT_CARDS } from "../helpers/seed-data";

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Page Landmarks
// ════════════════════════════════════════════════════════════════════════════

test.describe("Page Landmarks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "networkidle" });
  });

  test("TC-A01: main landmark exists on dashboard", async ({ page }) => {
    // Spec: every page must have a <main> landmark so assistive technology
    // can skip directly to the primary content region.
    const main = page.locator("main");
    await expect(main).toBeAttached();
    await expect(main).toBeVisible();
  });

  test("TC-A02: navigation landmark exists on dashboard", async ({ page }) => {
    // Spec: the SideNav renders an <aside> containing a <nav> element.
    // Screen readers expose <nav> as the "navigation" landmark role.
    const nav = page.locator("nav");
    await expect(nav).toBeAttached();
    await expect(nav).toBeVisible();
  });

  test("TC-A03: footer landmark exists on dashboard", async ({ page }) => {
    // Spec: Footer renders <footer role="contentinfo"> per Footer.tsx.
    // role="contentinfo" is the ARIA equivalent of <footer> at page level.
    const footer = page.locator("footer[role='contentinfo'], [role='contentinfo']");
    await expect(footer).toBeAttached();
    await expect(footer).toBeVisible();
  });

  test("TC-A04: header landmark exists on dashboard", async ({ page }) => {
    // Spec: TopBar renders a <header> element.
    // role="banner" is the ARIA equivalent exposed by <header> at page level.
    const header = page.locator("header");
    await expect(header).toBeAttached();
    await expect(header).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Heading Hierarchy
// ════════════════════════════════════════════════════════════════════════════

test.describe("Heading Hierarchy", () => {
  test("TC-A05: dashboard has h1 with correct text", async ({ page }) => {
    // Spec (page.tsx): h1 renders "The Ledger of Fates" — Voice 2 atmospheric
    // heading from copywriting.md. Per WCAG 2.4.6 (AA), the page must have
    // a descriptive heading that identifies its purpose.
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "networkidle" });

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("The Ledger of Fates");
  });

  test("TC-A06: Valhalla route redirects to dashboard with accessible heading", async ({ page }) => {
    // Spec (valhalla/page.tsx): the /valhalla route now redirects to /?tab=valhalla
    // (the standalone Valhalla page was merged into the dashboard in Issue #352).
    // Per WCAG 2.4.6 (AA), the page must have a descriptive h1 — provided by the
    // dashboard h1 "The Ledger of Fates". The Valhalla content is accessible via
    // the tabbed dashboard interface.
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.goto("/valhalla");
    await page.waitForURL(/\//);

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("The Ledger of Fates");
  });

  test("TC-A07: add card page has a heading", async ({ page }) => {
    // Spec (cards/new/page.tsx): the new card page renders an h1 "Forge a New Chain".
    // Per WCAG 2.4.6 (AA), a descriptive heading must be present.
    await page.goto("/ledger/cards/new");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    // Wait for the form to render — it's gated behind status !== "loading"
    const heading = page.locator("h1, h2, h3").first();
    await expect(heading).toBeAttached();
    const text = await heading.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Form Accessibility
// ════════════════════════════════════════════════════════════════════════════

test.describe("Form Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });
    // Navigate to the add card form
    await page.goto("/ledger/cards/new");
    // Wait for the form to appear (gated behind auth status resolution)
    await page.waitForSelector("form", { timeout: 5000 });
  });

  test("TC-A08: card form fields have associated labels", async ({ page }) => {
    // Spec (CardForm.tsx): every input must be wrapped with a <Label> whose
    // htmlFor matches the input id. This satisfies WCAG 1.3.1 (A) and 2.4.6 (AA).
    //
    // Fields verified: cardName, openDate, annualFee, annualFeeDate, bonusAmount,
    // bonusDeadline. The issuer and creditLimit selects use id on the SelectTrigger.
    //
    // Each label-input pair is verified by checking the label's for= attribute
    // matches the target element's id attribute.
    //
    // Note: CardForm in new-card mode uses a 2-step wizard. Step 1 shows cardName,
    // openDate, and annualFee. Step 2 shows annualFeeDate, bonusAmount, and bonusDeadline.
    // This test verifies Step 1 fields on the /cards/new form, which is all that's visible
    // without navigating the wizard steps.

    // Verify Step 1 form fields (visible on the /cards/new page by default)
    // In new-card mode, CardForm displays Step 1 with: issuerId, cardName, openDate,
    // annualFee, and bonusType. Step 2 fields (annualFeeDate, bonusDeadline) are only
    // rendered when currentStep === 2 or in edit mode, so they're not present on Step 1.
    const step1Pairs: Array<{ labelFor: string; inputId: string }> = [
      { labelFor: "issuerId", inputId: "issuerId" },
      { labelFor: "cardName", inputId: "cardName" },
      { labelFor: "openDate", inputId: "openDate" },
      { labelFor: "annualFee", inputId: "annualFee" },
      { labelFor: "bonusType", inputId: "bonusType" },
    ];

    for (const { labelFor, inputId } of step1Pairs) {
      // Label must exist with the correct for= attribute
      const label = page.locator(`label[for="${labelFor}"]`);
      await expect(label).toBeAttached();

      // The referenced input/element must exist
      const input = page.locator(`#${inputId}`);
      await expect(input).toBeAttached();
    }
  });

  test("TC-A09: required fields have required or aria-required attribute [KNOWN DEFECT DEF-A01]", async ({ page }) => {
    // Spec (WCAG 1.3.5 AA, CardForm.tsx): required fields must be programmatically
    // identifiable via the HTML required attribute or aria-required="true".
    // CardForm marks issuerId, cardName, and openDate as required (asterisk in label,
    // Zod min(1) validation).
    //
    // KNOWN DEFECT DEF-A01: react-hook-form with zodResolver does NOT inject the
    // HTML `required` attribute or `aria-required` onto native inputs. Validation
    // fires on submit only. This means screen readers cannot announce these fields
    // as required before the user submits the form — a WCAG 1.3.5 (AA) violation.
    //
    // This test documents the defect: it asserts the SPEC requirement and will fail
    // until CardForm adds required={true} or aria-required="true" to the fields.
    // Fix: add `required` to the <Input> elements for cardName and openDate, and
    // aria-required="true" to the SelectTrigger for issuerId.

    // cardName — text input registered with RHF
    const cardNameInput = page.locator("#cardName");
    await expect(cardNameInput).toBeAttached();
    const cardNameRequired = await cardNameInput.getAttribute("required");
    const cardNameAriaRequired = await cardNameInput.getAttribute("aria-required");
    const cardNameIsRequired =
      cardNameRequired !== null || cardNameAriaRequired === "true";
    // SPEC: must be true. Currently false — DEF-A01.
    expect(cardNameIsRequired).toBe(true);

    // openDate — date input registered with RHF
    const openDateInput = page.locator("#openDate");
    await expect(openDateInput).toBeAttached();
    const openDateRequired = await openDateInput.getAttribute("required");
    const openDateAriaRequired = await openDateInput.getAttribute("aria-required");
    const openDateIsRequired =
      openDateRequired !== null || openDateAriaRequired === "true";
    // SPEC: must be true. Currently false — DEF-A01.
    expect(openDateIsRequired).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Keyboard Navigation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Keyboard Navigation", () => {
  test("TC-A10: Tab key navigates through interactive elements on dashboard", async ({
    page,
  }) => {
    // Spec (WCAG 2.1.1 — AA): all interactive controls must be reachable
    // by keyboard. Tab must move focus through links and buttons.
    //
    // We press Tab up to 15 times from page load and verify that at least
    // 3 distinct elements receive focus, confirming a working tab order.
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "networkidle" });

    const focusedElements = new Set<string>();

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        // Identify by tag + text content or aria-label
        const tag = el.tagName.toLowerCase();
        const label =
          el.getAttribute("aria-label") ||
          (el as HTMLElement).innerText?.trim().slice(0, 40) ||
          el.getAttribute("href") ||
          "";
        return `${tag}:${label}`;
      });
      if (focused) focusedElements.add(focused);
    }

    // At minimum, the logo link, nav links, and Add Card button must be reachable
    expect(focusedElements.size).toBeGreaterThanOrEqual(3);
  });

  test("TC-A11: card tile links reachable by Tab and activatable by Enter", async ({
    page,
  }) => {
    // Spec (CardTile.tsx, WCAG 2.1.1 — AA): card tiles are wrapped in <Link>
    // (renders as <a>) which must be keyboard-focusable via Tab and activatable
    // via Enter key (standard anchor behavior).
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "networkidle" });

    // Find a card tile link — each card wraps in <Link href="/ledger/cards/{id}/edit">
    const cardLinks = page.locator('a[href*="/cards/"][href*="/edit"]');
    await expect(cardLinks.first()).toBeAttached();

    // Get the href to verify navigation target after Enter
    const firstCardHref = await cardLinks.first().getAttribute("href");
    expect(firstCardHref).toMatch(/\/cards\/.+\/edit/);

    // Focus the first card tile link using Tab traversal
    let found = false;
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const activeHref = await page.evaluate(() => {
        const el = document.activeElement as HTMLAnchorElement | null;
        return el?.tagName === "A" ? el.getAttribute("href") : null;
      });
      if (activeHref && activeHref.includes("/cards/") && activeHref.includes("/edit")) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);

    // Activate via Enter — should navigate to the card edit page
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/cards\/.+\/edit/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/cards\/.+\/edit/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5 — Screen Reader Support
// ════════════════════════════════════════════════════════════════════════════

test.describe("Screen Reader Support", () => {
  test("TC-A12: status badges have meaningful text content", async ({ page }) => {
    // Spec (StatusBadge.tsx): badges render visible text (from STATUS_LABELS)
    // and have an aria-label of "Card status: {label}". Screen readers must
    // be able to convey the card status without relying on color alone.
    // Per WCAG 1.4.1 (A): color is not the only visual means of conveying info.
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, URGENT_CARDS);
    await page.reload({ waitUntil: "networkidle" });

    // Badges are <span> elements inside the card tile header area with
    // aria-label="Card status: {label}"
    const badges = page.locator('[aria-label^="Card status:"]');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const badge = badges.nth(i);

      // Must have non-empty aria-label
      const ariaLabel = await badge.getAttribute("aria-label");
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel!.length).toBeGreaterThan("Card status: ".length);

      // Must have visible text content (not relying on color alone)
      const textContent = await badge.textContent();
      expect(textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  test("TC-A13: aria-live region exists for dynamic content updates", async ({
    page,
  }) => {
    // Spec (Footer.tsx LokiToast): the toast banner uses aria-live="polite"
    // aria-atomic="true" to announce status messages to screen readers.
    // Per WCAG 4.1.3 (AA): status messages must be programmatically determined.
    //
    // We verify aria-live regions exist in the page DOM. The Toaster (sonner)
    // and LokiToast both provide live region infrastructure.
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "networkidle" });

    // At least one aria-live region must be present in the page
    const liveRegions = page.locator(
      "[aria-live='polite'], [aria-live='assertive'], [role='status'], [role='alert'], [role='log']"
    );

    const count = await liveRegions.count();
    expect(count).toBeGreaterThan(0);
  });

  test("TC-A14: avatar button has accessible label for anonymous users", async ({
    page,
  }) => {
    // Spec (TopBar.tsx): the anonymous avatar button has
    // aria-label="Sign in to sync your data". Per WCAG 4.1.2 (AA), all
    // interactive elements must have an accessible name.
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    // TopBar renders the anonymous avatar button when not authenticated
    const avatarButton = page.locator(
      'button[aria-label="Sign in to sync your data"]'
    );
    await expect(avatarButton).toBeAttached();
  });

  test("TC-A15: sidebar collapse button has accessible label", async ({ page }) => {
    // Spec (SideNav.tsx): the collapse/expand toggle button has
    // aria-label="Collapse sidebar" or "Expand sidebar" depending on state.
    // Per WCAG 4.1.2 (AA), controls must have accessible names.
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    // In expanded state the button has aria-label="Collapse sidebar"
    const collapseButton = page.locator(
      'button[aria-label="Collapse sidebar"], button[aria-label="Expand sidebar"]'
    );
    await expect(collapseButton).toBeAttached();
    const label = await collapseButton.getAttribute("aria-label");
    expect(label).toMatch(/Collapse sidebar|Expand sidebar/);
  });
});
