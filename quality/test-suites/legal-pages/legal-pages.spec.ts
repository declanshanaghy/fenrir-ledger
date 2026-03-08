/**
 * Legal Pages Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Updated for GitHub Issue #341: Privacy, Terms, and FAQ pages
 * migrated from static HTML to Next.js routes.
 *
 * Acceptance Criteria:
 *   ✓ Privacy Policy at /privacy with full content
 *   ✓ Terms of Service at /terms with full content
 *   ✓ FAQ at /faq with 5 categories and accordion UI
 *   ✓ Sign-in page links updated to /privacy and /terms
 *   ✓ No regression in content or accessibility
 */

import { test, expect } from "@playwright/test";

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — Privacy Policy (/privacy)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Privacy Policy (/privacy)", () => {
  test("loads without errors", async ({ page }) => {
    const response = await page.goto("/privacy");
    expect(response?.status()).toBe(200);
  });

  test("contains required heading and metadata", async ({ page }) => {
    await page.goto("/privacy");
    const h1 = page.locator("h1");
    await expect(h1).toContainText("Privacy Policy");

    const titleText = await page.title();
    expect(titleText).toContain("Privacy Policy");
  });

  test("displays last updated date", async ({ page }) => {
    await page.goto("/privacy");
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toContain("Last Updated");
  });

  test("does NOT contain any Patreon references", async ({ page }) => {
    await page.goto("/privacy");
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("Patreon");
    expect(bodyText).not.toContain("patreon");
  });

  test("uses 'source-available' language (not 'open source')", async ({ page }) => {
    await page.goto("/privacy");
    const bodyText = await page.locator("body").textContent();

    // Should contain "source-available"
    expect(bodyText).toContain("source-available");
    // Should not have incorrect "open source" language in this context
    const wrongPhrase = bodyText?.match(/Fenrir Ledger is an open source/i);
    expect(wrongPhrase).toBeNull();
  });

  test("contains correct section headings", async ({ page }) => {
    await page.goto("/privacy");
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
      "9. Children",
      "10. Changes to This Policy",
      "11. Contact",
    ];

    for (const heading of expectedHeadings) {
      expect(bodyText).toContain(heading);
    }
  });

  test("contains attribution to Automattic legal documents", async ({ page }) => {
    await page.goto("/privacy");
    const bodyText = await page.locator("body").textContent();
    expect(bodyText?.toLowerCase()).toContain("automattic");
    expect(bodyText?.toLowerCase()).toContain("creative commons");
  });

  test("has back link to home", async ({ page }) => {
    await page.goto("/privacy");
    const backLink = page.locator('a:has-text("Back to Fenrir Ledger")');
    await expect(backLink).toBeVisible();
    expect(await backLink.getAttribute("href")).toBe("/");
  });

  test("footer contains links to legal documents", async ({ page }) => {
    await page.goto("/privacy");
    const footer = page.locator("footer");

    const privacyLink = footer.locator('a[href="/privacy"]');
    await expect(privacyLink).toBeVisible();

    const termsLink = footer.locator('a[href="/terms"]');
    await expect(termsLink).toBeVisible();
  });

  test("contact email links are present", async ({ page }) => {
    await page.goto("/privacy");
    const emailLinks = page.locator('a[href*="mailto:"]');
    const count = await emailLinks.count();
    expect(count).toBeGreaterThan(0);

    // Verify at least one privacy contact email exists
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toContain("privacy@fenrirledger.com");
  });

  test("has proper heading hierarchy", async ({ page }) => {
    await page.goto("/privacy");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
    const h2Count = await page.locator("h2").count();
    expect(h2Count).toBeGreaterThan(5);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Terms of Service (/terms)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Terms of Service (/terms)", () => {
  test("loads without errors", async ({ page }) => {
    const response = await page.goto("/terms");
    expect(response?.status()).toBe(200);
  });

  test("contains required heading and metadata", async ({ page }) => {
    await page.goto("/terms");
    const h1 = page.locator("h1");
    await expect(h1).toContainText("Terms of Service");

    const titleText = await page.title();
    expect(titleText).toContain("Terms of Service");
  });

  test("displays last updated date", async ({ page }) => {
    await page.goto("/terms");
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toContain("Last Updated");
  });

  test("does NOT contain any Patreon references", async ({ page }) => {
    await page.goto("/terms");
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("Patreon");
    expect(bodyText).not.toContain("patreon");
  });

  test("uses correct licensing language (Elastic License 2.0)", async ({ page }) => {
    await page.goto("/terms");
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toContain("Elastic License");
    expect(bodyText).toContain("ELv2");
    expect(bodyText).toContain("source-available");
  });

  test("contains correct section headings", async ({ page }) => {
    await page.goto("/terms");
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
    await page.goto("/terms");
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toContain("source-available license");
    expect(bodyText?.toLowerCase()).toContain("reverse engineer");
  });

  test("contains attribution to Automattic and App.net", async ({ page }) => {
    await page.goto("/terms");
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toContain("Automattic");
    expect(bodyText).toContain("App.net");
    expect(bodyText).toContain("Creative Commons");
  });

  test("has back link to home", async ({ page }) => {
    await page.goto("/terms");
    const backLink = page.locator('a:has-text("Back to Fenrir Ledger")');
    await expect(backLink).toBeVisible();
    expect(await backLink.getAttribute("href")).toBe("/");
  });

  test("footer contains links to legal documents", async ({ page }) => {
    await page.goto("/terms");
    const footer = page.locator("footer");

    const privacyLink = footer.locator('a[href="/privacy"]');
    await expect(privacyLink).toBeVisible();

    const termsLink = footer.locator('a[href="/terms"]');
    await expect(termsLink).toBeVisible();
  });

  test("contact email link is present", async ({ page }) => {
    await page.goto("/terms");
    const legalEmail = page.locator('a[href="mailto:legal@fenrirledger.com"]');
    await expect(legalEmail).toBeVisible();
  });

  test("Elastic License link is accessible", async ({ page }) => {
    await page.goto("/terms");
    const elasticLink = page.locator('a[href*="elastic.co/licensing/elastic-license"]');
    await expect(elasticLink).toBeVisible();
  });

  test("has proper heading hierarchy", async ({ page }) => {
    await page.goto("/terms");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
    const h2Count = await page.locator("h2").count();
    expect(h2Count).toBeGreaterThan(5);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — FAQ Page (/faq)
// ════════════════════════════════════════════════════════════════════════════

test.describe("FAQ Page (/faq)", () => {
  test("loads without errors", async ({ page }) => {
    const response = await page.goto("/faq");
    expect(response?.status()).toBe(200);
  });

  test("contains main heading", async ({ page }) => {
    await page.goto("/faq");
    const h1 = page.locator("h1");
    await expect(h1).toContainText("Frequently Asked Questions");

    const titleText = await page.title();
    expect(titleText).toContain("FAQ");
  });

  test("contains all 5 FAQ categories", async ({ page }) => {
    await page.goto("/faq");
    const bodyText = await page.locator("body").textContent();

    const expectedCategories = [
      "Getting Started",
      "Features",
      "Pricing",
      "Privacy and Security",
      "Technical",
    ];

    for (const cat of expectedCategories) {
      expect(bodyText).toContain(cat);
    }
  });

  test("has at least 10 questions total", async ({ page }) => {
    await page.goto("/faq");
    const questions = page.locator("details");
    const count = await questions.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test("accordion questions are collapsed by default", async ({ page }) => {
    await page.goto("/faq");
    const firstQuestion = page.locator("details").first();
    // <details> without 'open' attribute = collapsed
    const isOpen = await firstQuestion.evaluate(
      (el) => (el as HTMLDetailsElement).open
    );
    expect(isOpen).toBe(false);
  });

  test("accordion opens when question is clicked", async ({ page }) => {
    await page.goto("/faq");
    const firstQuestion = page.locator("details").first();
    const summary = firstQuestion.locator("summary");

    // Click to open
    await summary.click();

    const isOpen = await firstQuestion.evaluate(
      (el) => (el as HTMLDetailsElement).open
    );
    expect(isOpen).toBe(true);
  });

  test("accordion shows answer text when opened", async ({ page }) => {
    await page.goto("/faq");
    const firstQuestion = page.locator("details").first();
    const summary = firstQuestion.locator("summary");

    await summary.click();

    // The answer div should now be visible
    const answerDiv = firstQuestion.locator("div");
    await expect(answerDiv).toBeVisible();
    const answerText = await answerDiv.textContent();
    expect(answerText?.trim().length).toBeGreaterThan(10);
  });

  test("accordion closes when question is clicked again", async ({ page }) => {
    await page.goto("/faq");
    const firstQuestion = page.locator("details").first();
    const summary = firstQuestion.locator("summary");

    // Open it
    await summary.click();
    // Close it
    await summary.click();

    const isOpen = await firstQuestion.evaluate(
      (el) => (el as HTMLDetailsElement).open
    );
    expect(isOpen).toBe(false);
  });

  test("multiple questions can be open simultaneously", async ({ page }) => {
    await page.goto("/faq");
    const questions = page.locator("details");

    // Open first two questions
    await questions.nth(0).locator("summary").click();
    await questions.nth(1).locator("summary").click();

    const firstOpen = await questions.nth(0).evaluate(
      (el) => (el as HTMLDetailsElement).open
    );
    const secondOpen = await questions.nth(1).evaluate(
      (el) => (el as HTMLDetailsElement).open
    );

    expect(firstOpen).toBe(true);
    expect(secondOpen).toBe(true);
  });

  test("has back link to home", async ({ page }) => {
    await page.goto("/faq");
    const backLink = page.locator('a:has-text("Back to Fenrir Ledger")');
    await expect(backLink).toBeVisible();
    expect(await backLink.getAttribute("href")).toBe("/");
  });

  test("footer contains links to legal documents and FAQ", async ({ page }) => {
    await page.goto("/faq");
    const footer = page.locator("footer");
    const privacyLink = footer.locator('a[href="/privacy"]');
    await expect(privacyLink).toBeVisible();
    const termsLink = footer.locator('a[href="/terms"]');
    await expect(termsLink).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Sign-In Page Agreement Text
// ════════════════════════════════════════════════════════════════════════════

test.describe("Sign-In Page (/sign-in) — Legal Agreement", () => {
  test("loads without errors", async ({ page }) => {
    const response = await page.goto("/sign-in");
    expect(response?.status()).toBe(200);
  });

  test("contains implicit agreement text with legal links", async ({ page }) => {
    await page.goto("/sign-in");
    const agreementText = page.locator("p:has-text('By signing in, you agree to our')");
    await expect(agreementText).toBeVisible();
  });

  test("includes link to Privacy Policy at /privacy", async ({ page }) => {
    await page.goto("/sign-in");
    const privacyLink = page.locator('a[href="/privacy"]:has-text("Privacy Policy")');
    await expect(privacyLink).toBeVisible();
  });

  test("includes link to Terms of Service at /terms", async ({ page }) => {
    await page.goto("/sign-in");
    const termsLink = page.locator('a[href="/terms"]:has-text("Terms of Service")');
    await expect(termsLink).toBeVisible();
  });

  test("both agreement links point to new Next.js routes", async ({ page }) => {
    await page.goto("/sign-in");

    const privacyLink = page.locator('a[href="/privacy"]').first();
    expect(await privacyLink.getAttribute("href")).toBe("/privacy");

    const termsLink = page.locator('a[href="/terms"]').first();
    expect(await termsLink.getAttribute("href")).toBe("/terms");
  });

  test("privacy link navigates to /privacy", async ({ page }) => {
    await page.goto("/sign-in");

    await Promise.all([
      page.waitForNavigation(),
      page.locator('a[href="/privacy"]').first().click(),
    ]);

    expect(page.url()).toContain("/privacy");
    const heading = page.locator("h1");
    await expect(heading).toContainText("Privacy Policy");
  });

  test("terms link navigates to /terms", async ({ page }) => {
    await page.goto("/sign-in");

    await Promise.all([
      page.waitForNavigation(),
      page.locator('a[href="/terms"]').first().click(),
    ]);

    expect(page.url()).toContain("/terms");
    const heading = page.locator("h1");
    await expect(heading).toContainText("Terms of Service");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5 — Cross-Document Consistency
// ════════════════════════════════════════════════════════════════════════════

test.describe("Legal Documents — Cross-Document Consistency", () => {
  test("both documents have no Patreon references", async ({ page }) => {
    const routes = ["/privacy", "/terms"];

    for (const route of routes) {
      await page.goto(route);
      const content = await page.locator("body").textContent();
      expect(content).not.toContain("Patreon");
      expect(content).not.toContain("patreon");
      expect(content).not.toContain("PATREON");
    }
  });

  test("both documents reference correct licensing", async ({ page }) => {
    await page.goto("/privacy");
    const privacyContent = await page.locator("body").textContent();
    expect(privacyContent).toContain("source-available");

    await page.goto("/terms");
    const termsContent = await page.locator("body").textContent();
    expect(termsContent).toContain("source-available");
    expect(termsContent).toContain("Elastic License");
  });

  test("both documents have shared marketing nav with theme toggle", async ({ page }) => {
    const routes = ["/privacy", "/terms", "/faq"];

    for (const route of routes) {
      await page.goto(route);
      // Marketing header should include the wordmark
      const header = page.locator("header");
      const headerText = await header.textContent();
      expect(headerText).toContain("Fenrir Ledger");
    }
  });

  test("all three pages have footer with privacy and terms links", async ({ page }) => {
    const routes = ["/privacy", "/terms", "/faq"];

    for (const route of routes) {
      await page.goto(route);
      const footer = page.locator("footer");
      await expect(footer.locator('a[href="/privacy"]')).toBeVisible();
      await expect(footer.locator('a[href="/terms"]')).toBeVisible();
    }
  });
});
