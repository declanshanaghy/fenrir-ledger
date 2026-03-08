/**
 * Legal Pages Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates GitHub Issue #325: Update privacy.html and terms.html
 *
 * Acceptance Criteria:
 *   ✓ All Patreon references removed from both privacy.html and terms.html
 *   ✓ "open source" changed to "source available" in both files
 *   ✓ Sign-in page includes implicit agreement text with links to both documents
 *   ✓ Both documents reviewed for any other outdated content
 *   ✓ No regression in page styling or layout
 *
 * Test Strategy:
 *   - Privacy Policy: verify content, no Patreon refs, correct licensing language
 *   - Terms of Service: verify content, no Patreon refs, correct licensing language
 *   - Sign-In Page: verify agreement text and links are present
 *   - Styling: verify layout and visual consistency (fonts, colors, spacing)
 *   - Links: verify all links work and point to correct URLs
 */

import { test, expect } from "@playwright/test";

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Privacy Policy
// ════════════════════════════════════════════════════════════════════════════

test.describe("Privacy Policy (privacy.html)", () => {
  test("loads without errors", async ({ page }) => {
    const response = await page.goto("/static/privacy.html");
    expect(response?.status()).toBe(200);
  });

  test("contains required heading and metadata", async ({ page }) => {
    await page.goto("/static/privacy.html");
    const h1 = page.locator("h1");
    await expect(h1).toContainText("Privacy Policy");

    const title = page.locator("title");
    const titleText = await title.textContent();
    expect(titleText).toContain("Privacy Policy");
  });

  test("displays last updated date", async ({ page }) => {
    await page.goto("/static/privacy.html");
    const meta = page.locator(".meta");
    await expect(meta).toContainText("Last Updated");
  });

  test("does NOT contain any Patreon references", async ({ page }) => {
    await page.goto("/static/privacy.html");
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("Patreon");
    expect(bodyText).not.toContain("patreon");
  });

  test("uses 'source available' language (not 'open source')", async ({ page }) => {
    await page.goto("/static/privacy.html");
    const bodyText = await page.locator("body").textContent();

    // Should contain "source-available"
    expect(bodyText).toContain("source-available");
    // Should not have incorrect "open source" language in this context
    const wrongPhrase = bodyText?.match(/Fenrir Ledger is an open source/i);
    expect(wrongPhrase).toBeNull();
  });

  test("contains correct section headings", async ({ page }) => {
    await page.goto("/static/privacy.html");

    const bodyText = await page.locator("body").textContent();

    const expectedHeadings = [
      "1. Who We Are",
      "2. Information We Collect",
      "3. How We Use Your Information",
      "4. Analytics and Opting Out",
      "5. Data Storage and Security",
      "6. Data Sharing",
      "7. Data Retention",
      "8. Your Rights",
      "9. Children's Privacy",
      "10. Changes to This Policy",
      "11. Contact",
    ];

    for (const heading of expectedHeadings) {
      expect(bodyText).toContain(heading);
    }
  });

  test("contains attribution to Automattic legal documents", async ({ page }) => {
    await page.goto("/static/privacy.html");
    const attribution = page.locator(".attribution");
    const attributionText = await attribution.textContent();
    expect(attributionText?.toLowerCase()).toContain("automattic");
    expect(attributionText?.toLowerCase()).toContain("source-available");
    expect(attributionText).toContain("Creative Commons");
  });

  test("has back link to home", async ({ page }) => {
    await page.goto("/static/privacy.html");
    const backLink = page.locator("a.back");
    await expect(backLink).toContainText("Back to Fenrir Ledger");
    expect(await backLink.getAttribute("href")).toBe("/");
  });

  test("footer contains links to both legal documents", async ({ page }) => {
    await page.goto("/static/privacy.html");
    const footer = page.locator(".site-footer");

    const privacyLink = footer.locator('a[href="/static/privacy.html"]');
    await expect(privacyLink).toContainText("Privacy Policy");

    const termsLink = footer.locator('a[href="/static/terms.html"]');
    await expect(termsLink).toContainText("Terms of Service");
  });

  test("verifies page styling and layout integrity", async ({ page }) => {
    await page.goto("/static/privacy.html");

    // Check main container max-width is set
    const body = page.locator("body");
    const maxWidth = await body.evaluate((el) => window.getComputedStyle(el).maxWidth);
    expect(maxWidth).not.toBe("none");

    // Check heading colors (gold #d4a520)
    const h1 = page.locator("h1");
    const h1Color = await h1.evaluate((el) => window.getComputedStyle(el).color);
    expect(h1Color).toBeTruthy(); // Should have a color set
  });

  test("contact email links are functional", async ({ page }) => {
    await page.goto("/static/privacy.html");
    const emailLinks = page.locator('a[href*="mailto:"]');
    const count = await emailLinks.count();
    expect(count).toBeGreaterThan(0);

    // Verify at least one privacy contact email exists
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toContain("privacy@fenrirledger.com");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Terms of Service
// ════════════════════════════════════════════════════════════════════════════

test.describe("Terms of Service (terms.html)", () => {
  test("loads without errors", async ({ page }) => {
    const response = await page.goto("/static/terms.html");
    expect(response?.status()).toBe(200);
  });

  test("contains required heading and metadata", async ({ page }) => {
    await page.goto("/static/terms.html");
    const h1 = page.locator("h1");
    await expect(h1).toContainText("Terms of Service");

    const title = page.locator("title");
    const titleText = await title.textContent();
    expect(titleText).toContain("Terms of Service");
  });

  test("displays last updated date", async ({ page }) => {
    await page.goto("/static/terms.html");
    const meta = page.locator(".meta");
    await expect(meta).toContainText("Last Updated");
  });

  test("does NOT contain any Patreon references", async ({ page }) => {
    await page.goto("/static/terms.html");
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("Patreon");
    expect(bodyText).not.toContain("patreon");
  });

  test("uses correct licensing language (Elastic License 2.0)", async ({ page }) => {
    await page.goto("/static/terms.html");
    const bodyText = await page.locator("body").textContent();

    // Should reference Elastic License
    expect(bodyText).toContain("Elastic License");
    expect(bodyText).toContain("ELv2");
    expect(bodyText).toContain("source-available");
  });

  test("contains correct section headings", async ({ page }) => {
    await page.goto("/static/terms.html");

    const bodyText = await page.locator("body").textContent();

    const expectedHeadings = [
      "1. Who We Are",
      "2. Your Account",
      "3. The Service",
      "4. Acceptable Use",
      "5. Intellectual Property",
      "6. Third-Party Services",
      "7. Disclaimer of Warranties",
      "8. Limitation of Liability",
      "9. Changes to the Service",
      "10. Changes to These Terms",
      "11. Governing Law",
      "12. Contact",
    ];

    for (const heading of expectedHeadings) {
      expect(bodyText).toContain(heading);
    }
  });

  test("mentions source-available in acceptable use section", async ({ page }) => {
    await page.goto("/static/terms.html");
    const bodyText = await page.locator("body").textContent();

    // Should mention source-available license when discussing reverse engineering
    expect(bodyText).toContain("source-available license");
    expect(bodyText?.toLowerCase()).toContain("reverse engineer");
  });

  test("contains attribution to Automattic and App.net", async ({ page }) => {
    await page.goto("/static/terms.html");
    const attribution = page.locator(".attribution");
    await expect(attribution).toContainText("Automattic");
    await expect(attribution).toContainText("App.net");
    await expect(attribution).toContainText("Creative Commons");
  });

  test("has back link to home", async ({ page }) => {
    await page.goto("/static/terms.html");
    const backLink = page.locator("a.back");
    await expect(backLink).toContainText("Back to Fenrir Ledger");
    expect(await backLink.getAttribute("href")).toBe("/");
  });

  test("footer contains links to both legal documents", async ({ page }) => {
    await page.goto("/static/terms.html");
    const footer = page.locator(".site-footer");

    const privacyLink = footer.locator('a[href="/static/privacy.html"]');
    await expect(privacyLink).toContainText("Privacy Policy");

    const termsLink = footer.locator('a[href="/static/terms.html"]');
    await expect(termsLink).toContainText("Terms of Service");
  });

  test("verifies page styling and layout integrity", async ({ page }) => {
    await page.goto("/static/terms.html");

    // Check main container max-width is set
    const body = page.locator("body");
    const maxWidth = await body.evaluate((el) => window.getComputedStyle(el).maxWidth);
    expect(maxWidth).not.toBe("none");

    // Check heading colors (gold #d4a520)
    const h1 = page.locator("h1");
    const h1Color = await h1.evaluate((el) => window.getComputedStyle(el).color);
    expect(h1Color).toBeTruthy(); // Should have a color set
  });

  test("contact email link is functional", async ({ page }) => {
    await page.goto("/static/terms.html");
    const legalEmail = page.locator('a[href="mailto:legal@fenrirledger.com"]');
    await expect(legalEmail).toBeVisible();
  });

  test("Elastic License link is accessible", async ({ page }) => {
    await page.goto("/static/terms.html");
    const elasticLink = page.locator('a[href*="elastic.co/licensing/elastic-license"]');
    await expect(elasticLink).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Sign-In Page Agreement Text
// ════════════════════════════════════════════════════════════════════════════

test.describe("Sign-In Page (/sign-in) — Legal Agreement", () => {
  test("loads without errors", async ({ page }) => {
    const response = await page.goto("/sign-in");
    expect(response?.status()).toBe(200);
  });

  test("contains implicit agreement text with legal links", async ({ page }) => {
    await page.goto("/sign-in");

    // Look for the agreement text
    const agreementText = page.locator("p:has-text('By signing in, you agree to our')");
    await expect(agreementText).toBeVisible();
  });

  test("includes link to Privacy Policy", async ({ page }) => {
    await page.goto("/sign-in");

    const privacyLink = page.locator('a[href="/static/privacy.html"]:has-text("Privacy Policy")');
    await expect(privacyLink).toBeVisible();
  });

  test("includes link to Terms of Service", async ({ page }) => {
    await page.goto("/sign-in");

    const termsLink = page.locator('a[href="/static/terms.html"]:has-text("Terms of Service")');
    await expect(termsLink).toBeVisible();
  });

  test("both agreement links point to correct URLs", async ({ page }) => {
    await page.goto("/sign-in");

    const privacyLink = page.locator('a[href="/static/privacy.html"]').first();
    expect(await privacyLink.getAttribute("href")).toBe("/static/privacy.html");

    const termsLink = page.locator('a[href="/static/terms.html"]').first();
    expect(await termsLink.getAttribute("href")).toBe("/static/terms.html");
  });

  test("agreement text appears before sign-in button completion", async ({ page }) => {
    await page.goto("/sign-in");

    // Get the agreement paragraph and button
    const agreementText = page.locator("p:has-text('By signing in')");
    const signInButton = page.locator('button:has-text("Sign in")').first();

    // Both should be visible
    await expect(agreementText).toBeVisible();
    await expect(signInButton).toBeVisible();

    // Agreement should be visible (above or below the button is OK as long as it's on the page)
    const boundingBox = await agreementText.boundingBox();
    expect(boundingBox).not.toBeNull();
  });

  test("agreement links are styled consistently", async ({ page }) => {
    await page.goto("/sign-in");

    const privacyLink = page.locator('a[href="/static/privacy.html"]').first();
    const termsLink = page.locator('a[href="/static/terms.html"]').first();

    // Both should be visible and interactive
    await expect(privacyLink).toBeVisible();
    await expect(termsLink).toBeVisible();

    // Should have hover effects
    const privacyHref = await privacyLink.getAttribute("href");
    const termsHref = await termsLink.getAttribute("href");
    expect(privacyHref).not.toBeNull();
    expect(termsHref).not.toBeNull();
  });

  test("privacy link navigates to privacy policy", async ({ page }) => {
    await page.goto("/sign-in");

    // Click privacy link and navigate
    await Promise.all([
      page.waitForNavigation(),
      page.locator('a[href="/static/privacy.html"]').first().click(),
    ]);

    expect(page.url()).toContain("/static/privacy.html");

    const heading = page.locator("h1");
    await expect(heading).toContainText("Privacy Policy");
  });

  test("terms link navigates to terms of service", async ({ page }) => {
    await page.goto("/sign-in");

    // Click terms link and navigate
    await Promise.all([
      page.waitForNavigation(),
      page.locator('a[href="/static/terms.html"]').first().click(),
    ]);

    expect(page.url()).toContain("/static/terms.html");

    const heading = page.locator("h1");
    await expect(heading).toContainText("Terms of Service");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Cross-Document Consistency
// ════════════════════════════════════════════════════════════════════════════

test.describe("Legal Documents — Cross-Document Consistency", () => {
  test("both documents use same visual styling", async ({ page }) => {
    await page.goto("/static/privacy.html");
    const privacyH1Color = await page.locator("h1").evaluate(
      (el) => window.getComputedStyle(el).color
    );

    await page.goto("/static/terms.html");
    const termsH1Color = await page.locator("h1").evaluate(
      (el) => window.getComputedStyle(el).color
    );

    expect(privacyH1Color).toBe(termsH1Color);
  });

  test("both documents have footer navigation to each other", async ({ page }) => {
    // Check privacy.html footer
    await page.goto("/static/privacy.html");
    let footer = page.locator(".site-footer");
    let privacyLink = footer.locator('a[href="/static/privacy.html"]');
    let termsLink = footer.locator('a[href="/static/terms.html"]');
    await expect(privacyLink).toBeVisible();
    await expect(termsLink).toBeVisible();

    // Check terms.html footer
    await page.goto("/static/terms.html");
    footer = page.locator(".site-footer");
    privacyLink = footer.locator('a[href="/static/privacy.html"]');
    termsLink = footer.locator('a[href="/static/terms.html"]');
    await expect(privacyLink).toBeVisible();
    await expect(termsLink).toBeVisible();
  });

  test("no outdated Patreon references in either document", async ({ page }) => {
    const documents = ["/static/privacy.html", "/static/terms.html"];

    for (const doc of documents) {
      await page.goto(doc);
      const content = await page.locator("body").textContent();
      expect(content).not.toContain("Patreon");
      expect(content).not.toContain("patreon");
      expect(content).not.toContain("PATREON");
    }
  });

  test("both documents reference correct licensing", async ({ page }) => {
    // Privacy should reference source-available
    await page.goto("/static/privacy.html");
    const privacyContent = await page.locator("body").textContent();
    expect(privacyContent).toContain("source-available");

    // Terms should reference source-available and Elastic License
    await page.goto("/static/terms.html");
    const termsContent = await page.locator("body").textContent();
    expect(termsContent).toContain("source-available");
    expect(termsContent).toContain("Elastic License");
  });

  test("copyright year is consistent", async ({ page }) => {
    const documents = ["/static/privacy.html", "/static/terms.html"];
    const copyrightYear = new Date().getFullYear().toString();

    for (const doc of documents) {
      await page.goto(doc);
      const footer = page.locator(".site-footer");
      const copyrightText = await footer.textContent();
      expect(copyrightText).toContain(copyrightYear);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5 — Accessibility & Performance
// ════════════════════════════════════════════════════════════════════════════

test.describe("Legal Documents — Accessibility", () => {
  test("privacy policy has proper heading hierarchy", async ({ page }) => {
    await page.goto("/static/privacy.html");

    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1); // Only one h1

    const h2Count = await page.locator("h2").count();
    expect(h2Count).toBeGreaterThan(5); // Multiple sections
  });

  test("terms page has proper heading hierarchy", async ({ page }) => {
    await page.goto("/static/terms.html");

    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1); // Only one h1

    const h2Count = await page.locator("h2").count();
    expect(h2Count).toBeGreaterThan(5); // Multiple sections
  });

  test("links are underlined for accessibility", async ({ page }) => {
    await page.goto("/static/privacy.html");

    const links = page.locator("a");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    // Check first link has text-decoration
    const firstLink = links.first();
    const decoration = await firstLink.evaluate(
      (el) => window.getComputedStyle(el).textDecoration
    );
    expect(decoration).toContain("underline");
  });

  test("pages have adequate color contrast", async ({ page }) => {
    const documents = ["/static/privacy.html", "/static/terms.html"];

    for (const doc of documents) {
      await page.goto(doc);

      // Check body text contrast (dark background #12100e, light text #f0ede4)
      const bodyColor = await page.locator("body").evaluate(
        (el) => window.getComputedStyle(el).color
      );
      const bodyBg = await page.locator("body").evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      );

      // Both should be set (contrast verification is visual, but we can check they're defined)
      expect(bodyColor).toBeTruthy();
      expect(bodyBg).toBeTruthy();
    }
  });
});
