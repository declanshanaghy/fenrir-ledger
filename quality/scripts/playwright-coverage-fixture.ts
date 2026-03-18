/**
 * Playwright fixture that collects Istanbul coverage from the browser.
 *
 * After each test, reads window.__coverage__ from the page and merges it
 * into a cumulative coverage object. On teardown, writes the merged
 * coverage to quality/.coverage-tmp/browser-coverage.json.
 *
 * Import this in your Playwright test files or add to the global setup.
 *
 * Usage in playwright.config.ts:
 *   globalSetup: './quality/scripts/playwright-coverage-setup.ts',
 *   globalTeardown: './quality/scripts/playwright-coverage-teardown.ts',
 *
 * Or use the auto-fixture approach (recommended):
 *   In each test: await page.coverage... (handled automatically via afterEach)
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const COVERAGE_FILE = path.resolve(
  __dirname,
  "../../quality/.coverage-tmp/browser-coverage.json",
);

/**
 * Merge Istanbul coverage from page into the cumulative JSON file.
 * Call this after each page navigation or at the end of each test.
 */
export async function collectCoverage(
  page: import("@playwright/test").Page,
): Promise<void> {
  try {
    const coverage = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).__coverage__ ?? null;
    });

    if (!coverage) return;

    // Merge with existing coverage
    let merged = coverage;
    if (existsSync(COVERAGE_FILE)) {
      try {
        const existing = JSON.parse(readFileSync(COVERAGE_FILE, "utf-8"));
        // Simple merge: for each file, keep the one with more hits
        merged = { ...existing, ...coverage };
        for (const key of Object.keys(existing)) {
          if (coverage[key]) {
            // Both have this file — merge statement/branch/function counters
            const e = existing[key];
            const c = coverage[key];
            merged[key] = { ...c };
            // Merge statement counters (s)
            if (e.s && c.s) {
              merged[key].s = { ...c.s };
              for (const sid of Object.keys(e.s)) {
                merged[key].s[sid] = (merged[key].s[sid] || 0) + (e.s[sid] || 0);
              }
            }
            // Merge function counters (f)
            if (e.f && c.f) {
              merged[key].f = { ...c.f };
              for (const fid of Object.keys(e.f)) {
                merged[key].f[fid] = (merged[key].f[fid] || 0) + (e.f[fid] || 0);
              }
            }
            // Merge branch counters (b)
            if (e.b && c.b) {
              merged[key].b = { ...c.b };
              for (const bid of Object.keys(e.b)) {
                if (Array.isArray(e.b[bid]) && Array.isArray(c.b[bid])) {
                  merged[key].b[bid] = c.b[bid].map(
                    (v: number, i: number) => v + (e.b[bid][i] || 0),
                  );
                }
              }
            }
          }
        }
      } catch {
        // Corrupt file — start fresh
      }
    }

    mkdirSync(path.dirname(COVERAGE_FILE), { recursive: true });
    writeFileSync(COVERAGE_FILE, JSON.stringify(merged), "utf-8");
  } catch {
    // page might be closed — ignore
  }
}
