import { test as base } from "@playwright/test";

/**
 * Extended Playwright test fixture that blocks Umami analytics requests.
 * Import { test, expect } from this module instead of "@playwright/test"
 * to prevent E2E runs from polluting production analytics data.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("**/analytics.fenrirledger.com/**", (route) =>
      route.abort(),
    );
    await use(page);
  },
});

export { expect } from "@playwright/test";
