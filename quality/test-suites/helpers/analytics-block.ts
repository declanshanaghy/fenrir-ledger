import { test as base } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Extended Playwright test fixture that:
 * 1. Blocks Umami analytics requests — prevents E2E runs from polluting production analytics.
 * 2. Mocks /api/sync/** endpoints — prevents Firestore connection attempts in E2E.
 *
 * The sync mock returns a 200 with empty card data. This ensures that:
 * - Tests that run without real Firestore credentials never see "Connection closed." errors.
 * - Tests remain isolated from Firestore state even when running against production.
 * - The `useCloudSync` hook completes cleanly (no uncaught page errors).
 *
 * Issue #1189 — Firestore "Connection closed." error breaks auth callback tests in CI.
 */

/** Mock response body for POST /api/sync/push — empty merged result. */
const MOCK_SYNC_PUSH_BODY = JSON.stringify({ cards: [], syncedCount: 0 });

/** Mock response body for GET/POST /api/sync/pull — empty card list. */
const MOCK_SYNC_PULL_BODY = JSON.stringify({ cards: [] });

export const test = base.extend({
  page: async ({ page }, use) => {
    // Block analytics — prevents polluting production Umami data.
    await page.route("**/analytics.fenrirledger.com/**", (route) =>
      route.abort(),
    );

    // Mock sync API — prevents real Firestore calls in E2E tests.
    // Returns 200 with empty data so the hook completes cleanly.
    await page.route("**/api/sync/push", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: MOCK_SYNC_PUSH_BODY,
      }),
    );

    await page.route("**/api/sync/pull", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: MOCK_SYNC_PULL_BODY,
      }),
    );

    // Catch-all for any other sync sub-routes (e.g. /api/sync itself)
    await page.route("**/api/sync", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: MOCK_SYNC_PULL_BODY,
      }),
    );

    await use(page);

    // Collect Istanbul coverage from browser after each test.
    // swc-plugin-coverage-instrument injects __coverage__ at build time.
    try {
      const coverage = await page.evaluate(
        () => (window as unknown as { __coverage__?: Record<string, unknown> }).__coverage__ ?? null,
      );
      if (coverage) {
        const coverageDir = path.resolve(__dirname, "../../../quality/.coverage-tmp");
        const coverageFile = path.join(coverageDir, "browser-coverage.json");
        mkdirSync(coverageDir, { recursive: true });

        let merged: Record<string, unknown> = coverage;
        if (existsSync(coverageFile)) {
          try {
            const existing = JSON.parse(readFileSync(coverageFile, "utf-8"));
            merged = { ...existing, ...coverage };
          } catch { /* corrupt — overwrite */ }
        }
        writeFileSync(coverageFile, JSON.stringify(merged), "utf-8");
      }
    } catch { /* page closed — skip */ }
  },
});

export { expect } from "@playwright/test";
