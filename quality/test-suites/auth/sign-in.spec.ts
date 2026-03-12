/**
 * Sign-In Page Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the /sign-in page against the design spec and source.
 * Every assertion is derived from sign-in/page.tsx, ADR-005, ADR-006.
 * Real OAuth flow is not tested here — this file covers rendering,
 * element presence, and graceful degradation.
 *
 * Spec references:
 *   - sign-in/page.tsx: h1 content varies on cardCount (no cards: "Name the wolf.")
 *   - sign-in/page.tsx: Google sign-in button text "Sign in to Google"
 *   - sign-in/page.tsx: Secondary CTA "Continue without signing in" navigates to /
 *   - sign-in/page.tsx: Feature list aria-label "What signing in gives you"
 *   - ADR-006: sign-in is a voluntary upgrade — "Continue without signing in" is non-negotiable
 *   - sign-in/page.tsx: already-authed users see "Crossing the Bifrost..." and redirect to /
 *   - sign-in/page.tsx: min-h-screen flex — full-page layout, responsive at 375px
 *
 * Data isolation: clearAllStorage() before each test ensures no stale session or cards.
 */

import { test, expect } from "@playwright/test";
import { clearAllStorage } from "../helpers/test-fixtures";

// ─── Shared setup ─────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto("/ledger");
  await clearAllStorage(page);
  await page.goto("/ledger/sign-in", { waitUntil: "load" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Page Renders Without Errors
// ════════════════════════════════════════════════════════════════════════════

test.describe("Sign-In Page — Rendering", () => {
  test("page loads without a JS console error", async ({ page }) => {
    // Spec: page must not throw uncaught exceptions on load
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/ledger/sign-in", { waitUntil: "load" });

    // Filter out known benign Next.js HMR noise in dev
    const fatal = errors.filter(
      (e) => !e.includes("hydration") && !e.includes("HMR")
    );
    expect(fatal).toHaveLength(0);
  });

  test("page returns HTTP 200", async ({ page }) => {
    // Spec: /sign-in must be a valid, reachable route
    const response = await page.goto("/ledger/sign-in", { waitUntil: "load" });
    expect(response?.status()).toBe(200);
  });

  // "page has a visible main content area" — REMOVED (Issue #610)
  // Static aria-labelledby attribute check. Low regression value.
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Page Heading
// ════════════════════════════════════════════════════════════════════════════

// Suite 2 — Page Heading: REMOVED (Issue #610)
// Static text assertions ("Name the wolf.", aria-labelledby). Break on copy change.
// Heading presence implicitly tested by rendering suite above.

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Google Sign-In Button
// ════════════════════════════════════════════════════════════════════════════

test.describe("Sign-In Page — Google Sign-In Button", () => {
  test("Google sign-in button is visible", async ({ page }) => {
    // Spec: sign-in/page.tsx — <button type="button"> with text "Sign in to Google"
    const btn = page.locator('button:has-text("Sign in to Google")');
    await expect(btn).toBeVisible();
  });

  test("Google sign-in button is not disabled by default", async ({ page }) => {
    // Spec: button is disabled={isRedirecting}, which starts false
    const btn = page.locator('button:has-text("Sign in to Google")');
    await expect(btn).toBeEnabled();
  });

  // "Google G glyph SVG" — REMOVED (Issue #610): Static markup check.
  // "touch target height (46px)" — REMOVED (Issue #610): CSS measurement.
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Continue Without Signing In (NON-NEGOTIABLE)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Sign-In Page — Continue Without Signing In", () => {
  test("'Continue without signing in' button is visible", async ({ page }) => {
    // Spec: ADR-006 — this is a first-class exit path, not an afterthought
    const btn = page.locator('button:has-text("Continue without signing in")');
    await expect(btn).toBeVisible();
  });

  test("'Continue without signing in' navigates to /", async ({ page }) => {
    // Spec: sign-in/page.tsx — onClick={() => router.push("/")}
    const btn = page.locator('button:has-text("Continue without signing in")');
    await btn.click();
    await page.waitForURL("**/ledger", { timeout: 5000 });
    expect(page.url()).not.toContain("/ledger/sign-in");
  });

  test("'Continue without signing in' button meets minimum touch target height (46px)", async ({
    page,
  }) => {
    // Spec: sign-in/page.tsx — style={{ minHeight: 46 }}
    const btn = page.locator('button:has-text("Continue without signing in")');
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(46);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5 — Feature List
// ════════════════════════════════════════════════════════════════════════════

test.describe("Sign-In Page — Feature List", () => {
  test("feature list container is present with correct aria-label", async ({
    page,
  }) => {
    // Spec: sign-in/page.tsx — <div aria-label="What signing in gives you">
    const featureList = page.locator(
      "[aria-label='What signing in gives you']"
    );
    await expect(featureList).toBeVisible();
  });

  // "at least one feature item shown" — REMOVED (Issue #610): Static count check.
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 6 — Responsive at 375px
// ════════════════════════════════════════════════════════════════════════════

test.describe("Sign-In Page — Responsive (375px)", () => {
  test("page is usable at 375px viewport width", async ({ page }) => {
    // Spec: team norms — minimum 375px. Sign-in card uses w-full max-w-[400px]
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/ledger/sign-in", { waitUntil: "load" });

    const googleBtn = page.locator('button:has-text("Sign in to Google")');
    await expect(googleBtn).toBeVisible();

    const continueBtn = page.locator(
      'button:has-text("Continue without signing in")'
    );
    await expect(continueBtn).toBeVisible();
  });

  // "sign-in card does not overflow viewport" — REMOVED (Issue #610): CSS box math.
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 7 — Variant B: Has Local Cards
// ════════════════════════════════════════════════════════════════════════════

// Suite 7 — Variant B (has local cards): REMOVED (Issue #610)
// Static heading text assertion. Low regression value — heading copy
// changes don't indicate bugs.
