import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:3000/api/health/live",
    reuseExistingServer: true,
  },
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["iPhone SE"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], browserName: "chromium" } },
  ],
});
