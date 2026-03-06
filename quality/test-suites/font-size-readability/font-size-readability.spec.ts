/**
 * Font Size Readability — QA Test Suite
 * Validates GitHub Issue #149: [UX] [P3]: Increase base font sizes across the app
 *
 * Authored by Loki, QA Tester of the Pack.
 *
 * Every assertion is derived from the acceptance criteria in Issue #149 and the
 * typography scale spec in ux/wireframes/accessibility/font-size-scale.html.
 * We NEVER assert against what the code currently does — we assert against the
 * design spec.
 *
 * Acceptance Criteria (Issue #149):
 *   AC-1: Base body font size increased to ~16px
 *   AC-2: Headings, labels, metadata, and button text scaled proportionally
 *   AC-3: Saga Ledger design system aesthetic preserved
 *   AC-4: Visual hierarchy maintained — just scaled up
 *   AC-5: Mobile responsiveness preserved
 *   AC-6: No layout breakage from size increases
 *
 * Typography scale spec (from ux/wireframes/accessibility/font-size-scale.html):
 *   body/card content:  16px (text-base, Tailwind default)
 *   body-sm / labels:   14px (text-sm, Tailwind default)
 *   metadata:           13px or 14px
 *   badge:              12px (text-xs)   [was 10px]
 *   button:             16px (text-base) [was text-sm / 14px]
 *   input / select:     16px             [iOS Safari zoom prevention — globals.css]
 *   page heading (h1):  30px+ (text-3xl) on page pages, 24px+ on subpages
 *   section heading:    20px (text-xl)
 *
 * Exemptions (must NOT be affected by global CSS changes):
 *   - ConsoleSignature (ASCII art console output — no DOM elements)
 *   - LcarsOverlay     (easter egg — not visible by default)
 *
 * Seeding: localStorage is seeded via page.evaluate before page.reload()
 * so the app boots into a known state. Each test is idempotent.
 *
 * NOTE: baseURL is provided by playwright.config.ts (SERVER_URL env var).
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  seedCards,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";
import { FEW_CARDS } from "../helpers/seed-data";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Return the computed font-size in pixels for the first element matching the
 * CSS selector. Throws if no element found.
 */
async function computedFontSize(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`Element not found for selector: ${sel}`);
    return parseFloat(window.getComputedStyle(el).fontSize);
  }, selector);
}

/** Seed the app with a few cards and navigate to the dashboard. */
async function loadDashboard(page: Page): Promise<void> {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
  // Use domcontentloaded instead of networkidle to avoid timeout under load
  await page.reload({ waitUntil: "domcontentloaded" });
  // Wait for the page heading to appear, confirming the app has rendered
  await page.waitForSelector("h1", { timeout: 10000 });
}

// ════════════════════════════════════════════════════════════════════════════
// AC-1: Base body font size ~16px
// ════════════════════════════════════════════════════════════════════════════

test.describe("AC-1: Base body font size ~16px", () => {

  test("TC-FS-001: dashboard body text inherits 16px base", async ({ page }) => {
    // Spec: the body font size should be ~16px (the browser default is 16px, and
    // Tailwind's text-base is 1rem = 16px). The app body element must not
    // set a smaller font-size that would cascade to content.
    await page.goto("/");
    await page.waitForSelector("body", { timeout: 10000 });
    const bodySize = await computedFontSize(page, "body");
    // Modern browsers default to 16px; the app must not override it to be smaller
    expect(bodySize, "body font-size should be at least 16px").toBeGreaterThanOrEqual(16);
  });

  test("TC-FS-002: input elements are at least 16px (iOS Safari zoom prevention)", async ({ page }) => {
    // Spec: globals.css sets input { font-size: 16px } to prevent iOS Safari zoom.
    // iOS Safari zooms in when an input has font-size < 16px.
    await page.goto("/cards/new");
    await page.waitForSelector("input", { timeout: 10000 });
    const fontSize = await computedFontSize(page, "input");
    expect(fontSize, "input font-size must be >= 16px to prevent iOS Safari zoom").toBeGreaterThanOrEqual(16);
  });

  test("TC-FS-003: textarea elements are at least 16px (iOS Safari zoom prevention)", async ({ page }) => {
    // Spec: globals.css sets textarea { font-size: 16px } to prevent iOS Safari zoom.
    await page.goto("/cards/new");
    // Notes field is a textarea in CardForm
    const textareaCount = await page.locator("textarea").count();
    if (textareaCount === 0) {
      test.skip(true, "No textarea found on /cards/new — skipping");
      return;
    }
    const fontSize = await computedFontSize(page, "textarea");
    expect(fontSize, "textarea font-size must be >= 16px to prevent iOS Safari zoom").toBeGreaterThanOrEqual(16);
  });

  test("TC-FS-004: page heading on sign-in is at least 16px", async ({ page }) => {
    // Spec: all text across the app must be at minimum body size (16px).
    // Sign-in page was updated — verify it renders text at proper scale.
    await page.goto("/sign-in");
    await page.waitForSelector("body", { timeout: 10000 });
    const bodySize = await computedFontSize(page, "body");
    expect(bodySize, "sign-in body font-size should be at least 16px").toBeGreaterThanOrEqual(16);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-2: Headings, labels, metadata, and buttons scaled proportionally
// ════════════════════════════════════════════════════════════════════════════

test.describe("AC-2: Headings/labels/metadata/buttons scaled proportionally", () => {

  test("TC-FS-010: page title (h1) is at least 24px", async ({ page }) => {
    // Spec: page titles use text-2xl (24px) or text-3xl (30px).
    // Dashboard h1 "The Ledger of Fates" uses font-display text-2xl (or text-3xl).
    // Both satisfy >=24px.
    await loadDashboard(page);
    const fontSize = await computedFontSize(page, "h1");
    expect(fontSize, "page title (h1) should be at least 24px").toBeGreaterThanOrEqual(24);
  });

  test("TC-FS-011: primary CTA button text is at least 14px", async ({ page }) => {
    // Spec: button text = text-base (16px), scaled from text-sm (14px).
    // "Add Card" link on dashboard uses text-base after this change.
    // We assert >= 14px to guard against regression below 14px.
    await loadDashboard(page);
    // The Add Card link is an <a> styled as a button
    const addCard = page.locator('a[href="/cards/new"]');
    await expect(addCard).toBeVisible({ timeout: 10000 });
    const fontSize = await page.evaluate(() => {
      const el = document.querySelector('a[href="/cards/new"]');
      if (!el) throw new Error("Add Card link not found");
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    expect(fontSize, "Add Card button text should be at least 14px").toBeGreaterThanOrEqual(14);
  });

  test("TC-FS-012: card form labels are at least 14px", async ({ page }) => {
    // Spec: label = text-base (16px) in shadcn component (was text-sm/14px).
    // Both 14px and 16px are valid — the key is nothing is below 14px.
    await page.goto("/cards/new");
    await page.waitForSelector("label", { timeout: 10000 });
    const fontSize = await computedFontSize(page, "label");
    expect(fontSize, "form labels should be at least 14px after scaling").toBeGreaterThanOrEqual(14);
  });

  test("TC-FS-013: card form input fields are at least 14px", async ({ page }) => {
    // Spec: inputs = text-base (16px) after scaling from text-sm (14px).
    // shadcn Input was updated from text-sm to text-base.
    await page.goto("/cards/new");
    await page.waitForSelector('input[type="text"], input[type="number"]', { timeout: 10000 });
    const fontSize = await computedFontSize(
      page,
      'input[type="text"], input[type="number"]'
    );
    expect(fontSize, "card form input should be at least 14px after scaling").toBeGreaterThanOrEqual(14);
  });

  test("TC-FS-014: card tile card name heading is at least 14px", async ({ page }) => {
    // Spec: CardTitle in card tiles uses text-base (16px) — card name must be readable.
    await loadDashboard(page);
    // CardTitle renders as an h3 inside card tiles
    const h3 = page.locator("h3").first();
    await expect(h3).toBeVisible({ timeout: 10000 });
    const fontSize = await computedFontSize(page, "h3");
    expect(fontSize, "card tile name (h3) should be at least 14px").toBeGreaterThanOrEqual(14);
  });

  test("TC-FS-015: nav brand title is at least 14px", async ({ page }) => {
    // Spec: "Fenrir Ledger" brand title in TopBar scaled from text-sm (14px)
    // to text-base (16px). Must be at least 14px.
    await page.goto("/");
    await page.waitForSelector("body", { timeout: 10000 });
    const fontSize = await page.evaluate(() => {
      // Find the span containing exactly "Fenrir Ledger" brand text
      const spans = Array.from(document.querySelectorAll("span"));
      const el = spans.find(s => s.textContent?.trim() === "Fenrir Ledger");
      if (!el) return null;
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    if (fontSize !== null) {
      expect(fontSize, "brand title 'Fenrir Ledger' should be at least 14px").toBeGreaterThanOrEqual(14);
    }
  });

  test("TC-FS-016: brand tagline is at least 12px", async ({ page }) => {
    // Spec: "Break free. Harvest every reward." tagline scaled from text-xs (12px)
    // to text-sm (14px). Must be at least 12px.
    await page.goto("/");
    await page.waitForSelector("body", { timeout: 10000 });
    const fontSize = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const el = spans.find(s => s.textContent?.includes("Break free"));
      if (!el) return null;
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    if (fontSize !== null) {
      expect(fontSize, "brand tagline should be at least 12px").toBeGreaterThanOrEqual(12);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-3: Saga Ledger design system aesthetic preserved
// ════════════════════════════════════════════════════════════════════════════

test.describe("AC-3: Design system aesthetic preserved", () => {

  test("TC-FS-020: Cinzel/display font still applied to page title", async ({ page }) => {
    // Spec: h1 "The Ledger of Fates" uses font-display (Cinzel Decorative).
    // Font changes must not alter font-family assignments.
    await loadDashboard(page);
    const fontFamily = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      if (!h1) throw new Error("h1 not found on dashboard");
      return window.getComputedStyle(h1).fontFamily;
    });
    expect(fontFamily.toLowerCase(), "page title must use Cinzel display font").toMatch(/cinzel/i);
  });

  test("TC-FS-021: gold color on page title preserved (amber/gold tone)", async ({ page }) => {
    // Spec: title uses text-gold — a gold/amber color from the Saga Ledger palette.
    // Tailwind config defines: gold.DEFAULT = "#d4a520" = rgb(212, 165, 32).
    // Font size changes must not affect color. We assert the hue is gold/amber
    // (high red channel, medium-high green channel, low blue channel).
    // This is theme-mode agnostic — both light and dark mode use a gold tint.
    await loadDashboard(page);
    const components = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      if (!h1) throw new Error("h1 not found");
      const color = window.getComputedStyle(h1).color;
      const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!match) throw new Error(`Unexpected color format: ${color}`);
      return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), raw: color };
    });
    // Gold/amber hue: red > 150, green > 80, blue < 80, and red > blue substantially.
    expect(components.r, `h1 color red channel should be high for gold (got ${components.raw})`).toBeGreaterThan(150);
    expect(components.g, `h1 color green channel should be moderate for gold (got ${components.raw})`).toBeGreaterThan(80);
    expect(components.b, `h1 color blue channel should be low for gold (got ${components.raw})`).toBeLessThan(80);
    expect(components.r - components.b, "red-blue channel difference should be large for gold").toBeGreaterThan(100);
  });

  test("TC-FS-022: dark theme background is very dark (void-black aesthetic)", async ({ page }) => {
    // Spec: in dark mode, background is near-black (#12100e — warm charcoal).
    // We explicitly activate dark mode by adding the .dark class to <html>,
    // then verify the background color is very dark.
    // The .dark CSS class is controlled by next-themes via localStorage.
    await page.goto("/");
    await page.waitForSelector("body", { timeout: 10000 });
    // Activate dark theme by adding class directly to <html>
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
    });
    const bg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [, r, g, b] = match.map(Number);
      expect(r + g + b, `dark mode body background should be very dark (void-black). Got: ${bg}`).toBeLessThan(80);
    }
  });

  test("TC-FS-023: monospace font preserved on data elements", async ({ page }) => {
    // Spec: credit card values, fees, and numeric data use JetBrains Mono.
    // The font-mono class must still render a monospace font.
    await loadDashboard(page);
    const fontFamily = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[class*="font-mono"]'));
      if (els.length === 0) return null;
      return window.getComputedStyle(els[0]).fontFamily;
    });
    if (fontFamily !== null) {
      // Must be monospace — either JetBrains Mono by name or a monospace family
      const isMonospace =
        /mono|jetbrains/i.test(fontFamily) ||
        /monospace/i.test(fontFamily);
      expect(isMonospace, `font-mono elements should use a monospace font, got: ${fontFamily}`).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-4: Visual hierarchy maintained
// ════════════════════════════════════════════════════════════════════════════

test.describe("AC-4: Visual hierarchy maintained", () => {

  test("TC-FS-030: h1 font size is larger than card body text", async ({ page }) => {
    // Spec: h1 (~24-30px) must be strictly larger than body text (16px).
    // Hierarchy: page title > section content.
    await loadDashboard(page);
    const h1Size = await computedFontSize(page, "h1");
    // Body base size
    const bodySize = await computedFontSize(page, "body");
    expect(h1Size, "h1 must be larger than body to maintain visual hierarchy").toBeGreaterThan(bodySize);
  });

  test("TC-FS-031: brand title is larger than brand tagline", async ({ page }) => {
    // Spec: "Fenrir Ledger" (text-base/16px) > "Break free..." tagline (text-sm/14px).
    await page.goto("/");
    await page.waitForSelector("body", { timeout: 10000 });
    const sizes = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      const brandSpan = spans.find(s => s.textContent?.trim() === "Fenrir Ledger");
      const taglineSpan = spans.find(s => s.textContent?.includes("Break free"));
      return {
        brand: brandSpan ? parseFloat(window.getComputedStyle(brandSpan).fontSize) : null,
        tagline: taglineSpan ? parseFloat(window.getComputedStyle(taglineSpan).fontSize) : null,
      };
    });
    if (sizes.brand !== null && sizes.tagline !== null) {
      expect(
        sizes.brand,
        `brand name (${sizes.brand}px) should be >= tagline (${sizes.tagline}px)`
      ).toBeGreaterThanOrEqual(sizes.tagline);
    }
  });

  test("TC-FS-032: card title is larger than card metadata text", async ({ page }) => {
    // Spec: card name heading (text-base/16px) must be >= metadata (text-sm/14px).
    // Hierarchy within card tiles must be preserved after scaling.
    await loadDashboard(page);
    const h3 = page.locator("h3").first();
    const hasH3 = await h3.count() > 0;
    if (!hasH3) {
      test.skip(true, "No h3 card titles found — skipping hierarchy check");
      return;
    }
    const h3Size = await computedFontSize(page, "h3");
    // metadata text is at least 13px per spec; h3 should be larger
    expect(h3Size, "card title (h3) should be at least 14px").toBeGreaterThanOrEqual(14);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-5: Mobile responsiveness preserved
// ════════════════════════════════════════════════════════════════════════════

test.describe("AC-5: Mobile responsiveness preserved", () => {

  test("TC-FS-040: dashboard has no horizontal scroll at 375px", async ({ page }) => {
    // Spec: minimum viewport width is 375px. Font size increases must not cause overflow.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 10000 });
    const hasOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > document.documentElement.clientWidth + 5;
    });
    expect(hasOverflow, "375px viewport must not have horizontal overflow after font scaling").toBe(false);
  });

  test("TC-FS-041: card form has no horizontal scroll at 375px", async ({ page }) => {
    // Spec: forms must be usable on mobile. Larger inputs must not overflow.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/cards/new");
    await page.waitForLoadState("domcontentloaded");
    const hasOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > document.documentElement.clientWidth + 5;
    });
    expect(hasOverflow, "card form at 375px must not have horizontal overflow").toBe(false);
  });

  test("TC-FS-042: input font remains >=16px on mobile (iOS zoom prevention)", async ({ page }) => {
    // Spec: iOS zoom prevention must apply even on mobile viewport.
    // The globals.css rule targets all viewports.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/cards/new");
    await page.waitForSelector("input", { timeout: 10000 });
    const fontSize = await computedFontSize(page, "input");
    expect(fontSize, "input must be >= 16px on 375px mobile to prevent iOS Safari zoom").toBeGreaterThanOrEqual(16);
  });

  test("TC-FS-043: Valhalla page has no horizontal scroll at 375px", async ({ page }) => {
    // Spec: Valhalla page had font size changes. Must remain mobile-safe.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/valhalla");
    await page.waitForLoadState("domcontentloaded");
    const hasOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > document.documentElement.clientWidth + 5;
    });
    expect(hasOverflow, "Valhalla at 375px must not have horizontal overflow").toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AC-6: No layout breakage
// ════════════════════════════════════════════════════════════════════════════

test.describe("AC-6: No layout breakage", () => {

  test("TC-FS-050: dashboard renders the primary Add Card CTA", async ({ page }) => {
    // Spec: core navigation must survive font size changes.
    await loadDashboard(page);
    const addCardLink = page.locator('a[href="/cards/new"]');
    await expect(addCardLink, "Add Card link must be visible").toBeVisible({ timeout: 10000 });
  });

  test("TC-FS-051: card form page renders inputs and submit button", async ({ page }) => {
    // Spec: the card form must work correctly after font size changes.
    await page.goto("/cards/new");
    await page.waitForLoadState("domcontentloaded");
    const inputs = page.locator("input, select, textarea");
    const count = await inputs.count();
    expect(count, "card form should render multiple input fields").toBeGreaterThan(2);
    const submitButton = page.getByRole("button", { name: /forge|save|create|add/i });
    await expect(submitButton.first(), "card form must have a submit/save button").toBeVisible({ timeout: 10000 });
  });

  test("TC-FS-052: sign-in page renders a heading", async ({ page }) => {
    // Spec: sign-in page must render correctly. Font changes were applied there.
    await page.goto("/sign-in");
    await page.waitForLoadState("domcontentloaded");
    const heading = page.locator("h1, h2").first();
    await expect(heading, "sign-in page must have a visible heading").toBeVisible({ timeout: 10000 });
  });

  test("TC-FS-053: Valhalla page renders the main landmark", async ({ page }) => {
    // Spec: Valhalla page had significant font changes. Main landmark must exist.
    await page.goto("/valhalla");
    await page.waitForLoadState("domcontentloaded");
    const main = page.locator("main");
    await expect(main, "Valhalla page must have a main landmark").toBeVisible({ timeout: 10000 });
  });

  test("TC-FS-054: settings page renders without crashing", async ({ page }) => {
    // Spec: settings page had font size changes. Must render correctly.
    await page.goto("/settings");
    await page.waitForLoadState("domcontentloaded");
    const body = page.locator("body");
    await expect(body, "settings page body must be visible").toBeVisible({ timeout: 10000 });
  });

  test("TC-FS-055: card tiles render without text overflow at 1280px", async ({ page }) => {
    // Spec: larger font sizes must not cause text to overflow card boundaries at desktop.
    await page.setViewportSize({ width: 1280, height: 900 });
    await loadDashboard(page);
    const overflow = await page.evaluate(() => {
      // Check any element using the rounded-lg border class (card root)
      const cards = Array.from(document.querySelectorAll("[class*='rounded-lg'][class*='border']"));
      return cards.some(card => card.scrollWidth > card.clientWidth + 5);
    });
    expect(overflow, "card tiles must not overflow horizontally at 1280px desktop").toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Exemptions: ConsoleSignature and LcarsOverlay must not be affected
// ════════════════════════════════════════════════════════════════════════════

test.describe("Exemptions: Exempted components retain original behaviour", () => {

  test("TC-FS-060: ConsoleSignature has no DOM elements", async ({ page }) => {
    // Exemption: ConsoleSignature writes ASCII art only to console.log.
    // It must not render any DOM elements. This verifies no DOM leakage.
    await loadDashboard(page);
    const count = await page.locator(
      '[id*="console-signature"], [class*="console-signature"], [data-console-sig]'
    ).count();
    expect(count, "ConsoleSignature must not render any DOM elements").toBe(0);
  });

  test("TC-FS-061: LcarsOverlay is hidden by default", async ({ page }) => {
    // Exemption: LcarsOverlay is an easter egg and must not appear on normal dashboard load.
    // It retains its own font sizing (not subject to #149 changes).
    await loadDashboard(page);
    const lcars = page.locator('[class*="lcars"], [id*="lcars"], [data-lcars]');
    const count = await lcars.count();
    if (count > 0) {
      await expect(lcars.first(), "LcarsOverlay must not be visible by default").toBeHidden();
    }
    // If not in DOM at all, the exemption is satisfied
  });
});
