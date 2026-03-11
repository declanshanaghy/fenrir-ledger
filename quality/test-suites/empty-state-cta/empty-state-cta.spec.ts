/**
 * Test suite for GitHub Issue #156: Logged-out empty state is overbusy
 *
 * Acceptance Criteria (from issue):
 *   AC-1: One primary CTA — either "Add Card" or "Sign In", not both competing.
 *         When zero cards, the header "Add Card" button must not be present.
 *         The EmptyState "Add Card" link is the single primary CTA.
 *   AC-2: Upsell banner should not show to users who have not added a card yet.
 *         (UpsellBanner is gated behind hasCards).
 *   AC-3: Sign-in nudge should be subtle (no full-width bordered banner) when zero cards.
 *         The zero-cards nudge is a small muted text link, not the aria-labelled banner.
 *   AC-4: No duplicate "Add Card" — header button hidden when zero cards.
 *         When cards exist, the header "Add Card" button returns.
 *
 * All assertions are derived from acceptance criteria, not from current code behaviour.
 * Each test seeds localStorage fresh — idempotent by design.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  seedCards,
  makeCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ─── AC-1 & AC-4: No duplicate "Add Card" in header when zero cards ───────────

test.describe("AC-1 & AC-4 — Single primary CTA (no duplicate Add Card)", () => {
  test("header Add Card button is absent when zero cards (anonymous)", async ({
    page,
  }) => {
    // Establish browser context, clear storage, seed household (no cards).
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    // Reload with networkidle so all async effects settle.
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    // Count all /cards/new links — must be exactly 1 (EmptyState only, no header dupe).
    const addCardLinks = page.locator('a[href="/ledger/cards/new"]');
    await expect(addCardLinks).toHaveCount(1);
  });

  test("the single Add Card CTA is inside the EmptyState (not the header)", async ({
    page,
  }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    // The EmptyState is identified by its aria-description (Gleipnir ingredient 6 easter egg).
    const emptyState = page.locator('[aria-description="the spittle of a bird"]');
    await expect(emptyState).toBeVisible();

    // Add Card link lives inside the EmptyState.
    const emptyStateAddCard = emptyState.locator('a[href="/ledger/cards/new"]');
    await expect(emptyStateAddCard).toBeVisible();
    await expect(emptyStateAddCard).toContainText("Add Card");
  });

  test("header Add Card button appears once cards exist (anonymous)", async ({
    page,
  }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeCard()]);
    await page.reload({ waitUntil: "networkidle" });

    // With cards present the summary header is shown (e.g. "1 card").
    await page.waitForSelector('text=/\\d+ card/', { timeout: 10000 });

    // The header Add Card link must now be visible.
    const headerAddCard = page.locator('a[href="/ledger/cards/new"]');
    await expect(headerAddCard).toBeVisible();
  });
});

// ─── AC-2: Upsell banner hidden when zero cards ───────────────────────────────

test.describe("AC-2 — Upsell banner not shown to new (zero-card) users", () => {
  test("UpsellBanner full-width region is not rendered when zero cards (anonymous)", async ({
    page,
  }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    // The full SignInNudge banner has role="region" aria-label="Sync your data".
    // It must NOT appear in the zero-cards state.
    const upsellBanner = page.locator('[role="region"][aria-label="Sync your data"]');
    await expect(upsellBanner).not.toBeVisible();
  });

  test("UpsellBanner region appears when user has at least one card (anonymous)", async ({
    page,
  }) => {
    await page.goto("/");
    await clearAllStorage(page);
    // Remove any previous dismiss so the banner is shown.
    await page.evaluate(() => localStorage.removeItem("fenrir:upsell_dismissed"));
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeCard()]);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text=/\\d+ card/', { timeout: 10000 });

    // Full banner visible with ≥1 card (anonymous, not dismissed).
    const upsellBanner = page.locator('[role="region"][aria-label="Sync your data"]');
    await expect(upsellBanner).toBeVisible();
  });
});

// ─── AC-3: Sign-in nudge is subtle (muted text link) when zero cards ──────────

test.describe("AC-3 — Sign-in nudge is subtle (not a full-width banner) at zero cards", () => {
  test("zero-cards nudge renders as a small text button, not the full banner", async ({
    page,
  }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    // The subtle nudge renders as a <button> with text "Sign in to sync your data".
    const subtleNudge = page.locator('button:text("Sign in to sync your data")');
    await expect(subtleNudge).toBeVisible();
  });

  test("zero-cards nudge: full banner region is absent", async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    // Full banner identified by role="region" with aria-label — must not be present.
    const fullBanner = page.locator('[role="region"][aria-label="Sync your data"]');
    await expect(fullBanner).not.toBeVisible();
  });

  test("subtle nudge navigates to sign-in page on click", async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    const subtleNudge = page.locator('button:text("Sign in to sync your data")');
    await expect(subtleNudge).toBeVisible();
    await subtleNudge.click();

    // Navigation to /sign-in must happen.
    await page.waitForURL(/\/sign-in/, { timeout: 10000 });
    expect(page.url()).toContain("/ledger/sign-in");
  });

  test("subtle nudge is wrapped in a muted-foreground paragraph (not a gold CTA)", async ({
    page,
  }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    // The nudge paragraph carries "muted-foreground" styling — it is NOT a primary/gold CTA.
    const parentParagraph = page.locator(
      'p:has(button:text("Sign in to sync your data"))'
    );
    await expect(parentParagraph).toBeVisible();
    const parentClass = await parentParagraph.getAttribute("class");
    expect(parentClass).toMatch(/muted/);
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

test.describe("Edge cases", () => {
  test("page renders without JS errors on zero-card anonymous load", async ({
    page,
  }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    expect(jsErrors).toHaveLength(0);
  });

  test("mobile 375px: single Add Card CTA visible, no header duplicate", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    const addCardLinks = page.locator('a[href="/ledger/cards/new"]');
    await expect(addCardLinks).toHaveCount(1);

    const addCardLink = addCardLinks.first();
    await expect(addCardLink).toBeVisible();
  });

  test("mobile 375px: subtle sign-in nudge is visible", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    const subtleNudge = page.locator('button:text("Sign in to sync your data")');
    await expect(subtleNudge).toBeVisible();
  });

  test("EmptyState headline (Gleipnir) is present in zero-card state", async ({
    page,
  }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    const headline = page.locator("h2").filter({ hasText: /Gleipnir/ });
    await expect(headline).toBeVisible();
  });

  test("no competing CTAs: exactly one primary Add Card link + no gold banner sign-in", async ({
    page,
  }) => {
    await page.goto("/");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await page.reload({ waitUntil: "networkidle" });

    await page.waitForSelector('text="Before"', { timeout: 10000 });

    // Exactly one /cards/new link (EmptyState only).
    const addCardLinks = page.locator('a[href="/ledger/cards/new"]');
    await expect(addCardLinks).toHaveCount(1);

    // Gold-bordered "Sign in to sync" button from the full banner must not be visible.
    const bannerSignInBtn = page.locator(
      '[role="region"][aria-label="Sync your data"] button:text("Sign in to sync")'
    );
    await expect(bannerSignInBtn).not.toBeVisible();
  });
});
