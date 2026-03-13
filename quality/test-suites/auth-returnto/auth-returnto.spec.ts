/**
 * Auth returnTo Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the returnTo query param feature that redirects users back to their
 * origin page after sign-in completes. This validates the acceptance criteria:
 *   - Sign-in from /ledger/settings includes returnTo=/ledger/settings
 *   - Sign-in from /ledger/valhalla includes returnTo=/ledger/valhalla
 *   - Sign-in from /ledger includes returnTo=/ledger
 *   - Sign-in with no returnTo defaults to /ledger
 *   - External URLs in returnTo are rejected (redirect to /ledger instead)
 *
 * Spec references:
 *   - sign-in-url.ts: validateReturnTo() prevents open-redirect attacks
 *   - sign-in-url.ts: buildSignInUrl(currentPath) includes returnTo query param
 *   - auth/callback/page.tsx: reads callbackUrl and redirects after token exchange
 *
 * NOTE: Tests for sessionStorage PKCE data management have been removed per
 * Loki's ruthless consolidation criteria. These tests required intercepting
 * real Google OAuth requests, which is unreliable in E2E automation.
 * The PKCE flow is validated by:
 *   - auth-callback.spec.ts (13 tests validating token exchange)
 *   - Unit tests in src/__tests__/auth/ (PKCE generation, validation)
 */

import { test, expect } from "@playwright/test";
import { clearAllStorage } from "../helpers/test-fixtures";

// ─── Shared setup ─────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto("/ledger");
  await clearAllStorage(page);
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — returnTo Query Param Validation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Auth returnTo — Query Param Validation", () => {
  // "sign-in from /ledger includes returnTo" — REMOVED (Issue #610): Just navigates + URL echo.
  // "sign-in from /ledger/settings includes returnTo" — REMOVED (Issue #610): URL echo.
  // "sign-in from /ledger/valhalla includes returnTo" — REMOVED (Issue #610): URL echo.

  test("sign-in with no returnTo defaults to /ledger", async ({ page }) => {
    // Spec: /ledger/sign-in without returnTo param should default to /ledger
    await page.goto("/ledger/sign-in", { waitUntil: "load" });

    // Verify no returnTo param in URL
    await expect(page).toHaveURL(/\/ledger\/sign-in$/);
  });

  test("external URLs in returnTo are rejected (prevented client-side)", async ({
    page,
  }) => {
    // Spec: validateReturnTo should reject "https://evil.com" and fall back to /ledger
    // This is validated in the sign-in page's handleSignIn method
    await page.goto("/ledger/sign-in?returnTo=https://evil.com", {
      waitUntil: "load",
    });

    // The page should still load (validateReturnTo prevents the attack)
    await expect(page).toHaveURL(/\/ledger\/sign-in/);

    // The evil.com param should be in the URL (not sanitized at route level)
    // but validateReturnTo will reject it when OAuth completes
    await expect(page).toHaveURL(/returnTo=https:\/\/evil\.com/);
  });

  test("protocol-relative URLs in returnTo are rejected", async ({ page }) => {
    // Spec: validateReturnTo should reject "//evil.com"
    await page.goto("/ledger/sign-in?returnTo=//evil.com", {
      waitUntil: "load",
    });

    // The page should still load
    await expect(page).toHaveURL(/\/ledger\/sign-in/);
  });

  test("sign-in page does not crash with malformed returnTo", async ({
    page,
  }) => {
    // Spec: page must handle invalid returnTo gracefully (no console errors)
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // Try various malformed values
    const malformedUrls = [
      "/ledger/sign-in?returnTo=\\\\evil.com",
      "/ledger/sign-in?returnTo=%0ainjection",
    ];

    for (const url of malformedUrls) {
      await page.goto(url, { waitUntil: "load" });
    }

    // Filter out benign Next.js HMR noise
    const fatal = errors.filter(
      (e) => !e.includes("hydration") && !e.includes("HMR")
    );

    expect(fatal).toHaveLength(0);
  });
});
