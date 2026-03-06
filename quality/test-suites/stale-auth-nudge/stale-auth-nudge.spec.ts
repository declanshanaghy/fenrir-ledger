/**
 * Stale Auth Nudge — Playwright Test Suite
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates Issue #145: Nudge returning users to sign in when stale auth detected.
 *
 * Every assertion is derived from the acceptance criteria in Issue #145 and the
 * implementation spec in StaleAuthNudge.tsx. Never from what the code currently does.
 *
 * Acceptance Criteria (from Issue #145):
 *   AC-1: Returning user with expired session sees a sign-in nudge
 *   AC-2: Nudge is dismissible
 *   AC-3: No nudge for genuinely anonymous users (no cache)
 *   AC-4: After sign-in, entitlement refreshes and nudge disappears
 *
 * Additional edge cases (from FiremanDecko handoff):
 *   EC-1: No nudge during "loading" auth state
 *   EC-2: Sign-in CTA navigates to /sign-in
 *   EC-3: Stale cache with authenticated user — no nudge
 *   EC-4: Mobile viewport (375px) — stacked layout, 44px touch targets
 *   EC-5: Banner has correct ARIA role for screen readers
 *   EC-6: Dismiss clears entitlement cache from localStorage
 *   EC-7: Dismiss sets sessionStorage dismiss flag
 *
 * What CANNOT be tested via Playwright (and why):
 *   - Real OAuth sign-in flow to trigger AC-4 (requires live Google OAuth + redirect)
 *   - Auth "loading" state mid-evaluation (transient, sub-millisecond window)
 *   - sessionStorage persistence across new tabs (new tab = new page context)
 *
 * Layout note — dual responsive structure:
 *   StaleAuthNudge.tsx renders TWO layout variants inside one banner:
 *     - Desktop: <div class="hidden sm:flex ..."> — visible at >=640px
 *     - Mobile:  <div class="sm:hidden ...">      — visible at <640px
 *   Both divs are always in the DOM; CSS display controls which is shown.
 *   This means there are always 2 dismiss buttons and 2 sign-in buttons in the DOM.
 *   Locators must use .first() to avoid Playwright strict-mode violations,
 *   OR scope to the correct viewport variant.
 *
 * Manual test steps for untestable paths are documented at the bottom of this file.
 *
 * Data isolation: Each test seeds and clears its own localStorage state.
 * Tests are idempotent — safe to run multiple times without cleanup.
 */

import { test, expect, type Page } from "@playwright/test";
import { clearAllStorage } from "../helpers/test-fixtures";

// ---------------------------------------------------------------------------
// Constants — derived from implementation contracts (StaleAuthNudge.tsx, cache.ts)
// ---------------------------------------------------------------------------

/** localStorage key for the entitlement cache — from cache.ts */
const ENTITLEMENT_CACHE_KEY = "fenrir:entitlement";

/** sessionStorage key for the dismiss flag — from StaleAuthNudge.tsx */
const NUDGE_DISMISSED_KEY = "fenrir:stale-auth-nudge-dismissed";

/** A valid Entitlement object that will pass isValidEntitlement() in cache.ts */
const STALE_ENTITLEMENT = {
  tier: "karl",
  active: true,
  platform: "stripe",
  userId: "cus_test_stale123",
  linkedAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
  checkedAt: Date.now() - 2 * 60 * 60 * 1000,      // 2 hours ago (stale)
};

/** A stale thrall entitlement (free tier — user was previously signed in but on free plan) */
const STALE_THRALL_ENTITLEMENT = {
  tier: "thrall",
  active: false,
  platform: "stripe",
  userId: "cus_test_thrall456",
  linkedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
  checkedAt: Date.now() - 3 * 60 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seeds a stale entitlement cache into localStorage to simulate a returning
 * user whose session has expired but whose cache still exists.
 * The app must be on a page (page.goto called first) before this runs.
 */
async function seedStaleEntitlement(
  page: Page,
  entitlement: object = STALE_ENTITLEMENT
): Promise<void> {
  await page.evaluate(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value);
    },
    {
      key: ENTITLEMENT_CACHE_KEY,
      value: JSON.stringify(entitlement),
    }
  );
}

/**
 * Clears all Fenrir storage AND sessionStorage dismiss flag to guarantee a
 * clean state before each test. Idempotent — safe to call on empty storage.
 */
async function resetAllState(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await clearAllStorage(page);
  // Also clear the sessionStorage dismiss flag
  await page.evaluate((key: string) => {
    sessionStorage.removeItem(key);
  }, NUDGE_DISMISSED_KEY);
}

/**
 * Reads the entitlement cache value from localStorage.
 * Returns null if the key is absent.
 */
async function getEntitlementCacheValue(page: Page): Promise<string | null> {
  return page.evaluate((key: string) => {
    return localStorage.getItem(key);
  }, ENTITLEMENT_CACHE_KEY);
}

/**
 * Reads the sessionStorage dismiss flag.
 * Returns null if not set, "true" if dismissed.
 */
async function getDismissFlag(page: Page): Promise<string | null> {
  return page.evaluate((key: string) => {
    return sessionStorage.getItem(key);
  }, NUDGE_DISMISSED_KEY);
}

/**
 * Returns the banner region locator.
 * Uses role="region" + aria-label as specified in StaleAuthNudge.tsx.
 */
function getBanner(page: Page) {
  return page.locator('[role="region"][aria-label="Sign in reminder"]');
}

/**
 * Returns the dismiss button locator scoped to the desktop layout variant.
 *
 * StaleAuthNudge renders two layout variants simultaneously (desktop + mobile),
 * both containing a dismiss button with the same aria-label. At desktop viewports
 * (>=640px) the desktop variant (hidden sm:flex) is shown. We scope to it.
 *
 * Using .first() is correct here: Playwright's locator picks the first matching
 * element in DOM order, which is the desktop dismiss button.
 */
function getDesktopDismissBtn(page: Page) {
  return page
    .locator('[role="region"][aria-label="Sign in reminder"]')
    .locator('[aria-label="Dismiss sign-in reminder"]')
    .first();
}

/**
 * Returns the sign-in button locator scoped to the desktop layout variant.
 * Uses .first() for the same reason as getDesktopDismissBtn.
 */
function getDesktopSignInBtn(page: Page) {
  return page
    .locator('[role="region"][aria-label="Sign in reminder"]')
    .locator('button:has-text("Sign in")')
    .first();
}

/**
 * Returns the dismiss button visible at mobile viewports (<640px).
 * The mobile layout div has class "sm:hidden", making only the second button
 * the visible one. We use .last() to get the mobile-specific button.
 */
function getMobileDismissBtn(page: Page) {
  return page
    .locator('[role="region"][aria-label="Sign in reminder"]')
    .locator('[aria-label="Dismiss sign-in reminder"]')
    .last();
}

/**
 * Returns the sign-in button visible at mobile viewports (<640px).
 */
function getMobileSignInBtn(page: Page) {
  return page
    .locator('[role="region"][aria-label="Sign in reminder"]')
    .locator('button:has-text("Sign in")')
    .last();
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

// Each test gets a clean slate. Nudge state depends entirely on localStorage
// and sessionStorage — both are cleared before each test.
test.beforeEach(async ({ page }) => {
  await resetAllState(page);
});

// ===========================================================================
// Suite 1 — AC-1: Returning user with expired session sees a sign-in nudge
// ===========================================================================

test.describe("AC-1: Stale cache + anonymous user shows nudge", () => {
  test("TC-SAN-001: Banner visible when stale karl entitlement cache exists and user is anonymous", async ({
    page,
  }) => {
    // Spec: StaleAuthNudge.tsx — visible when status === "anonymous" AND cache exists
    await seedStaleEntitlement(page, STALE_ENTITLEMENT);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).toBeVisible({ timeout: 5000 });
  });

  test("TC-SAN-002: Banner visible when stale thrall entitlement cache exists and user is anonymous", async ({
    page,
  }) => {
    // Spec: nudge triggers on ANY valid entitlement cache, not just karl tier
    await seedStaleEntitlement(page, STALE_THRALL_ENTITLEMENT);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).toBeVisible({ timeout: 5000 });
  });

  test("TC-SAN-003: Banner contains the sign-in CTA text", async ({ page }) => {
    // Spec: StaleAuthNudge.tsx — "Welcome back -- sign in to restore your subscription."
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    const banner = getBanner(page);
    await expect(banner).toBeVisible({ timeout: 5000 });

    // The functional nudge text must be present — this is the core user message
    await expect(banner).toContainText("sign in to restore your subscription");
  });

  test("TC-SAN-004: Banner contains atmospheric Norse copy on desktop", async ({
    page,
  }) => {
    // Spec: StaleAuthNudge.tsx desktop layout — "The wolf remembers your oath."
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    const banner = getBanner(page);
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText("The wolf remembers your oath.");
  });

  test("TC-SAN-005: Banner renders on every app route, not just dashboard", async ({
    page,
  }) => {
    // Spec: AppShell.tsx renders StaleAuthNudge on ALL pages (above UpsellBanner)
    await seedStaleEntitlement(page);

    // Navigate to /valhalla — not the dashboard
    await page.goto("/valhalla", { waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).toBeVisible({ timeout: 5000 });
  });

  test("TC-SAN-006: Sign-in button is present in the banner (desktop)", async ({ page }) => {
    // Spec: StaleAuthNudge.tsx — desktop layout renders <button>Sign in</button>
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).toBeVisible({ timeout: 5000 });
    await expect(getDesktopSignInBtn(page)).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// Suite 2 — AC-2: Nudge is dismissible
// ===========================================================================

test.describe("AC-2: Nudge is dismissible", () => {
  test("TC-SAN-010: Dismiss button is present with correct aria-label (desktop)", async ({
    page,
  }) => {
    // Spec: StaleAuthNudge.tsx — aria-label="Dismiss sign-in reminder"
    // Both layout variants contain a dismiss button; desktop is .first()
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).toBeVisible({ timeout: 5000 });
    await expect(getDesktopDismissBtn(page)).toBeVisible({ timeout: 5000 });
  });

  test("TC-SAN-011: Clicking dismiss hides the banner (desktop)", async ({ page }) => {
    // Spec: StaleAuthNudge.tsx handleDismiss() — collapses banner via animation
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).toBeVisible({ timeout: 5000 });

    await getDesktopDismissBtn(page).click();

    // After animation completes (310ms + margin), banner should be gone
    await expect(getBanner(page)).not.toBeVisible({ timeout: 2000 });
  });

  test("TC-SAN-012: Dismissing clears the entitlement cache from localStorage", async ({
    page,
  }) => {
    // Spec: StaleAuthNudge.tsx handleDismiss() — clearEntitlementCache()
    // AC-2: "Clear the stale cache if the user dismisses the nudge"
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).toBeVisible({ timeout: 5000 });

    await getDesktopDismissBtn(page).click();

    // Wait for dismiss animation
    await page.waitForTimeout(400);

    const cacheValue = await getEntitlementCacheValue(page);
    expect(cacheValue).toBeNull();
  });

  test("TC-SAN-013: Dismissing sets the sessionStorage dismiss flag", async ({
    page,
  }) => {
    // Spec: StaleAuthNudge.tsx handleDismiss() — sessionStorage.setItem(NUDGE_DISMISSED_KEY, "true")
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).toBeVisible({ timeout: 5000 });

    await getDesktopDismissBtn(page).click();

    await page.waitForTimeout(400);

    const flag = await getDismissFlag(page);
    expect(flag).toBe("true");
  });

  test("TC-SAN-014: Nudge does not reappear after dismiss (cache cleared on dismiss)", async ({
    page,
  }) => {
    // Spec: After dismiss, cache is cleared AND sessionStorage flag is set.
    // On reload, the stale cache condition is no longer met — nudge must not show.
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).toBeVisible({ timeout: 5000 });

    await getDesktopDismissBtn(page).click();
    await page.waitForTimeout(400);

    // Reload the page — the cache is gone so condition #2 is not met
    await page.reload({ waitUntil: "domcontentloaded" });

    // Nudge must NOT appear — stale cache was cleared on dismiss
    await page.waitForTimeout(500);
    await expect(getBanner(page)).not.toBeVisible();
  });
});

// ===========================================================================
// Suite 3 — AC-3: No nudge for genuinely anonymous users (no cache)
// ===========================================================================

test.describe("AC-3: No nudge for genuinely anonymous users", () => {
  test("TC-SAN-020: No banner when localStorage has no entitlement cache", async ({
    page,
  }) => {
    // Spec: StaleAuthNudge.tsx — condition: hasStaleEntitlementCache() must be true
    // A genuinely new/anonymous user has no fenrir:entitlement key
    await page.reload({ waitUntil: "domcontentloaded" });

    // Give the component time to evaluate after hydration
    await page.waitForTimeout(500);

    await expect(getBanner(page)).not.toBeVisible();
  });

  test("TC-SAN-021: No banner when entitlement cache is corrupted/invalid JSON", async ({
    page,
  }) => {
    // Spec: cache.ts getEntitlementCache() — corrupted JSON returns null → no nudge
    await page.evaluate((key: string) => {
      localStorage.setItem(key, "not-valid-json{{{");
    }, ENTITLEMENT_CACHE_KEY);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    await expect(getBanner(page)).not.toBeVisible();
  });

  test("TC-SAN-022: No banner when entitlement cache has invalid shape (missing required fields)", async ({
    page,
  }) => {
    // Spec: cache.ts isValidEntitlement() — missing tier/active/platform → null → no nudge
    await page.evaluate((key: string) => {
      localStorage.setItem(key, JSON.stringify({ tier: "karl" })); // missing active, platform, etc.
    }, ENTITLEMENT_CACHE_KEY);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    await expect(getBanner(page)).not.toBeVisible();
  });

  test("TC-SAN-023: No banner when entitlement cache has unknown tier", async ({
    page,
  }) => {
    // Spec: cache.ts — only "thrall" | "karl" tiers are valid
    const badEntitlement = {
      ...STALE_ENTITLEMENT,
      tier: "jarl", // not a valid EntitlementTier
    };
    await page.evaluate(
      ({ key, value }: { key: string; value: string }) => {
        localStorage.setItem(key, value);
      },
      { key: ENTITLEMENT_CACHE_KEY, value: JSON.stringify(badEntitlement) }
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    await expect(getBanner(page)).not.toBeVisible();
  });
});

// ===========================================================================
// Suite 4 — AC-4 proxy: After sign-in navigation, nudge disappears
// (Full OAuth flow cannot be automated; we test what we can)
// ===========================================================================

test.describe("AC-4 (proxy): Sign-in CTA navigates to /sign-in", () => {
  test("TC-SAN-030: Clicking desktop 'Sign in' button navigates to /sign-in", async ({
    page,
  }) => {
    // Spec: StaleAuthNudge.tsx handleSignIn() — router.push("/sign-in")
    // Proxy for AC-4: validates the user can reach sign-in from the nudge
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getDesktopSignInBtn(page)).toBeVisible({ timeout: 5000 });

    await getDesktopSignInBtn(page).click();
    await page.waitForURL("**/sign-in**", { timeout: 5000 });

    expect(page.url()).toContain("/sign-in");
  });

  test("TC-SAN-031: Clicking mobile 'Sign in' button navigates to /sign-in", async ({
    page,
  }) => {
    // Spec: StaleAuthNudge.tsx mobile layout also has handleSignIn() CTA
    await page.setViewportSize({ width: 375, height: 812 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getMobileSignInBtn(page)).toBeVisible({ timeout: 5000 });

    await getMobileSignInBtn(page).click();
    await page.waitForURL("**/sign-in**", { timeout: 5000 });

    expect(page.url()).toContain("/sign-in");
  });
});

// ===========================================================================
// Suite 5 — Edge Cases (from FiremanDecko handoff)
// ===========================================================================

test.describe("EC: Edge cases", () => {
  test("TC-SAN-040: No nudge when sessionStorage dismiss flag is set (even with stale cache)", async ({
    page,
  }) => {
    // Spec: StaleAuthNudge.tsx — isNudgeDismissed() returns true → setVisible(false)
    // This covers the case where the user dismissed and sessionStorage persists.
    await seedStaleEntitlement(page);

    // Simulate "already dismissed in this session"
    await page.evaluate((key: string) => {
      sessionStorage.setItem(key, "true");
    }, NUDGE_DISMISSED_KEY);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    await expect(getBanner(page)).not.toBeVisible();
  });

  test("TC-SAN-041: Nudge banner has correct ARIA role and label for screen readers", async ({
    page,
  }) => {
    // Spec: StaleAuthNudge.tsx — role="region" aria-label="Sign in reminder"
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    const banner = getBanner(page);
    await expect(banner).toBeVisible({ timeout: 5000 });

    // Verify role attribute — derived from spec, not code observation
    expect(await banner.getAttribute("role")).toBe("region");
    expect(await banner.getAttribute("aria-label")).toBe("Sign in reminder");
  });

  test("TC-SAN-042: Desktop dismiss button meets minimum 44px touch target", async ({
    page,
  }) => {
    // Spec: StaleAuthNudge.tsx — style={{ minWidth: 44, minHeight: 44 }}
    // Team norms: touch targets min 44x44px
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    const dismissBtn = getDesktopDismissBtn(page);
    await expect(dismissBtn).toBeVisible({ timeout: 5000 });

    const box = await dismissBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("TC-SAN-043: Desktop sign-in button meets minimum 36px touch target height", async ({
    page,
  }) => {
    // Spec: StaleAuthNudge.tsx — style={{ minHeight: 36 }}
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    const signInBtn = getDesktopSignInBtn(page);
    await expect(signInBtn).toBeVisible({ timeout: 5000 });

    const box = await signInBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(36);
  });

  test("TC-SAN-044: Mobile layout (375px) — nudge banner is visible", async ({
    page,
  }) => {
    // Spec: StaleAuthNudge.tsx — sm:hidden mobile layout with stacked buttons
    // Team norms: minimum 375px viewport width
    await page.setViewportSize({ width: 375, height: 812 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).toBeVisible({ timeout: 5000 });

    // Mobile sign-in and dismiss buttons must be in DOM (both layout variants exist)
    // We verify the visible one using getMobile* helpers
    await expect(getMobileSignInBtn(page)).toBeAttached();
    await expect(getMobileDismissBtn(page)).toBeAttached();
  });

  test("TC-SAN-045: Mobile dismiss button meets 44px touch target at 375px", async ({
    page,
  }) => {
    // Spec: StaleAuthNudge.tsx mobile — style={{ minWidth: 44, minHeight: 44 }}
    await page.setViewportSize({ width: 375, height: 812 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    const dismissBtn = getMobileDismissBtn(page);
    await expect(dismissBtn).toBeAttached({ timeout: 5000 });

    const box = await dismissBtn.boundingBox();
    expect(box).not.toBeNull();
    // Box may have zero width/height if hidden — check the inline style
    // Both mobile and desktop variants have minWidth/minHeight 44px in style attribute
    const styleAttr = await dismissBtn.getAttribute("style") ?? "";
    // The button has style={{ minWidth: 44, minHeight: 44 }}
    // boundingBox returns null for display:none elements, so we check the rendered button
    // At 375px the mobile dismiss button IS rendered (sm:hidden shows it)
    if (box) {
      // If we got a box, verify the size
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    } else {
      // If box is null the element is display:none — check it has inline min-size style
      expect(styleAttr).toMatch(/min-width.*44|minWidth.*44/);
    }
  });

  test("TC-SAN-046: Mobile layout (375px) — nudge does not overflow viewport", async ({
    page,
  }) => {
    // Team norms: nothing overflows at 375px
    await page.setViewportSize({ width: 375, height: 812 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    const banner = getBanner(page);
    await expect(banner).toBeVisible({ timeout: 5000 });

    const box = await banner.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
  });

  test("TC-SAN-047: Mobile dismiss collapses banner and clears cache", async ({
    page,
  }) => {
    // Full dismiss flow at mobile viewport — same behavior as desktop
    await page.setViewportSize({ width: 375, height: 812 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    const banner = getBanner(page);
    await expect(banner).toBeVisible({ timeout: 5000 });

    // Click the mobile dismiss button (last() in DOM order)
    await getMobileDismissBtn(page).click();

    // Wait for animation
    await page.waitForTimeout(400);

    // Banner gone
    await expect(banner).not.toBeVisible();

    // Cache cleared
    const cacheValue = await getEntitlementCacheValue(page);
    expect(cacheValue).toBeNull();
  });

  test("TC-SAN-048: AppShell renders nudge — confirmed present in DOM on dashboard", async ({
    page,
  }) => {
    // Spec: AppShell.tsx — StaleAuthNudge is rendered in the component tree on all pages
    await seedStaleEntitlement(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const nudgeBanner = getBanner(page);
    await expect(nudgeBanner).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// Manual Test Steps — What CANNOT be automated
// ===========================================================================

/*
 * MANUAL TEST: AC-4 — After sign-in, nudge disappears
 * =====================================================
 * Prerequisites: Running app with real Google OAuth configured.
 *
 * Steps:
 * 1. Open a fresh browser tab with no existing session.
 * 2. In DevTools console, run:
 *      localStorage.setItem('fenrir:entitlement', JSON.stringify({
 *        tier: 'karl', active: true, platform: 'stripe',
 *        userId: 'cus_test_manual', linkedAt: Date.now() - 86400000,
 *        checkedAt: Date.now() - 7200000
 *      }));
 * 3. Reload the page.
 * 4. Verify the stale auth nudge banner appears with "Welcome back" copy.
 * 5. Click "Sign in" in the nudge banner.
 * 6. Complete Google OAuth sign-in.
 * 7. After redirect back to the app, verify:
 *    - The nudge banner is NOT visible.
 *    - The entitlement cache has been refreshed (checkedAt is recent).
 *    - The user sees their correct subscription state.
 *
 * MANUAL TEST: Auth "loading" state — no nudge
 * =============================================
 * This is a transient state (sub-millisecond), untestable with Playwright.
 * The implementation guards against it: useEffect skips when status === "loading".
 *
 * MANUAL TEST: New tab after dismiss
 * ===================================
 * 1. Set a stale entitlement cache and load the app.
 * 2. Dismiss the nudge (cache is cleared, sessionStorage flag set).
 * 3. Open a new browser tab to the same app.
 * 4. Verify NO nudge appears — because the cache itself was cleared on dismiss,
 *    the condition is not met in any tab (regardless of sessionStorage).
 */
