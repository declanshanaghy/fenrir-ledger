import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Karl upsell dialogs test suite
 * Issue #488: Unify Karl upsell dialogs across Valhalla, The Hunt, and The Howl
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:9653",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "cd /workspace/development/frontend && npm run dev",
    url: "http://localhost:9653",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
