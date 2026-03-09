import { test, expect } from "@playwright/test";

/**
 * QA Test Suite: Issue #417 — Remove AI-built copy
 *
 * Validates:
 * - All explicit AI/LLM/Claude references removed
 * - Agent profiles and team section preserved
 * - Norse voice and mystical framing intact
 * - No layout regressions
 */

test.describe("Issue #417 — Remove explicit AI copy", () => {
  test("About page: no AI-built references remain", async ({ page }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");

    const pageContent = await page.innerText("body");

    // Check that AI-related terms are NOT present
    expect(pageContent, "About page should not contain 'built by AI'").not.toMatch(
      /built by AI|AI agents|built entirely by AI|AI-built|no human wrote/i
    );
  });

  test("About page: agent names still present", async ({ page }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");

    // Check for agent names
    await expect(page.locator("text=/Odin|Product Owner/i").first()).toBeVisible();
    await expect(page.locator("text=/Freya/i").first()).toBeVisible();
    await expect(page.locator("text=/Loki/i").first()).toBeVisible();
    await expect(page.locator("text=/FiremanDecko|Principal Engineer/i").first()).toBeVisible();
  });

  test("About page: Norse mythology terms present", async ({ page }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");

    const pageContent = await page.innerText("body");

    // Verify Norse mythology terms are present
    expect(pageContent).toContain("Gleipnir");
    expect(pageContent).toMatch(/ASGARD|Asgard|Ragnarok/i);
    expect(pageContent).toContain("Fenrir");
    expect(pageContent).toMatch(/Odin|Loki|Freya/);
  });

  test("About page: The Forge section renamed from 'Built by AI'", async ({
    page,
  }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");

    const pageContent = await page.innerText("body");

    // New title should be present (may be in all caps or different formatting)
    expect(pageContent).toMatch(/FORGED IN THE FIRES|Forged in the Fires/i);

    // Old title should NOT be present
    expect(pageContent).not.toContain("Built by AI, for Humans");
  });

  test("About page: Freya bio updated (no AI import pipeline)", async ({
    page,
  }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");

    const pageContent = await page.innerText("body");

    // Old text should be gone
    expect(pageContent).not.toContain("AI import pipeline");

    // But import pipeline (without AI) should exist
    expect(pageContent).toContain("import pipeline");

    // Profile should still exist
    expect(pageContent).toContain("Freya");
    expect(pageContent).toContain("Product Owner");
  });

  test("About page: agent autonomy text mentions 'member of the pack' not AI", async ({
    page,
  }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");

    const pageContent = await page.innerText("body");

    // New text should be present
    expect(pageContent).toContain("Each member of the pack has autonomy");

    // Old subtitle should be gone
    expect(pageContent).not.toContain("built entirely by AI agents");
  });

  test("About page: closing statement uses Norse theme not AI theme", async ({
    page,
  }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");

    const pageContent = await page.innerText("body");

    // New Norse-themed closing
    expect(pageContent).toContain("The forge never cools");
    expect(pageContent).toContain("Bugs slain before");

    // Old statements should be gone
    expect(pageContent).not.toContain("This changes everything");
    expect(pageContent).not.toContain("Development velocity unconstrained");
  });

  test("About page: Agents section subtitle updated", async ({ page }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");

    const pageContent = await page.innerText("body");

    // New subtitle about the pack
    expect(pageContent).toContain(
      "Every member of the pack has their domain, their purpose, their saga"
    );

    // Old subtitle about AI agents should be gone
    expect(pageContent).not.toContain("Fenrir Ledger is built entirely by AI agents");
  });

  test("Features page: Smart Import no longer called AI-Powered", async ({
    page,
  }) => {
    await page.goto("/features");
    await page.waitForLoadState("networkidle");

    const pageContent = await page.innerText("body");

    // Old text should be gone
    expect(pageContent).not.toContain("AI-Powered");
    expect(pageContent).not.toContain("AI-powered extraction");

    // But Smart Import should still exist
    expect(pageContent).toContain("Smart Import");
  });

  test("Features page: Smart Import description updated without AI reference", async ({
    page,
  }) => {
    await page.goto("/features");
    await page.waitForLoadState("networkidle");

    const pageContent = await page.innerText("body");

    // Old AI-specific language
    expect(pageContent).not.toContain("Fenrir's AI extracts");
    expect(pageContent).not.toContain("Smart Import uses AI to read");

    // But feature still exists and works
    expect(pageContent).toMatch(/Smart Import|spreadsheet|CSV|XLSX/);
  });

  test("Pricing page: Smart Import comparison uses 'automatic' not 'AI-powered'", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");

    const pageContent = await page.innerText("body");

    // Old phrasing
    expect(pageContent).not.toContain("AI-powered extraction from spreadsheets");

    // New phrasing
    expect(pageContent).toContain("automatic extraction from spreadsheets");
  });

  test("About page: Anthropic Claude not in tech stack", async ({ page }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");

    const pageContent = await page.innerText("body");

    // Should not mention Claude as a tool
    expect(pageContent).not.toContain("Anthropic Claude");
  });

  test("All marketing pages load without major console errors", async ({
    page,
  }) => {
    const pagePaths = ["/about", "/features", "/pricing"];

    for (const path of pagePaths) {
      let consoleErrors: string[] = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // Filter out expected error patterns (sourcemap errors, etc.)
      const relevantErrors = consoleErrors.filter(
        (err) =>
          !err.includes("sourcemap") &&
          !err.includes("Failed to load resource") &&
          !err.includes("404")
      );

      expect(
        relevantErrors,
        `${path} should not have significant console errors`
      ).toEqual([]);
    }
  });

  test("Marketing pages have consistent layout", async ({ page }) => {
    const pagePaths = ["/about", "/features", "/pricing"];

    for (const path of pagePaths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // Check for nav bar
      const navbar = page.locator("nav");
      await expect(navbar.first()).toBeVisible();

      // Check for footer
      const footer = page.locator("footer");
      await expect(footer).toBeVisible();

      // Check for main content area
      const main = page.locator("main");
      await expect(main).toBeVisible();
    }
  });
});
