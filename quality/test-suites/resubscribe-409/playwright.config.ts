import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["html", { outputFolder: "../../reports/resubscribe-409" }],
    ["junit", { outputFile: "../../reports/resubscribe-409/junit.xml" }],
    ["list"],
  ],
  use: {
    baseURL: process.env.APP_BASE_URL || "http://localhost:9653",
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
    command: "npm run dev",
    url: "http://localhost:9653",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
