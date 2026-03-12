/**
 * Accessibility Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests derived from WCAG 2.1 AA requirements and the Fenrir Ledger
 * product design brief. Every assertion is grounded in the spec —
 * not in what the code currently does.
 *
 * Covers:
 *   - Heading hierarchy on each route
 *   - Form field labelling and required-field marking
 *   - Keyboard navigation: Tab order and Enter activation
 *   - Screen reader support: status badge text, aria-live regions
 *
 * Removed (superseded by integration tests — Issue #582):
 *   - Page landmark structure (TC-A01..A04) → component render tests
 *   - Avatar aria-label (TC-A14) → ledger-topbar.test.tsx
 *   - Sidebar collapse label (TC-A15) → dead code (sidebar removed #403)
 *
 * Seeding pattern: all card data is written to localStorage before
 * page.reload() so the app reads the expected state on first render.
 *
 * NOTE: baseURL is provided by playwright.config.ts.
 * Tests use page.goto(path) — no hardcoded host or port.
 *
 * Route: /ledger (dashboard). The sidebar was removed in Issue #403.
 * The LedgerShell provides <header role="banner"> and <main>.
 * The <nav> (LedgerBottomTabs) is mobile-only (md:hidden).
 * The <footer> lives only on marketing pages, not in LedgerShell.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  seedCards,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";
import { FEW_CARDS, URGENT_CARDS } from "../helpers/seed-data";

// Suite 1 — Page Landmarks: REMOVED
// TC-A01 to TC-A04 superseded by integration tests:
//   - app-shell.test.tsx (main, footer landmarks)
//   - ledger-shell.test.tsx (main landmark)
//   - ledger-topbar.test.tsx (header/banner landmark)
//   - footer.test.tsx (footer/contentinfo landmark)

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Heading Hierarchy
// ════════════════════════════════════════════════════════════════════════════

test.describe("Heading Hierarchy", () => {
  test("TC-A05: dashboard has h1 with correct text", async ({ page }) => {
    // Spec (page.tsx): h1 renders "The Ledger of Fates" — Voice 2 atmospheric
    // heading from copywriting.md. Per WCAG 2.4.6 (AA), the page must have
    // a descriptive heading that identifies its purpose.
    await page.goto("/ledger");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "load" });

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("The Ledger of Fates");
  });

  test("TC-A06: Valhalla route redirects to dashboard with accessible heading", async ({ page }) => {
    // Spec (valhalla/page.tsx): the /ledger/valhalla route redirects to /ledger?tab=valhalla.
    await page.goto("/ledger");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.goto("/ledger/valhalla");
    await page.waitForURL(/\/ledger/);

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
    await page.reload({ waitUntil: "load" });

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
    await page.goto("/ledger");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "load" });
    // Navigate to the add card form
    await page.goto("/ledger/cards/new");
    // Wait for the form to appear (gated behind auth status resolution)
    await page.waitForSelector("form", { timeout: 5000 });
  });

  test("TC-A08: card form fields have associated labels", async ({ page }) => {
    const step1Pairs: Array<{ labelFor: string; inputId: string }> = [
      { labelFor: "issuerId", inputId: "issuerId" },
      { labelFor: "cardName", inputId: "cardName" },
      { labelFor: "openDate", inputId: "openDate" },
      { labelFor: "annualFee", inputId: "annualFee" },
      { labelFor: "bonusType", inputId: "bonusType" },
    ];

    for (const { labelFor, inputId } of step1Pairs) {
      const label = page.locator(`label[for="${labelFor}"]`);
      await expect(label).toBeAttached();
      const input = page.locator(`#${inputId}`);
      await expect(input).toBeAttached();
    }
  });

  test("TC-A09: required fields have required or aria-required attribute [KNOWN DEFECT DEF-A01]", async ({ page }) => {
    // cardName — text input registered with RHF
    const cardNameInput = page.locator("#cardName");
    await expect(cardNameInput).toBeAttached();
    const cardNameRequired = await cardNameInput.getAttribute("required");
    const cardNameAriaRequired = await cardNameInput.getAttribute("aria-required");
    const cardNameIsRequired =
      cardNameRequired !== null || cardNameAriaRequired === "true";
    expect(cardNameIsRequired).toBe(true);

    // openDate — date input registered with RHF
    const openDateInput = page.locator("#openDate");
    await expect(openDateInput).toBeAttached();
    const openDateRequired = await openDateInput.getAttribute("required");
    const openDateAriaRequired = await openDateInput.getAttribute("aria-required");
    const openDateIsRequired =
      openDateRequired !== null || openDateAriaRequired === "true";
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
    await page.goto("/ledger");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "load" });

    const focusedElements = new Set<string>();

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
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

    expect(focusedElements.size).toBeGreaterThanOrEqual(3);
  });

  test("TC-A11: card tile links reachable by Tab and activatable by Enter", async ({
    page,
  }) => {
    await page.goto("/ledger");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "load" });

    const cardLinks = page.locator('a[href*="/ledger/cards/"][href*="/edit"]');
    await expect(cardLinks.first()).toBeAttached();

    const firstCardHref = await cardLinks.first().getAttribute("href");
    expect(firstCardHref).toMatch(/\/cards\/.+\/edit/);

    let found = false;
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const activeHref = await page.evaluate(() => {
        const el = document.activeElement as HTMLAnchorElement | null;
        return el?.tagName === "A" ? el.getAttribute("href") : null;
      });
      if (activeHref && activeHref.includes("/ledger/cards/") && activeHref.includes("/edit")) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);

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
    await page.goto("/ledger");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, URGENT_CARDS);
    await page.reload({ waitUntil: "load" });

    const badges = page.locator('[aria-label^="Card status:"]');
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const badge = badges.nth(i);
      const ariaLabel = await badge.getAttribute("aria-label");
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel!.length).toBeGreaterThan("Card status: ".length);
      const textContent = await badge.textContent();
      expect(textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  test("TC-A13: aria-live region exists for dynamic content updates", async ({
    page,
  }) => {
    await page.goto("/ledger");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "load" });

    const liveRegions = page.locator(
      "[aria-live='polite'], [aria-live='assertive'], [role='status'], [role='alert'], [role='log']"
    );

    const count = await liveRegions.count();
    expect(count).toBeGreaterThan(0);
  });

  // TC-A14: avatar button aria-label — REMOVED
  // Superseded by ledger-topbar.test.tsx "renders the anonymous avatar button with correct aria-label"

  // TC-A15: sidebar collapse button — REMOVED
  // Sidebar was removed in Issue #403. This test was dead code.
});
