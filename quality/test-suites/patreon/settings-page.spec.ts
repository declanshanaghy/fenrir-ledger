/**
 * Settings Page Test Suite -- Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the /settings route against the soft-gate design spec in:
 *   - development/frontend/src/app/settings/page.tsx
 *   - development/frontend/src/app/settings/layout.tsx
 *   - development/frontend/src/components/entitlement/SubscriptionGate.tsx
 *   - development/frontend/src/components/entitlement/SealedRuneModal.tsx
 *   - development/frontend/src/components/entitlement/PatreonSettings.tsx
 *   - development/frontend/src/components/layout/SideNav.tsx
 *
 * Updated for soft-gate behavior: Settings page uses mode="soft" on all
 * SubscriptionGate instances. Feature sections are always visible with
 * subscribe banners above them for non-subscribers. No modals auto-open.
 *
 * Devil's Advocate mindset: test what the SPEC says, not what the code produces.
 * Every assertion traces back to an explicit design requirement.
 *
 * AC coverage:
 *   AC-1: /settings route loads and renders without errors
 *   AC-2: Settings page has "Settings" in the title/heading
 *   AC-3: Settings link appears in sidebar navigation
 *   AC-4: Clicking Settings link navigates to /settings
 *   AC-6: Settings page shows PatreonSettings section (unlinked state)
 *   AC-7: Settings page shows 3 soft-gated feature sections (always visible)
 *   AC-8: Soft gate banners present for Thrall users (no modal auto-open)
 *   AC-9: Soft gate banner content and structure
 *   AC-10: Soft gate feature content always visible after any interaction
 */

import { test, expect } from "@playwright/test";
import { clearAllStorage } from "../helpers/test-fixtures";

// -- Test target override ----------------------------------------------------
// Uses SERVER_URL env var (set by orchestrator or run script).
// Falls back to the playwright.config.ts default (port 9653).
// Explicit full URLs ensure we always hit the configured test server.

const BASE_URL = process.env.SERVER_URL ?? "http://localhost:9653";

// -- Setup -------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  // Navigate to settings to initialize browser context, then clear all storage
  // to guarantee a clean anonymous (Thrall) state.
  await page.goto(`${BASE_URL}/`);
  await clearAllStorage(page);
  // Also clear any entitlement or upsell dismissal state
  await page.evaluate(() => {
    localStorage.removeItem("fenrir:entitlement");
    localStorage.removeItem("fenrir:upsell-dismissed");
  });
});

// ============================================================================
// AC-1: /settings route loads and renders without errors
// ============================================================================

test.describe("Settings Page -- AC-1: Route loads", () => {
  test("TC-SP-01: /settings route returns HTTP 200 and renders page shell", async ({
    page,
  }) => {
    // Spec: /settings is a valid Next.js route with layout.tsx + page.tsx.
    // The route must not 404 or throw a crash error.
    const response = await page.goto(`${BASE_URL}/settings`, {
      waitUntil: "networkidle",
    });

    // HTTP status must be 200 -- not 404, not 500
    expect(response?.status()).toBe(200);

    // Page must contain the root shell element (main landmark)
    await expect(page.locator("main")).toBeVisible();
  });

  test("TC-SP-02: Settings page renders page heading element", async ({
    page,
  }) => {
    // Spec: settings/page.tsx renders <h1> with text "Settings"
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("Settings");
  });
});

// ============================================================================
// AC-2: Settings page has "Settings" in the title/heading
// ============================================================================

test.describe("Settings Page -- AC-2: Heading and title", () => {
  test("TC-SP-03: page <title> contains 'Settings' (verified via SSR HTML)", async ({
    page,
  }) => {
    // Spec: settings/layout.tsx exports metadata { title: "Settings" }
    // Next.js App Router renders the title server-side as "Settings -- Fenrir Ledger".
    //
    // Note: In Next.js 15 App Router dev mode, React clears and re-hoists the
    // <title> element during hydration, causing document.title to temporarily
    // be empty even after networkidle. Instead, we verify the SSR HTML response
    // contains the correct <title> tag via a direct HTTP fetch.
    //
    // This tests the metadata contract (layout.tsx exports metadata.title = "Settings")
    // which is what the spec requires -- not the transient DOM state.
    const response = await page.request.get(`${BASE_URL}/settings`);
    const html = await response.text();

    // The SSR HTML must contain the correct <title> tag
    expect(html).toContain("<title>Settings");
  });

  test("TC-SP-04: page h1 reads 'Settings' exactly", async ({ page }) => {
    // Spec: settings/page.tsx -- <h1 className="font-display text-xl text-gold ...">Settings</h1>
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const h1 = page.locator("h1").first();
    await expect(h1).toHaveText("Settings");
  });

  test("TC-SP-05: atmospheric subtitle 'Forge your preferences' appears below heading", async ({
    page,
  }) => {
    // Spec: settings/page.tsx -- <p className="text-xs text-muted-foreground ...">Forge your preferences...</p>
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const subtitle = page
      .locator("p")
      .filter({ hasText: "Forge your preferences" });
    await expect(subtitle).toBeVisible();
  });
});

// ============================================================================
// AC-3: Settings link appears in sidebar navigation
// ============================================================================

test.describe("Settings Page -- AC-3: Sidebar Settings link", () => {
  test("TC-SP-06: Settings nav link exists in sidebar with href='/settings'", async ({
    page,
  }) => {
    // Spec: SideNav.tsx NAV_ITEMS includes { label: "Settings", href: "/settings", icon: Settings }
    // The link must be present and point to /settings.
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    const settingsLink = page.locator('nav a[href="/settings"]');
    await expect(settingsLink).toBeVisible();
  });

  test("TC-SP-07: Settings nav link shows 'Settings' label text when sidebar is expanded", async ({
    page,
  }) => {
    // Spec: SideNav expanded state renders <span className="font-body truncate">Settings</span>
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    // Ensure sidebar is expanded (default state)
    const settingsLink = page.locator('nav a[href="/settings"]');
    await expect(settingsLink).toContainText("Settings");
  });

  test("TC-SP-08: Settings nav link uses Lucide Settings icon (not a rune)", async ({
    page,
  }) => {
    // Spec: SideNav NAV_ITEMS for Settings uses icon: Settings (Lucide) with NO iconNode.
    // This means the icon is rendered as an <svg> (Lucide), not a rune text span.
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    const settingsLink = page.locator('nav a[href="/settings"]');
    // Lucide icons render as <svg> elements
    const icon = settingsLink.locator("svg");
    await expect(icon).toBeAttached();
  });
});

// ============================================================================
// AC-4: Clicking Settings link navigates to /settings
// ============================================================================

test.describe("Settings Page -- AC-4: Navigation to /settings", () => {
  test("TC-SP-09: clicking Settings link navigates to /settings", async ({
    page,
  }) => {
    // Spec: SideNav href="/settings" -- clicking must navigate, URL must change.
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    const settingsLink = page.locator('nav a[href="/settings"]');
    await settingsLink.click();

    await page.waitForURL(`${BASE_URL}/settings`, { timeout: 5000 });
    expect(page.url()).toBe(`${BASE_URL}/settings`);
  });

  test("TC-SP-10: Settings link has active styling when on /settings route", async ({
    page,
  }) => {
    // Spec: SideNav isActive logic -- when pathname === "/settings", link gets
    // class "text-gold border-l-2 border-gold" (active styles).
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const settingsLink = page.locator('nav a[href="/settings"]');
    const classList = await settingsLink.getAttribute("class");
    expect(classList).not.toBeNull();
    // Active link has text-gold per SideNav spec
    expect(classList).toContain("text-gold");
  });

  test("TC-SP-11: Settings link is NOT active on dashboard (/)", async ({
    page,
  }) => {
    // Spec: SideNav isActive is pathname === href. On /, /settings link is inactive.
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    const settingsLink = page.locator('nav a[href="/settings"]');
    const classList = await settingsLink.getAttribute("class");
    expect(classList).not.toBeNull();
    // Inactive links have border-transparent per SideNav spec
    expect(classList).toContain("border-transparent");
  });
});

// ============================================================================
// AC-6: Settings page shows PatreonSettings section (unlinked state)
// ============================================================================

test.describe("Settings Page -- AC-6: PatreonSettings section", () => {
  test("TC-SP-12: Patreon section IS visible for anonymous users (no AuthGate -- PR #110)", async ({
    page,
  }) => {
    // UPDATED: settings/page.tsx previously wrapped PatreonSettings in <AuthGate>,
    // but PR #110 (feat/anon-patreon-client) removed AuthGate to support anonymous
    // Patreon subscriptions. Anonymous users now see the "Subscribe via Patreon" CTA.
    //
    // Spec (post-PR #110): PatreonSettings handles auth-awareness internally.
    // Anonymous users must see the Patreon section with the subscribe CTA.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    // PatreonSettings section has aria-label="Patreon subscription"
    const patreonSection = page.locator('[aria-label="Patreon subscription"]');
    // Must be visible -- AuthGate removed, anonymous users can access the Patreon CTA
    await expect(patreonSection).toBeVisible();
  });

  test.skip("TC-SP-13: 'Link your Patreon' button text visible in unlinked state when authenticated", async ({
    page,
  }) => {
    // SKIPPED: This test injects a mock Google session via sessionStorage, but
    // the auth verification happens server-side (requireAuth checks the token
    // against Google's userinfo endpoint). A mock token cannot pass server
    // verification on Vercel deployments. This test requires real OAuth
    // credentials and is covered in manual integration testing.
    //
    // Spec: PatreonSettings unlinked state renders "Link Patreon" button when
    // the user is authenticated but has not linked their Patreon account.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const linkPatreonButton = page
      .locator("button")
      .filter({ hasText: "Link Patreon" });
    await expect(linkPatreonButton).toBeVisible();
  });
});

// ============================================================================
// AC-7: Settings page shows 3 soft-gated feature sections (always visible)
// ============================================================================

test.describe("Settings Page -- AC-7: Three soft-gated feature sections", () => {
  test("TC-SP-14: Cloud Sync section is visible for Thrall user (soft gate)", async ({
    page,
  }) => {
    // Spec (soft gate): settings/page.tsx -- <SubscriptionGate feature="cloud-sync" mode="soft">
    // Soft gate always renders children. Thrall users see a banner + the section content.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const cloudSyncSection = page.locator('[aria-label="Cloud Sync"]');
    await expect(cloudSyncSection).toBeVisible();
    await expect(cloudSyncSection).toContainText("Cloud Sync");
  });

  test("TC-SP-15: Multi-Household section is visible for Thrall user (soft gate)", async ({
    page,
  }) => {
    // Spec (soft gate): settings/page.tsx -- <SubscriptionGate feature="multi-household" mode="soft">
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const multiHouseholdSection = page.locator(
      '[aria-label="Multi-Household"]'
    );
    await expect(multiHouseholdSection).toBeVisible();
    await expect(multiHouseholdSection).toContainText("Multi-Household");
  });

  test("TC-SP-16: Data Export section is visible for Thrall user (soft gate)", async ({
    page,
  }) => {
    // Spec (soft gate): settings/page.tsx -- <SubscriptionGate feature="data-export" mode="soft">
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const dataExportSection = page.locator('[aria-label="Data Export"]');
    await expect(dataExportSection).toBeVisible();
    await expect(dataExportSection).toContainText("Data Export");
  });

  test("TC-SP-17: All 3 sections show subscribe banners for Thrall user", async ({
    page,
  }) => {
    // Spec (soft gate): Each SubscriptionGate in soft mode renders a SoftGateBanner
    // with "Unlock this feature" text when hasFeature() === false.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const banners = page.locator('[aria-label="Unlock this feature"]');
    await expect(banners).toHaveCount(3);
  });
});

// ============================================================================
// AC-8: Soft gate -- no modal auto-opens; banners present instead
// ============================================================================

test.describe("Settings Page -- AC-8: Soft gate banners for Thrall users", () => {
  test("TC-SP-18: No SealedRuneModal auto-opens on /settings (soft gate)", async ({
    page,
  }) => {
    // Spec (soft gate): In soft mode, modals never auto-open. The banner is
    // the primary upsell surface. Modals only open via explicit "Learn more" click.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const openDialogs = page.locator('[role="dialog"]');
    const dialogCount = await openDialogs.count();
    expect(dialogCount).toBe(0);
  });

  test("TC-SP-19: Subscribe banner for Cloud Sync contains 'Unlock this feature'", async ({
    page,
  }) => {
    // Spec (soft gate): SoftGateBanner renders "Unlock this feature" heading.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const banners = page.locator('[aria-label="Unlock this feature"]');
    // The first banner corresponds to cloud-sync (DOM order matches page order)
    await expect(banners.first()).toBeVisible();
    await expect(banners.first()).toContainText("Unlock this feature");
  });

  test("TC-SP-20: Subscribe banner shows platform-appropriate CTA text", async ({
    page,
  }) => {
    // Spec (soft gate): SoftGateBanner shows "Subscribe" for Stripe or
    // "Learn more" for Patreon, depending on active platform.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const banner = page.locator('[aria-label="Unlock this feature"]').first();
    await expect(banner).toBeVisible();

    // Must contain one of the platform-specific CTAs
    const bannerText = await banner.textContent();
    const hasSubscribe = bannerText?.includes("Subscribe");
    const hasLearnMore = bannerText?.includes("Learn more");
    expect(hasSubscribe || hasLearnMore).toBe(true);
  });

  test("TC-SP-21: Each banner contains a rune icon (decorative)", async ({
    page,
  }) => {
    // Spec (soft gate): SoftGateBanner renders a decorative rune span with aria-hidden.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const runeIcons = page.locator(
      '[aria-label="Unlock this feature"] [aria-hidden="true"]'
    );
    // Each of the 3 banners has a rune icon
    const count = await runeIcons.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// AC-9: Soft gate banner content and structure
// ============================================================================

test.describe("Settings Page -- AC-9: Soft gate banner content", () => {
  test("TC-SP-22: Banner has gold-bordered styling", async ({ page }) => {
    // Spec (soft gate): SoftGateBanner has className "border border-gold/30".
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const banner = page.locator('[aria-label="Unlock this feature"]').first();
    await expect(banner).toBeVisible();
    // Verify the banner has a border (rendered as a visible region)
    const classList = await banner.getAttribute("class");
    expect(classList).toContain("border");
  });

  test("TC-SP-23: Banner shows subscription description text", async ({
    page,
  }) => {
    // Spec (soft gate): SoftGateBanner shows a description:
    //   Stripe: "Subscribe to Karl for full access -- $3.99/month."
    //   Patreon: "Available to Karl supporters. Link your Patreon to unlock."
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const banner = page.locator('[aria-label="Unlock this feature"]').first();
    const bannerText = await banner.textContent();

    // Must contain one of the platform-specific descriptions
    const hasStripeDesc = bannerText?.includes("$3.99/month");
    const hasPatreonDesc = bannerText?.includes("Link your Patreon");
    expect(hasStripeDesc || hasPatreonDesc).toBe(true);
  });

  test("TC-SP-24: 'Learn more' button in Patreon banner opens SealedRuneModal", async ({
    page,
  }) => {
    // Spec (soft gate, Patreon): "Learn more" button opens SealedRuneModal.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    // Check if "Learn more" buttons exist (Patreon mode)
    const learnMoreButtons = page.locator("button", { hasText: "Learn more" });
    const count = await learnMoreButtons.count();

    if (count > 0) {
      // Click the first "Learn more" button
      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll<HTMLElement>("button")
        );
        const learnMore = buttons.find(
          (b) => b.textContent?.trim() === "Learn more"
        );
        if (learnMore) learnMore.click();
      });
      await page.waitForTimeout(400);

      // SealedRuneModal should now be open
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog.first()).toBeAttached();
      await expect(dialog.first()).toContainText("THIS RUNE IS SEALED");
    }
    // If no "Learn more" buttons (Stripe mode), test is a no-op -- platform-dependent
  });

  test("TC-SP-25: SealedRuneModal opened from banner can be dismissed", async ({
    page,
  }) => {
    // Spec (soft gate, Patreon): SealedRuneModal opened via "Learn more" can be
    // closed via the dismiss button, returning to the banner + children state.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    // Open modal via "Learn more" (Patreon mode only)
    const learnMoreButtons = page.locator("button", { hasText: "Learn more" });
    const count = await learnMoreButtons.count();

    if (count > 0) {
      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll<HTMLElement>("button")
        );
        const learnMore = buttons.find(
          (b) => b.textContent?.trim() === "Learn more"
        );
        if (learnMore) learnMore.click();
      });
      await page.waitForTimeout(400);

      // Dismiss the modal
      await page.evaluate(() => {
        const btn = document.querySelector<HTMLElement>(
          'button[aria-label="Dismiss and continue without premium features"]'
        );
        if (btn) btn.click();
      });
      await page.waitForTimeout(400);

      // Modal should be closed
      const openDialogs = page.locator('[role="dialog"]');
      const dialogCount = await openDialogs.count();
      expect(dialogCount).toBe(0);

      // Feature sections should still be visible (soft gate)
      const cloudSync = page.locator('[aria-label="Cloud Sync"]');
      await expect(cloudSync).toBeVisible();
    }
  });
});

// ============================================================================
// AC-10: Soft gate -- feature content always visible after any interaction
// ============================================================================

test.describe("Settings Page -- AC-10: Soft gate feature visibility", () => {
  test("TC-SP-26: Feature sections remain visible even after modal interaction", async ({
    page,
  }) => {
    // Spec (soft gate): Children are always rendered. Opening and closing the
    // SealedRuneModal does not hide the feature content.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    // Verify all 3 feature sections are visible
    await expect(page.locator('[aria-label="Cloud Sync"]')).toBeVisible();
    await expect(page.locator('[aria-label="Multi-Household"]')).toBeVisible();
    await expect(page.locator('[aria-label="Data Export"]')).toBeVisible();

    // Open a modal if possible (Patreon mode)
    await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll<HTMLElement>("button")
      );
      const learnMore = buttons.find(
        (b) => b.textContent?.trim() === "Learn more"
      );
      if (learnMore) learnMore.click();
    });
    await page.waitForTimeout(400);

    // Dismiss if modal opened
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        'button[aria-label="Dismiss and continue without premium features"]'
      );
      if (btn) btn.click();
    });
    await page.waitForTimeout(400);

    // All sections must still be visible after modal interaction
    await expect(page.locator('[aria-label="Cloud Sync"]')).toBeVisible();
    await expect(page.locator('[aria-label="Multi-Household"]')).toBeVisible();
    await expect(page.locator('[aria-label="Data Export"]')).toBeVisible();
  });

  test("TC-SP-27: Banners remain after modal open/close cycle", async ({
    page,
  }) => {
    // Spec (soft gate): The subscribe banner is persistent -- opening and closing
    // the modal does not dismiss the banner.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const bannersBefore = await page
      .locator('[aria-label="Unlock this feature"]')
      .count();
    expect(bannersBefore).toBe(3);

    // Open and close a modal (Patreon mode)
    await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll<HTMLElement>("button")
      );
      const learnMore = buttons.find(
        (b) => b.textContent?.trim() === "Learn more"
      );
      if (learnMore) learnMore.click();
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        'button[aria-label="Dismiss and continue without premium features"]'
      );
      if (btn) btn.click();
    });
    await page.waitForTimeout(400);

    // Banners must still be present
    const bannersAfter = await page
      .locator('[aria-label="Unlock this feature"]')
      .count();
    expect(bannersAfter).toBe(3);
  });

  test("TC-SP-28: 'Learn more' button in banner can open modal multiple times", async ({
    page,
  }) => {
    // Spec (soft gate, Patreon): "Learn more" can be clicked repeatedly to open
    // the SealedRuneModal, and dismissed each time.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const learnMoreButtons = page.locator("button", { hasText: "Learn more" });
    const count = await learnMoreButtons.count();

    if (count > 0) {
      // First open/close cycle
      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll<HTMLElement>("button")
        );
        const learnMore = buttons.find(
          (b) => b.textContent?.trim() === "Learn more"
        );
        if (learnMore) learnMore.click();
      });
      await page.waitForTimeout(400);
      await expect(page.locator('[role="dialog"]').first()).toBeAttached();

      await page.evaluate(() => {
        const btn = document.querySelector<HTMLElement>(
          'button[aria-label="Dismiss and continue without premium features"]'
        );
        if (btn) btn.click();
      });
      await page.waitForTimeout(400);
      expect(await page.locator('[role="dialog"]').count()).toBe(0);

      // Second open/close cycle
      await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll<HTMLElement>("button")
        );
        const learnMore = buttons.find(
          (b) => b.textContent?.trim() === "Learn more"
        );
        if (learnMore) learnMore.click();
      });
      await page.waitForTimeout(400);
      await expect(page.locator('[role="dialog"]').first()).toBeAttached();
    }
  });

  test("TC-SP-29: Subscribe button has minimum 44px touch target", async ({
    page,
  }) => {
    // Spec: All interactive elements must have minimum 44x44px touch targets.
    // The Subscribe button (Stripe) and Learn more button (Patreon) in the
    // SoftGateBanner must meet this requirement.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const banner = page.locator('[aria-label="Unlock this feature"]').first();
    await expect(banner).toBeVisible();

    // Find the CTA button inside the first banner
    const ctaButton = banner.locator("button");
    const box = await ctaButton.boundingBox();
    expect(box).not.toBeNull();
    // Height must be at least 44px (WCAG touch target)
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("TC-SP-30: all three feature sections show 'Coming soon' text", async ({
    page,
  }) => {
    // Spec: Each feature section placeholder includes "Coming soon to Karl supporters."
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const comingSoonMessages = page.locator("p", {
      hasText: "Coming soon to Karl supporters.",
    });
    await expect(comingSoonMessages).toHaveCount(3);
  });
});

// ============================================================================
// Edge cases -- Devil's Advocate specials
// ============================================================================

test.describe("Settings Page -- Edge Cases", () => {
  test("TC-SP-31: navigating directly to /settings from /valhalla works", async ({
    page,
  }) => {
    // Edge case: Settings route must be accessible from any other route,
    // not just from the sidebar (tests route integrity).
    await page.goto(`${BASE_URL}/valhalla`, { waitUntil: "networkidle" });

    const settingsLink = page.locator('nav a[href="/settings"]');
    await expect(settingsLink).toBeVisible();
    await settingsLink.click();

    await page.waitForURL(`${BASE_URL}/settings`);
    await expect(page.locator("h1")).toContainText("Settings");
  });

  test("TC-SP-32: /settings page renders on mobile viewport (375px)", async ({
    page,
  }) => {
    // Spec: Settings page is mobile-first, minimum 375px width.
    await page.setViewportSize({ width: 375, height: 812 });
    const response = await page.goto(`${BASE_URL}/settings`, {
      waitUntil: "networkidle",
    });

    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText("Settings");
  });

  test("TC-SP-33: /settings page renders on tablet viewport (768px)", async ({
    page,
  }) => {
    // Spec: responsive layouts with md: breakpoints.
    await page.setViewportSize({ width: 768, height: 1024 });
    const response = await page.goto(`${BASE_URL}/settings`, {
      waitUntil: "networkidle",
    });

    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText("Settings");
  });

  test("TC-SP-34: reloading /settings with cleared entitlement cache shows Thrall state with banners", async ({
    page,
  }) => {
    // Edge case: Entitlement state must always default to Thrall when no
    // localStorage cache exists. This ensures gating is never bypassed by
    // missing cache entries.
    await page.goto(`${BASE_URL}/settings`);
    await page.evaluate(() => {
      localStorage.removeItem("fenrir:entitlement");
    });
    await page.reload({ waitUntil: "networkidle" });

    // With no entitlement cache, default is Thrall -- soft gate shows banners
    const banners = page.locator('[aria-label="Unlock this feature"]');
    const count = await banners.count();
    expect(count).toBe(3);

    // Feature sections must still be visible (soft gate does not hide children)
    await expect(page.locator('[aria-label="Cloud Sync"]')).toBeVisible();
    await expect(page.locator('[aria-label="Multi-Household"]')).toBeVisible();
    await expect(page.locator('[aria-label="Data Export"]')).toBeVisible();
  });

  test("TC-SP-35: No modals auto-open on /settings even with cleared entitlement cache", async ({
    page,
  }) => {
    // Soft gate does not auto-open modals. Even with no entitlement cache,
    // the settings page should show banners -- not modals.
    await page.goto(`${BASE_URL}/settings`);
    await page.evaluate(() => {
      localStorage.removeItem("fenrir:entitlement");
    });
    await page.reload({ waitUntil: "networkidle" });

    // No dialogs should be auto-opened
    const dialogs = page.locator('[role="dialog"]');
    const dialogCount = await dialogs.count();
    expect(dialogCount).toBe(0);
  });
});

// ============================================================================
// Helper: dismiss all visible SealedRuneModals
// ============================================================================

/**
 * Dismisses all currently open SealedRuneModals by directly invoking DOM
 * click() on each dismiss button via page.evaluate().
 *
 * Why page.evaluate() instead of locator.click():
 *   The Next.js dev mode <nextjs-portal> element and Radix overlay layers
 *   can intercept Playwright's pointer-event-based clicks. page.evaluate()
 *   fires a direct DOM click that bypasses all overlay barriers.
 *   This is the same pattern used in sidebar.spec.ts for the expand button.
 *
 * Used to reveal the underlying settings page content for assertions
 * that target the page structure, not the modal content.
 */
async function dismissAllSealedRuneModals(
  page: import("@playwright/test").Page
): Promise<void> {
  // Keep dismissing until no more dismiss buttons exist in the DOM
  let maxAttempts = 10;
  while (maxAttempts-- > 0) {
    // Use page.evaluate() to directly fire DOM click -- bypasses portal interception
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(
        'button[aria-label="Dismiss and continue without premium features"]'
      );
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!clicked) break;
    await page.waitForTimeout(300);
  }
}
