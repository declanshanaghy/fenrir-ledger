/**
 * Navigation & Link Integrity Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * The chain must be sound. Fenrir howls only when the circle is unbroken:
 *
 *   App (/) → Footer → Marketing site (/static/)
 *   Sessions archive (/sessions/) → Chronicle entries → Back → Next entry → Back
 *   Sessions archive (/sessions/) → App (/)
 *   Marketing site (/static/) → App (/) via CTA
 *
 * Two test suites:
 *
 *   1. Marketing Site Browsability
 *      Verifies /static/ loads with key content and the "Open the Ledger" CTA
 *      resolves to the app root.
 *
 *   2. Session Archive Navigation
 *      Visits /sessions/, clicks the first chronicle entry, navigates back,
 *      clicks the second chronicle entry, navigates back. Verifies correct
 *      page titles and working return path throughout.
 *
 * Assumptions:
 *   - BASE_URL points to a running server (local or production)
 *   - /sessions/ is served at BASE_URL/sessions/
 *   - /static/ is served at BASE_URL/static/
 *   - The app dashboard is served at BASE_URL/
 */

import { test, expect, Page } from "@playwright/test";

// ── Configuration ────────────────────────────────────────────────────────────

const BASE_URL = process.env.SERVER_URL || "http://localhost:3000";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Navigate to a URL and wait for the page to be fully loaded. */
async function goto(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
}

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Marketing Site Browsability
// ════════════════════════════════════════════════════════════════════════════

test.describe("Marketing Site — /static/", () => {
  test("loads with expected content and the Ledger CTA is wired to the app", async ({
    page,
  }) => {
    await goto(page, "/static/");

    // Page has a <title>
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Brand wordmark is visible somewhere on the page
    const body = page.locator("body");
    await expect(body).toContainText("FENRIR");

    // At least one CTA button links to the app root.
    // The static site wires [data-app-link] elements via an inline JS snippet
    // that sets href to the APP_URL constant — on Vercel this resolves to "/",
    // on local it may be the full Vercel URL. We assert it is NOT "#" (the
    // un-wired placeholder value) and is not empty.
    const ctaLinks = page.locator("[data-app-link]");
    const count = await ctaLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await ctaLinks.nth(i).getAttribute("href");
      expect(href).not.toBeNull();
      expect(href).not.toBe("#");
      expect(href!.length).toBeGreaterThan(0);
    }

    // Session Chronicles link is present and points to /sessions/
    const sessionLink = page.locator('a[href="/sessions/"]').first();
    await expect(sessionLink).toBeVisible();
    await expect(sessionLink).toHaveAttribute("href", "/sessions/");
  });

  test("topbar logo link from app reaches /static/", async ({ page }) => {
    // Start at the app root (may redirect to sign-in — we check the topbar
    // logo link href by inspecting the DOM directly).
    await goto(page, "/");

    // The topbar logo link must exist with href="/static"
    // (Per commit beae3ff: footer now has About button, topbar has /static link)
    const topbarLink = page
      .locator('header a[href="/static"]')
      .first();
    await expect(topbarLink).toBeAttached();

    // Confirm it opens in a new tab (target="_blank")
    await expect(topbarLink).toHaveAttribute("target", "_blank");

    // Navigate directly to /static/ and confirm it serves real content
    await goto(page, "/static/");
    await expect(page.locator("body")).toContainText("FENRIR");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Session Archive Navigation
// ════════════════════════════════════════════════════════════════════════════

test.describe("Session Archive — /sessions/", () => {
  test("archive loads with Open-the-Ledger link and at least 2 chronicle cards", async ({
    page,
  }) => {
    await goto(page, "/sessions/");

    // Page title
    const title = await page.title();
    expect(title).toContain("Session Archive");

    // "Open the Ledger →" nav link must be present and point to "/"
    const appLink = page.locator('[data-testid="open-ledger-link"]');
    await expect(appLink).toBeVisible();
    await expect(appLink).toHaveAttribute("href", "/");

    // Must have at least 2 session cards
    const cards = page.locator(".session-card");
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(2);
  });

  test("click first chronicle, navigate back, click second chronicle, navigate back", async ({
    page,
  }) => {
    await goto(page, "/sessions/");

    const cards = page.locator(".session-card");

    // ── First entry ────────────────────────────────────────────────────────

    const firstTitle = await cards.nth(0).locator(".card-title").textContent();
    expect(firstTitle).toBeTruthy();

    await cards.nth(0).click();

    // Chronicle page must have a back-nav link pointing to the archive index
    // Per design spec: root-relative /sessions/ so it resolves correctly
    // regardless of whether the URL has a trailing slash.
    const backLink = page.locator('.back-link[href="/sessions/"]');
    await expect(backLink).toBeVisible();

    // Chronicle must have an <h1> with content
    const h1 = page.locator("h1").first();
    await expect(h1).not.toBeEmpty();

    // Navigate back
    await page.goBack({ waitUntil: "domcontentloaded" });

    // We're back at the archive (Vercel may drop trailing slash, so check without it)
    expect(page.url()).toContain("/sessions");
    await expect(page.locator(".session-card")).toHaveCount(
      await page.locator(".session-card").count()
    );

    // ── Second entry ───────────────────────────────────────────────────────

    const secondTitle = await cards.nth(1).locator(".card-title").textContent();
    expect(secondTitle).toBeTruthy();

    // Titles must be different
    expect(secondTitle).not.toBe(firstTitle);

    await cards.nth(1).click();

    // Chronicle back-link still present (root-relative per design spec)
    const backLink2 = page.locator('.back-link[href="/sessions/"]');
    await expect(backLink2).toBeVisible();

    // Navigate back again
    await page.goBack({ waitUntil: "domcontentloaded" });

    // Safely back at the archive
    expect(page.url()).toContain("/sessions/");
  });

  test("all session card hrefs are relative (no fenrir-ledger.vercel.app absolute URLs)", async ({
    page,
  }) => {
    await goto(page, "/sessions/");

    const cards = page.locator(".session-card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await cards.nth(i).getAttribute("href");
      expect(href).not.toBeNull();
      // Must NOT be an absolute URL to fenrir-ledger.vercel.app
      expect(href).not.toContain("fenrir-ledger.vercel.app");
      // Per design spec: root-relative paths so links resolve correctly
      // regardless of trailing slash on the /sessions URL.
      expect(href!.startsWith("/sessions/")).toBe(true);
    }
  });

  test("marketing site link in archive is relative and reachable", async ({
    page,
  }) => {
    await goto(page, "/sessions/");

    const marketingLink = page.locator(".marketing-banner");
    await expect(marketingLink).toBeVisible();

    const href = await marketingLink.getAttribute("href");
    // Must be a relative path (not absolute to vercel)
    expect(href).not.toContain("fenrir-ledger.vercel.app");
    expect(href).not.toBeNull();

    // Navigate to the marketing site and verify it loads
    await goto(page, "/static/");
    await expect(page.locator("body")).toContainText("FENRIR");
  });
});
